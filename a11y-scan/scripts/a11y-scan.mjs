#!/usr/bin/env node

/**
 * a11y-scan — WCAG accessibility scanner
 *
 * Usage:
 *   node a11y-scan.mjs <url> [--level A|AA|AAA] [--output report.html] [--depth 1-5]
 *   node a11y-scan.mjs --file urls.txt [--level A|AA|AAA] [--output report.html] [--depth 1-5]
 *
 * Requires: playwright, @axe-core/playwright (installed automatically if missing)
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Dependency check
// ---------------------------------------------------------------------------

function ensureDeps() {
  const deps = ['playwright', '@axe-core/playwright'];
  const missing = deps.filter((d) => {
    try { import.meta.resolve?.(d); return false; } catch { return true; }
  });

  // Fallback: try require.resolve-style check
  for (const d of deps) {
    try {
      execSync(`node -e "require.resolve('${d}')"`, { stdio: 'ignore' });
    } catch {
      if (!missing.includes(d)) missing.push(d);
    }
  }

  // Remove already-found ones
  const toInstall = [];
  for (const d of missing) {
    try {
      execSync(`node -e "require.resolve('${d}')"`, { stdio: 'ignore' });
    } catch {
      toInstall.push(d);
    }
  }

  if (toInstall.length > 0) {
    console.log(`📦 Installing dependencies: ${toInstall.join(', ')}...`);
    execSync(`npm install --no-save ${toInstall.join(' ')}`, { stdio: 'inherit' });
    if (toInstall.includes('playwright')) {
      console.log('🌐 Installing Playwright browsers...');
      execSync('npx playwright install chromium', { stdio: 'inherit' });
    }
  }
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    url: '',
    file: '',
    level: 'AA',
    output: '',
    depth: 1,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--level' && args[i + 1]) {
      opts.level = args[++i].toUpperCase();
    } else if (arg === '--output' && args[i + 1]) {
      opts.output = args[++i];
    } else if (arg === '--depth' && args[i + 1]) {
      opts.depth = Math.min(5, Math.max(1, parseInt(args[++i], 10) || 1));
    } else if (arg === '--file' && args[i + 1]) {
      opts.file = args[++i];
    } else if (!arg.startsWith('--')) {
      opts.url = arg;
    }
  }

  if (opts.url && opts.file) {
    console.error('Error: Cannot use both a positional URL and --file. Pick one mode.');
    process.exit(1);
  }

  if (!opts.url && !opts.file) {
    console.error('Usage: node a11y-scan.mjs <url> [--level A|AA|AAA] [--output report.html] [--depth 1-5]');
    console.error('       node a11y-scan.mjs --file urls.txt [--level A|AA|AAA] [--output report.html] [--depth 1-5]');
    process.exit(1);
  }

  if (opts.url) {
    if (!opts.url.startsWith('http://') && !opts.url.startsWith('https://')) {
      opts.url = `https://${opts.url}`;
    }
    if (!opts.output) {
      const hostname = new URL(opts.url).hostname.replace(/[^a-z0-9]/gi, '-');
      opts.output = `a11y-report-${hostname}.html`;
    }
  }

  if (opts.file) {
    if (!existsSync(opts.file)) {
      console.error(`Error: File not found: ${opts.file}`);
      process.exit(1);
    }
    if (!opts.output) {
      opts.output = 'a11y-batch-report.html';
    }
  }

  return opts;
}

// ---------------------------------------------------------------------------
// URL file parser
// ---------------------------------------------------------------------------

function parseUrlFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const urls = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((url) => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
      }
      return url;
    });

  if (urls.length === 0) {
    console.error('Error: No URLs found in file.');
    process.exit(1);
  }

  return urls;
}

// ---------------------------------------------------------------------------
// WCAG tag mapping
// ---------------------------------------------------------------------------

function getAxeTags(level) {
  const tags = {
    A: ['wcag2a', 'wcag21a'],
    AA: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    AAA: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'],
  };
  return tags[level] || tags.AA;
}

// ---------------------------------------------------------------------------
// Page crawler (simple breadth-first)
// ---------------------------------------------------------------------------

async function crawlPages(context, startUrl, maxDepth) {
  const visited = new Set();
  const pages = [];

  // Use a dedicated page for crawling so it doesn't interfere with scanning
  const crawlPage = await context.newPage();

  try {
    // Navigate to the start URL first to resolve any redirects (e.g. micsgroup.org → www.micsgroup.org)
    await crawlPage.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await crawlPage.waitForTimeout(3000);
    const resolvedUrl = crawlPage.url().split('#')[0].split('?')[0].replace(/\/$/, '');
    const resolvedOrigin = new URL(resolvedUrl).origin;

    console.log(`    ↳ Resolved origin: ${resolvedOrigin}`);

    const queue = [{ url: resolvedUrl, depth: 0 }];

    while (queue.length > 0) {
      const { url, depth } = queue.shift();
      const normalized = url.split('#')[0].split('?')[0].replace(/\/$/, '') || resolvedOrigin;

      if (visited.has(normalized) || depth > maxDepth) continue;
      visited.add(normalized);
      pages.push(url);

      if (depth < maxDepth) {
        try {
          if (pages.length > 1 || depth > 0) {
            // Already loaded the first page above; only navigate for subsequent pages
            await crawlPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await crawlPage.waitForTimeout(2000);
          }

          const links = await crawlPage.evaluate((orig) => {
            return Array.from(document.querySelectorAll('a[href]'))
              .map((a) => a.href)
              .filter((href) => {
                try {
                  const u = new URL(href);
                  return u.origin === orig && !href.includes('#') &&
                    !href.match(/\.(pdf|zip|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|ico)$/i);
                } catch { return false; }
              });
          }, resolvedOrigin);

          console.log(`    ↳ depth ${depth}: found ${links.length} links on ${url}`);

          for (const link of links.slice(0, 50)) {
            const norm = link.split('#')[0].split('?')[0].replace(/\/$/, '') || resolvedOrigin;
            if (!visited.has(norm)) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        } catch {
          // Skip unreachable pages
        }
      }
    }
  } finally {
    await crawlPage.close();
  }

  return pages;
}

// ---------------------------------------------------------------------------
// Browser management
// ---------------------------------------------------------------------------

async function createBrowser() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  return { browser, context, page };
}

// ---------------------------------------------------------------------------
// Scan a single site (given a page instance)
// ---------------------------------------------------------------------------

async function scanSite(page, url, level, depth, context) {
  const AxeBuilder = (await import('@axe-core/playwright')).default;
  const AxeBuilderClass = AxeBuilder.default ?? AxeBuilder;
  const tags = getAxeTags(level);
  const results = [];

  console.log(`🔍 Crawling ${url} (depth: ${depth})...`);
  const pages = await crawlPages(context, url, depth);
  console.log(`📄 Found ${pages.length} page(s) to scan\n`);

  for (const pageUrl of pages) {
    process.stdout.write(`  Scanning: ${pageUrl} ... `);
    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
    } catch {
      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1500);
      } catch {
        console.log('⚠️  skipped (unreachable)');
        continue;
      }
    }

    try {
      const axeResults = await new AxeBuilderClass({ page }).withTags(tags).analyze();
      const violations = axeResults.violations;
      const passes = axeResults.passes;

      let totalWeight = passes.length;
      let penaltyWeight = 0;
      const sevWeights = { critical: 4, serious: 3, moderate: 2, minor: 1 };

      for (const v of violations) {
        const w = sevWeights[v.impact] ?? 1;
        totalWeight += w;
        penaltyWeight += w;
      }

      const score = totalWeight > 0
        ? Math.round(((totalWeight - penaltyWeight) / totalWeight) * 100)
        : 100;

      const issues = [];
      for (const v of violations) {
        for (const node of v.nodes) {
          issues.push({
            severity: v.impact || 'minor',
            ruleId: v.id,
            description: v.help,
            element: node.html.slice(0, 500),
            helpUrl: v.helpUrl,
            wcagTags: v.tags.filter((t) => t.startsWith('wcag')),
          });
        }
      }

      results.push({
        url: pageUrl,
        score,
        totalChecks: passes.length + violations.length,
        passedChecks: passes.length,
        violations: violations.length,
        issues,
      });

      const icon = score >= 90 ? '✅' : score >= 70 ? '⚠️' : '❌';
      console.log(`${icon} Score: ${score}/100 (${violations.length} violations, ${issues.length} issues)`);
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      results.push({ url: pageUrl, score: 0, totalChecks: 0, passedChecks: 0, violations: 0, issues: [], error: err.message });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Run accessibility scan (single site — backward compatible)
// ---------------------------------------------------------------------------

async function runScan(url, level, depth) {
  const { browser, context, page } = await createBrowser();
  try {
    return await scanSite(page, url, level, depth, context);
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// HTML report generation
// ---------------------------------------------------------------------------

function severityColor(sev) {
  return { critical: '#dc2626', serious: '#ea580c', moderate: '#ca8a04', minor: '#3b82f6' }[sev] || '#6b7280';
}

function severityBg(sev) {
  return { critical: '#fef2f2', serious: '#fff7ed', moderate: '#fefce8', minor: '#eff6ff' }[sev] || '#f9fafb';
}

function scoreColor(score) {
  if (score >= 90) return '#16a34a';
  if (score >= 70) return '#ca8a04';
  return '#dc2626';
}

function generateReport(url, level, results) {
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  const avgScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
    : 0;

  const sevCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const r of results) {
    for (const i of r.issues) {
      sevCounts[i.severity] = (sevCounts[i.severity] || 0) + 1;
    }
  }

  const pagesHtml = results.map((r) => {
    const issuesHtml = r.issues.length > 0
      ? r.issues.map((i) => `
        <div style="border-left:4px solid ${severityColor(i.severity)};background:${severityBg(i.severity)};padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="background:${severityColor(i.severity)};color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;">${i.severity}</span>
            <code style="font-size:12px;color:#6b7280;">${i.ruleId}</code>
            ${i.wcagTags.length ? `<span style="font-size:11px;color:#8b5cf6;">${i.wcagTags.join(', ')}</span>` : ''}
          </div>
          <p style="margin:0 0 8px 0;font-size:14px;color:#1f2937;">${i.description}</p>
          ${i.element ? `<pre style="background:#1e293b;color:#e2e8f0;padding:10px 14px;border-radius:6px;font-size:12px;overflow-x:auto;margin:0 0 6px 0;white-space:pre-wrap;word-break:break-all;"><code>${escapeHtml(i.element)}</code></pre>` : ''}
          ${i.helpUrl ? `<a href="${i.helpUrl}" target="_blank" style="font-size:12px;color:#2563eb;">Learn more →</a>` : ''}
        </div>
      `).join('')
      : '<p style="color:#6b7280;font-style:italic;">No violations found on this page 🎉</p>';

    return `
      <div style="background:white;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:24px;margin-bottom:24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <h3 style="margin:0;font-size:16px;color:#1f2937;">${escapeHtml(r.url)}</h3>
            <p style="margin:4px 0 0 0;font-size:13px;color:#6b7280;">${r.totalChecks} rules checked · ${r.passedChecks} passed · ${r.violations} violations</p>
          </div>
          <div style="text-align:center;">
            <div style="font-size:32px;font-weight:800;color:${scoreColor(r.score)};">${r.score}</div>
            <div style="font-size:11px;color:#6b7280;">/ 100</div>
          </div>
        </div>
        ${r.error ? `<div style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:8px;color:#dc2626;font-size:13px;">Error: ${escapeHtml(r.error)}</div>` : issuesHtml}
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Report — ${escapeHtml(url)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
    .container { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
    .header { text-align: center; margin-bottom: 40px; }
    .header h1 { font-size: 28px; margin: 0 0 8px 0; color: #0f172a; }
    .header p { font-size: 14px; color: #64748b; margin: 0; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .summary-card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 20px; text-align: center; }
    .summary-card .value { font-size: 36px; font-weight: 800; }
    .summary-card .label { font-size: 12px; color: #64748b; margin-top: 4px; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .verdict { font-size: 16px; font-weight: 700; margin-top: 8px; }
    @media print { body { background: white; } .container { padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>♿ WCAG ${escapeHtml(level)} Accessibility Report</h1>
      <p>${escapeHtml(url)} · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
    </div>

    <div class="summary">
      <div class="summary-card">
        <div class="value" style="color:${scoreColor(avgScore)}">${avgScore}</div>
        <div class="label">Overall Score</div>
        <div class="verdict" style="color:${avgScore >= 80 ? '#16a34a' : '#dc2626'}">${avgScore >= 80 ? '✅ PASS' : '❌ FAIL'}</div>
      </div>
      <div class="summary-card">
        <div class="value">${results.length}</div>
        <div class="label">Pages Scanned</div>
      </div>
      <div class="summary-card">
        <div class="value">${totalIssues}</div>
        <div class="label">Total Issues</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color:${severityColor('critical')}">${sevCounts.critical}</div>
        <div class="label">Critical</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color:${severityColor('serious')}">${sevCounts.serious}</div>
        <div class="label">Serious</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color:${severityColor('moderate')}">${sevCounts.moderate}</div>
        <div class="label">Moderate</div>
      </div>
    </div>

    <h2 style="font-size:20px;margin-bottom:16px;">Page Results</h2>
    ${pagesHtml}

    <div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:12px;">
      Generated by a11y-scan skill · WCAG ${escapeHtml(level)} · ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>`;
}

function generateBatchReport(sites, level) {
  const siteStats = sites.map((s) => {
    const totalIssues = s.results.reduce((sum, r) => sum + r.issues.length, 0);
    const avgScore = s.results.length > 0
      ? Math.round(s.results.reduce((sum, r) => sum + r.score, 0) / s.results.length)
      : 0;
    const sevCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const r of s.results) {
      for (const i of r.issues) {
        sevCounts[i.severity] = (sevCounts[i.severity] || 0) + 1;
      }
    }
    return { url: s.url, avgScore, totalIssues, sevCounts, pages: s.results.length, pass: avgScore >= 80 };
  });

  const allResults = sites.flatMap((s) => s.results);
  const totalPages = allResults.length;
  const totalIssues = allResults.reduce((sum, r) => sum + r.issues.length, 0);
  const overallScore = siteStats.length > 0
    ? Math.round(siteStats.reduce((sum, s) => sum + s.avgScore, 0) / siteStats.length)
    : 0;
  const allPass = siteStats.every((s) => s.pass);

  const sevCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const r of allResults) {
    for (const i of r.issues) {
      sevCounts[i.severity] = (sevCounts[i.severity] || 0) + 1;
    }
  }

  const sitesTableRows = siteStats.map((s) => `
    <tr>
      <td style="padding:10px 14px;font-size:14px;"><a href="#site-${siteStats.indexOf(s)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(s.url)}</a></td>
      <td style="padding:10px 14px;text-align:center;">${s.pages}</td>
      <td style="padding:10px 14px;text-align:center;font-weight:700;color:${scoreColor(s.avgScore)}">${s.avgScore}</td>
      <td style="padding:10px 14px;text-align:center;">${s.totalIssues}</td>
      <td style="padding:10px 14px;text-align:center;font-weight:600;color:${s.pass ? '#16a34a' : '#dc2626'}">${s.pass ? '✅ PASS' : '❌ FAIL'}</td>
    </tr>
  `).join('');

  const siteSections = sites.map((site, idx) => {
    const stats = siteStats[idx];

    const pagesHtml = site.results.map((r) => {
      const issuesHtml = r.issues.length > 0
        ? r.issues.map((i) => `
          <div style="border-left:4px solid ${severityColor(i.severity)};background:${severityBg(i.severity)};padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="background:${severityColor(i.severity)};color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;">${i.severity}</span>
              <code style="font-size:12px;color:#6b7280;">${i.ruleId}</code>
              ${i.wcagTags.length ? `<span style="font-size:11px;color:#8b5cf6;">${i.wcagTags.join(', ')}</span>` : ''}
            </div>
            <p style="margin:0 0 8px 0;font-size:14px;color:#1f2937;">${i.description}</p>
            ${i.element ? `<pre style="background:#1e293b;color:#e2e8f0;padding:10px 14px;border-radius:6px;font-size:12px;overflow-x:auto;margin:0 0 6px 0;white-space:pre-wrap;word-break:break-all;"><code>${escapeHtml(i.element)}</code></pre>` : ''}
            ${i.helpUrl ? `<a href="${i.helpUrl}" target="_blank" style="font-size:12px;color:#2563eb;">Learn more →</a>` : ''}
          </div>
        `).join('')
        : '<p style="color:#6b7280;font-style:italic;">No violations found on this page 🎉</p>';

      return `
        <div style="background:white;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);padding:24px;margin-bottom:24px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <div>
              <h4 style="margin:0;font-size:16px;color:#1f2937;">${escapeHtml(r.url)}</h4>
              <p style="margin:4px 0 0 0;font-size:13px;color:#6b7280;">${r.totalChecks} rules checked · ${r.passedChecks} passed · ${r.violations} violations</p>
            </div>
            <div style="text-align:center;">
              <div style="font-size:32px;font-weight:800;color:${scoreColor(r.score)};">${r.score}</div>
              <div style="font-size:11px;color:#6b7280;">/ 100</div>
            </div>
          </div>
          ${r.error ? `<div style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:8px;color:#dc2626;font-size:13px;">Error: ${escapeHtml(r.error)}</div>` : issuesHtml}
        </div>
      `;
    }).join('');

    return `
      <div id="site-${idx}" style="margin-bottom:48px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding:20px;background:white;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <div>
            <h2 style="margin:0;font-size:20px;color:#0f172a;">${escapeHtml(site.url)}</h2>
            <p style="margin:4px 0 0;font-size:13px;color:#64748b;">${stats.pages} pages · ${stats.totalIssues} issues</p>
          </div>
          <div style="text-align:center;">
            <div style="font-size:36px;font-weight:800;color:${scoreColor(stats.avgScore)}">${stats.avgScore}</div>
            <div style="font-size:11px;color:#6b7280;">/ 100</div>
          </div>
        </div>
        ${pagesHtml}
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Batch Accessibility Report — WCAG ${escapeHtml(level)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
    .container { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
    .header { text-align: center; margin-bottom: 40px; }
    .header h1 { font-size: 28px; margin: 0 0 8px 0; color: #0f172a; }
    .header p { font-size: 14px; color: #64748b; margin: 0; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .summary-card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 20px; text-align: center; }
    .summary-card .value { font-size: 36px; font-weight: 800; }
    .summary-card .label { font-size: 12px; color: #64748b; margin-top: 4px; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .verdict { font-size: 16px; font-weight: 700; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; margin-bottom: 32px; }
    th { background: #f1f5f9; padding: 12px 14px; font-size: 12px; text-transform: uppercase; color: #64748b; text-align: left; }
    td { border-top: 1px solid #e2e8f0; }
    @media print { body { background: white; } .container { padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>♿ WCAG ${escapeHtml(level)} Batch Accessibility Report</h1>
      <p>${siteStats.length} sites · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
    </div>

    <div class="summary">
      <div class="summary-card">
        <div class="value" style="color:${scoreColor(overallScore)}">${overallScore}</div>
        <div class="label">Overall Score</div>
        <div class="verdict" style="color:${allPass ? '#16a34a' : '#dc2626'}">${allPass ? '✅ ALL PASS' : '❌ SOME FAIL'}</div>
      </div>
      <div class="summary-card">
        <div class="value">${siteStats.length}</div>
        <div class="label">Sites Scanned</div>
      </div>
      <div class="summary-card">
        <div class="value">${totalPages}</div>
        <div class="label">Total Pages</div>
      </div>
      <div class="summary-card">
        <div class="value">${totalIssues}</div>
        <div class="label">Total Issues</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color:${severityColor('critical')}">${sevCounts.critical}</div>
        <div class="label">Critical</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color:${severityColor('serious')}">${sevCounts.serious}</div>
        <div class="label">Serious</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color:${severityColor('moderate')}">${sevCounts.moderate}</div>
        <div class="label">Moderate</div>
      </div>
    </div>

    <h2 style="font-size:20px;margin-bottom:16px;">Sites Overview</h2>
    <table>
      <thead>
        <tr>
          <th>Site</th>
          <th style="text-align:center;">Pages</th>
          <th style="text-align:center;">Score</th>
          <th style="text-align:center;">Issues</th>
          <th style="text-align:center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${sitesTableRows}
      </tbody>
    </table>

    <h2 style="font-size:20px;margin-bottom:16px;">Detailed Results</h2>
    ${siteSections}

    <div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:12px;">
      Generated by a11y-scan skill · WCAG ${escapeHtml(level)} · Batch mode · ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  ensureDeps();

  const opts = parseArgs();

  // --- Batch mode ---
  if (opts.file) {
    const urls = parseUrlFile(opts.file);

    console.log(`\n♿ WCAG ${opts.level} Batch Accessibility Scan`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`File:  ${opts.file}`);
    console.log(`Sites: ${urls.length}`);
    console.log(`Level: ${opts.level}`);
    console.log(`Depth: ${opts.depth}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const { browser, context, page } = await createBrowser();
    const sites = [];

    try {
      for (let idx = 0; idx < urls.length; idx++) {
        const url = urls[idx];
        console.log(`\n[${idx + 1}/${urls.length}] ${url}`);
        console.log(`${'─'.repeat(40)}`);
        const results = await scanSite(page, url, opts.level, opts.depth, context);
        sites.push({ url, results });
      }
    } finally {
      await browser.close();
    }

    // Combined summary table
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Batch Scan Results`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    let allPass = true;
    const siteResults = [];

    for (const site of sites) {
      const totalIssues = site.results.reduce((s, r) => s + r.issues.length, 0);
      const avgScore = site.results.length > 0
        ? Math.round(site.results.reduce((s, r) => s + r.score, 0) / site.results.length)
        : 0;
      const pass = avgScore >= 80;
      if (!pass) allPass = false;

      const icon = pass ? '✅' : '❌';
      console.log(`  ${icon} ${avgScore.toString().padStart(3)}/100  ${site.url} (${site.results.length} pages, ${totalIssues} issues)`);

      siteResults.push({
        url: site.url,
        level: opts.level,
        score: avgScore,
        pass,
        pages: site.results.length,
        totalIssues,
        critical: site.results.reduce((s, r) => s + r.issues.filter((i) => i.severity === 'critical').length, 0),
        serious: site.results.reduce((s, r) => s + r.issues.filter((i) => i.severity === 'serious').length, 0),
      });
    }

    // Generate batch HTML report
    const html = generateBatchReport(sites, opts.level);
    const outputPath = resolve(opts.output);
    writeFileSync(outputPath, html, 'utf-8');

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📝 Report saved: ${outputPath}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Structured output — array for batch mode
    for (const sr of siteResults) {
      sr.reportPath = outputPath;
    }
    console.log(`\n__A11Y_RESULT__${JSON.stringify(siteResults)}__A11Y_RESULT__`);

    process.exit(allPass ? 0 : 1);
    return;
  }

  // --- Single URL mode (unchanged behavior) ---
  console.log(`\n♿ WCAG ${opts.level} Accessibility Scan`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`URL:   ${opts.url}`);
  console.log(`Level: ${opts.level}`);
  console.log(`Depth: ${opts.depth}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const results = await runScan(opts.url, opts.level, opts.depth);

  // Summary
  const totalIssues = results.reduce((s, r) => s + r.issues.length, 0);
  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
    : 0;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Overall Score: ${avgScore}/100 ${avgScore >= 80 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`📄 Pages scanned: ${results.length}`);
  console.log(`🐛 Total issues: ${totalIssues}`);

  // Generate HTML report
  const html = generateReport(opts.url, opts.level, results);
  const outputPath = resolve(opts.output);
  writeFileSync(outputPath, html, 'utf-8');
  console.log(`📝 Report saved: ${outputPath}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Return structured data for the calling agent
  const summary = {
    url: opts.url,
    level: opts.level,
    score: avgScore,
    pass: avgScore >= 80,
    pages: results.length,
    totalIssues,
    critical: results.reduce((s, r) => s + r.issues.filter((i) => i.severity === 'critical').length, 0),
    serious: results.reduce((s, r) => s + r.issues.filter((i) => i.severity === 'serious').length, 0),
    reportPath: outputPath,
  };
  console.log(`\n__A11Y_RESULT__${JSON.stringify(summary)}__A11Y_RESULT__`);

  process.exit(avgScore >= 80 ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(2);
});
