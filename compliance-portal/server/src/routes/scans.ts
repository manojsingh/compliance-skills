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

const router = Router();

// GET /api/scans — List all scans (optional ?campaignId= filter)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const campaignId = req.query.campaignId as string | undefined;
    const scans = listScans(campaignId);
    res.json(scans);
  }),
);

// GET /api/scans/:id — Get scan detail with summary
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const scan = getScan(id);
    if (!scan) throw new NotFoundError('Scan');
    res.json(scan);
  }),
);

// GET /api/scans/:id/results — Get scan results (optional ?category= and ?siteId= filters)
router.get(
  '/:id/results',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const scan = getScan(id);
    if (!scan) throw new NotFoundError('Scan');

    const { category, siteId } = req.query;

    let results;
    if (siteId && typeof siteId === 'string') {
      results = getResultsBySite(id, siteId);
    } else if (category && typeof category === 'string') {
      results = getResultsByCategory(id, category as AuditCategory);
    } else {
      results = getResultsByScan(id);
    }

    res.json(results);
  }),
);

// GET /api/scans/:id/issues — Get all issues for a scan (optional ?severity= filter)
router.get(
  '/:id/issues',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const scan = getScan(id);
    if (!scan) throw new NotFoundError('Scan');

    const results = getResultsByScan(id);
    let allIssues: ScanIssue[] = [];
    for (const result of results) {
      const issues = getIssuesByResult(result.id);
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
    const scan = getScan(id);
    if (!scan) throw new NotFoundError('Scan');

    const summary = getAuditSummary(id);
    res.json(summary);
  }),
);

// GET /api/scans/:id/audit-log — Get audit log entries for a scan
router.get(
  '/:id/audit-log',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const scan = getScan(id);
    if (!scan) throw new NotFoundError('Scan');

    const category = req.query.category as AuditCategory | undefined;
    const entries = category
      ? getAuditLogByCategory(id, category)
      : getAuditLog(id);

    res.json(entries);
  }),
);

export default router;
