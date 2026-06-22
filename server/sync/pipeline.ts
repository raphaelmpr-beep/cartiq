/**
 * CartIQ Inventory Verification Pipeline
 *
 * Modes:
 *   verify   — check existing CartIQ listings against live dealer pages, flag price drift
 *   discover — scan dealer sitemaps for NEW listings not yet in CartIQ, queue to pending_imports
 *   import   — promote a pending_import into a real listing
 *
 * Run via: POST /api/admin/sync  { mode, dealer, limit }
 */

import { chromium, type Browser, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import {
  getBoteroListingUrls,
  getJaxListingUrls,
  parseBoteroListing,
  parseJaxListing,
  parseDiscoveryListing,
  type ListingData,
} from './adapters.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Price drift threshold — flag if live price differs by more than 5%
const PRICE_DRIFT_THRESHOLD = 0.05;

// ─── Main entry point ─────────────────────────────────────────────────────────

export interface SyncOptions {
  mode: 'verify' | 'discover' | 'import';
  dealer?: 'botero' | 'jax' | 'discovery' | 'all';
  limit?: number;           // max listings to process
  import_id?: number;       // for mode=import: pending_imports.id to promote
  dry_run?: boolean;        // don't write to DB
}

export interface SyncResult {
  mode: string;
  dealer: string;
  processed: number;
  verified_ok: number;
  price_mismatches: number;  // existing listings with wrong price
  new_found: number;         // new listings queued to pending_imports
  errors: number;
  duration_ms: number;
  summary: string[];
}

export async function runSync(opts: SyncOptions): Promise<SyncResult> {
  const start = Date.now();
  const result: SyncResult = {
    mode: opts.mode,
    dealer: opts.dealer || 'all',
    processed: 0,
    verified_ok: 0,
    price_mismatches: 0,
    new_found: 0,
    errors: 0,
    duration_ms: 0,
    summary: [],
  };

  if (opts.mode === 'import' && opts.import_id) {
    await runImport(opts.import_id, opts.dry_run || false, result);
    result.duration_ms = Date.now() - start;
    return result;
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const dealers = opts.dealer === 'all'
      ? ['botero', 'jax']
      : [opts.dealer || 'botero'];

    for (const dealer of dealers) {
      if (opts.mode === 'verify') {
        await runVerify(browser, dealer, opts.limit || 20, opts.dry_run || false, result);
      } else if (opts.mode === 'discover') {
        await runDiscover(browser, dealer, opts.limit || 30, opts.dry_run || false, result);
      }
    }
  } finally {
    await browser.close();
  }

  result.duration_ms = Date.now() - start;
  return result;
}

// ─── VERIFY mode: check existing CartIQ listings ─────────────────────────────

async function runVerify(
  browser: Browser,
  dealer: string,
  limit: number,
  dry_run: boolean,
  result: SyncResult
) {
  // Get CartIQ listings for this dealer that have a source_listing_url
  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, title, price, source_listing_url, sync_source, verified_at')
    .or(`sync_source.eq.${dealer},source_listing_url.ilike.%${getDealerDomain(dealer)}%`)
    .not('source_listing_url', 'is', null)
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error || !listings?.length) {
    result.summary.push(`[${dealer}] No listings with source URLs to verify`);
    return;
  }

  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  for (const listing of listings) {
    try {
      const live = await parseListing(page, listing.source_listing_url!, dealer);
      result.processed++;

      const priceDrift = live.price && listing.price
        ? Math.abs(live.price - listing.price) / listing.price
        : null;

      const status = !live.price
        ? 'not_found'
        : priceDrift && priceDrift > PRICE_DRIFT_THRESHOLD
        ? 'price_mismatch'
        : 'ok';

      if (status === 'ok') result.verified_ok++;
      if (status === 'price_mismatch') {
        result.price_mismatches++;
        result.summary.push(
          `[${dealer}] Price drift on #${listing.id} "${listing.title}": ` +
          `CartIQ=$${listing.price} Live=$${live.price} (${(priceDrift! * 100).toFixed(1)}%)`
        );
      }

      if (!dry_run) {
        // Update listing with fresh data
        const updates: any = {
          last_checked_at: new Date().toISOString(),
          price_confidence: status === 'ok' ? 'confirmed' : status === 'price_mismatch' ? 'stale' : 'unavailable',
        };
        if (status === 'ok' || status === 'price_mismatch') {
          updates.verified_at = new Date().toISOString();
        }
        if (status === 'price_mismatch' && live.price) {
          updates.price_scraped = live.price; // store live price separately, don't auto-update
        }
        if (live.image_urls.length > 0 && !listing.source_listing_url?.includes('unsplash')) {
          updates.image_url = live.image_url;
          updates.image_urls_json = JSON.stringify(live.image_urls);
        }

        await supabase.from('listings').update(updates).eq('id', listing.id);

        // Log to sync_log
        await supabase.from('sync_log').insert({
          listing_id: listing.id,
          dealer_slug: dealer,
          source_url: listing.source_listing_url,
          price_found: live.price,
          price_changed: status === 'price_mismatch',
          image_count: live.image_urls.length,
          status,
          notes: status === 'price_mismatch'
            ? `CartIQ: $${listing.price} | Live: $${live.price}`
            : null,
        });
      }
    } catch (e: any) {
      result.errors++;
      result.summary.push(`[${dealer}] Error on #${listing.id}: ${e.message}`);
    }
  }

  await page.close();
}

// ─── DISCOVER mode: find new listings not yet in CartIQ ──────────────────────

async function runDiscover(
  browser: Browser,
  dealer: string,
  limit: number,
  dry_run: boolean,
  result: SyncResult
) {
  // Get all listing URLs from dealer sitemap
  let allUrls: string[] = [];
  if (dealer === 'botero') allUrls = await getBoteroListingUrls(true); // FL/GA only
  if (dealer === 'jax') allUrls = await getJaxListingUrls();

  if (!allUrls.length) {
    result.summary.push(`[${dealer}] No URLs found in sitemap`);
    return;
  }

  // Get existing source URLs from CartIQ + already-pending imports
  const { data: existing } = await supabase
    .from('listings')
    .select('source_listing_url')
    .not('source_listing_url', 'is', null);
  const { data: pending } = await supabase
    .from('pending_imports')
    .select('source_url');

  const knownUrls = new Set([
    ...(existing || []).map((r: any) => r.source_listing_url),
    ...(pending || []).map((r: any) => r.source_url),
  ]);

  // Only process URLs not already known
  const newUrls = allUrls.filter(u => !knownUrls.has(u)).slice(0, limit);

  if (!newUrls.length) {
    result.summary.push(`[${dealer}] All ${allUrls.length} listings already known`);
    return;
  }

  result.summary.push(`[${dealer}] Found ${newUrls.length} new URLs to parse (from ${allUrls.length} total)`);

  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  for (const url of newUrls) {
    try {
      const listing = await parseListing(page, url, dealer);
      result.processed++;

      if (!listing.make && !listing.year && !listing.price) {
        result.errors++;
        continue; // nothing useful parsed
      }

      result.new_found++;

      if (!dry_run) {
        await supabase.from('pending_imports').insert({
          dealer_slug: dealer,
          source_url: url,
          raw_title: listing.raw_title,
          year: listing.year,
          make: listing.make,
          model: listing.model,
          condition: listing.condition,
          price: listing.price,
          image_url: listing.image_url,
          image_urls_json: JSON.stringify(listing.image_urls),
          location_city: listing.location_city,
          location_state: listing.location_state,
          specs_json: JSON.stringify(listing.specs),
        });
      }

      result.summary.push(
        `[${dealer}] Queued: ${listing.year} ${listing.make} ${listing.model} @ $${listing.price ?? 'N/A'} — ${url}`
      );
    } catch (e: any) {
      result.errors++;
    }
  }

  await page.close();
}

// ─── IMPORT mode: promote a pending_import into a real listing ────────────────

async function runImport(import_id: number, dry_run: boolean, result: SyncResult) {
  const { data: imp, error } = await supabase
    .from('pending_imports')
    .select('*')
    .eq('id', import_id)
    .single();

  if (error || !imp) {
    result.summary.push(`Import #${import_id} not found`);
    result.errors++;
    return;
  }

  // Map pending_import fields to listings columns
  const newListing = {
    title: imp.raw_title || `${imp.year} ${imp.make} ${imp.model}`,
    year: imp.year,
    make: imp.make,
    model: imp.model,
    condition: imp.condition,
    price: imp.price,
    image_url: imp.image_url,
    image_urls_json: imp.image_urls_json,
    location_city: imp.location_city,
    location_state: imp.location_state,
    source_listing_url: imp.source_url,
    source_type: 'dealer_site',
    sync_source: imp.dealer_slug,
    verified_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
    price_confidence: 'confirmed',
  };

  result.processed++;

  if (!dry_run) {
    const { data: inserted, error: insertErr } = await supabase
      .from('listings')
      .insert(newListing)
      .select('id')
      .single();

    if (insertErr) {
      result.errors++;
      result.summary.push(`Import failed: ${insertErr.message}`);
      return;
    }

    await supabase.from('pending_imports').update({
      status: 'imported',
      reviewed_at: new Date().toISOString(),
      imported_listing_id: inserted.id,
    }).eq('id', import_id);

    result.new_found++;
    result.summary.push(`Imported #${import_id} → listing #${inserted.id}: ${newListing.title}`);
  } else {
    result.summary.push(`[dry_run] Would import: ${newListing.title} @ $${newListing.price}`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function parseListing(page: Page, url: string, dealer: string): Promise<ListingData> {
  if (dealer === 'botero') return parseBoteroListing(page, url);
  if (dealer === 'jax') return parseJaxListing(page, url);
  if (dealer === 'discovery') return parseDiscoveryListing(page, url);
  throw new Error(`Unknown dealer: ${dealer}`);
}

function getDealerDomain(dealer: string): string {
  const domains: Record<string, string> = {
    botero: 'boterocarts.com',
    jax: 'golfcartsjacksonville.com',
    discovery: 'discoverygolfcars.com',
  };
  return domains[dealer] || dealer;
}
