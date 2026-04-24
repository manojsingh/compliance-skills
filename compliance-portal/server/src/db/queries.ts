import { v4 as uuidv4 } from 'uuid';
import db from './index.js';
import PostgresDatabase from './postgres.js';
import type {
  Campaign,
  CampaignSite,
  Scan,
  ScanSummary,
  ScanResult,
  ScanIssue,
  AuditCategory,
} from '@compliance-portal/shared';

// PostgreSQL-primary mode: when env vars are set, all reads/writes go to PostgreSQL
const USE_POSTGRES_PRIMARY = Boolean(process.env.PGHOST || process.env.DATABASE_URL);

const postgresPrimary = USE_POSTGRES_PRIMARY
  ? new PostgresDatabase({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'compliancedb',
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: process.env.PGSSLMODE === 'require',
      useAzureAuth: process.env.AZURE_POSTGRESQL_PASSWORDLESS === 'true',
    })
  : null;

console.log(`[DB] Mode: ${USE_POSTGRES_PRIMARY ? 'PostgreSQL Primary' : 'SQLite (local dev)'}`);

// ---------------------------------------------------------------------------
// Row <-> Domain type mappers
// ---------------------------------------------------------------------------

interface CampaignRow {
  id: string;
  name: string;
  compliance_level: string;
  categories: string;
  scan_depth: number;
  max_pages_to_scan: number | null;
  site_concurrency: number;
  page_concurrency: number;
  schedule_cron: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ScanRow {
  id: string;
  campaign_id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  summary: string | null;
  created_at: string;
}

interface ScanResultRow {
  id: string;
  scan_id: string;
  site_id: string;
  page_url: string;
  category: string;
  score: number;
  issues_count: number;
  details: string;
}

interface ScanIssueRow {
  id: string;
  result_id: string;
  severity: string;
  wcag_criterion: string;
  wcag_level: string;
  description: string;
  element: string;
  help_url: string;
  failure_summary: string | null;
  related_nodes: string | null;
}

interface CampaignSiteRow {
  id: string;
  campaign_id: string;
  url: string;
  label: string;
}

function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    complianceLevel: row.compliance_level as Campaign['complianceLevel'],
    categories: JSON.parse(row.categories) as AuditCategory[],
    scanDepth: row.scan_depth,
    maxPagesToScan: row.max_pages_to_scan,
    siteConcurrency: row.site_concurrency,
    pageConcurrency: row.page_concurrency,
    scheduleCron: row.schedule_cron,
    status: row.status as Campaign['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toScan(row: ScanRow): Scan {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    status: row.status as Scan['status'],
    startedAt: row.started_at,
    completedAt: row.completed_at,
    summary: row.summary ? (JSON.parse(row.summary) as ScanSummary) : null,
  };
}

function toScanResult(row: ScanResultRow): ScanResult {
  return {
    id: row.id,
    scanId: row.scan_id,
    siteId: row.site_id,
    pageUrl: row.page_url,
    category: row.category as AuditCategory,
    score: row.score,
    issuesCount: row.issues_count,
    details: JSON.parse(row.details),
  };
}

function toScanIssue(row: ScanIssueRow): ScanIssue {
  return {
    id: row.id,
    resultId: row.result_id,
    severity: row.severity as ScanIssue['severity'],
    wcagCriterion: row.wcag_criterion,
    wcagLevel: row.wcag_level as ScanIssue['wcagLevel'],
    description: row.description,
    element: row.element,
    helpUrl: row.help_url,
    failureSummary: row.failure_summary || undefined,
    relatedNodes: row.related_nodes ? JSON.parse(row.related_nodes) : undefined,
  };
}

function toSite(row: CampaignSiteRow): CampaignSite {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    url: row.url,
    label: row.label,
  };
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export interface CreateCampaignInput {
  name: string;
  complianceLevel: Campaign['complianceLevel'];
  categories: AuditCategory[];
  scanDepth?: number;
  maxPagesToScan?: number | null;
  siteConcurrency?: number;
  pageConcurrency?: number;
  scheduleCron?: string | null;
  sites: { url: string; label?: string }[];
}

const insertCampaignStmt = db.prepare(`
  INSERT INTO campaigns (id, name, compliance_level, categories, scan_depth, max_pages_to_scan, site_concurrency, page_concurrency, schedule_cron)
  VALUES (@id, @name, @compliance_level, @categories, @scan_depth, @max_pages_to_scan, @site_concurrency, @page_concurrency, @schedule_cron)
`);

const insertSiteStmt = db.prepare(`
  INSERT INTO campaign_sites (id, campaign_id, url, label)
  VALUES (@id, @campaign_id, @url, @label)
`);

const deleteSitesByCampaignStmt = db.prepare(`
  DELETE FROM campaign_sites WHERE campaign_id = ?
`);

export function createCampaign(data: CreateCampaignInput): Campaign & { sites: CampaignSite[] } {
  const campaignId = uuidv4();

  const sites: CampaignSite[] = data.sites.map((s) => ({
    id: uuidv4(),
    campaignId,
    url: s.url,
    label: s.label ?? '',
  }));

  const txn = db.transaction(() => {
    insertCampaignStmt.run({
      id: campaignId,
      name: data.name,
      compliance_level: data.complianceLevel,
      categories: JSON.stringify(data.categories),
      scan_depth: data.scanDepth ?? 2,
      max_pages_to_scan: data.maxPagesToScan ?? null,
      site_concurrency: data.siteConcurrency ?? 2,
      page_concurrency: data.pageConcurrency ?? 3,
      schedule_cron: data.scheduleCron ?? null,
    });

    for (const site of sites) {
      insertSiteStmt.run({
        id: site.id,
        campaign_id: site.campaignId,
        url: site.url,
        label: site.label,
      });
    }
  });

  txn();


  const campaign = getCampaign(campaignId)!;
  return { ...campaign, sites };
}

const getCampaignStmt = db.prepare(`SELECT * FROM campaigns WHERE id = ?`);
const getCampaignSitesStmt = db.prepare(`SELECT * FROM campaign_sites WHERE campaign_id = ?`);

export function getCampaign(id: string): (Campaign & { sites: CampaignSite[] }) | null {
  const row = getCampaignStmt.get(id) as CampaignRow | undefined;
  if (!row) return null;

  const siteRows = getCampaignSitesStmt.all(id) as CampaignSiteRow[];
  return {
    ...toCampaign(row),
    sites: siteRows.map(toSite),
  };
}

const listCampaignsStmt = db.prepare(`
  SELECT c.*,
    (SELECT COUNT(*) FROM campaign_sites cs WHERE cs.campaign_id = c.id) AS site_count,
    (SELECT COUNT(*) FROM scans s WHERE s.campaign_id = c.id) AS scan_count,
    (SELECT s.status FROM scans s WHERE s.campaign_id = c.id ORDER BY s.created_at DESC LIMIT 1) AS latest_scan_status,
    (SELECT s.id FROM scans s WHERE s.campaign_id = c.id ORDER BY s.created_at DESC LIMIT 1) AS latest_scan_id,
    (SELECT s.summary FROM scans s WHERE s.campaign_id = c.id AND s.status = 'completed' ORDER BY s.completed_at DESC LIMIT 1) AS latest_scan_summary,
    (SELECT s.completed_at FROM scans s WHERE s.campaign_id = c.id AND s.status = 'completed' ORDER BY s.completed_at DESC LIMIT 1) AS latest_scan_date
  FROM campaigns c
  ORDER BY c.created_at DESC
`);

export function listCampaigns(): (Campaign & {
  siteCount: number;
  scanCount: number;
  latestScanStatus: string | null;
  latestScanId: string | null;
  latestScanSummary: string | null;
  latestScanDate: string | null;
})[] {
  const rows = listCampaignsStmt.all() as (CampaignRow & {
    site_count: number;
    scan_count: number;
    latest_scan_status: string | null;
    latest_scan_id: string | null;
    latest_scan_summary: string | null;
    latest_scan_date: string | null;
  })[];
  return rows.map((row) => ({
    ...toCampaign(row),
    siteCount: row.site_count ?? 0,
    scanCount: row.scan_count ?? 0,
    latestScanStatus: row.latest_scan_status,
    latestScanId: row.latest_scan_id,
    latestScanSummary: row.latest_scan_summary,
    latestScanDate: row.latest_scan_date,
  }));
}

export interface UpdateCampaignInput {
  name?: string;
  complianceLevel?: Campaign['complianceLevel'];
  categories?: AuditCategory[];
  scanDepth?: number;
  maxPagesToScan?: number | null;
  siteConcurrency?: number;
  pageConcurrency?: number;
  scheduleCron?: string | null;
  status?: Campaign['status'];
  sites?: { url: string; label?: string }[];
}

export function updateCampaign(id: string, data: UpdateCampaignInput): Campaign | null {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  if (data.name !== undefined) { fields.push('name = @name'); params.name = data.name; }
  if (data.complianceLevel !== undefined) { fields.push('compliance_level = @compliance_level'); params.compliance_level = data.complianceLevel; }
  if (data.categories !== undefined) { fields.push('categories = @categories'); params.categories = JSON.stringify(data.categories); }
  if (data.scanDepth !== undefined) { fields.push('scan_depth = @scan_depth'); params.scan_depth = data.scanDepth; }
  if (data.maxPagesToScan !== undefined) { fields.push('max_pages_to_scan = @max_pages_to_scan'); params.max_pages_to_scan = data.maxPagesToScan; }
  if (data.siteConcurrency !== undefined) { fields.push('site_concurrency = @site_concurrency'); params.site_concurrency = data.siteConcurrency; }
  if (data.pageConcurrency !== undefined) { fields.push('page_concurrency = @page_concurrency'); params.page_concurrency = data.pageConcurrency; }
  if (data.scheduleCron !== undefined) { fields.push('schedule_cron = @schedule_cron'); params.schedule_cron = data.scheduleCron; }
  if (data.status !== undefined) { fields.push('status = @status'); params.status = data.status; }

  if (fields.length === 0 && data.sites === undefined) return getCampaign(id);

  const updateTxn = db.transaction(() => {
    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      const sql = `UPDATE campaigns SET ${fields.join(', ')} WHERE id = @id`;
      db.prepare(sql).run(params);
    }

    if (data.sites !== undefined) {
      deleteSitesByCampaignStmt.run(id);
      for (const site of data.sites) {
        insertSiteStmt.run({
          id: uuidv4(),
          campaign_id: id,
          url: site.url,
          label: site.label ?? '',
        });
      }
    }
  });

  updateTxn();


  return getCampaign(id);
}

const deleteCampaignStmt = db.prepare(`DELETE FROM campaigns WHERE id = ?`);
const deleteCampaignSitesStmt = db.prepare(`DELETE FROM campaign_sites WHERE campaign_id = ?`);
const deleteScansByCampaignStmt = db.prepare(`DELETE FROM scans WHERE campaign_id = ?`);
const deleteScanResultsByScanStmt = db.prepare(`DELETE FROM scan_results WHERE scan_id = ?`);
const deleteScanIssuesByResultStmt = db.prepare(`DELETE FROM scan_issues WHERE result_id = ?`);
const deleteScanAuditLogByScanStmt = db.prepare(`DELETE FROM scan_audit_log WHERE scan_id = ?`);

// Helper queries to fetch IDs
const getScansStmt = db.prepare(`SELECT id FROM scans WHERE campaign_id = ?`);
const getScanResultsStmt = db.prepare(`SELECT id FROM scan_results WHERE scan_id = ?`);

export function deleteCampaign(id: string): boolean {
  // Temporarily disable foreign key checks to avoid constraint issues during cascading deletes
  db.pragma('foreign_keys = OFF');
  
  try {
    const deleteOne = db.transaction((campaignId: string) => {
      // Get all scans for this campaign
      const scans = getScansStmt.all(campaignId) as { id: string }[];
      
      // For each scan, delete its related records
      for (const scan of scans) {
        // Get all scan results for this scan
        const results = getScanResultsStmt.all(scan.id) as { id: string }[];
        
        // Delete scan issues for each result
        for (const result of results) {
          deleteScanIssuesByResultStmt.run(result.id);
        }
        
        // Delete scan results for this scan
        deleteScanResultsByScanStmt.run(scan.id);
        
        // Delete audit log for this scan
        deleteScanAuditLogByScanStmt.run(scan.id);
      }
      
      // Delete all scans
      deleteScansByCampaignStmt.run(campaignId);
      
      // Delete campaign sites
      deleteCampaignSitesStmt.run(campaignId);
      
      // Delete the campaign itself
      const result = deleteCampaignStmt.run(campaignId);
      return result.changes > 0;
    });
    
    const deleted = deleteOne(id);
    if (deleted) {
    }
    return deleted;
  } finally {
    // Re-enable foreign key checks
    db.pragma('foreign_keys = ON');
  }
}

export function deleteCampaigns(ids: string[]): number {
  // Temporarily disable foreign key checks to avoid constraint issues during cascading deletes
  db.pragma('foreign_keys = OFF');
  
  try {
    const deleteMany = db.transaction((campaignIds: string[]) => {
      let totalDeleted = 0;
      for (const campaignId of campaignIds) {
        // Get all scans for this campaign
        const scans = getScansStmt.all(campaignId) as { id: string }[];
        
        // For each scan, delete its related records
        for (const scan of scans) {
          // Get all scan results for this scan
          const results = getScanResultsStmt.all(scan.id) as { id: string }[];
          
          // Delete scan issues for each result
          for (const result of results) {
            deleteScanIssuesByResultStmt.run(result.id);
          }
          
          // Delete scan results for this scan
          deleteScanResultsByScanStmt.run(scan.id);
          
          // Delete audit log for this scan
          deleteScanAuditLogByScanStmt.run(scan.id);
        }
        
        // Delete all scans
        deleteScansByCampaignStmt.run(campaignId);
        
        // Delete campaign sites
        deleteCampaignSitesStmt.run(campaignId);
        
        // Delete the campaign itself
        const result = deleteCampaignStmt.run(campaignId);
        totalDeleted += result.changes;
      }
      return totalDeleted;
    });
    
    const deletedCount = deleteMany(ids);
    if (deletedCount > 0 && ids.length > 0) {
    }
    return deletedCount;
  } finally {
    // Re-enable foreign key checks
    db.pragma('foreign_keys = ON');
  }
}

// ---------------------------------------------------------------------------
// Scans
// ---------------------------------------------------------------------------

const insertScanStmt = db.prepare(`
  INSERT INTO scans (id, campaign_id) VALUES (@id, @campaign_id)
`);

export function createScan(campaignId: string): Scan {
  const id = uuidv4();
  insertScanStmt.run({ id, campaign_id: campaignId });


  return getScan(id)!;
}

const updateScanStatusStmt = db.prepare(`
  UPDATE scans SET status = @status, summary = @summary,
    started_at = CASE WHEN @status = 'running' AND started_at IS NULL THEN datetime('now') ELSE started_at END,
    completed_at = CASE WHEN @status IN ('completed', 'failed') THEN datetime('now') ELSE completed_at END
  WHERE id = @id
`);

export function updateScanStatus(id: string, status: Scan['status'], summary?: ScanSummary): Scan | null {
  updateScanStatusStmt.run({
    id,
    status,
    summary: summary ? JSON.stringify(summary) : null,
  });


  return getScan(id);
}

const getScanStmt = db.prepare(`SELECT * FROM scans WHERE id = ?`);

export function getScan(id: string): (Scan & { results?: ScanResult[] }) | null {
  const row = getScanStmt.get(id) as ScanRow | undefined;
  if (!row) return null;

  const results = getResultsByScan(row.id);
  return { ...toScan(row), results };
}

const listScansAllStmt = db.prepare(`
  SELECT s.*, c.name AS campaign_name
  FROM scans s
  JOIN campaigns c ON c.id = s.campaign_id
  ORDER BY s.created_at DESC
`);

const listScansByCampaignStmt = db.prepare(`
  SELECT s.*, c.name AS campaign_name
  FROM scans s
  JOIN campaigns c ON c.id = s.campaign_id
  WHERE s.campaign_id = ?
  ORDER BY s.created_at DESC
`);

export function listScans(campaignId?: string): (Scan & { campaignName: string })[] {
  const rows = campaignId
    ? (listScansByCampaignStmt.all(campaignId) as (ScanRow & { campaign_name: string })[])
    : (listScansAllStmt.all() as (ScanRow & { campaign_name: string })[]);

  return rows.map((row) => ({
    ...toScan(row),
    campaignName: row.campaign_name,
  }));
}

const getLatestScanStmt = db.prepare(`
  SELECT * FROM scans WHERE campaign_id = ? ORDER BY created_at DESC LIMIT 1
`);

export function getLatestScan(campaignId: string): Scan | null {
  const row = getLatestScanStmt.get(campaignId) as ScanRow | undefined;
  return row ? toScan(row) : null;
}

// ---------------------------------------------------------------------------
// Scan Results
// ---------------------------------------------------------------------------

const insertScanResultStmt = db.prepare(`
  INSERT INTO scan_results (id, scan_id, site_id, page_url, category, score, issues_count, details)
  VALUES (@id, @scan_id, @site_id, @page_url, @category, @score, @issues_count, @details)
`);

export interface InsertScanResultInput {
  scanId: string;
  siteId: string;
  pageUrl: string;
  category: AuditCategory;
  score: number;
  issuesCount: number;
  details?: unknown;
}

export function insertScanResult(data: InsertScanResultInput): ScanResult {
  const id = uuidv4();
  const detailsJson = JSON.stringify(data.details ?? {});
  insertScanResultStmt.run({
    id,
    scan_id: data.scanId,
    site_id: data.siteId,
    page_url: data.pageUrl,
    category: data.category,
    score: data.score,
    issues_count: data.issuesCount,
    details: detailsJson,
  });


  return {
    id,
    scanId: data.scanId,
    siteId: data.siteId,
    pageUrl: data.pageUrl,
    category: data.category,
    score: data.score,
    issuesCount: data.issuesCount,
    details: data.details ?? {},
  };
}

const insertScanIssueStmt = db.prepare(`
  INSERT INTO scan_issues (id, result_id, severity, wcag_criterion, wcag_level, description, element, help_url, failure_summary, related_nodes)
  VALUES (@id, @result_id, @severity, @wcag_criterion, @wcag_level, @description, @element, @help_url, @failure_summary, @related_nodes)
`);

export interface InsertScanIssueInput {
  resultId: string;
  severity: ScanIssue['severity'];
  wcagCriterion: string;
  wcagLevel: ScanIssue['wcagLevel'];
  description: string;
  element?: string;
  helpUrl?: string;
  failureSummary?: string;
  relatedNodes?: string[];
}

export function insertScanIssues(issues: InsertScanIssueInput[]): ScanIssue[] {
  const inserted: ScanIssue[] = [];
  const mirroredIssues: Array<{
    id: string;
    resultId: string;
    severity: ScanIssue['severity'];
    wcagCriterion: string;
    wcagLevel: ScanIssue['wcagLevel'];
    description: string;
    element: string;
    helpUrl: string;
    failureSummary: string | null;
    relatedNodes: string[] | null;
  }> = [];

  const txn = db.transaction(() => {
    for (const issue of issues) {
      const id = uuidv4();
      insertScanIssueStmt.run({
        id,
        result_id: issue.resultId,
        severity: issue.severity,
        wcag_criterion: issue.wcagCriterion,
        wcag_level: issue.wcagLevel,
        description: issue.description,
        element: issue.element ?? '',
        help_url: issue.helpUrl ?? '',
        failure_summary: issue.failureSummary ?? null,
        related_nodes: issue.relatedNodes ? JSON.stringify(issue.relatedNodes) : null,
      });
      mirroredIssues.push({
        id,
        resultId: issue.resultId,
        severity: issue.severity,
        wcagCriterion: issue.wcagCriterion,
        wcagLevel: issue.wcagLevel,
        description: issue.description,
        element: issue.element ?? '',
        helpUrl: issue.helpUrl ?? '',
        failureSummary: issue.failureSummary ?? null,
        relatedNodes: issue.relatedNodes ?? null,
      });
      inserted.push({
        id,
        resultId: issue.resultId,
        severity: issue.severity,
        wcagCriterion: issue.wcagCriterion,
        wcagLevel: issue.wcagLevel,
        description: issue.description,
        element: issue.element ?? '',
        helpUrl: issue.helpUrl ?? '',
      });
    }
  });

  txn();

  if (inserted.length > 0) {
  }

  return inserted;
}

const getResultsByScanStmt = db.prepare(`SELECT * FROM scan_results WHERE scan_id = ?`);

export function getResultsByScan(scanId: string): ScanResult[] {
  const rows = getResultsByScanStmt.all(scanId) as ScanResultRow[];
  return rows.map(toScanResult);
}

const getResultsBySiteStmt = db.prepare(`
  SELECT * FROM scan_results WHERE scan_id = ? AND site_id = ?
`);

export function getResultsBySite(scanId: string, siteId: string): ScanResult[] {
  const rows = getResultsBySiteStmt.all(scanId, siteId) as ScanResultRow[];
  return rows.map(toScanResult);
}

const getResultsByCategoryStmt = db.prepare(`
  SELECT * FROM scan_results WHERE scan_id = ? AND category = ?
`);

export function getResultsByCategory(scanId: string, category: AuditCategory): ScanResult[] {
  const rows = getResultsByCategoryStmt.all(scanId, category) as ScanResultRow[];
  return rows.map(toScanResult);
}

const getIssuesByResultStmt = db.prepare(`SELECT * FROM scan_issues WHERE result_id = ?`);

export function getIssuesByResult(resultId: string): ScanIssue[] {
  const rows = getIssuesByResultStmt.all(resultId) as ScanIssueRow[];
  return rows.map(toScanIssue);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const dashboardSummaryStmt = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM campaigns) AS total_campaigns,
    (SELECT COUNT(*) FROM scans) AS total_scans,
    (SELECT AVG(score) FROM scan_results) AS avg_score,
    (SELECT COUNT(*) FROM scan_issues WHERE severity = 'critical') AS critical_count,
    (SELECT COUNT(*) FROM scan_issues WHERE severity = 'serious') AS serious_count,
    (SELECT COUNT(*) FROM scan_issues WHERE severity = 'moderate') AS moderate_count,
    (SELECT COUNT(*) FROM scan_issues WHERE severity = 'minor') AS minor_count
`);

export interface DashboardSummary {
  totalCampaigns: number;
  totalScans: number;
  avgScore: number;
  issuesBySeverity: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

export function getDashboardSummary(): DashboardSummary {
  const row = dashboardSummaryStmt.get() as {
    total_campaigns: number;
    total_scans: number;
    avg_score: number | null;
    critical_count: number;
    serious_count: number;
    moderate_count: number;
    minor_count: number;
  };

  return {
    totalCampaigns: row.total_campaigns,
    totalScans: row.total_scans,
    avgScore: row.avg_score ?? 0,
    issuesBySeverity: {
      critical: row.critical_count,
      serious: row.serious_count,
      moderate: row.moderate_count,
      minor: row.minor_count,
    },
  };
}

const recentScansStmt = db.prepare(`
  SELECT s.*, c.name AS campaign_name,
    (SELECT COUNT(*) FROM campaign_sites cs WHERE cs.campaign_id = s.campaign_id) AS site_count,
    (SELECT COUNT(*) FROM scan_issues si
       JOIN scan_results sr ON sr.id = si.result_id
       WHERE sr.scan_id = s.id) AS live_issue_count
  FROM scans s
  JOIN campaigns c ON c.id = s.campaign_id
  ORDER BY s.created_at DESC
  LIMIT ?
`);

export function getRecentScans(limit: number = 10): (Scan & { campaignName: string; siteCount: number; liveIssueCount: number })[] {
  const rows = recentScansStmt.all(limit) as (ScanRow & { campaign_name: string; site_count: number; live_issue_count: number })[];
  return rows.map((row) => ({
    ...toScan(row),
    campaignName: row.campaign_name,
    siteCount: row.site_count ?? 0,
    liveIssueCount: row.live_issue_count ?? 0,
  }));
}

const campaignScoreHistoryStmt = db.prepare(`
  SELECT s.id AS scan_id, s.created_at, s.summary
  FROM scans s
  WHERE s.campaign_id = ? AND s.status = 'completed' AND s.summary IS NOT NULL
  ORDER BY s.created_at ASC
`);

export interface ScoreHistoryEntry {
  scanId: string;
  createdAt: string;
  scores: Record<AuditCategory, number>;
}

export function getCampaignScoreHistory(campaignId: string): ScoreHistoryEntry[] {
  const rows = campaignScoreHistoryStmt.all(campaignId) as { scan_id: string; created_at: string; summary: string }[];
  return rows.map((row) => {
    const summary = JSON.parse(row.summary) as ScanSummary;
    return {
      scanId: row.scan_id,
      createdAt: row.created_at,
      scores: summary.scores,
    };
  });
}

// ---------------------------------------------------------------------------
// Scan Audit Log
// ---------------------------------------------------------------------------

interface ScanAuditLogRow {
  id: string;
  scan_id: string;
  category: string;
  rule_id: string;
  rule_name: string;
  expected: number;
  executed: number;
  passed: number | null;
  error_message: string | null;
  site_id: string | null;
  page_url: string | null;
  executed_at: string | null;
  created_at: string;
}

export interface ScanAuditEntry {
  id: string;
  scanId: string;
  category: AuditCategory;
  ruleId: string;
  ruleName: string;
  expected: boolean;
  executed: boolean;
  passed: boolean | null;
  errorMessage: string | null;
  siteId: string | null;
  pageUrl: string | null;
  executedAt: string | null;
  createdAt: string;
}

export interface ScanAuditSummary {
  totalExpected: number;
  totalExecuted: number;
  totalPassed: number;
  totalFailed: number;
  totalErrored: number;
  coveragePercent: number;
  byCategory: Record<AuditCategory, {
    expected: number;
    executed: number;
    passed: number;
    failed: number;
    errored: number;
  }>;
}

function toAuditEntry(row: ScanAuditLogRow): ScanAuditEntry {
  return {
    id: row.id,
    scanId: row.scan_id,
    category: row.category as AuditCategory,
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    expected: row.expected === 1,
    executed: row.executed === 1,
    passed: row.passed === null ? null : row.passed === 1,
    errorMessage: row.error_message,
    siteId: row.site_id,
    pageUrl: row.page_url,
    executedAt: row.executed_at,
    createdAt: row.created_at,
  };
}

const insertAuditLogStmt = db.prepare(`
  INSERT INTO scan_audit_log (id, scan_id, category, rule_id, rule_name, expected, executed, passed, error_message, site_id, page_url, executed_at)
  VALUES (@id, @scan_id, @category, @rule_id, @rule_name, @expected, @executed, @passed, @error_message, @site_id, @page_url, @executed_at)
`);

export interface InsertAuditLogInput {
  scanId: string;
  category: AuditCategory;
  ruleId: string;
  ruleName: string;
  expected?: boolean;
  executed?: boolean;
  passed?: boolean | null;
  errorMessage?: string | null;
  siteId?: string | null;
  pageUrl?: string | null;
}

export function insertAuditLogEntry(data: InsertAuditLogInput): ScanAuditEntry {
  const id = uuidv4();
  const executedAt = data.executed ? new Date().toISOString() : null;
  insertAuditLogStmt.run({
    id,
    scan_id: data.scanId,
    category: data.category,
    rule_id: data.ruleId,
    rule_name: data.ruleName,
    expected: data.expected !== false ? 1 : 0,
    executed: data.executed ? 1 : 0,
    passed: data.passed === undefined || data.passed === null ? null : data.passed ? 1 : 0,
    error_message: data.errorMessage ?? null,
    site_id: data.siteId ?? null,
    page_url: data.pageUrl ?? null,
    executed_at: executedAt,
  });


  return {
    id,
    scanId: data.scanId,
    category: data.category,
    ruleId: data.ruleId,
    ruleName: data.ruleName,
    expected: data.expected !== false,
    executed: data.executed ?? false,
    passed: data.passed ?? null,
    errorMessage: data.errorMessage ?? null,
    siteId: data.siteId ?? null,
    pageUrl: data.pageUrl ?? null,
    executedAt: data.executed ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
  };
}

export function insertAuditLogBatch(entries: InsertAuditLogInput[]): ScanAuditEntry[] {
  const results: ScanAuditEntry[] = [];
  const txn = db.transaction(() => {
    for (const entry of entries) {
      results.push(insertAuditLogEntry(entry));
    }
  });
  txn();
  return results;
}

const updateAuditLogStmt = db.prepare(`
  UPDATE scan_audit_log
  SET executed = @executed, passed = @passed, error_message = @error_message, executed_at = @executed_at
  WHERE scan_id = @scan_id AND rule_id = @rule_id AND category = @category AND page_url = @page_url AND site_id = @site_id
`);

export function updateAuditLogEntry(
  scanId: string,
  category: AuditCategory,
  ruleId: string,
  siteId: string,
  pageUrl: string,
  update: { executed: boolean; passed: boolean | null; errorMessage?: string | null },
): void {
  const executedAt = update.executed ? new Date().toISOString() : null;
  updateAuditLogStmt.run({
    scan_id: scanId,
    category,
    rule_id: ruleId,
    site_id: siteId,
    page_url: pageUrl,
    executed: update.executed ? 1 : 0,
    passed: update.passed === null ? null : update.passed ? 1 : 0,
    error_message: update.errorMessage ?? null,
    executed_at: executedAt,
  });

}

const getAuditLogStmt = db.prepare(`
  SELECT * FROM scan_audit_log WHERE scan_id = ? ORDER BY category, rule_id, page_url
`);

export function getAuditLog(scanId: string): ScanAuditEntry[] {
  const rows = getAuditLogStmt.all(scanId) as ScanAuditLogRow[];
  return rows.map(toAuditEntry);
}

const getAuditLogByCategoryStmt = db.prepare(`
  SELECT * FROM scan_audit_log WHERE scan_id = ? AND category = ? ORDER BY rule_id, page_url
`);

export function getAuditLogByCategory(scanId: string, category: AuditCategory): ScanAuditEntry[] {
  const rows = getAuditLogByCategoryStmt.all(scanId, category) as ScanAuditLogRow[];
  return rows.map(toAuditEntry);
}

export function getAuditSummary(scanId: string): ScanAuditSummary {
  const entries = getAuditLog(scanId);

  const summary: ScanAuditSummary = {
    totalExpected: 0,
    totalExecuted: 0,
    totalPassed: 0,
    totalFailed: 0,
    totalErrored: 0,
    coveragePercent: 0,
    byCategory: {
      accessibility: { expected: 0, executed: 0, passed: 0, failed: 0, errored: 0 },
    },
  };

  for (const entry of entries) {
    if (entry.expected) {
      summary.totalExpected++;
      summary.byCategory[entry.category].expected++;
    }
    if (entry.executed) {
      summary.totalExecuted++;
      summary.byCategory[entry.category].executed++;
    }
    if (entry.passed === true) {
      summary.totalPassed++;
      summary.byCategory[entry.category].passed++;
    } else if (entry.passed === false && entry.errorMessage) {
      summary.totalErrored++;
      summary.byCategory[entry.category].errored++;
    } else if (entry.passed === false) {
      summary.totalFailed++;
      summary.byCategory[entry.category].failed++;
    }
  }

  summary.coveragePercent =
    summary.totalExpected > 0
      ? Math.round((summary.totalExecuted / summary.totalExpected) * 100)
      : 100;

  return summary;
}
