import { chromium, type Browser, type Page } from 'playwright';
import {
  updateScanStatus,
  insertScanResult,
  insertScanIssues,
  getCampaign,
  insertAuditLogBatch,
  updateAuditLogEntry,
} from '../../db/queries.js';
import type { InsertAuditLogInput } from '../../db/queries.js';
import type { AuditCategory, ScanSummary, ComplianceLevel } from '@compliance-portal/shared';
import { getCriteriaForLevel } from '../../data/wcag-helpers.js';
import { crawlSite } from './crawler.js';
import { auditAccessibility } from './accessibility.js';

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      try {
        await fn(item);
      } catch (err) {
        // Log but continue processing remaining items in this worker
        console.error('runWithConcurrency: item failed:', err);
      }
    }
  });
  await Promise.allSettled(workers);
}

const SITE_CONCURRENCY = 2;
const PAGE_CONCURRENCY = 3;

export interface ScanConfig {
  scanId: string;
  campaignId: string;
  sites: Array<{ id: string; url: string; label: string }>;
  complianceLevel: ComplianceLevel;
  categories: AuditCategory[];
  scanDepth: number;
  maxPagesToScan: number | null;
}

const PAGE_TIMEOUT = 30_000;

function insertExpectedRules(
  scanId: string,
  siteId: string,
  pageUrl: string,
  categories: AuditCategory[],
  complianceLevel: ComplianceLevel,
): void {
  const entries: InsertAuditLogInput[] = [];

  if (categories.includes('accessibility')) {
    const criteria = getCriteriaForLevel(complianceLevel);
    for (const c of criteria) {
      entries.push({
        scanId,
        category: 'accessibility',
        ruleId: c.id,
        ruleName: c.name,
        expected: true,
        executed: false,
        passed: null,
        siteId,
        pageUrl,
      });
    }
  }

  if (entries.length > 0) {
    insertAuditLogBatch(entries);
  }
}

interface SiteResult {
  pages: number;
  issues: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  accessibilityScores: number[];
  error?: string;
}

/**
 * Main scanning orchestrator.
 * Launches a headless browser, crawls pages, runs audits, and stores results.
 * Sites are processed in parallel (up to SITE_CONCURRENCY), and pages within
 * each site are audited in parallel tabs (up to PAGE_CONCURRENCY).
 * This function is designed to run in the background (fire-and-forget).
 */
export async function executeScan(config: ScanConfig): Promise<void> {
  let browser: Browser | undefined;

  try {
    updateScanStatus(config.scanId, 'running');
    browser = await chromium.launch({ headless: true });

    const siteResults: SiteResult[] = [];

    await runWithConcurrency(config.sites, SITE_CONCURRENCY, async (site) => {
      const result: SiteResult = {
        pages: 0,
        issues: 0,
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        accessibilityScores: [],
      };

      let context: import('playwright').BrowserContext | undefined;
      try {
        context = await browser!.newContext({
          ignoreHTTPSErrors: true,
          userAgent:
            'Mozilla/5.0 (compatible; CompliancePortalScanner/1.0; +https://compliance-portal.dev)',
        });
        // Crawl using a dedicated page (BFS must be sequential)
        console.log(`[Scanner] Crawling site: ${site.url} (depth=${config.scanDepth}, maxPages=${config.maxPagesToScan ?? 'unlimited'})`);
        const crawlPage = await context.newPage();
        crawlPage.setDefaultTimeout(PAGE_TIMEOUT);
        const pages = await crawlSite(crawlPage, site.url, config.scanDepth, config.maxPagesToScan);
        await crawlPage.close();
        result.pages = pages.length;
        console.log(`[Scanner] Crawled ${pages.length} page(s) for ${site.url}`);

        // Track how many pages actually loaded successfully
        let pagesAudited = 0;

        // Audit discovered pages in parallel using multiple tabs
        await runWithConcurrency(pages, PAGE_CONCURRENCY, async (pageUrl) => {
          const auditPage = await context!.newPage();
          auditPage.setDefaultTimeout(PAGE_TIMEOUT);

          try {
            // Use domcontentloaded as primary — faster and sufficient for axe
            let navSuccess = false;
            try {
              await auditPage.goto(pageUrl, {
                waitUntil: 'domcontentloaded',
                timeout: PAGE_TIMEOUT,
              });
              // Brief settle time for JS-rendered content
              await auditPage.waitForTimeout(2000);
              navSuccess = true;
            } catch {
              // Skip this page if navigation fails entirely
              console.warn(`[Scanner] Navigation failed for ${pageUrl} — skipping`);
              return;
            }

            if (navSuccess) pagesAudited++;

            // Pre-insert expected audit log entries
            insertExpectedRules(config.scanId, site.id, pageUrl, config.categories, config.complianceLevel);

            // Accessibility audit
            if (config.categories.includes('accessibility')) {
              try {
                const a11yResult = await auditAccessibility(auditPage, config.complianceLevel);
                result.accessibilityScores.push(a11yResult.score);

                const scanResult = insertScanResult({
                  scanId: config.scanId,
                  siteId: site.id,
                  pageUrl,
                  category: 'accessibility',
                  score: a11yResult.score,
                  issuesCount: a11yResult.issues.length,
                  details: {
                    totalChecks: a11yResult.totalChecks,
                    passedChecks: a11yResult.passedChecks,
                  },
                });

                if (a11yResult.issues.length > 0) {
                  const dbIssues = insertScanIssues(
                    a11yResult.issues.map((issue) => ({
                      resultId: scanResult.id,
                      severity: issue.severity,
                      wcagCriterion: issue.wcagCriterion,
                      wcagLevel: issue.wcagLevel,
                      description: issue.description,
                      element: issue.element,
                      helpUrl: issue.helpUrl,
                    })),
                  );
                  for (const i of dbIssues) {
                    result.issues++;
                    if (i.severity === 'critical') result.critical++;
                    else if (i.severity === 'serious') result.serious++;
                    else if (i.severity === 'moderate') result.moderate++;
                    else result.minor++;
                  }
                }

                // Update audit log
                const criteria = getCriteriaForLevel(config.complianceLevel);
                const violatedCriteria = new Set(a11yResult.issues.map(i => i.wcagCriterion));
                for (const c of criteria) {
                  updateAuditLogEntry(config.scanId, 'accessibility', c.id, site.id, pageUrl, {
                    executed: true,
                    passed: !violatedCriteria.has(c.id),
                  });
                }
              } catch (err) {
                console.error(`Accessibility audit failed for ${pageUrl}:`, err);
                const criteria = getCriteriaForLevel(config.complianceLevel);
                for (const c of criteria) {
                  updateAuditLogEntry(config.scanId, 'accessibility', c.id, site.id, pageUrl, {
                    executed: false,
                    passed: null,
                    errorMessage: (err as Error).message ?? 'Unknown error',
                  });
                }
              }
            }
          } catch (err) {
            console.error(`Error auditing page ${pageUrl}:`, err);
          } finally {
            await auditPage.close().catch(() => {});
          }
        });

        // If the site was crawled but every page failed to navigate, record an
        // unreachable result so the UI shows the site rather than silently omitting it.
        if (pages.length > 0 && pagesAudited === 0) {
          const errMsg = 'Site unreachable — all pages failed to load';
          console.warn(`[Scanner] ${errMsg}: ${site.url}`);
          result.error = errMsg;
          if (config.categories.includes('accessibility')) {
            insertScanResult({
              scanId: config.scanId,
              siteId: site.id,
              pageUrl: site.url,
              category: 'accessibility',
              score: 0,
              issuesCount: 0,
              details: { error: errMsg },
            });
          }
        }
      } catch (err) {
        const errMsg = (err as Error).message ?? 'Unknown error';
        console.error(`[Scanner] Error processing site ${site.url}:`, err);
        result.error = errMsg;
        // Store a 0-score result so the site appears in the UI with an error
        if (config.categories.includes('accessibility')) {
          insertScanResult({
            scanId: config.scanId,
            siteId: site.id,
            pageUrl: site.url,
            category: 'accessibility',
            score: 0,
            issuesCount: 0,
            details: { error: errMsg },
          });
        }
      } finally {
        await context?.close().catch(() => {});
      }

      siteResults.push(result);
    });

    // Aggregate results from all sites
    let totalPages = 0;
    let totalIssues = 0;
    let criticalCount = 0;
    let seriousCount = 0;
    let moderateCount = 0;
    let minorCount = 0;
    const allAccessibilityScores: number[] = [];

    for (const r of siteResults) {
      totalPages += r.pages;
      totalIssues += r.issues;
      criticalCount += r.critical;
      seriousCount += r.serious;
      moderateCount += r.moderate;
      minorCount += r.minor;
      allAccessibilityScores.push(...r.accessibilityScores);
    }

    const avgScore = (arr: number[]) =>
      arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const summary: ScanSummary = {
      totalPages,
      totalIssues,
      criticalCount,
      seriousCount,
      moderateCount,
      minorCount,
      scores: {
        accessibility: avgScore(allAccessibilityScores),
      },
    };

    updateScanStatus(config.scanId, 'completed', summary);
    console.log(`Scan ${config.scanId} completed: ${totalPages} pages, ${totalIssues} issues`);
  } catch (err) {
    console.error(`Scan ${config.scanId} failed:`, err);
    updateScanStatus(config.scanId, 'failed');
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
