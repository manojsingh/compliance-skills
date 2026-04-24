import { Router } from 'express';
import { getDashboardSummary, getRecentScans } from '../db/queries.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as pgQueries from '../db/queries-postgres.js';
import { sharedPgDb as pgDb, USE_POSTGRES as USE_POSTGRES_PRIMARY } from '../db/shared.js';

const router = Router();

// GET /api/dashboard/summary — Aggregate dashboard stats
router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    let summary;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      summary = await pgQueries.getDashboardSummaryPostgres(pgDb);
    } else {
      summary = getDashboardSummary();
    }
    
    res.json(summary);
  }),
);

// GET /api/dashboard/recent-scans — Recent scans with campaign info
router.get(
  '/recent-scans',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    
    let scans;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      scans = await pgQueries.getRecentScansPostgres(pgDb, limit);
    } else {
      scans = getRecentScans(limit);
    }
    
    res.json(scans);
  }),
);

export default router;
