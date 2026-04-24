import { Router } from 'express';
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  deleteCampaigns,
  createScan,
  listScans,
  getLatestScan,
} from '../db/queries.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { validateCampaignCreate, validateCampaignUpdate } from '../middleware/validate.js';
import { scheduler } from '../services/scheduler/index.js';
import { isValidCron } from '../services/scheduler/cron-helpers.js';
import type { UpdateCampaignInput } from '../db/queries.js';
import { executeScan } from '../services/scanner/index.js';
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

// GET /api/campaigns — List all campaigns (with latest scan info)
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    if (USE_POSTGRES_PRIMARY && pgDb) {
      const campaigns = await pgQueries.listCampaignsPostgres(pgDb);
      res.json(campaigns);
    } else {
      const campaigns = listCampaigns();
      res.json(campaigns);
    }
  }),
);

// POST /api/campaigns — Create a new campaign
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = validateCampaignCreate(req.body);
    
    let campaign;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      campaign = await pgQueries.createCampaignPostgres(pgDb, data);
    } else {
      campaign = createCampaign(data);
    }

    // Register cron schedule if provided and valid
    if (campaign.scheduleCron && isValidCron(campaign.scheduleCron)) {
      scheduler.schedule(campaign.id, campaign.scheduleCron);
    }

    res.status(201).json(campaign);
  }),
);

// GET /api/campaigns/:id — Get campaign detail (with sites and latest scan)
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    
    let campaign;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      campaign = await pgQueries.getCampaignPostgres(pgDb, id);
    } else {
      campaign = getCampaign(id);
    }
    
    if (!campaign) throw new NotFoundError('Campaign');

    let latestScan;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      latestScan = await pgQueries.getLatestScanPostgres(pgDb, id);
    } else {
      latestScan = getLatestScan(id);
    }
    
    res.json({ ...campaign, latestScan });
  }),
);

// PUT /api/campaigns/:id — Update campaign
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    
    let existing;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      existing = await pgQueries.getCampaignPostgres(pgDb, id);
    } else {
      existing = getCampaign(id);
    }
    
    if (!existing) throw new NotFoundError('Campaign');

    const data = validateCampaignUpdate(req.body);
    
    let updated;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      updated = await pgQueries.updateCampaignPostgres(pgDb, id, data as pgQueries.UpdateCampaignInput);
    } else {
      updated = updateCampaign(id, data as UpdateCampaignInput);
    }
    
    const newStatus = (data as UpdateCampaignInput).status;
    const newCron = (data as UpdateCampaignInput).scheduleCron;

    if (newStatus === 'paused' || newStatus === 'completed') {
      // Pausing/completing a campaign removes its schedule
      scheduler.unschedule(id);
    } else if (newStatus === 'active' && updated?.scheduleCron && isValidCron(updated.scheduleCron)) {
      // Re-activating a campaign with a schedule
      scheduler.schedule(id, updated.scheduleCron);
    } else if (newCron !== undefined) {
      // Schedule was explicitly changed
      if (newCron && isValidCron(newCron) && updated?.status === 'active') {
        scheduler.reschedule(id, newCron);
      } else {
        // Cron cleared or campaign not active
        scheduler.unschedule(id);
      }
    }

    res.json(updated);
  }),
);

// DELETE /api/campaigns — Bulk delete campaigns
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids must be a non-empty array' });
      return;
    }

    // Unschedule all campaigns being deleted
    for (const id of ids) {
      scheduler.unschedule(id);
    }

    let deleted = 0;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      for (const id of ids) {
        await pgQueries.deleteCampaignPostgres(pgDb, id);
        deleted++;
      }
    } else {
      deleted = deleteCampaigns(ids);
    }
    
    res.json({ deleted });
  }),
);

// DELETE /api/campaigns/:id — Delete campaign
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    scheduler.unschedule(id);
    
    let existed;
    if (USE_POSTGRES_PRIMARY && pgDb) {
      existed = await pgQueries.deleteCampaignPostgres(pgDb, id);
    } else {
      existed = deleteCampaign(id);
    }
    
    if (!existed) throw new NotFoundError('Campaign');
    res.status(204).send();
  }),
);

// POST /api/campaigns/:id/scan — Trigger a new scan for this campaign
router.post(
  '/:id/scan',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const campaign = getCampaign(id);
    if (!campaign) throw new NotFoundError('Campaign');

    const scan = createScan(id);

    // Kick off scan in the background — don't await
    executeScan({
      scanId: scan.id,
      campaignId: id,
      sites: campaign.sites.map((s) => ({ id: s.id, url: s.url, label: s.label })),
      complianceLevel: campaign.complianceLevel,
      categories: campaign.categories,
      scanDepth: campaign.scanDepth,
      maxPagesToScan: campaign.maxPagesToScan,
      siteConcurrency: campaign.siteConcurrency,
      pageConcurrency: campaign.pageConcurrency,
    }).catch((err) => {
      console.error(`Background scan ${scan.id} error:`, err);
    });

    res.status(201).json(scan);
  }),
);

// GET /api/campaigns/:id/scans — List all scans for a campaign
router.get(
  '/:id/scans',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const campaign = getCampaign(id);
    if (!campaign) throw new NotFoundError('Campaign');

    const scans = listScans(id);
    res.json(scans);
  }),
);

export default router;
