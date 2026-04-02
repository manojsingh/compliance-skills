import type { Page } from 'playwright';

export interface CrawlResult {
  url: string;
  depth: number;
  links: string[];
}

const MAX_PAGES = 50;
const PAGE_TIMEOUT = 30_000;

// File extensions to skip during crawling
const SKIP_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.css', '.js', '.json', '.xml', '.woff', '.woff2', '.ttf', '.eot',
]);

function shouldSkipUrl(href: string): boolean {
  try {
    const url = new URL(href);
    const ext = url.pathname.split('.').pop()?.toLowerCase();
    if (ext && SKIP_EXTENSIONS.has(`.${ext}`)) return true;
    // Skip fragment-only and javascript: URLs
    if (url.protocol === 'javascript:') return true;
    if (url.protocol === 'mailto:') return true;
    if (url.protocol === 'tel:') return true;
    return false;
  } catch {
    return true;
  }
}

function normalizeUrl(href: string): string {
  try {
    const url = new URL(href);
    url.hash = '';
    // Remove trailing slash for consistency (except root)
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }
    return url.toString();
  } catch {
    return href;
  }
}

function stripWww(hostname: string): string {
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
}

function isSameDomain(base: string, candidate: string): boolean {
  try {
    const baseHost = stripWww(new URL(base).hostname);
    const candidateHost = stripWww(new URL(candidate).hostname);
    return baseHost === candidateHost;
  } catch {
    return false;
  }
}

/**
 * BFS crawl starting from startUrl.
 * - Follows same-domain links only
 * - maxDepth: 1 = just the start URL, 2 = start + linked pages, etc.
 * - maxPages: maximum number of pages to crawl (null = no limit, defaults to MAX_PAGES constant)
 * - Deduplicates URLs
 * - Skips non-HTML resources
 */
export async function crawlSite(
  page: Page,
  startUrl: string,
  maxDepth: number,
  maxPages: number | null = null,
): Promise<string[]> {
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [];

  const normalized = normalizeUrl(startUrl);
  queue.push({ url: normalized, depth: 1 });
  visited.add(normalized);

  const discoveredPages: string[] = [];

  // Use configured maxPages, or fall back to MAX_PAGES constant
  const effectiveMaxPages = maxPages ?? MAX_PAGES;

  // The effective domain may differ from startUrl if the site redirects
  // (e.g. example.com → www.example.com). We resolve it after the first
  // successful navigation so that same-domain checks work correctly.
  let effectiveDomain: string = startUrl;

  while (queue.length > 0 && discoveredPages.length < effectiveMaxPages) {
    const current = queue.shift()!;
    discoveredPages.push(current.url);

    // Don't crawl deeper if we've reached the max depth
    if (current.depth >= maxDepth) continue;

    // Navigate to the page — use domcontentloaded for speed; fall back if needed
    let response;
    let loaded = false;
    try {
      response = await page.goto(current.url, {
        waitUntil: 'domcontentloaded',
        timeout: PAGE_TIMEOUT,
      });
      // Brief settle time for JS-rendered content / redirects to finalise
      await page.waitForTimeout(1000);
      loaded = true;
    } catch {
      // domcontentloaded timed out — try with networkidle as a last resort
      try {
        response = await page.goto(current.url, {
          waitUntil: 'networkidle',
          timeout: PAGE_TIMEOUT,
        });
        loaded = true;
      } catch {
        // Total failure — skip link extraction for this page
      }
    }

    if (!loaded) continue;

    // After the first successful navigation, capture the effective domain
    // (post-redirect) so that links are not incorrectly filtered out.
    if (current.depth === 1) {
      effectiveDomain = page.url() || startUrl;
    }

    try {
      // Only extract links from HTML responses.
      // Prefer page.url() content-type check via headers; fall back to
      // assuming HTML if the response object is unavailable (some redirects
      // don't expose headers through Playwright's response object).
      const contentType = response?.headers()['content-type'] ?? 'text/html';
      if (!contentType.includes('text/html')) continue;

      // Extract all absolute links from the page
      const links: string[] = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((href) => href.startsWith('http'));
      });

      const newLinks: string[] = [];
      for (const link of links) {
        if (discoveredPages.length + queue.length >= effectiveMaxPages) break;

        const norm = normalizeUrl(link);
        if (visited.has(norm)) continue;
        // Use effectiveDomain (post-redirect) for same-domain check
        if (!isSameDomain(effectiveDomain, norm)) continue;
        if (shouldSkipUrl(norm)) continue;

        visited.add(norm);
        newLinks.push(norm);
      }

      newLinks.sort();
      for (const norm of newLinks) {
        queue.push({ url: norm, depth: current.depth + 1 });
      }
    } catch {
      // Link extraction failed — continue with other pages
    }
  }

  return discoveredPages;
}
