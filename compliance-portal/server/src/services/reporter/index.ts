import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import db from '../../db/index.js';
import {
  getScan,
  getCampaign,
  getResultsByScan,
  getIssuesByResult,
} from '../../db/queries.js';
import type {
  Scan,
  ScanResult,
  ScanIssue,
  ScanSummary,
  Campaign,
  CampaignSite,
  AuditCategory,
} from '@compliance-portal/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_DIR = path.join(__dirname, '../../../../data/reports');

const COLORS = {
  blue: '#2563eb',
  darkBlue: '#1e40af',
  lightBlue: '#dbeafe',
  black: '#111827',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  white: '#ffffff',
  critical: '#dc2626',
  serious: '#ea580c',
  moderate: '#ca8a04',
  minor: '#2563eb',
  pass: '#16a34a',
  fail: '#dc2626',
} as const;

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 612; // US Letter
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportOptions {
  scanId: string;
  includeDetails?: boolean;
}

export interface Report {
  id: string;
  scanId: string;
  filePath: string;
  createdAt: string;
}

interface SiteData {
  site: CampaignSite;
  results: ScanResult[];
  issues: ScanIssue[];
}

// ---------------------------------------------------------------------------
// Database init — reports table
// ---------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    scan_id TEXT NOT NULL REFERENCES scans(id),
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const insertReportStmt = db.prepare(
  `INSERT INTO reports (id, scan_id, file_path) VALUES (@id, @scan_id, @file_path)`
);
const getReportStmt = db.prepare(`SELECT * FROM reports WHERE id = ?`);
const listReportsStmt = db.prepare(
  `SELECT * FROM reports WHERE scan_id = ? ORDER BY created_at DESC`
);

// ---------------------------------------------------------------------------
// PDF Helpers
// ---------------------------------------------------------------------------

function addPageFooter(doc: InstanceType<typeof PDFDocument>, pageNum: number) {
  doc.save();
  doc
    .fontSize(8)
    .fillColor(COLORS.gray)
    .text(`Page ${pageNum}`, PAGE_MARGIN, 750, {
      width: CONTENT_WIDTH,
      align: 'center',
    });
  doc.restore();
}

function addPageHeader(doc: InstanceType<typeof PDFDocument>, title: string) {
  doc
    .rect(0, 0, PAGE_WIDTH, 40)
    .fill(COLORS.blue);
  doc
    .fontSize(10)
    .fillColor(COLORS.white)
    .text('WCAG Compliance Portal', PAGE_MARGIN, 14, { width: CONTENT_WIDTH });
  doc
    .fontSize(10)
    .fillColor(COLORS.white)
    .text(title, PAGE_MARGIN, 14, { width: CONTENT_WIDTH, align: 'right' });
}

function drawHorizontalRule(doc: InstanceType<typeof PDFDocument>, y: number) {
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(PAGE_WIDTH - PAGE_MARGIN, y)
    .strokeColor(COLORS.lightGray)
    .lineWidth(1)
    .stroke();
}

function severityColor(severity: string): string {
  return COLORS[severity as keyof typeof COLORS] ?? COLORS.gray;
}

function ensureSpace(currentY: number, needed: number): boolean {
  return currentY + needed > 720;
}

// ---------------------------------------------------------------------------
// PDF Sections
// ---------------------------------------------------------------------------

function renderCoverPage(
  doc: InstanceType<typeof PDFDocument>,
  campaign: Campaign & { sites: CampaignSite[] },
  scan: Scan,
  pageNum: number
) {
  // Background accent
  doc.rect(0, 0, PAGE_WIDTH, 300).fill(COLORS.blue);

  doc
    .fontSize(14)
    .fillColor(COLORS.lightBlue)
    .text('WCAG COMPLIANCE PORTAL', PAGE_MARGIN, 100, {
      width: CONTENT_WIDTH,
      align: 'center',
    });

  doc
    .fontSize(32)
    .fillColor(COLORS.white)
    .text('Compliance Report', PAGE_MARGIN, 135, {
      width: CONTENT_WIDTH,
      align: 'center',
    });

  doc
    .fontSize(14)
    .fillColor(COLORS.lightBlue)
    .text(campaign.name, PAGE_MARGIN, 185, {
      width: CONTENT_WIDTH,
      align: 'center',
    });

  // Info block below the banner
  const infoY = 340;
  doc.fillColor(COLORS.black);

  const pairs: [string, string][] = [
    ['Compliance Level', `WCAG 2.1 Level ${campaign.complianceLevel}`],
    ['Date of Scan', scan.completedAt ?? scan.startedAt ?? 'N/A'],
    ['Sites Scanned', String(campaign.sites.length)],
    ['Scan Status', scan.status.toUpperCase()],
    ['Categories', campaign.categories.join(', ')],
  ];

  pairs.forEach(([label, value], i) => {
    const rowY = infoY + i * 32;
    doc.fontSize(10).fillColor(COLORS.gray).text(label, PAGE_MARGIN, rowY);
    doc.fontSize(12).fillColor(COLORS.black).text(value, PAGE_MARGIN + 200, rowY);
  });

  addPageFooter(doc, pageNum);
}

function renderExecutiveSummary(
  doc: InstanceType<typeof PDFDocument>,
  campaign: Campaign & { sites: CampaignSite[] },
  scan: Scan,
  summary: ScanSummary,
  siteDataList: SiteData[],
  pageNum: number
): number {
  addPageHeader(doc, 'Executive Summary');

  let y = 60;

  doc.fontSize(20).fillColor(COLORS.darkBlue).text('Executive Summary', PAGE_MARGIN, y);
  y += 40;

  // Overall score (big number)
  const avgScore =
    Object.values(summary.scores).filter((s) => s > 0).length > 0
      ? Object.values(summary.scores).filter((s) => s > 0).reduce((a, b) => a + b, 0) /
        Object.values(summary.scores).filter((s) => s > 0).length
      : 0;
  const scoreStr = Math.round(avgScore).toString();
  const verdict = avgScore >= 80 ? 'PASS' : 'FAIL';
  const verdictColor = avgScore >= 80 ? COLORS.pass : COLORS.fail;

  doc
    .fontSize(64)
    .fillColor(COLORS.blue)
    .text(scoreStr, PAGE_MARGIN, y, { continued: false });
  doc
    .fontSize(14)
    .fillColor(COLORS.gray)
    .text('/ 100  Overall Score', PAGE_MARGIN + 90, y + 40);
  doc
    .fontSize(18)
    .fillColor(verdictColor)
    .text(verdict, PAGE_MARGIN + 260, y + 10);
  y += 100;

  drawHorizontalRule(doc, y);
  y += 15;

  // Category scores — bar chart style
  doc.fontSize(14).fillColor(COLORS.darkBlue).text('Category Scores', PAGE_MARGIN, y);
  y += 25;

  const categories: AuditCategory[] = ['accessibility'];
  for (const cat of categories) {
    const score = summary.scores[cat] ?? 0;
    if (score === 0 && !campaign.categories.includes(cat)) continue;

    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    doc.fontSize(10).fillColor(COLORS.black).text(label, PAGE_MARGIN, y);
    doc.fontSize(10).fillColor(COLORS.gray).text(`${Math.round(score)}`, PAGE_MARGIN + 430, y);

    // Bar background
    const barX = PAGE_MARGIN + 100;
    const barW = 320;
    doc.rect(barX, y + 2, barW, 12).fill(COLORS.lightGray);
    // Bar fill
    const fillW = (score / 100) * barW;
    const barColor = score >= 80 ? COLORS.pass : score >= 50 ? COLORS.moderate : COLORS.fail;
    doc.rect(barX, y + 2, fillW, 12).fill(barColor);
    y += 28;
  }

  y += 10;
  drawHorizontalRule(doc, y);
  y += 15;

  // Issue summary counts
  doc.fontSize(14).fillColor(COLORS.darkBlue).text('Issue Summary', PAGE_MARGIN, y);
  y += 25;

  const issueCounts: [string, number, string][] = [
    ['Critical', summary.criticalCount, COLORS.critical],
    ['Serious', summary.seriousCount, COLORS.serious],
    ['Moderate', summary.moderateCount, COLORS.moderate],
    ['Minor', summary.minorCount, COLORS.minor],
  ];

  const boxW = (CONTENT_WIDTH - 30) / 4;
  issueCounts.forEach(([label, count, color], i) => {
    const bx = PAGE_MARGIN + i * (boxW + 10);
    doc.rect(bx, y, boxW, 50).fill(COLORS.lightGray);
    doc.rect(bx, y, 4, 50).fill(color);
    doc
      .fontSize(20)
      .fillColor(COLORS.black)
      .text(String(count), bx + 14, y + 8, { width: boxW - 20 });
    doc
      .fontSize(9)
      .fillColor(COLORS.gray)
      .text(label, bx + 14, y + 32, { width: boxW - 20 });
  });
  y += 70;

  // Sites scanned list
  doc.fontSize(14).fillColor(COLORS.darkBlue).text('Sites Scanned', PAGE_MARGIN, y);
  y += 22;

  for (const sd of siteDataList) {
    if (ensureSpace(y, 35)) {
      addPageFooter(doc, pageNum);
      doc.addPage();
      pageNum++;
      addPageHeader(doc, 'Executive Summary');
      y = 60;
    }
    doc
      .fontSize(10)
      .fillColor(COLORS.black)
      .text(`• ${sd.site.label || sd.site.url}`, PAGE_MARGIN + 10, y);
    doc
      .fontSize(9)
      .fillColor(COLORS.gray)
      .text(sd.site.url, PAGE_MARGIN + 20, y + 13);
    y += 30;
  }

  addPageFooter(doc, pageNum);
  return pageNum;
}

function renderSiteResults(
  doc: InstanceType<typeof PDFDocument>,
  siteDataList: SiteData[],
  startPage: number
): number {
  if (siteDataList.length === 0) return startPage;

  let pageNum = startPage;

  for (const sd of siteDataList) {
    doc.addPage();
    pageNum++;
    addPageHeader(doc, 'Site Results');

    let y = 60;

    // Site heading
    doc.fontSize(16).fillColor(COLORS.darkBlue).text(sd.site.label || 'Site', PAGE_MARGIN, y);
    y += 22;
    doc.fontSize(10).fillColor(COLORS.gray).text(sd.site.url, PAGE_MARGIN, y);
    y += 25;

    drawHorizontalRule(doc, y);
    y += 15;

    // Aggregate per-site scores
    const catScores: Partial<Record<AuditCategory, number>> = {};
    let pagesScanned = 0;
    const pageUrls = new Set<string>();
    for (const r of sd.results) {
      catScores[r.category] = r.score;
      pageUrls.add(r.pageUrl);
    }
    pagesScanned = pageUrls.size;

    const siteAvg =
      Object.values(catScores).length > 0
        ? Object.values(catScores).reduce((a, b) => a + b, 0) / Object.values(catScores).length
        : 0;

    doc.fontSize(12).fillColor(COLORS.black).text(`Overall Score: `, PAGE_MARGIN, y, { continued: true });
    doc.fillColor(siteAvg >= 80 ? COLORS.pass : COLORS.fail).text(`${Math.round(siteAvg)}/100`);
    y += 20;
    doc.fontSize(10).fillColor(COLORS.gray).text(`Pages scanned: ${pagesScanned}`, PAGE_MARGIN, y);
    y += 25;

    // Category breakdown
    doc.fontSize(12).fillColor(COLORS.darkBlue).text('Category Breakdown', PAGE_MARGIN, y);
    y += 20;

    for (const [cat, score] of Object.entries(catScores)) {
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      doc.fontSize(10).fillColor(COLORS.black).text(`${label}:`, PAGE_MARGIN + 10, y, { continued: true });
      doc.fillColor(score >= 80 ? COLORS.pass : score >= 50 ? COLORS.moderate : COLORS.fail).text(` ${Math.round(score)}/100`);
      y += 18;
    }
    y += 15;

    drawHorizontalRule(doc, y);
    y += 15;

    // Top critical/serious issues (up to 5)
    const topIssues = sd.issues
      .filter((i) => i.severity === 'critical' || i.severity === 'serious')
      .slice(0, 5);

    if (topIssues.length > 0) {
      doc.fontSize(12).fillColor(COLORS.darkBlue).text('Top Issues', PAGE_MARGIN, y);
      y += 20;

      for (const issue of topIssues) {
        if (ensureSpace(y, 60)) {
          addPageFooter(doc, pageNum);
          doc.addPage();
          pageNum++;
          addPageHeader(doc, 'Site Results');
          y = 60;
        }

        // Severity badge
        const badgeColor = severityColor(issue.severity);
        doc.rect(PAGE_MARGIN, y, 60, 16).fill(badgeColor);
        doc
          .fontSize(8)
          .fillColor(COLORS.white)
          .text(issue.severity.toUpperCase(), PAGE_MARGIN + 4, y + 4, { width: 52 });

        // WCAG criterion
        if (issue.wcagCriterion) {
          doc
            .fontSize(9)
            .fillColor(COLORS.gray)
            .text(`WCAG ${issue.wcagCriterion} (Level ${issue.wcagLevel})`, PAGE_MARGIN + 70, y + 3);
        }
        y += 20;

        doc.fontSize(10).fillColor(COLORS.black).text(issue.description, PAGE_MARGIN + 10, y, {
          width: CONTENT_WIDTH - 10,
        });
        y += doc.heightOfString(issue.description, { width: CONTENT_WIDTH - 10 }) + 10;
      }
    } else {
      doc.fontSize(10).fillColor(COLORS.pass).text('No critical or serious issues found.', PAGE_MARGIN, y);
    }

    addPageFooter(doc, pageNum);
  }

  return pageNum;
}

function renderDetailedFindings(
  doc: InstanceType<typeof PDFDocument>,
  siteDataList: SiteData[],
  startPage: number
): number {
  if (siteDataList.length === 0) return startPage;

  let pageNum = startPage;

  doc.addPage();
  pageNum++;
  addPageHeader(doc, 'Detailed Findings');

  let y = 60;
  doc.fontSize(20).fillColor(COLORS.darkBlue).text('Detailed Findings', PAGE_MARGIN, y);
  y += 35;

  for (const sd of siteDataList) {
    if (ensureSpace(y, 40)) {
      addPageFooter(doc, pageNum);
      doc.addPage();
      pageNum++;
      addPageHeader(doc, 'Detailed Findings');
      y = 60;
    }

    doc.fontSize(14).fillColor(COLORS.darkBlue).text(sd.site.label || sd.site.url, PAGE_MARGIN, y);
    y += 22;

    if (sd.issues.length === 0) {
      doc.fontSize(10).fillColor(COLORS.pass).text('No issues found.', PAGE_MARGIN + 10, y);
      y += 25;
      continue;
    }

    for (const issue of sd.issues) {
      const blockHeight = 90;
      if (ensureSpace(y, blockHeight)) {
        addPageFooter(doc, pageNum);
        doc.addPage();
        pageNum++;
        addPageHeader(doc, 'Detailed Findings');
        y = 60;
      }

      // Severity badge
      const badgeColor = severityColor(issue.severity);
      doc.rect(PAGE_MARGIN, y, 60, 16).fill(badgeColor);
      doc
        .fontSize(8)
        .fillColor(COLORS.white)
        .text(issue.severity.toUpperCase(), PAGE_MARGIN + 4, y + 4, { width: 52 });

      // WCAG criterion and level
      if (issue.wcagCriterion) {
        doc
          .fontSize(9)
          .fillColor(COLORS.blue)
          .text(
            `WCAG ${issue.wcagCriterion} — Level ${issue.wcagLevel}`,
            PAGE_MARGIN + 70,
            y + 3
          );
      }
      y += 22;

      // Description
      doc.fontSize(10).fillColor(COLORS.black).text(issue.description, PAGE_MARGIN + 10, y, {
        width: CONTENT_WIDTH - 20,
      });
      y += doc.heightOfString(issue.description, { width: CONTENT_WIDTH - 20 }) + 6;

      // Affected element
      if (issue.element) {
        doc.fontSize(8).fillColor(COLORS.gray).text('Element:', PAGE_MARGIN + 10, y, { continued: true });
        doc.font('Courier').text(` ${issue.element}`, { continued: false });
        doc.font('Helvetica');
        y += 14;
      }

      // Help URL
      if (issue.helpUrl) {
        doc.fontSize(8).fillColor(COLORS.blue).text(`Fix guidance: ${issue.helpUrl}`, PAGE_MARGIN + 10, y, {
          width: CONTENT_WIDTH - 20,
          link: issue.helpUrl,
          underline: true,
        });
        y += 14;
      }

      y += 10;
    }

    y += 10;
  }

  addPageFooter(doc, pageNum);
  return pageNum;
}

function renderAppendix(
  doc: InstanceType<typeof PDFDocument>,
  campaign: Campaign,
  pageNum: number
) {
  doc.addPage();
  pageNum++;
  addPageHeader(doc, 'Appendix');

  let y = 60;

  doc.fontSize(20).fillColor(COLORS.darkBlue).text('Appendix', PAGE_MARGIN, y);
  y += 35;

  // WCAG guidelines reference
  doc.fontSize(14).fillColor(COLORS.darkBlue).text('WCAG Guidelines Reference', PAGE_MARGIN, y);
  y += 22;

  const levelDescriptions: Record<string, string> = {
    A: 'Level A is the minimum level of conformance. It covers the most basic web accessibility features, ensuring content is available to users with disabilities. Key areas include text alternatives for non-text content, keyboard accessibility, and seizure prevention.',
    AA: 'Level AA addresses the most common barriers for disabled users. It includes all Level A criteria plus additional requirements for color contrast (4.5:1 minimum), resize text up to 200%, and consistent navigation. This is the standard most organizations target.',
    AAA: 'Level AAA is the highest level of conformance. It includes all Level A and AA criteria plus enhanced contrast (7:1), sign language interpretation, extended audio descriptions, and reading level considerations. Full AAA conformance is not always achievable for all content.',
  };

  doc
    .fontSize(10)
    .fillColor(COLORS.black)
    .text(`Tested Level: WCAG 2.1 Level ${campaign.complianceLevel}`, PAGE_MARGIN + 10, y);
  y += 18;
  doc.fontSize(9).fillColor(COLORS.gray).text(levelDescriptions[campaign.complianceLevel] ?? '', PAGE_MARGIN + 10, y, {
    width: CONTENT_WIDTH - 20,
  });
  y += doc.heightOfString(levelDescriptions[campaign.complianceLevel] ?? '', { width: CONTENT_WIDTH - 20 }) + 20;

  drawHorizontalRule(doc, y);
  y += 15;

  // Methodology
  doc.fontSize(14).fillColor(COLORS.darkBlue).text('Methodology', PAGE_MARGIN, y);
  y += 22;

  const methodology = [
    'Automated scanning was performed using axe-core accessibility testing engine.',
    'Each page was audited for WCAG accessibility criteria as configured in the campaign.',
    'Issues are classified by severity: critical, serious, moderate, and minor.',
    'Scores are calculated on a 0–100 scale based on the ratio of passed rules to total applicable rules.',
    'Results reflect the state of pages at the time of scan and may change as sites are updated.',
  ];

  for (const line of methodology) {
    doc.fontSize(9).fillColor(COLORS.black).text(`• ${line}`, PAGE_MARGIN + 10, y, {
      width: CONTENT_WIDTH - 20,
    });
    y += doc.heightOfString(`• ${line}`, { width: CONTENT_WIDTH - 20 }) + 6;
  }

  y += 10;
  drawHorizontalRule(doc, y);
  y += 15;

  // Disclaimer
  doc.fontSize(14).fillColor(COLORS.darkBlue).text('Disclaimer', PAGE_MARGIN, y);
  y += 22;

  const disclaimer =
    'This report is generated by an automated compliance scanning tool and should be used as a guideline only. ' +
    'Automated testing can identify many common accessibility issues but cannot detect all barriers. ' +
    'Manual testing by users with disabilities and accessibility experts is recommended for complete WCAG conformance evaluation. ' +
    'The scores and findings in this report do not constitute a legal compliance certification.';

  doc.fontSize(9).fillColor(COLORS.gray).text(disclaimer, PAGE_MARGIN + 10, y, {
    width: CONTENT_WIDTH - 20,
  });

  addPageFooter(doc, pageNum);
}

// ---------------------------------------------------------------------------
// Core report generation
// ---------------------------------------------------------------------------

export async function generateReport(options: ReportOptions): Promise<Buffer> {
  const { scanId, includeDetails = false } = options;

  // Fetch data
  const scan = getScan(scanId);
  if (!scan) throw new Error(`Scan not found: ${scanId}`);

  const campaign = getCampaign(scan.campaignId);
  if (!campaign) throw new Error(`Campaign not found: ${scan.campaignId}`);

  const results = getResultsByScan(scanId);

  // Group results by site and collect issues
  const siteMap = new Map<string, SiteData>();
  for (const site of campaign.sites) {
    siteMap.set(site.id, { site, results: [], issues: [] });
  }
  for (const result of results) {
    let sd = siteMap.get(result.siteId);
    if (!sd) {
      // Fallback: site might not be in campaign list
      sd = {
        site: { id: result.siteId, campaignId: scan.campaignId, url: result.pageUrl, label: '' },
        results: [],
        issues: [],
      };
      siteMap.set(result.siteId, sd);
    }
    sd.results.push(result);
    const issues = getIssuesByResult(result.id);
    sd.issues.push(...issues);
  }

  const siteDataList = Array.from(siteMap.values()).filter((sd) => sd.results.length > 0);

  const summary: ScanSummary = scan.summary ?? {
    totalPages: 0,
    totalIssues: 0,
    criticalCount: 0,
    seriousCount: 0,
    moderateCount: 0,
    minorCount: 0,
    scores: { accessibility: 0 },
  };

  // Build PDF
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
      info: {
        Title: `WCAG Compliance Report — ${campaign.name}`,
        Author: 'WCAG Compliance Portal',
        Subject: `Scan ${scanId}`,
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let pageNum = 1;

    // Page 1 — Cover
    renderCoverPage(doc, campaign, scan, pageNum);

    // Page 2 — Executive Summary
    doc.addPage();
    pageNum++;
    pageNum = renderExecutiveSummary(doc, campaign, scan, summary, siteDataList, pageNum);

    // Page 3+ — Per-Site Results
    pageNum = renderSiteResults(doc, siteDataList, pageNum);

    // Detailed Findings (optional)
    if (includeDetails) {
      pageNum = renderDetailedFindings(doc, siteDataList, pageNum);
    }

    // Final Page — Appendix
    renderAppendix(doc, campaign, pageNum);

    doc.end();
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function createReport(scanId: string, includeDetails = true): Promise<string> {
  // Ensure output dir
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const reportId = uuidv4();
  const timestamp = Date.now();
  const fileName = `report-${scanId}-${timestamp}.pdf`;
  const filePath = path.join(REPORTS_DIR, fileName);

  const buffer = await generateReport({ scanId, includeDetails });
  fs.writeFileSync(filePath, buffer);

  insertReportStmt.run({
    id: reportId,
    scan_id: scanId,
    file_path: filePath,
  });

  return reportId;
}

export async function getReportPath(reportId: string): Promise<string | null> {
  const row = getReportStmt.get(reportId) as { file_path: string } | undefined;
  if (!row) return null;
  return fs.existsSync(row.file_path) ? row.file_path : null;
}

export async function listReports(scanId: string): Promise<Report[]> {
  const rows = listReportsStmt.all(scanId) as {
    id: string;
    scan_id: string;
    file_path: string;
    created_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    scanId: r.scan_id,
    filePath: r.file_path,
    createdAt: r.created_at,
  }));
}
