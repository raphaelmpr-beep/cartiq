/**
 * CartIQ — Discovery Golf Cars Sync Orchestrator
 *
 * Execution order (enforced):
 *  1. Crawl /inventory/ for listing URLs (via Playwright)
 *  2. Parse each listing page → ListingData
 *  3. Insert into pending_imports (status = 'pending')
 *  4. Skip duplicates (source_url UNIQUE constraint)
 *  5. Write sync_log entry
 *  6. NEVER publish directly to listings table
 *
 * MAX_PARALLEL_BROWSER_TASKS = 4 (enforced via concurrency limiter)
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { getDiscoveryListingUrls, parseDiscoveryListing, type ListingData } from './adapters.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;
const MAX_CONCURRENCY = 4;

interface SyncOptions {
  limit?: number;        // max listings to discover (0 = no limit; use 5 for test)
  dryRun?: boolean;      // if true, parse but don't write to DB
  verbose?: boolean;
}

interface SyncResult {
  discovered: number;
  inserted: number;
  duplicates: number;
  errors: number;
  listings: ListingData[];
  syncLogId?: number;
}

// ── Concurrency limiter ────────────────────────────────────────────────────────

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrent: number
): Promise<T[]> {
  const results: T[] = [];
  const queue = [...tasks];
  const inFlight: Promise<void>[] = [];

  const runNext = async (): Promise<void> => {
    if (queue.length === 0) return;
    const task = queue.shift()!;
    const result = await task();
    results.push(result);
    await runNext();
  };

  for (let i = 0; i < Math.min(maxConcurrent, tasks.length); i++) {
    inFlight.push(runNext());
  }
  await Promise.all(inFlight);
  return results;
}

// ── Main sync function ─────────────────────────────────────────────────────────

export async function runDiscoverySync(opts: SyncOptions = {}): Promise<SyncResult> {
  const { limit = 0, dryRun = false, verbose = true } = opts;
  const log = verbose ? console.log : () => {};

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const result: SyncResult = {
    discovered: 0, inserted: 0, duplicates: 0, errors: 0, listings: [],
  };

  const startedAt = new Date().toISOString();
  log(`[Discovery Sync] Starting${limit ? ` (limit: ${limit})` : ''} at ${startedAt}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  try {
    // ── Step 1: Crawl inventory pages for listing URLs ──
    log(`[Discovery Sync] Crawling inventory pages...`);
    const indexPage = await context.newPage();
    const listingUrls = await getDiscoveryListingUrls(indexPage, limit);
    await indexPage.close();

    result.discovered = listingUrls.length;
    log(`[Discovery Sync] Found ${listingUrls.length} listing URLs`);

    if (listingUrls.length === 0) {
      log(`[Discovery Sync] No listings found — check if /inventory/ is accessible`);
      await browser.close();
      return result;
    }

    // ── Step 2: Parse each listing page (with concurrency cap) ──
    const parseTasks = listingUrls.map(url => async (): Promise<ListingData | null> => {
      const page = await context.newPage();
      try {
        log(`  Parsing: ${url}`);
        const data = await parseDiscoveryListing(page, url);
        return data;
      } catch (e) {
        console.error(`  [ERROR] ${url}: ${(e as Error).message}`);
        result.errors++;
        return null;
      } finally {
        await page.close();
      }
    });

    const parseResults = await runWithConcurrency(parseTasks, MAX_CONCURRENCY);
    const validListings = parseResults.filter((l): l is ListingData => l !== null);
    result.listings = validListings;

    log(`[Discovery Sync] Parsed ${validListings.length}/${listingUrls.length} listings successfully`);

    if (dryRun) {
      log(`[Discovery Sync] DRY RUN — not writing to DB`);
      await browser.close();
      return result;
    }

    // ── Step 3: Upsert into pending_imports ──
    log(`[Discovery Sync] Writing to pending_imports...`);
    for (const listing of validListings) {
      const row = {
        dealer_slug:    listing.dealer_slug,
        source_url:     listing.source_url,
        raw_title:      listing.raw_title || null,
        year:           listing.year,
        make:           listing.make,
        model:          listing.model,
        condition:      listing.condition,
        price:          listing.price,
        image_url:      listing.image_url,
        image_urls_json: JSON.stringify(listing.image_urls),
        location_city:  listing.location_city,
        location_state: listing.location_state,
        specs_json:     JSON.stringify(listing.specs),
        status:         'pending',
        // deal_rating and valuation_confidence set at import time (not pending stage)
        // Kept here as a reminder — pending_imports table does not carry these fields.
        // When promoted to listings via runImport(), defaults are: unknown / low.
      };

      const { error } = await sb
        .from('pending_imports')
        .upsert(row, { onConflict: 'source_url', ignoreDuplicates: true });

      if (error) {
        if (error.message?.includes('duplicate') || error.code === '23505') {
          result.duplicates++;
          log(`  ~ Duplicate skipped: ${listing.source_url}`);
        } else {
          result.errors++;
          console.error(`  [DB ERROR] ${listing.source_url}: ${error.message}`);
        }
      } else {
        result.inserted++;
        log(`  + Inserted: ${listing.raw_title || listing.source_url} | $${listing.price} | ${listing.location_city}`);
      }
    }

    // ── Step 4: Write sync_log entry ──
    const finishedAt = new Date().toISOString();
    const { data: logRow } = await sb
      .from('sync_log')
      .insert({
        dealer_slug: 'discovery',
        source_url:  'https://discoverygolfcars.com/inventory/',
        price_found: null,
        price_changed: false,
        image_count: validListings.reduce((sum, l) => sum + l.image_urls.length, 0),
        status: result.errors > 0 ? 'error' : 'ok',
        notes: JSON.stringify({
          discovered: result.discovered,
          inserted:   result.inserted,
          duplicates: result.duplicates,
          errors:     result.errors,
          limit,
          started_at: startedAt,
          finished_at: finishedAt,
        }),
        synced_at: finishedAt,
      })
      .select('id')
      .single();

    if (logRow) {
      result.syncLogId = logRow.id;
      log(`[Discovery Sync] sync_log entry created: id=${logRow.id}`);
    }

  } finally {
    await browser.close();
  }

  log(`\n[Discovery Sync] Complete:`);
  log(`  Discovered: ${result.discovered}`);
  log(`  Inserted:   ${result.inserted}`);
  log(`  Duplicates: ${result.duplicates}`);
  log(`  Errors:     ${result.errors}`);
  if (result.syncLogId) log(`  Log ID:     ${result.syncLogId}`);

  return result;
}
