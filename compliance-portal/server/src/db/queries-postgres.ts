/**
 * PostgreSQL-specific async query layer
 * Use these functions when PostgreSQL primary mode is enabled
 */

import { v4 as uuidv4 } from 'uuid';
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

function toSite(row: any): CampaignSite {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    url: row.url,
    label: row.label,
  };
}

export async function listCampaignsPostgres(db: PostgresDatabase): Promise<(Campaign & {
  siteCount: number;
  scanCount: number;
  latestScanStatus: string | null;
  latestScanId: string | null;
  latestScanSummary: string | null;
  latestScanDate: string | null;
})[]> {
  const rows = await db.query<any>(`
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

export async function getCampaignPostgres(db: PostgresDatabase, id: string): Promise<(Campaign & { sites: CampaignSite[] }) | null> {
  const row = await db.queryOne<CampaignRow>(
    'SELECT * FROM campaigns WHERE id = $1',
    [id]
  );
  if (!row) return null;

  const siteRows = await db.query<any>(
    'SELECT * FROM campaign_sites WHERE campaign_id = $1',
    [id]
  );

  return {
    ...toCampaign(row),
    sites: siteRows.map(toSite),
  };
}

export async function createCampaignPostgres(db: PostgresDatabase, data: CreateCampaignInput): Promise<Campaign & { sites: CampaignSite[] }> {
  const campaignId = uuidv4();
  const sites: CampaignSite[] = data.sites.map((s) => ({
    id: uuidv4(),
    campaignId,
    url: s.url,
    label: s.label ?? '',
  }));

  await db.transaction(async (client) => {
    await client.query(
      `INSERT INTO campaigns (
        id, name, compliance_level, categories, scan_depth, max_pages_to_scan, site_concurrency, page_concurrency, schedule_cron
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        campaignId,
        data.name,
        data.complianceLevel,
        JSON.stringify(data.categories),
        data.scanDepth ?? 2,
        data.maxPagesToScan ?? null,
        data.siteConcurrency ?? 2,
        data.pageConcurrency ?? 3,
        data.scheduleCron ?? null,
      ],
    );

    for (const site of sites) {
      await client.query(
        `INSERT INTO campaign_sites (id, campaign_id, url, label) VALUES ($1, $2, $3, $4)`,
        [site.id, site.campaignId, site.url, site.label],
      );
    }
  });

  const campaign = await getCampaignPostgres(db, campaignId);
  if (!campaign) throw new Error('Failed to retrieve created campaign');
  return campaign;
}

export async function updateCampaignPostgres(db: PostgresDatabase, id: string, data: UpdateCampaignInput): Promise<Campaign | null> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex}`);
    params.push(data.name);
    paramIndex++;
  }
  if (data.complianceLevel !== undefined) {
    updates.push(`compliance_level = $${paramIndex}`);
    params.push(data.complianceLevel);
    paramIndex++;
  }
  if (data.categories !== undefined) {
    updates.push(`categories = $${paramIndex}`);
    params.push(JSON.stringify(data.categories));
    paramIndex++;
  }
  if (data.scanDepth !== undefined) {
    updates.push(`scan_depth = $${paramIndex}`);
    params.push(data.scanDepth);
    paramIndex++;
  }
  if (data.maxPagesToScan !== undefined) {
    updates.push(`max_pages_to_scan = $${paramIndex}`);
    params.push(data.maxPagesToScan);
    paramIndex++;
  }
  if (data.siteConcurrency !== undefined) {
    updates.push(`site_concurrency = $${paramIndex}`);
    params.push(data.siteConcurrency);
    paramIndex++;
  }
  if (data.pageConcurrency !== undefined) {
    updates.push(`page_concurrency = $${paramIndex}`);
    params.push(data.pageConcurrency);
    paramIndex++;
  }
  if (data.scheduleCron !== undefined) {
    updates.push(`schedule_cron = $${paramIndex}`);
    params.push(data.scheduleCron);
    paramIndex++;
  }
  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex}`);
    params.push(data.status);
    paramIndex++;
  }

  if (updates.length === 0 && data.sites === undefined) return getCampaignPostgres(db, id);

  await db.transaction(async (client) => {
    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      params.push(id);
      const sql = `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
      await client.query(sql, params);
    }

    if (data.sites !== undefined) {
      await client.query('DELETE FROM campaign_sites WHERE campaign_id = $1', [id]);
      for (const site of data.sites) {
        await client.query(
          'INSERT INTO campaign_sites (id, campaign_id, url, label) VALUES ($1, $2, $3, $4)',
          [uuidv4(), id, site.url, site.label ?? ''],
        );
      }
    }
  });

  return getCampaignPostgres(db, id);
}

export async function deleteCampaignPostgres(db: PostgresDatabase, id: string): Promise<boolean> {
  await db.transaction(async (client) => {
    await client.query('DELETE FROM scan_issues WHERE scan_id IN (SELECT id FROM scans WHERE campaign_id = $1)', [id]);
    await client.query('DELETE FROM scan_results WHERE scan_id IN (SELECT id FROM scans WHERE campaign_id = $1)', [id]);
    await client.query('DELETE FROM scans WHERE campaign_id = $1', [id]);
    await client.query('DELETE FROM campaign_sites WHERE campaign_id = $1', [id]);
    await client.query('DELETE FROM campaigns WHERE id = $1', [id]);
  });
  return true;
}

export async function createScanPostgres(db: PostgresDatabase, campaignId: string): Promise<Scan> {
  const id = uuidv4();
  await db.query(
    `INSERT INTO scans (id, campaign_id, status, created_at)
     VALUES ($1, $2, 'pending', NOW())`,
    [id, campaignId]
  );
  return {
    id,
    campaignId,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    summary: null,
  };
}

export async function getLatestScanPostgres(db: PostgresDatabase, campaignId: string): Promise<Scan | null> {
  const row = await db.queryOne<any>(
    'SELECT * FROM scans WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 1',
    [campaignId]
  );
  if (!row) return null;

  return {
    id: row.id,
    campaignId: row.campaign_id,
    status: row.status as Scan['status'],
    startedAt: row.started_at,
    completedAt: row.completed_at,
    summary: row.summary ? JSON.parse(row.summary) as ScanSummary : null,
  };
}

// Scans query functions
export async function listScansPostgres(db: PostgresDatabase, campaignId?: string): Promise<(Scan & { campaignName: string })[]> {
  let query = `
    SELECT s.*, c.name as campaign_name
    FROM scans s
    JOIN campaigns c ON s.campaign_id = c.id
  `;
  const params: any[] = [];

  if (campaignId) {
    query += ' WHERE s.campaign_id = $1';
    params.push(campaignId);
  }

  query += ' ORDER BY s.created_at DESC';

  const rows = await db.query<any>(query, params);
  return rows.map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    status: row.status as Scan['status'],
    startedAt: row.started_at,
    completedAt: row.completed_at,
    summary: row.summary ? JSON.parse(row.summary) as ScanSummary : null,
    campaignName: row.campaign_name,
  }));
}

export async function getScanPostgres(db: PostgresDatabase, id: string): Promise<Scan | null> {
  const row = await db.queryOne<any>(
    'SELECT * FROM scans WHERE id = $1',
    [id]
  );
  if (!row) return null;

  return {
    id: row.id,
    campaignId: row.campaign_id,
    status: row.status as Scan['status'],
    startedAt: row.started_at,
    completedAt: row.completed_at,
    summary: row.summary ? JSON.parse(row.summary) as ScanSummary : null,
  };
}

export async function getResultsByScanPostgres(db: PostgresDatabase, scanId: string): Promise<ScanResult[]> {
  const rows = await db.query<any>(
    `SELECT * FROM scan_results WHERE scan_id = $1 ORDER BY page_url ASC`,
    [scanId]
  );

  return rows.map((row) => ({
    id: row.id,
    scanId: row.scan_id,
    siteId: row.site_id,
    pageUrl: row.page_url,
    category: row.category as AuditCategory,
    score: row.score,
    issuesCount: row.issues_count,
    details: JSON.parse(row.details),
  }));
}

export async function getResultsByCategoryPostgres(db: PostgresDatabase, scanId: string, category: AuditCategory): Promise<ScanResult[]> {
  const rows = await db.query<any>(
    `SELECT * FROM scan_results WHERE scan_id = $1 AND category = $2 ORDER BY page_url ASC`,
    [scanId, category]
  );

  return rows.map((row) => ({
    id: row.id,
    scanId: row.scan_id,
    siteId: row.site_id,
    pageUrl: row.page_url,
    category: row.category as AuditCategory,
    score: row.score,
    issuesCount: row.issues_count,
    details: JSON.parse(row.details),
  }));
}

export async function getResultsBySitePostgres(db: PostgresDatabase, scanId: string, siteId: string): Promise<ScanResult[]> {
  const rows = await db.query<any>(
    `SELECT * FROM scan_results WHERE scan_id = $1 AND site_id = $2 ORDER BY page_url ASC`,
    [scanId, siteId]
  );

  return rows.map((row) => ({
    id: row.id,
    scanId: row.scan_id,
    siteId: row.site_id,
    pageUrl: row.page_url,
    category: row.category as AuditCategory,
    score: row.score,
    issuesCount: row.issues_count,
    details: JSON.parse(row.details),
  }));
}

export async function getIssuesByResultPostgres(db: PostgresDatabase, resultId: string): Promise<ScanIssue[]> {
  const rows = await db.query<any>(
    `SELECT * FROM scan_issues WHERE result_id = $1`,
    [resultId]
  );

  return rows.map((row) => ({
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
  }));
}

export async function getAuditLogPostgres(db: PostgresDatabase, scanId: string): Promise<any[]> {
  const rows = await db.query<any>(
    `SELECT * FROM scan_audit_log WHERE scan_id = $1 ORDER BY event_date DESC`,
    [scanId]
  );

  return rows;
}

export async function getAuditLogByCategoryPostgres(db: PostgresDatabase, scanId: string, category: string): Promise<any[]> {
  const rows = await db.query<any>(
    `SELECT * FROM scan_audit_log WHERE scan_id = $1 AND category = $2 ORDER BY event_date DESC`,
    [scanId, category]
  );

  return rows;
}

export async function getAuditSummaryPostgres(db: PostgresDatabase, scanId: string): Promise<any> {
  const summary = await db.queryOne<any>(
    `SELECT 
      COUNT(*) as total_entries,
      SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_severity,
      SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium_severity,
      SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low_severity
    FROM scan_audit_log
    WHERE scan_id = $1`,
    [scanId]
  );

  return summary;
}

// Dashboard query functions
export async function getDashboardSummaryPostgres(db: PostgresDatabase): Promise<any> {
  const row = await db.queryOne<any>(
    `SELECT
      (SELECT COUNT(*) FROM campaigns) as total_campaigns,
      (SELECT COUNT(*) FROM campaigns WHERE status = 'active') as active_campaigns,
      (SELECT COUNT(*) FROM scans) as total_scans,
      (SELECT COUNT(*) FROM scans WHERE status = 'completed') as completed_scans,
      (SELECT COUNT(*) FROM scan_issues) as total_issues,
      (SELECT COUNT(*) FROM scan_issues WHERE severity = 'high') as high_severity_issues,
      (SELECT COUNT(*) FROM campaign_sites) as total_sites
    FROM campaigns LIMIT 1`
  );

  return {
    totalCampaigns: row?.total_campaigns ?? 0,
    activeCampaigns: row?.active_campaigns ?? 0,
    totalScans: row?.total_scans ?? 0,
    completedScans: row?.completed_scans ?? 0,
    totalIssues: row?.total_issues ?? 0,
    highSeverityIssues: row?.high_severity_issues ?? 0,
    totalSites: row?.total_sites ?? 0,
  };
}

export async function getRecentScansPostgres(db: PostgresDatabase, limit: number): Promise<(Scan & { campaignName: string })[]> {
  const rows = await db.query<any>(
    `SELECT s.*, c.name as campaign_name
    FROM scans s
    JOIN campaigns c ON s.campaign_id = c.id
    WHERE s.status = 'completed'
    ORDER BY s.completed_at DESC
    LIMIT $1`,
    [limit]
  );

  return rows.map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    status: row.status as Scan['status'],
    startedAt: row.started_at,
    completedAt: row.completed_at,
    summary: row.summary ? JSON.parse(row.summary) as ScanSummary : null,
    campaignName: row.campaign_name,
  }));
}
