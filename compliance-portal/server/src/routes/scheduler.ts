import { Router } from 'express';
import { scheduler } from '../services/scheduler/index.js';
import { schedulePresets, isValidCron, describeCron, getNextRuns } from '../services/scheduler/cron-helpers.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

// GET /api/scheduler/status — List all scheduled jobs with next run times
router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const jobs = scheduler.getScheduledJobs();
    res.json({
      totalJobs: jobs.length,
      jobs,
    });
  }),
);

// GET /api/scheduler/presets — Available schedule presets for the frontend
router.get(
  '/presets',
  asyncHandler(async (_req, res) => {
    const presets = Object.entries(schedulePresets).map(([key, value]) => ({
      key,
      ...value,
    }));
    res.json(presets);
  }),
);

// POST /api/scheduler/validate — Validate a cron expression and return description + next runs
router.post(
  '/validate',
  asyncHandler(async (req, res) => {
    const { expression } = req.body as { expression?: string };

    if (!expression || typeof expression !== 'string') {
      res.status(400).json({ error: { message: 'expression is required', code: 'VALIDATION_ERROR' } });
      return;
    }

    const valid = isValidCron(expression);
    res.json({
      expression,
      valid,
      description: valid ? describeCron(expression) : null,
      nextRuns: valid ? getNextRuns(expression, 5).map((d) => d.toISOString()) : [],
    });
  }),
);

export default router;
