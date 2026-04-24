import { Router } from 'express';
import {
  listScans,
  getScan,
  getResultsByScan,
  getResultsByCategory,
  getResultsBySite,
  getIssuesByResult,
  getAuditLog,
  getAuditLogByCategory,
  getAuditSummary,
} from '../db/queries.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import type { AuditCategory, ScanIssue } from '@compliance-portal/shared';
import PostgresDatabase from '../db/postgres.js';
import * as pgQueries from '../db/queries-postgres.js';

// Detect PostgreSQL primary mode
const USE_POSTGRES_PRIMARY = Boolean(process.env.PGHOST || process.env.DATABASE_URL);
const pgDb = USE_POSTGRES_PRIMARY
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

const router = Router();

// GET /api/scans — List all scans (optional ?campaignId= filter)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const campaignId = req.query.campaignId as string | undefined;
    
    let scans;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      scans = await pgQueries.listScansPostgres(pgDb, campaignId);
    } else {
      scans = listScans(campaignId);
    }
    
    res.json(scans);
  }),
);

// GET /api/scans/:id — Get scan detail with summary
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    
    let scan;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      scan = await pgQueries.getScanPostgres(pgDb, id);
    } else {
      scan = getScan(id);
    }
    
    if (!scan) throw new NotFoundError('Scan');
    res.json(scan);
  }),
);

// GET /api/scans/:id/results — Get scan results (optional ?category= and ?siteId= filters)
router.get(
  '/:id/results',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    
    let scan;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      scan = await pgQueries.getScanPostgres(pgDb, id);
    } else {
      scan = getScan(id);
    }
    
    if (!scan) throw new NotFoundError('Scan');

    const { category, siteId } = req.query;

    let results;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      if (siteId && typeof siteId === 'string') {
        results = await pgQueries.getResultsBySitePostgres(pgDb, id, siteId);
      } else if (category && typeof category === 'string') {
        results = await pgQueries.getResultsByCategoryPostgres(pgDb, id, category as AuditCategory);
      } else {
        results = await pgQueries.getResultsByScanPostgres(pgDb, id);
      }
    } else {
      if (siteId && typeof siteId === 'string') {
        results = getResultsBySite(id, siteId);
      } else if (category && typeof category === 'string') {
        results = getResultsByCategory(id, category as AuditCategory);
      } else {
        results = getResultsByScan(id);
      }
    }

    res.json(results);
  }),
);

// GET /api/scans/:id/issues — Get all issues for a scan (optional ?severity= filter)
router.get(
  '/:id/issues',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    
    let scan;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      scan = await pgQueries.getScanPostgres(pgDb, id);
    } else {
      scan = getScan(id);
    }
    
    if (!scan) throw new NotFoundError('Scan');

    let results;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      results = await pgQueries.getResultsByScanPostgres(pgDb, id);
    } else {
      results = getResultsByScan(id);
    }
    
    let allIssues: ScanIssue[] = [];
    for (const result of results) {
      let issues;
      if (USE_POSTGRES_PRIMARY && pgDb) {
        issues = await pgQueries.getIssuesByResultPostgres(pgDb, result.id);
      } else {
        issues = getIssuesByResult(result.id);
      }
      
      allIssues = allIssues.concat(issues);
    }

    const severity = req.query.severity as string | undefined;
    if (severity) {
      allIssues = allIssues.filter((issue) => issue.severity === severity);
    }

    res.json(allIssues);
  }),
);

// GET /api/scans/:id/audit-log/summary — Get audit log coverage summary
router.get(
  '/:id/audit-log/summary',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    
    let scan;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      scan = await pgQueries.getScanPostgres(pgDb, id);
    } else {
      scan = getScan(id);
    }
    
    if (!scan) throw new NotFoundError('Scan');

    let summary;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      summary = await pgQueries.getAuditSummaryPostgres(pgDb, id);
    } else {
      summary = getAuditSummary(id);
    }
    
    res.json(summary);
  }),
);

// GET /api/scans/:id/audit-log — Get audit log entries for a scan
router.get(
  '/:id/audit-log',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    
    let scan;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      scan = await pgQueries.getScanPostgres(pgDb, id);
    } else {
      scan = getScan(id);
    }
    
    if (!scan) throw new NotFoundError('Scan');

    const category = req.query.category as AuditCategory | undefined;
    
    let entries;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      entries = category
        ? await pgQueries.getAuditLogByCategoryPostgres(pgDb, id, category)
        : await pgQueries.getAuditLogPostgres(pgDb, id);
    } else {
      entries = category
        ? getAuditLogByCategory(id, category)
        : getAuditLog(id);
    }

    res.json(entries);
  }),
);

export default router;
