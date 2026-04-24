import { Router } from 'express';
import { getDashboardSummary, getRecentScans } from '../db/queries.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
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
