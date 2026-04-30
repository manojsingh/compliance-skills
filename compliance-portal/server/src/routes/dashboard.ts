import { Router } from 'express';
import { getDashboardSummary, getRecentScans } from '../db/queries.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as pgQueries from '../db/queries-postgres.js';
import { sharedPgDb as pgDb, USE_POSTGRES as USE_POSTGRES_PRIMARY } from '../db/shared.js';
import { cached } from '../utils/cache.js';

const router = Router();

// GET /api/dashboard/summary — Aggregate dashboard stats
router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    // Cache dashboard summary for 30 seconds (high read, low write)
    const summary = await cached(
      'dashboard:summary',
      async () => {
        if (USE_POSTGRES_PRIMARY && pgDb) {
          return await pgQueries.getDashboardSummaryPostgres(pgDb);
        } else {
          return getDashboardSummary();
        }
      },
      30_000, // 30 seconds TTL
    );
    
    res.json(summary);
  }),
);

// GET /api/dashboard/recent-scans — Recent scans with campaign info
router.get(
  '/recent-scans',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    
    // Cache recent scans for 15 seconds
    const scans = await cached(
      `dashboard:recent-scans:${limit}`,
      async () => {
        if (USE_POSTGRES_PRIMARY && pgDb) {
          return await pgQueries.getRecentScansPostgres(pgDb, limit);
        } else {
          return getRecentScans(limit);
        }
      },
      15_000, // 15 seconds TTL
    );
    
    res.json(scans);
  }),
);

export default router;
