import { Router } from 'express';
import { getDashboardSummary, getRecentScans } from '../db/queries.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// GET /api/dashboard/summary — Aggregate dashboard stats
router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const summary = getDashboardSummary();
    res.json(summary);
  }),
);

// GET /api/dashboard/recent-scans — Recent scans with campaign info
router.get(
  '/recent-scans',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const scans = getRecentScans(limit);
    res.json(scans);
  }),
);

export default router;
