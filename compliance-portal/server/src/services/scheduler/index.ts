import cron from 'node-cron';
import { createScan, getLatestScan, getCampaign } from '../../db/queries.js';
import db from '../../db/index.js';
import { isValidCron, describeCron, getNextRuns } from './cron-helpers.js';

// ---------------------------------------------------------------------------
// Conditionally import the scanner service (may not exist yet)
// ---------------------------------------------------------------------------

type ExecuteScanFn = (config: {
  scanId: string;
  campaignId: string;
  sites: Array<{ id: string; url: string; label: string }>;
  complianceLevel: 'A' | 'AA' | 'AAA';
  categories: string[];
  scanDepth: number;
}) => Promise<void>;

let executeScan: ExecuteScanFn | null = null;

async function loadScanner(): Promise<void> {
  try {
    // Use a variable to prevent TypeScript from resolving the module at compile time.
    // The scanner service may not exist yet — another agent will create it.
    const scannerPath = '../scanner/index.js';
    const scanner = await import(/* @vite-ignore */ scannerPath);
    if (typeof scanner.executeScan === 'function') {
      executeScan = scanner.executeScan;
      console.log('[Scheduler] Scanner service loaded');
    }
  } catch {
    console.log('[Scheduler] Scanner service not available — scans will be created but not executed');
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduledJob {
  campaignId: string;
  task: cron.ScheduledTask;
  cronExpression: string;
}

export interface ScheduledJobInfo {
  campaignId: string;
  campaignName: string | null;
  cronExpression: string;
  description: string;
  nextRuns: string[];
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

interface ActiveScheduleRow {
  id: string;
  name: string;
  schedule_cron: string;
}

const listActiveSchedulesStmt = db.prepare(`
  SELECT id, name, schedule_cron
  FROM campaigns
  WHERE status = 'active' AND schedule_cron IS NOT NULL AND schedule_cron != ''
`);

// ---------------------------------------------------------------------------
// ScanScheduler
// ---------------------------------------------------------------------------

class ScanScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();

  /** Boot the scheduler — reload all active campaign schedules from DB. */
  async initialize(): Promise<void> {
    await loadScanner();

    const rows = listActiveSchedulesStmt.all() as ActiveScheduleRow[];
    let count = 0;

    for (const row of rows) {
      if (isValidCron(row.schedule_cron)) {
        this.schedule(row.id, row.schedule_cron);
        count++;
      } else {
        console.warn(`[Scheduler] Invalid cron "${row.schedule_cron}" for campaign ${row.id} (${row.name}) — skipped`);
      }
    }

    console.log(`[Scheduler] Initialized — ${count} job(s) registered`);
  }

  /** Register (or replace) a cron job for a campaign. */
  schedule(campaignId: string, cronExpression: string): void {
    if (!isValidCron(cronExpression)) {
      console.warn(`[Scheduler] Refusing to schedule invalid cron "${cronExpression}" for campaign ${campaignId}`);
      return;
    }

    // Remove existing job first if any
    if (this.jobs.has(campaignId)) {
      this.unschedule(campaignId);
    }

    const task = cron.schedule(cronExpression, () => {
      void this.runScan(campaignId);
    });

    this.jobs.set(campaignId, { campaignId, task, cronExpression });
    console.log(`[Scheduler] Job registered for campaign ${campaignId} — ${describeCron(cronExpression)}`);
  }

  /** Stop and remove the cron job for a campaign. */
  unschedule(campaignId: string): void {
    const job = this.jobs.get(campaignId);
    if (job) {
      job.task.stop();
      this.jobs.delete(campaignId);
      console.log(`[Scheduler] Job removed for campaign ${campaignId}`);
    }
  }

  /** Replace a campaign's schedule. */
  reschedule(campaignId: string, cronExpression: string): void {
    this.unschedule(campaignId);
    this.schedule(campaignId, cronExpression);
  }

  /** Return info about every registered job. */
  getScheduledJobs(): ScheduledJobInfo[] {
    const infos: ScheduledJobInfo[] = [];

    for (const [, job] of this.jobs) {
      let campaignName: string | null = null;
      try {
        const campaign = getCampaign(job.campaignId);
        campaignName = campaign?.name ?? null;
      } catch { /* ignore */ }

      infos.push({
        campaignId: job.campaignId,
        campaignName,
        cronExpression: job.cronExpression,
        description: describeCron(job.cronExpression),
        nextRuns: getNextRuns(job.cronExpression, 3).map((d) => d.toISOString()),
      });
    }

    return infos;
  }

  /** Check whether a campaign is currently scheduled. */
  isScheduled(campaignId: string): boolean {
    return this.jobs.has(campaignId);
  }

  /** Gracefully stop all jobs. */
  shutdown(): void {
    for (const [, job] of this.jobs) {
      job.task.stop();
    }
    const count = this.jobs.size;
    this.jobs.clear();
    console.log(`[Scheduler] Shutdown — ${count} job(s) stopped`);
  }

  // -------------------------------------------------------------------------
  // Internal: trigger a scan for a campaign
  // -------------------------------------------------------------------------

  private async runScan(campaignId: string): Promise<void> {
    try {
      // Ensure campaign still exists and is active
      const campaign = getCampaign(campaignId);
      if (!campaign) {
        console.warn(`[Scheduler] Campaign ${campaignId} no longer exists — removing job`);
        this.unschedule(campaignId);
        return;
      }
      if (campaign.status !== 'active') {
        console.log(`[Scheduler] Campaign ${campaignId} is not active (${campaign.status}) — skipping`);
        return;
      }

      // Don't stack scans: skip if there's already a running/pending scan
      const latest = getLatestScan(campaignId);
      if (latest && (latest.status === 'pending' || latest.status === 'running')) {
        console.log(`[Scheduler] Campaign ${campaignId} already has a ${latest.status} scan — skipping`);
        return;
      }

      // Create scan record
      const scan = createScan(campaignId);
      console.log(`[Scheduler] Triggered scan ${scan.id} for campaign ${campaignId} (${campaign.name})`);

      // Execute the scan if the scanner service is available
      if (executeScan) {
        await executeScan({
          scanId: scan.id,
          campaignId,
          sites: campaign.sites.map((s) => ({ id: s.id, url: s.url, label: s.label })),
          complianceLevel: campaign.complianceLevel,
          categories: campaign.categories,
          scanDepth: campaign.scanDepth,
        });
      }
    } catch (err) {
      console.error(`[Scheduler] Error running scan for campaign ${campaignId}:`, err);
      // Schedule continues — we don't unschedule on transient errors
    }
  }
}

// Singleton
export const scheduler = new ScanScheduler();
