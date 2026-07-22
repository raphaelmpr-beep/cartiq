/**
 * CartIQ — Generic Browser-Based Sync Orchestrator
 *
 * Handles dealers where plain HTTP fetch is blocked by bot-protection
 * (SiteGround SG Captcha, Cloudflare JS Challenge, etc.).
 *
 * Currently supported dealers:
 *   - jax-golf-carts-jacksonville  (adapter_key: jax, platform: gcr_wordpress)
 *
 * Extension pattern:
 *   1. Add dealer slug + sitemapUrl to BROWSER_SYNC_DEALERS
 *   2. Add adapter_key → parsePageFn mapping in PAGE_PARSERS
 *   3. Set browser_required=true on the dealers table row
 *   4. Trigger via POST /api/admin/sync-browser { dealer: "slug" }
 *
 * MAX_PARALLEL_BROWSER_TASKS = 4 (enforced via concurrency limiter)
 */

import { chromium, type BrowserContext } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import {
  parseJaxListing,
  type ListingData,
} from './adapters.js';
import { stealthFetchSitemapUrls } from './stealth-fetcher.js';

const MAX_CONCURRENCY = 4;

// ── Dealer registry for browser-based sync ────────────────────────────────────

interface BrowserSyncDealer {
  slug: string;
  name: string;
  sitemapUrl: string;
  /** Regex matching individual listing URLs in the sitemap */
  listingUrlPattern: RegExp;
  adapterKey: string;
  locationCity: string;
  locationState: string;
}

const BROWSER_SYNC_DEALERS: Record<string, BrowserSyncDealer> = {
  'jax-golf-carts-jacksonville': {
    slug: 'jax-golf-carts-jacksonville',
    name: 'JAX Golf Carts — Jacksonville',
    sitemapUrl: 'https://golfcartsjacksonville.com/auto-listing-sitemap.xml',
    listingUrlPattern: /^https:\/\/golfcartsjacksonville\.com\/listing\//,
    adapterKey: 'jax',
    locationCity: 'Jacksonville',
    locationState: 'FL',
  },
  // Future: add other SiteGround-protected or JS-challenge dealers here
  // 'example-dealer': {
  //   slug: 'example-dealer',
  //   sitemapUrl: 'https://example.com/auto-listing-sitemap.xml',
  //   listingUrlPattern: /^https:\/\/example\.com\/listing\//,
  //   adapterKey: 'gcr_generic',
  //   locationCity: 'City',
  //   locationState: 'FL',
  // },
};

// ── Page parser registry ───────────────────────────────────────────────────────

type PageParserFn = (
  page: import('playwright').Page,
  url: string
) => Promise<ListingData>;

const PAGE_PARSERS: Record<string, PageParserFn> = {
  jax: parseJaxListing,
  // Future adapters: add adapter_key → parser here
};

// ── Result types ──────────────────────────────────────────────────────────────

export interface BrowserSyncResult {
  dealer: string;
  discovered: number;
  new_queued: number;
  already_known: number;
  parse_errors: number;
  db_errors: number;
  duration_ms: number;
  summary: string[];
  listings?: ListingData[];
}

// ── Concurrency limiter ────────────────────────────────────────────────────────

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrent: number
): Promise<T[]> {
  const results: T[] = [];
  const queue = [...tasks];

  const runNext = async (): Promise<void> => {
    if (queue.length === 0) return;
    const task = queue.shift()!;
    results.push(await task());
    await runNext();
  };

  await Promise.all(
    Array.from({ length: Math.min(maxConcurrent, tasks.length) }, () => runNext())
  );
  return results;
}

// ── Sitemap fetcher (browser-based, bypasses SG Captcha) ──────────────────────

async function fetchSitemapUrlsViaBrowser(
  context: BrowserContext,
  dealer: BrowserSyncDealer,
  limit: number
): Promise<string[]> {
  const page = await context.newPage();
  try {
    await page.goto(dealer.sitemapUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500); // allow JS challenge to resolve

    const content = await page.content();

    // Extract <loc> URLs from XML — works whether the browser renders raw XML
    // or the SG Captcha challenge resolves and returns real content
    const matches = [...content.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(m => m[1].trim())
      .filter(url => dealer.listingUrlPattern.test(url));

    const urls = [...new Set(matches)]; // deduplicate
    return limit > 0 ? urls.slice(0, limit) : urls;
  } finally {
    await page.close();
  }
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export interface BrowserSyncOptions {
  dealer: string;   // dealer slug
  limit?: number;   // max listings to process (0 = all)
  dry_run?: boolean;
  verbose?: boolean;
}

export async function runBrowserSync(
  opts: BrowserSyncOptions
): Promise<BrowserSyncResult> {
  const { dealer: dealerSlug, limit = 0, dry_run = false, verbose = true } = opts;
  const log = verbose ? console.log : () => {};

  const start = Date.now();
  const result: BrowserSyncResult = {
    dealer: dealerSlug,
    discovered: 0,
    new_queued: 0,
    already_known: 0,
    parse_errors: 0,
    db_errors: 0,
    duration_ms: 0,
    summary: [],
    listings: [],
  };

  // ── Validate dealer config ──────────────────────────────────────────────────
  const dealerCfg = BROWSER_SYNC_DEALERS[dealerSlug];
  if (!dealerCfg) {
    result.summary.push(`[${dealerSlug}] Not found in BROWSER_SYNC_DEALERS registry`);
    result.duration_ms = Date.now() - start;
    return result;
  }

  const parseFn = PAGE_PARSERS[dealerCfg.adapterKey];
  if (!parseFn) {
    result.summary.push(`[${dealerSlug}] No page parser for adapter_key="${dealerCfg.adapterKey}"`);
    result.duration_ms = Date.now() - start;
    return result;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );

  log(`[BrowserSync] Starting ${dealerCfg.name}${limit ? ` (limit: ${limit})` : ''}`);

  // ── Launch browser ──────────────────────────────────────────────────────────
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  try {
    // ── Step 1: Fetch sitemap via stealth browser (bypasses SG JS challenge) ────
    log(`[BrowserSync] Fetching sitemap via stealth: ${dealerCfg.sitemapUrl}`);
    await browser.close(); // close plain browser — stealth-fetcher manages its own

    const stealthResult = await stealthFetchSitemapUrls(
      dealerCfg.sitemapUrl,
      dealerCfg.listingUrlPattern
    );

    if (!stealthResult.success || stealthResult.urls.length === 0) {
      result.summary.push(
        `[${dealerSlug}] Stealth fetch failed or returned 0 URLs: ${stealthResult.error ?? 'empty sitemap'}`
      );
      // Update dealer status
      await supabase.from('dealers').update({
        last_discovery_status: 'needs_browser',
        last_discovery_message: `[${dealerSlug}] Stealth fetch: ${stealthResult.error ?? 'no listing URLs found'}`,
        last_discovery_at: new Date().toISOString(),
      }).eq('slug', dealerSlug);
      result.duration_ms = Date.now() - start;
      return result;
    }

    const rawUrls = limit > 0 ? stealthResult.urls.slice(0, limit) : stealthResult.urls;
    log(`[BrowserSync] Stealth fetch found ${rawUrls.length} listing URL(s)`);

    // ── Step 2: Diff against known URLs ─────────────────────────────────────────
    // "Active" listings: already public+active → skip (no re-parse needed)
    // "Inactive/archived" listings: in DB but hidden → eligible for re-parse+reactivation
    // "Pending imports": queued but not yet promoted → skip (already in flight)
    const [{ data: activeListings }, { data: inactiveListings }, { data: existingPending }] = await Promise.all([
      supabase
        .from('listings')
        .select('id, source_listing_url')
        .eq('sync_source', dealerSlug)
        .eq('status', 'active')
        .not('source_listing_url', 'is', null),
      supabase
        .from('listings')
        .select('id, source_listing_url')
        .eq('sync_source', dealerSlug)
        .in('status', ['inactive', 'archived'])
        .not('source_listing_url', 'is', null),
      supabase
        .from('pending_imports')
        .select('source_url')
        .eq('dealer_slug', dealerSlug)
        .eq('status', 'pending'),
    ]);

    const activeUrls  = new Set((activeListings  || []).map((r: any) => r.source_listing_url as string));
    const pendingUrls = new Set((existingPending || []).map((r: any) => r.source_url as string));
    // Inactive listings that are back in the live sitemap — re-parse to refresh data
    const inactiveUrlMap = new Map(
      (inactiveListings || []).map((r: any) => [r.source_listing_url as string, r.id as number])
    );

    const allUrls = rawUrls;
    const trulyNew   = allUrls.filter(u => !activeUrls.has(u) && !pendingUrls.has(u) && !inactiveUrlMap.has(u));
    const toReparse  = allUrls.filter(u => inactiveUrlMap.has(u) && !pendingUrls.has(u));
    const skipActive = allUrls.filter(u => activeUrls.has(u)).length;
    const skipPending = allUrls.filter(u => pendingUrls.has(u)).length;

    result.already_known = skipActive + skipPending;
    log(`[BrowserSync] ${allUrls.length} in sitemap | ${skipActive} active (skip) | ${skipPending} pending (skip) | ${toReparse.length} inactive→re-parse | ${trulyNew.length} new`);
    result.summary.push(
      `[${dealerSlug}] ${allUrls.length} in sitemap | ${result.already_known} up-to-date | ${toReparse.length} inactive→re-parse | ${trulyNew.length} new`
    );

    const urlsToProcess = [...trulyNew, ...toReparse];

    if (urlsToProcess.length === 0) {
      result.summary.push(`[${dealerSlug}] All listings current — nothing to do`);
      result.duration_ms = Date.now() - start;
      return result;
    }

    if (dry_run) {
      result.new_queued = trulyNew.length;
      result.summary.push(`[${dealerSlug}] [DRY RUN] Would parse ${trulyNew.length} new + ${toReparse.length} re-parse:`);
      urlsToProcess.slice(0, 10).forEach(u => result.summary.push(`  → ${u}${inactiveUrlMap.has(u) ? ' (re-parse)' : ' (new)'}`) );
      result.duration_ms = Date.now() - start;
      return result;
    }

    // ── Step 3: Parse each listing page via Playwright (capped concurrency) ──────
    log(`[BrowserSync] Parsing ${urlsToProcess.length} listing pages (max ${MAX_CONCURRENCY} parallel)...`);

    // Relaunch browser for parsing (stealth-fetcher closed its own instance)
    const parseBrowser = await chromium.launch({ headless: true });
    const parseContext = await parseBrowser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });

    const parseTasks = urlsToProcess.map(url => async (): Promise<ListingData | null> => {
      const page = await parseContext.newPage();
      try {
        log(`  Parsing: ${url}`);
        const data = await parseFn(page, url);

        // Fallback: fill in city/state from dealer config if parser couldn't extract it
        if (!data.location_city) data.location_city = dealerCfg.locationCity;
        if (!data.location_state) data.location_state = dealerCfg.locationState;

        return data;
      } catch (e) {
        const msg = (e as Error).message;
        console.error(`  [PARSE ERROR] ${url}: ${msg}`);
        result.parse_errors++;
        result.summary.push(`  ✗ Parse error: ${url} — ${msg}`);
        return null;
      } finally {
        await page.close();
      }
    });

    const parseResults = await runWithConcurrency(parseTasks, MAX_CONCURRENCY);
    await parseBrowser.close();
    const validListings = parseResults.filter((l): l is ListingData => l !== null);
    result.listings = validListings;

    log(`[BrowserSync] Parsed ${validListings.length}/${newUrls.length} successfully`);

    // ── Step 4: Persist results ──────────────────────────────────────────────────
    // Re-parse path: reactivate inactive listings with fresh page data
    // New path: insert into pending_imports for admin review
    for (const listing of validListings) {
      const existingId = inactiveUrlMap.get(listing.source_url);

      if (existingId) {
        // Re-activate: update the existing listing in place with fresh data
        const update: Record<string, any> = {
          status:         'active',
          public_listing: true,
          updated_at:     new Date().toISOString(),
        };
        if (listing.price)              update.price       = listing.price;
        if (listing.raw_title)          update.title       = listing.raw_title;
        if (listing.year)               update.year        = listing.year;
        if (listing.make)               update.make        = listing.make;
        if (listing.model)              update.model       = listing.model;
        if (listing.image_url)          update.image_url   = listing.image_url;
        if (listing.image_urls?.length) update.image_urls  = listing.image_urls;
        if (listing.condition)          update.condition   = listing.condition;
        if (listing.location_city)      update.city        = listing.location_city;
        if (listing.location_state)     update.state       = listing.location_state;

        const { error } = await supabase.from('listings').update(update).eq('id', existingId);
        if (error) {
          result.db_errors++;
          result.summary.push(`  ✗ Reactivate error #${existingId}: ${error.message}`);
        } else {
          result.new_queued++;
          result.summary.push(`  ↺ Reactivated: ${listing.raw_title || listing.source_url} ($${listing.price ?? 'N/A'})`);
          log(`  ↺ Reactivated #${existingId}: ${listing.raw_title} | $${listing.price}`);
        }
      } else {
        // Genuinely new: queue in pending_imports for admin review
        const row = {
          dealer_slug:      listing.dealer_slug,
          source_url:       listing.source_url,
          raw_title:        listing.raw_title || null,
          year:             listing.year,
          make:             listing.make,
          model:            listing.model,
          condition:        listing.condition,
          price:            listing.price,
          image_url:        listing.image_url,
          image_urls_json:  JSON.stringify(listing.image_urls),
          location_city:    listing.location_city,
          location_state:   listing.location_state,
          specs_json:       JSON.stringify(listing.specs),
          status:           'pending',
        };
        const { error } = await supabase
          .from('pending_imports')
          .upsert(row, { onConflict: 'source_url', ignoreDuplicates: true });
        if (error) {
          result.db_errors++;
          result.summary.push(`  ✗ DB error: ${listing.source_url} — ${error.message}`);
        } else {
          result.new_queued++;
          result.summary.push(`  + Queued: ${listing.raw_title || listing.source_url} ($${listing.price ?? 'N/A'})`);
          log(`  + Queued: ${listing.raw_title} | $${listing.price}`);
        }
      }
    }

    // ── Step 5: Update dealer discovery status ──────────────────────────────────
    const statusMsg = result.new_queued > 0
      ? `Browser sync OK — ${result.new_queued} new listing(s) queued for review`
      : `Browser sync OK — no new listings found`;
    await supabase.from('dealers').update({
      last_discovery_status:  result.new_queued > 0 ? 'ok' : 'no_new',
      last_discovery_message: statusMsg,
      last_discovery_at:      new Date().toISOString(),
    }).eq('slug', dealerSlug);

    result.summary.push(
      `[${dealerSlug}] Done — ${result.new_queued} queued | ${result.parse_errors} parse errors | ${result.db_errors} DB errors`
    );

  } catch (e: any) {
    result.summary.push(`[${dealerSlug}] Unexpected error: ${String(e?.message || e)}`);
  }

  result.duration_ms = Date.now() - start;
  return result;
}
