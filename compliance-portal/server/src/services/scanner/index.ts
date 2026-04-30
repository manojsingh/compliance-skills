import { chromium, type Browser, type Page } from 'playwright';
import {
  updateScanStatus,
  insertScanResult,
  insertScanIssues,
  insertAuditLogBatch,
} from '../../db/queries.js';
import type { InsertAuditLogInput } from '../../db/queries.js';
import type { AuditCategory, ScanSummary, ComplianceLevel, Scan, ScanIssue, ScanResult } from '@compliance-portal/shared';
import * as pgQueries from '../../db/queries-postgres.js';
import { getCriteriaForLevel } from '../../data/wcag-helpers.js';
import { crawlSite } from './crawler.js';
import { auditAccessibility } from './accessibility.js';
import { sharedPgDb as pgDb, USE_POSTGRES as USE_POSTGRES_PRIMARY } from '../../db/shared.js';
import { invalidatePattern } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';
import { perfMonitor } from '../../utils/performance.js';

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      try {
        await fn(item);
      } catch (err) {
        // Log but continue processing remaining items in this worker
        console.error('runWithConcurrency: item failed:', err);
      }
    }
  });
  await Promise.allSettled(workers);
}

export interface ScanConfig {
  scanId: string;
  campaignId: string;
  sites: Array<{ id: string; url: string; label: string }>;
  complianceLevel: ComplianceLevel;
  categories: AuditCategory[];
  scanDepth: number;
  maxPagesToScan: number | null;
  siteConcurrency: number;
  pageConcurrency: number;
}

// Shorter timeout on Azure/production — avoids blocking per slow page
const PAGE_TIMEOUT = (process.env.WEBSITES_PORT !== undefined || process.env.NODE_ENV === 'production') ? 10_000 : 30_000;
// Brief settle so JS frameworks finish rendering before axe runs (audit phase only)
const AUDIT_SETTLE_MS = 50;

/**
 * Optimize concurrency for limited resources in containerized environments.
 * Azure B1 tier has only 1 CPU core - reduce parallelism to avoid thrashing.
 */
function optimizeConcurrencyForEnvironment(config: ScanConfig): ScanConfig {
  // Detect Azure App Service (WEBSITES_PORT is reliably set in containers)
  const isAzure = process.env.WEBSITES_PORT !== undefined;
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isAzure && isProduction) {
    console.log(`[Scanner] Azure environment detected - optimizing concurrency (site: ${config.siteConcurrency}→1, page: ${config.pageConcurrency}→5)`);
    // In Azure process sites sequentially to avoid memory pressure, but allow
    // 5 parallel page tabs (IO-bound network operations, so more concurrency helps despite 1 CPU)
    return {
      ...config,
      siteConcurrency: Math.min(config.siteConcurrency, 1), // Process sites sequentially
      pageConcurrency: Math.min(config.pageConcurrency, 5), // Max 5 pages at once
    };
  }
  
  console.log(`[Scanner] Local environment - using configured concurrency (site: ${config.siteConcurrency}, page: ${config.pageConcurrency})`);
  return config;
}

async function insertExpectedRules(
  scanId: string,
  siteId: string,
  pageUrl: string,
  categories: AuditCategory[],
  complianceLevel: ComplianceLevel,
): Promise<void> {
  const entries: InsertAuditLogInput[] = [];

  if (categories.includes('accessibility')) {
    const criteria = getCriteriaForLevel(complianceLevel);
    for (const c of criteria) {
      entries.push({
        scanId,
        category: 'accessibility',
        ruleId: c.id,
        ruleName: c.name,
        expected: true,
        executed: false,
        passed: null,
        siteId,
        pageUrl,
      });
    }
  }

  if (entries.length > 0) {
    if (USE_POSTGRES_PRIMARY && pgDb) {
      await pgQueries.insertAuditLogBatchPostgres(pgDb, entries);
    } else {
      insertAuditLogBatch(entries);
    }
  }
}

async function setScanStatus(scanId: string, status: Scan['status'], summary?: ScanSummary): Promise<void> {
  try {
    if (USE_POSTGRES_PRIMARY && pgDb) {
      console.log(`[setScanStatus] Updating scan ${scanId} to status: ${status}`);
      const result = await pgQueries.updateScanStatusPostgres(pgDb, scanId, status, summary);
      if (result) {
        console.log(`[setScanStatus] SUCCESS - Scan ${scanId} updated to ${status} (DB confirmed status: ${result.status})`);
        // Invalidate dashboard cache when scan status changes
        invalidatePattern('dashboard:');
      } else {
        console.error(`[setScanStatus] WARNING - updateScanStatusPostgres returned null for scan ${scanId}`);
      }
      return;
    }
    updateScanStatus(scanId, status, summary);
    console.log(`[setScanStatus] Scan ${scanId} updated to ${status} (SQLite)`);
    // Invalidate dashboard cache when scan status changes
    invalidatePattern('dashboard:');
  } catch (error) {
    console.error(`[setScanStatus] FAILED to update scan ${scanId} to ${status}:`, error);
    throw error;
  }
}

async function addScanResult(data: {
  scanId: string;
  siteId: string;
  pageUrl: string;
  category: AuditCategory;
  score: number;
  issuesCount: number;
  details?: unknown;
}): Promise<ScanResult> {
  if (USE_POSTGRES_PRIMARY && pgDb) {
    return pgQueries.insertScanResultPostgres(pgDb, data);
  }
  return insertScanResult(data);
}

async function addScanIssues(issues: Array<{
  resultId: string;
  severity: ScanIssue['severity'];
  wcagCriterion: string;
  wcagLevel: ScanIssue['wcagLevel'];
  description: string;
  element?: string;
  helpUrl?: string;
  failureSummary?: string;
  relatedNodes?: string[];
}>): Promise<ScanIssue[]> {
  if (USE_POSTGRES_PRIMARY && pgDb) {
    return pgQueries.insertScanIssuesPostgres(pgDb, issues);
  }
  return insertScanIssues(issues);
}

interface SiteResult {
  pages: number;
  issues: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  accessibilityScores: number[];
  error?: string;
}

/**
 * Main scanning orchestrator.
 * Launches a headless browser, crawls pages, runs audits, and stores results.
 * Sites are processed in parallel (up to siteConcurrency), and pages within
 * each site are audited in parallel tabs (up to pageConcurrency).
 * This function is designed to run in the background (fire-and-forget).
 */
export async function executeScan(config: ScanConfig): Promise<void> {
  let browser: Browser | undefined;

  try {
    await setScanStatus(config.scanId, 'running');
    
    // Optimize concurrency for Azure containerized environment
    config = optimizeConcurrencyForEnvironment(config);
    
    // Launch browser with performance monitoring
    perfMonitor.start(`scan.${config.scanId}.browser-launch`);
    browser = await chromium.launch({ 
      headless: true,
      args: [
        // Essential container flags
        '--disable-dev-shm-usage',        // Use /tmp instead of /dev/shm (limited in containers)
        '--no-sandbox',                   // Required for containerized environments
        '--disable-setuid-sandbox',       // Required for containerized environments
        '--disable-gpu',                  // GPU not available in containers
        // Performance optimizations (keep multi-process for Playwright efficiency)
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-extensions',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    const browserLaunchTime = perfMonitor.end(`scan.${config.scanId}.browser-launch`);
    logger.scanProgress(config.scanId, 'Browser launched', { duration: browserLaunchTime });

    const siteResults: SiteResult[] = [];

    logger.scanProgress(config.scanId, 'Scan started', { 
      siteConcurrency: config.siteConcurrency, 
      pageConcurrency: config.pageConcurrency,
      sites: config.sites.length,
    });

    await runWithConcurrency(config.sites, config.siteConcurrency, async (site) => {
      const siteStartTime = Date.now();
      const result: SiteResult = {
        pages: 0,
        issues: 0,
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
        accessibilityScores: [],
      };

      let context: import('playwright').BrowserContext | undefined;
      try {
        context = await browser!.newContext({
          ignoreHTTPSErrors: true,
          userAgent:
            'Mozilla/5.0 (compatible; CompliancePortalScanner/1.0; +https://compliance-portal.dev)',
        });
        // Crawl using a dedicated page (BFS must be sequential)
        console.log(`[Scanner] Crawling site: ${site.url} (depth=${config.scanDepth}, maxPages=${config.maxPagesToScan ?? 'unlimited'})`);
        const crawlStartTime = Date.now();
        const crawlPage = await context.newPage();
        crawlPage.setDefaultTimeout(PAGE_TIMEOUT);
        const pages = await crawlSite(crawlPage, site.url, config.scanDepth, config.maxPagesToScan);
        await crawlPage.close();
        result.pages = pages.length;
        console.log(`[Scanner] Crawled ${pages.length} page(s) for ${site.url} in ${Date.now() - crawlStartTime}ms`);

        // Track how many pages actually loaded successfully
        let pagesAudited = 0;
        const auditStartTime = Date.now();
        
        // Get criteria once for all pages (avoid repeated DB queries)
        const criteria = config.categories.includes('accessibility') 
          ? getCriteriaForLevel(config.complianceLevel) 
          : [];

        // Audit discovered pages in parallel using multiple tabs
        await runWithConcurrency(pages, config.pageConcurrency, async (pageUrl) => {
          const auditPage = await context!.newPage();
          auditPage.setDefaultTimeout(PAGE_TIMEOUT);

          try {
            // Use domcontentloaded as primary — faster and sufficient for axe
            let navSuccess = false;
            const pageStartTime = Date.now();
            try {
              await auditPage.goto(pageUrl, {
                waitUntil: 'domcontentloaded',
                timeout: PAGE_TIMEOUT,
              });
              // Let JS frameworks finish rendering before axe runs
              await auditPage.waitForTimeout(AUDIT_SETTLE_MS);
              navSuccess = true;
              console.log(`[Scanner] Page loaded in ${Date.now() - pageStartTime}ms: ${pageUrl}`);
            } catch (err) {
              // Skip this page if navigation fails entirely
              console.warn(`[Scanner] Navigation failed after ${Date.now() - pageStartTime}ms for ${pageUrl} — skipping`);
              return;
            }

            if (navSuccess) pagesAudited++;

            // Pre-insert expected audit log entries (fire-and-forget — don't block the audit)
            insertExpectedRules(config.scanId, site.id, pageUrl, config.categories, config.complianceLevel).catch(
              (err) => console.warn(`[Scanner] insertExpectedRules failed for ${pageUrl}:`, err),
            );

            // Accessibility audit
            if (config.categories.includes('accessibility')) {
              try {
                const a11yResult = await auditAccessibility(auditPage, config.complianceLevel);
                result.accessibilityScores.push(a11yResult.score);

                const scanResult = await addScanResult({
                  scanId: config.scanId,
                  siteId: site.id,
                  pageUrl,
                  category: 'accessibility',
                  score: a11yResult.score,
                  issuesCount: a11yResult.issues.length,
                  details: {
                    totalChecks: a11yResult.totalChecks,
                    passedChecks: a11yResult.passedChecks,
                  },
                });

                if (a11yResult.issues.length > 0) {
                  const dbIssues = await addScanIssues(
                    a11yResult.issues.map((issue) => ({
                      resultId: scanResult.id,
                      severity: issue.severity,
                      wcagCriterion: issue.wcagCriterion,
                      wcagLevel: issue.wcagLevel,
                      description: issue.description,
                      element: issue.element,
                      helpUrl: issue.helpUrl,
                      failureSummary: issue.failureSummary,
                      relatedNodes: issue.relatedNodes,
                    })),
                  );
                  for (const i of dbIssues) {
                    result.issues++;
                    if (i.severity === 'critical') result.critical++;
                    else if (i.severity === 'serious') result.serious++;
                    else if (i.severity === 'moderate') result.moderate++;
                    else result.minor++;
                  }
                }

                // Update audit log - OPTIMIZED: Skip individual updates to avoid 500+ DB calls
                // The audit log is pre-populated with insertExpectedRules() 
                // For performance, we skip per-page updates and rely on scan results instead
                /*
                const violatedCriteria = new Set(a11yResult.issues.map(i => i.wcagCriterion));
                for (const c of criteria) {
                  updateAuditLogEntry(config.scanId, 'accessibility', c.id, site.id, pageUrl, {
                    executed: true,
                    passed: !violatedCriteria.has(c.id),
                  });
                }
                */
              } catch (err) {
                console.error(`Accessibility audit failed for ${pageUrl}:`, err);
                // Skip audit log updates on error for performance
                /*
                for (const c of criteria) {
                  updateAuditLogEntry(config.scanId, 'accessibility', c.id, site.id, pageUrl, {
                    executed: false,
                    passed: null,
                    errorMessage: (err as Error).message ?? 'Unknown error',
                  });
                }
                */
              }
            }
          } catch (err) {
            console.error(`Error auditing page ${pageUrl}:`, err);
          } finally {
            await auditPage.close().catch(() => {});
          }
        });

        console.log(`[Scanner] Audited ${pagesAudited}/${pages.length} pages in ${Date.now() - auditStartTime}ms`);

        // If the site was crawled but every page failed to navigate, record an
        // unreachable result so the UI shows the site rather than silently omitting it.
        if (pages.length > 0 && pagesAudited === 0) {
          const errMsg = 'Site unreachable — all pages failed to load';
          console.warn(`[Scanner] ${errMsg}: ${site.url}`);
          result.error = errMsg;
          if (config.categories.includes('accessibility')) {
            await addScanResult({
              scanId: config.scanId,
              siteId: site.id,
              pageUrl: site.url,
              category: 'accessibility',
              score: 0,
              issuesCount: 0,
              details: { error: errMsg },
            });
          }
        }
      } catch (err) {
        const errMsg = (err as Error).message ?? 'Unknown error';
        console.error(`[Scanner] Error processing site ${site.url}:`, err);
        result.error = errMsg;
        // Store a 0-score result so the site appears in the UI with an error
        if (config.categories.includes('accessibility')) {
          await addScanResult({
            scanId: config.scanId,
            siteId: site.id,
            pageUrl: site.url,
            category: 'accessibility',
            score: 0,
            issuesCount: 0,
            details: { error: errMsg },
          });
        }
      } finally {
        await context?.close().catch(() => {});
        console.log(`[Scanner] Site completed: ${site.url} in ${Date.now() - siteStartTime}ms (${result.pages} pages, ${result.issues} issues)`);
      }

      siteResults.push(result);
    });

    // Aggregate results from all sites
    let totalPages = 0;
    let totalIssues = 0;
    let criticalCount = 0;
    let seriousCount = 0;
    let moderateCount = 0;
    let minorCount = 0;
    const allAccessibilityScores: number[] = [];

    for (const r of siteResults) {
      totalPages += r.pages;
      totalIssues += r.issues;
      criticalCount += r.critical;
      seriousCount += r.serious;
      moderateCount += r.moderate;
      minorCount += r.minor;
      allAccessibilityScores.push(...r.accessibilityScores);
    }

    const avgScore = (arr: number[]) =>
      arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const summary: ScanSummary = {
      totalPages,
      totalIssues,
      criticalCount,
      seriousCount,
      moderateCount,
      minorCount,
      scores: {
        accessibility: avgScore(allAccessibilityScores),
      },
    };

    await setScanStatus(config.scanId, 'completed', summary);
    console.log(`Scan ${config.scanId} completed: ${totalPages} pages, ${totalIssues} issues`);
  } catch (err) {
    console.error(`Scan ${config.scanId} failed:`, err);
    await setScanStatus(config.scanId, 'failed');
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
