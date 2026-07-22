/**
 * CartIQ — Compliant Inventory Crawler
 *
 * Uses a two-phase fetch strategy:
 *   Phase 1: Plain HTTP fetch (fast, respects robots.txt)
 *   Phase 2: JavaScript rendering via Playwright (if Phase 1 returns empty content)
 *
 * Compliance rules (hard-coded, not configurable):
 *   - Checks robots.txt before crawling any path
 *   - Conservative rate limit: 1 request / 3s per domain
 *   - No CAPTCHA solving
 *   - No login bypass
 *   - No stealth / fingerprint evasion
 *   - No residential proxies
 *   - Marks source blocked_public_crawl + writes dealer_block_log on any denial
 *
 * Not imported by Vercel Lambda (pipeline-lambda.ts) — only used by cron agents
 * and the run-pipeline worker which have Playwright available.
 */

import { createClient } from '@supabase/supabase-js';
import { bm25Trim, INVENTORY_QUERY } from './bm25-trim.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;

const USER_AGENT = 'GolfCartIQ-Bot/1.0 (+https://golfcartiq.com/bot)';
const REQUEST_DELAY_MS = 3000;   // 1 req / 3s per domain — conservative
const FETCH_TIMEOUT_MS = 15000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlockReason =
  | 'http_403'
  | 'http_402'
  | 'http_401'
  | 'dns_failure'
  | 'robots_txt'
  | 'captcha_detected'
  | 'ssl_error'
  | 'timeout'
  | 'empty_content';

export interface CrawlResult {
  success: boolean;
  html?: string;
  finalUrl?: string;
  httpStatus?: number;
  blocked: boolean;
  blockReason?: BlockReason;
  errorMessage?: string;
  usedJsRender: boolean;
  robotsTxtChecked: boolean;
  robotsTxtDisallows: boolean;
}

export interface BlockLogEntry {
  dealer_slug: string;
  dealer_name?: string;
  inventory_url: string;
  block_reason: BlockReason;
  http_status?: number;
  error_message?: string;
  robots_txt_disallows: boolean;
}

// ─── robots.txt cache (in-memory, per-process) ────────────────────────────────

const robotsCache = new Map<string, { disallowedPaths: string[]; fetchedAt: number }>();
const ROBOTS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchRobotsTxt(origin: string): Promise<string[]> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) {
    return cached.disallowedPaths;
  }

  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      robotsCache.set(origin, { disallowedPaths: [], fetchedAt: Date.now() });
      return [];
    }
    const text = await res.text();
    const disallowed: string[] = [];
    let inOurBlock = false;

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('user-agent:')) {
        const agent = trimmed.slice('user-agent:'.length).trim();
        inOurBlock = agent === '*' || agent.toLowerCase().includes('golfcartiq');
      }
      if (inOurBlock && trimmed.toLowerCase().startsWith('disallow:')) {
        const path = trimmed.slice('disallow:'.length).trim();
        if (path) disallowed.push(path);
      }
    }

    robotsCache.set(origin, { disallowedPaths: disallowed, fetchedAt: Date.now() });
    return disallowed;
  } catch {
    return [];
  }
}

function isDisallowedByRobots(url: string, disallowedPaths: string[]): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    return disallowedPaths.some(dp => {
      if (dp === '/') return true;
      return path.startsWith(dp);
    });
  } catch {
    return false;
  }
}

// ─── Rate limiter (per domain) ────────────────────────────────────────────────

const lastRequestTime = new Map<string, number>();

async function rateLimitDelay(url: string): Promise<void> {
  const domain = new URL(url).hostname;
  const last = lastRequestTime.get(domain) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise(r => setTimeout(r, REQUEST_DELAY_MS - elapsed));
  }
  lastRequestTime.set(domain, Date.now());
}

// ─── CAPTCHA detection ────────────────────────────────────────────────────────

function detectsCaptcha(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes('cf-challenge') ||
    lower.includes('cf_clearance') ||
    lower.includes('recaptcha') ||
    lower.includes('hcaptcha') ||
    lower.includes('just a moment') ||
    lower.includes('checking your browser') ||
    lower.includes('enable javascript and cookies') ||
    lower.includes('sg-captcha') ||
    lower.includes('siteground') && lower.includes('captcha')
  );
}

function hasInventoryContent(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes('golf cart') ||
    lower.includes('listing') ||
    lower.includes('price') ||
    lower.includes('inventory') ||
    lower.includes('e-z-go') ||
    lower.includes('club car') ||
    lower.includes('yamaha')
  );
}

// ─── Phase 1: Plain HTTP fetch ────────────────────────────────────────────────

async function httpFetch(url: string): Promise<CrawlResult> {
  await rateLimitDelay(url);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });

    const html = await res.text();

    if (res.status === 403) return { success: false, blocked: true, blockReason: 'http_403', httpStatus: 403, usedJsRender: false, robotsTxtChecked: false, robotsTxtDisallows: false };
    if (res.status === 402) return { success: false, blocked: true, blockReason: 'http_402', httpStatus: 402, usedJsRender: false, robotsTxtChecked: false, robotsTxtDisallows: false };
    if (res.status === 401) return { success: false, blocked: true, blockReason: 'http_401', httpStatus: 401, usedJsRender: false, robotsTxtChecked: false, robotsTxtDisallows: false };
    if (!res.ok)            return { success: false, blocked: false, httpStatus: res.status, errorMessage: `HTTP ${res.status}`, usedJsRender: false, robotsTxtChecked: false, robotsTxtDisallows: false };

    if (detectsCaptcha(html)) {
      return { success: false, blocked: true, blockReason: 'captcha_detected', httpStatus: res.status, usedJsRender: false, robotsTxtChecked: false, robotsTxtDisallows: false };
    }

    // BM25 trim: reduce large pages to relevant inventory content before further parsing
    const trimmedHtml = html.length > 12000 ? bm25Trim(html, INVENTORY_QUERY) : html;

    return {
      success: true,
      html: trimmedHtml,
      finalUrl: res.url,
      httpStatus: res.status,
      blocked: false,
      usedJsRender: false,
      robotsTxtChecked: false,
      robotsTxtDisallows: false,
    };
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes('SSL') || msg.includes('ssl') || msg.includes('TLS')) {
      return { success: false, blocked: false, blockReason: 'ssl_error', errorMessage: msg, usedJsRender: false, robotsTxtChecked: false, robotsTxtDisallows: false };
    }
    if (msg.includes('timeout') || msg.includes('Timeout')) {
      return { success: false, blocked: false, blockReason: 'timeout', errorMessage: msg, usedJsRender: false, robotsTxtChecked: false, robotsTxtDisallows: false };
    }
    return { success: false, blocked: false, blockReason: 'dns_failure', errorMessage: msg, usedJsRender: false, robotsTxtChecked: false, robotsTxtDisallows: false };
  }
}

// ─── Phase 2: JS render via Playwright ───────────────────────────────────────

async function jsRenderFetch(url: string): Promise<CrawlResult> {
  await rateLimitDelay(url);

  // Dynamic import — only available in cron/worker environment
  let chromium: any;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    return { success: false, blocked: false, errorMessage: 'Playwright not available in this environment', usedJsRender: true, robotsTxtChecked: false, robotsTxtDisallows: false };
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      // No stealth, no fingerprint spoofing
    });
    const page = await context.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: FETCH_TIMEOUT_MS });
    await page.waitForTimeout(2000); // brief wait for JS render

    const html = await page.content();
    const status = response?.status() ?? 0;

    if (detectsCaptcha(html)) {
      return { success: false, blocked: true, blockReason: 'captcha_detected', httpStatus: status, usedJsRender: true, robotsTxtChecked: false, robotsTxtDisallows: false };
    }
    if (status === 403) return { success: false, blocked: true, blockReason: 'http_403', httpStatus: 403, usedJsRender: true, robotsTxtChecked: false, robotsTxtDisallows: false };

    return {
      success: true,
      html,
      finalUrl: page.url(),
      httpStatus: status,
      blocked: false,
      usedJsRender: true,
      robotsTxtChecked: false,
      robotsTxtDisallows: false,
    };
  } catch (e: any) {
    return { success: false, blocked: false, errorMessage: String(e?.message || e), usedJsRender: true, robotsTxtChecked: false, robotsTxtDisallows: false };
  } finally {
    await browser.close();
  }
}

// ─── Main entry: compliant crawl ──────────────────────────────────────────────

/**
 * Attempt to fetch inventory content from a dealer URL.
 *
 * Flow:
 *   1. Check robots.txt
 *   2. Phase 1: HTTP fetch
 *   3. If empty/no inventory content → Phase 2: JS render
 *   4. If blocked at any phase → return blocked result
 *
 * Never retries blocked sources. Caller is responsible for writing block log.
 */
export async function compliantCrawl(url: string): Promise<CrawlResult> {
  const origin = new URL(url).origin;

  // Step 1: robots.txt check
  const disallowedPaths = await fetchRobotsTxt(origin);
  const robotsBlocks = isDisallowedByRobots(url, disallowedPaths);

  if (robotsBlocks) {
    return {
      success: false,
      blocked: true,
      blockReason: 'robots_txt',
      usedJsRender: false,
      robotsTxtChecked: true,
      robotsTxtDisallows: true,
      errorMessage: `robots.txt disallows crawling ${new URL(url).pathname}`,
    };
  }

  // Step 2: HTTP fetch
  const phase1 = await httpFetch(url);
  phase1.robotsTxtChecked = true;
  phase1.robotsTxtDisallows = false;

  if (phase1.blocked) return phase1;
  if (!phase1.success) {
    // Non-block failure (DNS, SSL, timeout) — try JS render
    const phase2 = await jsRenderFetch(url);
    phase2.robotsTxtChecked = true;
    phase2.robotsTxtDisallows = false;
    return phase2;
  }

  // Phase 1 succeeded — check if content is useful
  if (phase1.html && hasInventoryContent(phase1.html)) {
    return phase1;
  }

  // Step 3: JS render (content was empty or no inventory signals)
  console.log(`[compliantCrawl] Phase 1 returned no inventory content for ${url} — trying JS render`);
  const phase2 = await jsRenderFetch(url);
  phase2.robotsTxtChecked = true;
  phase2.robotsTxtDisallows = false;
  return phase2;
}

// ─── Block log writer ─────────────────────────────────────────────────────────

/**
 * Upsert a dealer_block_log entry.
 * Uses ON CONFLICT (dealer_slug) DO UPDATE so only the latest attempt is kept.
 */
export async function writeBlockLog(entry: BlockLogEntry): Promise<void> {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  await sb.from('dealer_block_log').upsert({
    dealer_slug:          entry.dealer_slug,
    dealer_name:          entry.dealer_name,
    inventory_url:        entry.inventory_url,
    block_reason:         entry.block_reason,
    http_status:          entry.http_status ?? null,
    error_message:        entry.error_message ?? null,
    robots_txt_disallows: entry.robots_txt_disallows,
    attempted_at:         new Date().toISOString(),
    resolved:             false,
    updated_at:           new Date().toISOString(),
  }, { onConflict: 'dealer_slug' });
}

// ─── Seed known blocked dealers ───────────────────────────────────────────────

/**
 * Called once to seed dealer_block_log with dealers we already know are blocked.
 * Safe to call multiple times (upsert).
 */
export const KNOWN_BLOCKED_DEALERS: BlockLogEntry[] = [
  { dealer_slug: 'icon-golf-cars-jacksonville', dealer_name: 'ICON Golf Cars — Jacksonville', inventory_url: 'https://icongolfcartsusa.com/location/florida/', block_reason: 'http_403', http_status: 403, robots_txt_disallows: false },
  { dealer_slug: 'icon-golf-cars-yulee',        dealer_name: 'ICON Golf Cars — Yulee',        inventory_url: 'https://icongolfcartsusa.com/location/florida/', block_reason: 'http_403', http_status: 403, robots_txt_disallows: false },
  { dealer_slug: 'paradise-powersports-nsb',    dealer_name: 'Paradise Powersports — NSB',    inventory_url: 'https://paradisepowersports.com/inventory/',    block_reason: 'http_403', http_status: 403, robots_txt_disallows: false },
  { dealer_slug: 'total-golf-cart-vero-beach',  dealer_name: 'Total Golf Cart — Vero Beach',  inventory_url: 'https://www.totalgolfcart.com/inventory/',       block_reason: 'http_403', http_status: 403, robots_txt_disallows: false },
  { dealer_slug: 'pooler-golf-cars',            dealer_name: 'Pooler Golf Cars',              inventory_url: 'https://www.poolergolfcars.com/',               block_reason: 'http_402', http_status: 402, robots_txt_disallows: false },
  { dealer_slug: 'golden-coast-golf-carts-brunswick', dealer_name: 'Golden Coast Golf Carts — Brunswick', inventory_url: 'https://www.goldencoastgolfcarts.com/Major_Unit_List', block_reason: 'http_403', http_status: 403, robots_txt_disallows: false },
  { dealer_slug: 'jax-golf-carts-jacksonville', dealer_name: 'JAX Golf Carts — Jacksonville', inventory_url: 'https://golfcartsjacksonville.com/auto-listing-sitemap.xml', block_reason: 'captcha_detected', http_status: 202, robots_txt_disallows: false },
  { dealer_slug: 'tsa-golf-evans',              dealer_name: 'TSA Golf — Evans',              inventory_url: 'https://www.tsagolf.com/',                       block_reason: 'captcha_detected', http_status: 202, robots_txt_disallows: false },
  { dealer_slug: 'budget-golf-carts-yulee',     dealer_name: 'Budget Golf Carts — Yulee',     inventory_url: 'https://budgetgolfcarts.com/shop-now/',          block_reason: 'captcha_detected', http_status: 202, robots_txt_disallows: false },
  { dealer_slug: 'sunshine-golf-car',           dealer_name: 'Sunshine Golf Car',             inventory_url: 'https://www.sunshinegolfcar.com/inventory/',     block_reason: 'ssl_error',       http_status: 0,   robots_txt_disallows: false },
  { dealer_slug: 'whitakers-golf-cars-waycross',dealer_name: "Whitaker's Golf Cars — Waycross", inventory_url: 'https://www.whitakersgolfcars.com/',           block_reason: 'dns_failure',     http_status: 0,   robots_txt_disallows: false },
];
