/**
 * CartIQ Sync Pipeline — Lambda-safe version
 *
 * This runs inside Vercel Lambda (no Playwright, no child_process, no filesystem writes).
 * Only handles:
 *   - discover_sitemap: fetch sitemap URLs, diff against DB, insert new URLs to pending_imports (NO page parsing)
 *   - import: promote a pending_import row into a real listing
 *   - verify_prices: fetch individual listing pages via HTTP (no JS rendering — marks as stale if blocked)
 *
 * Full Playwright-based parsing is handled by the weekly cron (run-pipeline.ts) which runs
 * in the pplx.app environment where Playwright IS available.
 */

import { createClient } from '@supabase/supabase-js';
import {
  getGcrSitemapUrls,
  isNavPage,
  cleanHtmlWhitespace,
} from './adapters.js';
// browser-sync is loaded lazily (dynamic import) to avoid pulling in playwright
// at module load time, which crashes Vercel Lambda environments without playwright installed.
// import { runBrowserSync } from './browser-sync.js'; // DO NOT re-add as static import

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );
}

// ─── Sitemap fetchers (HTTP only, no browser) ─────────────────────────────────

// Maps URL keyword → { dealer_slug, city, state } for all Botero locations
const BOTERO_LOCATION_MAP: Array<{ keywords: string[]; dealer_slug: string; city: string; state: string }> = [
  { keywords: ['jacksonville'],                  dealer_slug: 'botero-carts-jacksonville', city: 'Jacksonville',  state: 'FL' },
  { keywords: ['ocala'],                         dealer_slug: 'botero-carts-ocala',        city: 'Ocala',         state: 'FL' },
  { keywords: ['clearwater'],                    dealer_slug: 'botero-carts-clearwater',   city: 'Clearwater',    state: 'FL' },
  { keywords: ['melbourne'],                     dealer_slug: 'botero-carts-melbourne',    city: 'Melbourne',     state: 'FL' },
  { keywords: ['pensacola'],                     dealer_slug: 'botero-carts-pensacola',    city: 'Pensacola',     state: 'FL' },
  { keywords: ['peachtree', 'peachtree-city'],   dealer_slug: 'botero-carts-peachtree-city', city: 'Peachtree City', state: 'GA' },
  { keywords: ['cumming'],                       dealer_slug: 'botero-carts-cumming',      city: 'Cumming',       state: 'GA' },
];

interface BoteroRecord { url: string; dealer_slug: string; city: string; state: string; }

/** Fetch all Botero sitemaps and return structured records with dealer_slug/city/state per URL */
async function getBoteroLocationRecords(): Promise<BoteroRecord[]> {
  const sitemaps = [
    'https://boterocarts.com/glc_listing-sitemap.xml',
    'https://boterocarts.com/glc_listing-sitemap2.xml',
    'https://boterocarts.com/glc_listing-sitemap3.xml',
  ];
  const allUrls: string[] = [];
  for (const sm of sitemaps) {
    try {
      const res = await fetch(sm, { headers: sitemapHeaders(sm), signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const xml = await res.text();
      const matches = [...xml.matchAll(/<loc>(https:\/\/boterocarts\.com\/listing\/[^<]+)<\/loc>/g)];
      allUrls.push(...matches.map(m => m[1].trim()));
    } catch { /* skip failed sitemaps */ }
  }

  const records: BoteroRecord[] = [];
  for (const url of allUrls) {
    const lower = url.toLowerCase();
    const loc = BOTERO_LOCATION_MAP.find(l => l.keywords.some(kw => lower.includes(kw)));
    if (loc) {
      records.push({ url, dealer_slug: loc.dealer_slug, city: loc.city, state: loc.state });
    }
    // Skip URLs with no recognizable location (older slugs without city keyword)
  }
  return records;
}

// Legacy flat-URL helper (kept for back-compat, not used in main path)
async function getBoteroSitemapUrls(flGaOnly = true): Promise<string[]> {
  const records = await getBoteroLocationRecords();
  return records.map(r => r.url);
}

async function getJaxSitemapUrls(): Promise<string[]> {
  try {
    const jaxSitemap = 'https://golfcartsjacksonville.com/auto-listing-sitemap.xml';
    const res = await fetch(jaxSitemap, {
      headers: sitemapHeaders(jaxSitemap), signal: AbortSignal.timeout(10000)
    });
    const xml = await res.text();
    const matches = [...xml.matchAll(/<loc>(https:\/\/golfcartsjacksonville\.com\/listing\/[^<]+)<\/loc>/g)];
    return matches.map(m => m[1].trim());
  } catch { return []; }
}

// The Villages Golf Cars — 6 paginated product sitemaps, requires browser-like UA
async function getVillagesGolfCarsSitemapUrls(): Promise<string[]> {
  const UA = 'Mozilla/5.0 (compatible; GolfCartWise-Sync/1.0)';
  const urls: string[] = [];
  const suffixes = ['', '2', '3', '4', '5', '6'];
  for (const suffix of suffixes) {
    try {
      const res = await fetch(
        `https://www.thevillagesgolfcars.com/product-sitemap${suffix}.xml`,
        { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) break;
      const xml = await res.text();
      const matches = [...xml.matchAll(/<loc>(https:\/\/www\.thevillagesgolfcars\.com\/product\/[^<]+)<\/loc>/g)];
      urls.push(...matches.map(m => m[1].trim()));
    } catch { break; }
  }
  return urls;
}

// Quick title parser for slug-based metadata (no page fetch needed)
function parseSlug(url: string, dealer: string): { year: number | null; make: string | null; model: string | null; condition: string | null } {
  const slug = url.split('/listing/')[1]?.replace(/\/$/, '') || '';

  const yearMatch = slug.match(/\b(20\d{2}|19\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  const condMatch = slug.match(/^(new|used|refurbished|certified)/i);
  const condition = condMatch ? condMatch[1].toLowerCase() : null;

  const makeMap: [string, string][] = [
    ['e-z-go', 'E-Z-GO'], ['ezgo', 'E-Z-GO'], ['club-car', 'Club Car'],
    ['yamaha', 'Yamaha'], ['icon', 'ICON'], ['bintelli', 'Bintelli'],
    ['advanced-ev', 'Advanced EV'], ['star-ev', 'Star EV'], ['gem', 'GEM'],
    ['evolution', 'Evolution'], ['denago', 'Denago'], ['dach', 'Dach'],
    ['apollo', 'Apollo'], ['teko', 'Teko'],
  ];
  let make: string | null = null;
  for (const [pattern, name] of makeMap) {
    if (slug.includes(pattern)) { make = name; break; }
  }

  // Model: everything after make slug until next dash-number or end
  const modelSlug = slug.replace(/^(new|used|refurbished|certified)-/, '')
    .replace(/\b(20\d{2}|19\d{2})\b-?/, '')
    .replace(/lithium-ion-?|lithium-?|electric-?|gas-?/gi, '')
    .split('-').filter(p => p && !/^\d+$/.test(p)).slice(0, 4).join(' ')
    .replace(/\s+/g, ' ').trim();

  return { year, make, model: modelSlug || null, condition };
}


// ─── DX1/Algolia inventory fetcher ────────────────────────────────────────────
// Golf Rider (and future DX1-platform dealers) use an Algolia-powered inventory
// search. We query the API directly to get fully structured data — no page fetches.

interface Dx1AlgoliaConfig {
  appId: string;
  apiKey: string;       // restricted key scoped to this dealer's org/site
  indexName: string;    // e.g. 'prod_WebSellable'
  baseUrl: string;      // e.g. 'https://www.golfrider.com'
}

interface Dx1Unit {
  source_url: string;
  raw_title: string;
  year: number | null;
  make: string | null;
  model: string | null;
  condition: string | null;
  price: number | null;
  image_url: string | null;
  seating: number | null;
  location_city: string | null;
  location_state: string | null;
}

async function fetchDx1AlgoliaInventory(cfg: Dx1AlgoliaConfig): Promise<Dx1Unit[]> {
  const endpoint = `https://${cfg.appId}-dsn.algolia.net/1/indexes/${cfg.indexName}/query`;
  const units: Dx1Unit[] = [];
  let page = 0;

  while (true) {
    const payload = JSON.stringify({ params: `hitsPerPage=100&page=${page}`, query: '' });
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'X-Algolia-Application-Id': cfg.appId,
          'X-Algolia-API-Key': cfg.apiKey,
          'Content-Type': 'application/json',
        },
        body: payload,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.warn(`[dx1] Algolia error: ${res.status} ${res.statusText}`);
        break;
      }
      const data = await res.json() as any;
      const hits: any[] = data.hits || [];

      for (const h of hits) {
        const showroomUrl: string = h.ShowroomUrl || '';
        if (!showroomUrl) continue;

        // Only include golf cart / utility vehicle categories (skip ATVs, PWC, snowmobiles)
        const category: string = (h.ProductCategory || h.FriendlyProductCategory || '').toLowerCase();
        const industry: string = ((h.IndustryNameLists || []) as string[]).join(' ').toLowerCase();
        const isCart = /golf.cart|utility.vehic|electric.vehicle|low.speed|cart/i.test(category)
          || /golf.cart|utility.vehic|electric.vehicle|low.speed/i.test(industry)
          || /golf.cart|utility.vehic|electric/i.test(h.ProductType || '');
        // E-Z-GO, Yamaha, Club Car, Cushman, Alset are always golf cart brands
        const cartBrands = ['e-z-go','yamaha','club car','cushman','alset','star ev','icon','bintelli','epic','venom'];
        const mfr = (h.Manufacturer || '').toLowerCase();
        const isBrand = cartBrands.some(b => mfr.includes(b));
        if (!isCart && !isBrand) continue;

        const year = h.Year ? parseInt(h.Year) : null;
        const make = h.Manufacturer || null;
        const model = h.ProductName || null;
        const cond = (h.Condition || '').toLowerCase() === 'used' ? 'used' : 'new';
        const price = h.Price || h.SalePrice || h.Msrp || null;
        const photos: string[] = h.PhotoLists || [];
        const image_url = photos.length > 0 ? photos[0] : null;

        // Seating from ProductType string (e.g. "4 Passenger", "6 Passenger")
        const ptMatch = (h.ProductType || '').match(/^(\d+)/);
        const seating = ptMatch ? parseInt(ptMatch[1]) : null;

        const title = [year, make, model].filter(Boolean).join(' ');

        units.push({
          source_url: showroomUrl,
          raw_title: title,
          year,
          make,
          model,
          condition: cond,
          price: price ? parseFloat(String(price)) : null,
          image_url,
          seating,
          location_city: h.City || null,
          location_state: h.StateProvinceCode || h.StateProvince || null,
        });
      }

      if (page + 1 >= (data.nbPages || 1)) break;
      page++;
    } catch (e: any) {
      console.warn(`[dx1] Fetch error page ${page}: ${e?.message}`);
      break;
    }
  }

  return units;
}

// Golf Rider DX1 config — extracted from their inventory page HTML
const GOLF_RIDER_DX1: Dx1AlgoliaConfig = {
  appId:     'RBG3H22Y5V',
  apiKey:    'MTE0ODVhZDAzNjQ2Y2I0Mzg5MGUzMzQ4Yjg3NmQ5MTI2ZmQ0Y2YwNjVkNDEzYmRkMDhjZjdjZTE3YzdlZWUwZGF0dHJpYnV0ZXNUb1JldHJpZXZlPSomYXR0cmlidXRlc1RvSGlnaGxpZ2h0PU1hbnVmYWN0dXJlcixQcm9kdWN0TmFtZSxQcm9kdWN0VHlwZSZmYWNldEZpbHRlcnM9JTVCJTVCJTIyT3JnYW5pemF0aW9uSWQlM0E2MGU4MzUyYi01MWU5LTRhNzQtYmE0Yi0xYzc3ZjFkY2MzZDIlMjIlNUQlMkMlNUIlMjJTaXRlR3VpZExpc3RzJTNBMTk3ZGI4ZjUtMGVhMy00OGQxLTgxZGEtMTA4N2I4ZGUzNTY3JTIyJTVEJTVEJmFuYWx5dGljcz10cnVlJmFuYWx5dGljc1RhZ3M9R29sZitSaWRlciUyQytJbmMuJm51bWVyaWNGaWx0ZXJzPSU1QiU1QiUyMkhhc0RhdGVTb2xkJTNEMCUyMiUyQyUyMlNvbGRVbml0c0V4cGlyZURhdGUlM0UlM0QxNzgyMzQ1NjAwJTIyJTVEJTVEJnJlc3RyaWN0SW5kaWNlcz1wcm9kX1dlYlNlbGxhYmxlLHByb2RfV2ViU2VsbGFibGVfUHJpY2VfQXNjLHByb2RfV2ViU2VsbGFibGVfUHJpY2VfRGVzYyxwcm9kX1dlYlNlbGxhYmxlX1llYXJfQXNjLHByb2RfV2ViU2VsbGFibGVfWWVhcl9EZXNjLHByb2RfV2ViU2VsbGFibGVfQWdlX0FzYyxwcm9kX1dlYlNlbGxhYmxlX0FnZV9EZXNjJnZhbGlkVW50aWw9MTc4MjM5MjAzMA==',
  indexName: 'prod_WebSellable',
  baseUrl:   'https://www.golfrider.com',
};

// ─── Main sync entry point (Lambda-safe) ─────────────────────────────────────

export interface SyncOptions {
  mode: 'discover_sitemap' | 'import' | 'status';
  dealer?: string;
  limit?: number;
  import_id?: number;
  dry_run?: boolean;
}

// ── Source-registry dealer record (from dealers table) ────────────────────────
interface DealerSourceRecord {
  slug: string;
  name: string | null;
  website_url: string | null;
  adapter_key: string | null;
  platform_type: string | null;
  discovery_strategy: string | null;
  inventory_source_url: string | null;
  canonical_domain: string | null;
  browser_required: boolean;
  sync_enabled: boolean;
}

export interface SyncResult {
  mode: string;
  dealer: string;
  processed: number;
  new_queued: number;
  already_known: number;
  errors: number;
  duration_ms: number;
  summary: string[];
}

export async function runLambdaSync(opts: SyncOptions): Promise<SyncResult> {
  const start = Date.now();
  const result: SyncResult = {
    mode: opts.mode,
    dealer: opts.dealer || 'all',
    processed: 0,
    new_queued: 0,
    already_known: 0,
    errors: 0,
    duration_ms: 0,
    summary: [],
  };

  if (opts.mode === 'import' && opts.import_id) {
    await runImport(opts.import_id, opts.dry_run || false, result);
  } else if (opts.mode === 'discover_sitemap') {
    const supabase = getSupabase();

    if (opts.dealer === 'all') {
      // Run all sync_enabled dealers that have an adapter_key
      const { data: allDealers } = await supabase
        .from('dealers')
        .select('slug,name,website_url,adapter_key,platform_type,discovery_strategy,inventory_source_url,canonical_domain,browser_required,sync_enabled')
        .eq('sync_enabled', true)
        .not('adapter_key', 'is', null);

      // Dedupe by adapter_key so shared-sitemap dealers (e.g. 5 Jenkins locations) run once
      const seen = new Set<string>();
      for (const d of (allDealers || []) as DealerSourceRecord[]) {
        const key = d.adapter_key!;
        if (seen.has(key)) continue;
        seen.add(key);
        await runDiscoverSitemap(d, opts.limit || 100, opts.dry_run || false, result);
      }
    } else {
      const dealerSlug = opts.dealer || 'botero';

      // Look up by slug first
      let { data: rec } = await supabase
        .from('dealers')
        .select('slug,name,website_url,adapter_key,platform_type,discovery_strategy,inventory_source_url,canonical_domain,browser_required,sync_enabled')
        .eq('slug', dealerSlug)
        .maybeSingle();

      // Fallback: match by adapter_key (e.g. slug='jenkins' matches jenkins-* records)
      if (!rec) {
        const { data: byKey } = await supabase
          .from('dealers')
          .select('slug,name,website_url,adapter_key,platform_type,discovery_strategy,inventory_source_url,canonical_domain,browser_required,sync_enabled')
          .eq('adapter_key', dealerSlug)
          .limit(1);
        rec = byKey?.[0] || null;
      }

      // Synthesize minimal record for dealers not yet in registry
      if (!rec) {
        rec = {
          slug: dealerSlug, name: dealerSlug, website_url: null,
          adapter_key: null, platform_type: null, discovery_strategy: null,
          inventory_source_url: null, canonical_domain: null,
          browser_required: false, sync_enabled: true,
        };
      }

      await runDiscoverSitemap(rec as DealerSourceRecord, opts.limit || 100, opts.dry_run || false, result);
    }
  } else if (opts.mode === 'status') {
    await getStatus(result);
  }

  result.duration_ms = Date.now() - start;
  return result;
}

// ─── DISCOVER_SITEMAP: route via source registry ─────────────────────────────

// Hardcoded overrides for adapter_keys needing special logic (multi-sitemap, filters)
const ADAPTER_OVERRIDES: Record<string, () => Promise<string[]>> = {
  jax:                       () => getJaxSitemapUrls(),
  'the-villages-golf-cars':  () => getVillagesGolfCarsSitemapUrls(),
  // NOTE: botero is handled via BOTERO_MULTI_ADAPTER (multi-location) — not in this map
};

// Botero multi-location adapter — returns BoteroRecord[] per URL so each gets the right dealer_slug
const BOTERO_MULTI_ADAPTER = getBoteroLocationRecords;

// Rich adapters return pre-parsed Dx1Unit[] rows (full metadata, no slug-parsing needed)
const RICH_ADAPTER_OVERRIDES: Record<string, (dealer: DealerSourceRecord) => Promise<Dx1Unit[]>> = {
  golf_rider: () => fetchDx1AlgoliaInventory(GOLF_RIDER_DX1),
};



/**
 * Write discovery status back to dealers.last_discovery_* AND emit a
 * sync_log row so the Inventory Gap Audit can render lastSyncAt /
 * lastSyncStatus for discovery runs (not just verify runs).
 *
 * Previously discovery paths only updated dealers.last_discovery_* and
 * dealer_coverage_log / adapter_run_log — sync_log was only written by
 * the verify path in pipeline.ts. That's why dealers with pending_imports
 * rows showed lastSyncAt=null in the audit.
 */
async function writeDiscoveryStatus(
  supabase: ReturnType<typeof getSupabase>,
  slug: string,
  status: string,
  message: string
) {
  try {
    await supabase.from('dealers').update({
      last_discovery_status:  status,
      last_discovery_message: message,
      last_discovery_at:      new Date().toISOString(),
    }).eq('slug', slug);
  } catch { /* non-fatal */ }
  await writeSyncLog(supabase, slug, status, message);
}

/**
 * Fetch all rows from a table matching a filter, paginating past the 1000-row
 * PostgREST cap. Without this, dedup queries silently miss any URL past the
 * first 1000 rows and every discovery run marks new listings as "already known".
 */
async function fetchAllPaginated<T = any>(
  supabase: ReturnType<typeof getSupabase>,
  table: string,
  select: string,
  build: (q: any) => any = (q) => q,
  pageSize = 1000,
  maxRows = 50000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build(
      supabase.from(table).select(select).range(from, from + pageSize - 1)
    );
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

/**
 * Write a per-run row to sync_log so the Inventory Gap Audit can render
 * lastSyncAt / lastSyncStatus for discovery runs (not just verify runs).
 * Non-fatal: swallows errors so a logging failure never breaks a sync.
 */
async function writeSyncLog(
  supabase: ReturnType<typeof getSupabase>,
  slug: string,
  status: string,
  notes: string,
) {
  try {
    await supabase.from('sync_log').insert({
      dealer_slug: slug,
      status,
      synced_at:   new Date().toISOString(),
      notes,
    });
  } catch { /* non-fatal */ }
}

/** Auto-detect inventory sitemap for dealers not yet in source registry */
async function autoDetectSitemapUrls(
  dealer: DealerSourceRecord,
  supabase: ReturnType<typeof getSupabase>
): Promise<string[]> {
  const slug = dealer.slug;

  // Build list of domains to try (canonical first, then bare, then www variant)
  const domains: string[] = [];
  if (dealer.canonical_domain) domains.push(dealer.canonical_domain);
  if (dealer.website_url) {
    try {
      const host = new URL(dealer.website_url).hostname;
      const bare = host.replace(/^www\./, '');
      if (!domains.includes(host)) domains.push(host);
      if (!domains.includes(`www.${bare}`)) domains.push(`www.${bare}`);
      if (!domains.includes(bare)) domains.push(bare);
    } catch { /* invalid URL */ }
  }

  if (!domains.length) return [];

  const SITEMAP_PATHS = [
    '/auto-listing-sitemap.xml',
    '/glc_listing-sitemap.xml',
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/page-sitemap.xml',
    '/wp-sitemap.xml',
  ];

  for (const domain of domains) {
    for (const path of SITEMAP_PATHS) {
      try {
        const sitemapUrl = `https://${domain}${path}`;
        const res = await fetch(sitemapUrl, {
          headers: sitemapHeaders(sitemapUrl),
          signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
        });
        if (!res.ok) continue;
        const xml = await res.text();
        const allLocs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
        if (!allLocs.length) continue;

        // Sitemap index — follow listing-related sub-sitemaps
        if (xml.includes('<sitemap>') || xml.toLowerCase().includes('sitemap-index')) {
          const subSitemaps = allLocs.filter(u =>
            /listing|inventory|product|golf/i.test(u)
          ).slice(0, 3);
          for (const sub of subSitemaps) {
            try {
              const sr = await fetch(sub, { headers: sitemapHeaders(sub), signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
              if (!sr.ok) continue;
              const sxml = await sr.text();
              const subLocs = [...sxml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
              const cartLocs = subLocs.filter(u => !isNavPage(u));
              if (cartLocs.length > 5) {
                // Register discovery for next time
                await supabase.from('dealers').update({
                  platform_type:        'gcr_wordpress',
                  discovery_strategy:   'gcr_sitemap',
                  canonical_domain:     domain,
                  inventory_source_url: sub,
                  last_discovery_status:  'ok',
                  last_discovery_message: `Auto-detected via ${sub} — ${cartLocs.length} URLs`,
                  last_discovery_at:      new Date().toISOString(),
                }).eq('slug', slug);
                return cartLocs;
              }
            } catch { continue; }
          }
          continue;
        }

        // Direct listing URLs
        const cartLocs = allLocs.filter(u => /\/Golf-Cart|\/listing\//i.test(u) && !isNavPage(u));
        if (cartLocs.length > 0) {
          await supabase.from('dealers').update({
            platform_type:        'gcr_wordpress',
            discovery_strategy:   'gcr_sitemap',
            canonical_domain:     domain,
            inventory_source_url: `https://${domain}${path}`,
            last_discovery_status:  'ok',
            last_discovery_message: `Auto-detected ${cartLocs.length} cart URLs at ${path}`,
            last_discovery_at:      new Date().toISOString(),
          }).eq('slug', slug);
          return cartLocs;
        }

        // General inventory-like URLs (non-GCR platforms)
        const invLocs = allLocs.filter(u =>
          /\/inventory|\/shop|\/collections\/all|\/default\.asp/i.test(u) && !isNavPage(u)
        );
        if (invLocs.length > 2) {
          await supabase.from('dealers').update({
            platform_type:        'unknown',
            discovery_strategy:   'not_configured',
            canonical_domain:     domain,
            inventory_source_url: `https://${domain}${path}`,
            last_discovery_status:  'not_configured',
            last_discovery_message: `Found ${invLocs.length} inventory-like URLs but no GCR adapter. Needs custom adapter.`,
            last_discovery_at:      new Date().toISOString(),
          }).eq('slug', slug);
          return [];  // don't queue — needs review first
        }
      } catch { continue; }
    }
  }
  return [];
}

async function runDiscoverSitemap(
  dealer: DealerSourceRecord,
  limit: number,
  dry_run: boolean,
  result: SyncResult
) {
  const supabase = getSupabase();
  const slug     = dealer.slug;
  const adapterKey = dealer.adapter_key;
  const strategy   = dealer.discovery_strategy;

  // ── Known-blocked sources: skip fetch entirely, write block log ────────────
  // Dealers in dealer_block_log with resolved=false are flagged as blocked_public_crawl.
  // Fail-open: if the table doesn't exist yet (migration pending), skip gracefully.
  try {
    const { data: blockRow, error: blockErr } = await supabase
      .from('dealer_block_log')
      .select('block_reason,http_status,inventory_url')
      .eq('dealer_slug', slug)
      .eq('resolved', false)
      .maybeSingle();

    if (!blockErr && blockRow) {
      const msg = `[${slug}] Skipped — marked blocked_public_crawl (${blockRow.block_reason}, HTTP ${blockRow.http_status ?? 'n/a'}). Resolve via admin Blocked Sources panel.`;
      result.summary.push(msg);
      await writeDiscoveryStatus(supabase, slug, 'blocked_public_crawl', msg);
      // Stamp attempted_at so the admin panel shows a fresh "last attempt" time
      try {
        await supabase
          .from('dealer_block_log')
          .update({ attempted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('dealer_slug', slug);
      } catch { /* non-fatal */ }
      return;
    }
  } catch { /* table not yet created — fail-open, continue with sync */ }

  // ── Requires browser — route through browser-sync.ts ───────────────────────
  // Some dealers use SiteGround SG Captcha, Cloudflare JS challenge, or
  // otherwise render inventory via JS that plain HTTP fetch can't reach.
  // browser-sync.ts uses Playwright to bypass these and either
  //   (a) parse full listing pages (dealers with a per-platform parser), or
  //   (b) queue URL-only entries with slug-derived metadata (urlOnly:true).
  //
  // Note: this path can only run in environments where Playwright is
  // available (pplx.app weekly cron, not Vercel Lambda). In Lambda, calling
  // runBrowserSync() will throw — the catch below marks the dealer as
  // 'needs_browser' so the next Playwright-capable run picks it up.
  if (dealer.browser_required) {
    const browserSyncDealers = ['jax-golf-carts-jacksonville'];
    if (browserSyncDealers.includes(slug)) {
      try {
        const { runBrowserSync } = await import('./browser-sync.js');
        const bsResult = await runBrowserSync({
          dealer: slug,
          limit,
          dry_run,
          verbose: true,
        });
        result.new_queued    += bsResult.new_queued;
        result.already_known += bsResult.already_known;
        result.processed     += bsResult.discovered;
        if (bsResult.parse_errors > 0 || bsResult.db_errors > 0) result.errors++;
        bsResult.summary.forEach(s => result.summary.push(s));
        await writeDiscoveryStatus(
          supabase, slug,
          bsResult.new_queued > 0 ? 'ok' : 'no_new',
          bsResult.summary[bsResult.summary.length - 1] || 'Browser sync complete'
        );
      } catch (e: any) {
        // Playwright unavailable in Lambda — mark for next Playwright-capable run.
        const isPlaywrightMissing = /playwright|chromium|browserType|Executable doesn/i.test(e?.message || '');
        const msg = isPlaywrightMissing
          ? `[${slug}] Playwright not available in this environment — will retry from weekly cron`
          : `[${slug}] Browser sync error: ${e?.message || e}`;
        result.errors++;
        result.summary.push(msg);
        await writeDiscoveryStatus(supabase, slug, isPlaywrightMissing ? 'needs_browser' : 'error', msg);
      }
      return;
      }
    }

  // ── Resolve listing URLs ──────────────────────────────────────────────────
  let sitemapUrls: string[] = [];

  if (adapterKey && RICH_ADAPTER_OVERRIDES[adapterKey]) {
    // Rich adapter — returns fully structured rows (no slug-parsing needed)
    const units = await RICH_ADAPTER_OVERRIDES[adapterKey](dealer);
    if (!units.length) {
      const msg = `[${slug}] Rich adapter returned 0 units`;
      result.summary.push(msg);
      await writeDiscoveryStatus(supabase, slug, 'no_new', msg);
      return;
    }

    // Diff against known URLs — paginate past the 1000-row PostgREST cap.
    const [existing, pendingKnown] = await Promise.all([
      fetchAllPaginated<{ source_listing_url: string | null }>(
        supabase,
        'listings',
        'source_listing_url',
        (q) => q.eq('sync_source', slug).not('source_listing_url', 'is', null),
      ),
      fetchAllPaginated<{ source_url: string }>(
        supabase,
        'pending_imports',
        'source_url',
        (q) => q.eq('dealer_slug', slug),
      ),
    ]);
    const knownUrls = new Set<string>([
      ...existing.map((r) => r.source_listing_url).filter((u): u is string => !!u),
      ...pendingKnown.map((r) => r.source_url).filter((u): u is string => !!u),
    ]);

    const newUnits = units.filter(u => !knownUrls.has(u.source_url));
    result.already_known = units.length - newUnits.length;
    result.summary.push(`[${slug}] ${units.length} in API | ${result.already_known} known | ${newUnits.length} new`);

    const toInsert = newUnits.slice(0, limit).map(u => ({
      dealer_slug: slug,
      source_url:  u.source_url,
      raw_title:   u.raw_title,
      year:        u.year,
      make:        u.make,
      model:       u.model,
      condition:   u.condition,
      price:       u.price,
      image_url:   u.image_url,
      location_city:  u.location_city,
      location_state: u.location_state,
      status: 'pending',
    }));

    result.processed = toInsert.length;

    if (!dry_run && toInsert.length > 0) {
      const { error } = await supabase.from('pending_imports').upsert(toInsert, { onConflict: 'source_url', ignoreDuplicates: true });
      if (error) {
        result.errors++;
        result.summary.push(`[${slug}] DB error: ${error.message}`);
        await writeDiscoveryStatus(supabase, slug, 'error', error.message);
      } else {
        result.new_queued = toInsert.length;
        await writeDiscoveryStatus(supabase, slug, 'ok', `Queued ${toInsert.length} new units from DX1 API (${units.length} total, ${result.already_known} already known)`);
        result.summary.push(`[${slug}] Queued ${toInsert.length} new listings`);
      }
    } else if (dry_run) {
      result.new_queued = toInsert.length;
      result.summary.push(`[${slug}] [DRY RUN] Would queue ${toInsert.length} listings`);
      toInsert.slice(0, 5).forEach(r => result.summary.push(`  → ${r.raw_title} ($${r.price ?? 'N/A'}) ${r.source_url}`));
    }
    return;

  } else if (adapterKey === 'botero') {
    // ── Botero multi-location adapter ───────────────────────────────────────
    // Each URL carries its own dealer_slug/city/state — queue per-location correctly.
    const allRecords = await BOTERO_MULTI_ADAPTER();
    if (!allRecords.length) {
      const msg = `[botero] Sitemap returned 0 location-tagged URLs`;
      result.summary.push(msg);
      await writeDiscoveryStatus(supabase, slug, 'no_new', msg);
      return;
    }

    // Only process the target location (filter by dealer_slug) when called for a specific dealer
    const targetSlug = dealer.slug; // e.g. 'botero-carts-jacksonville'
    const isGenericBotero = targetSlug === 'botero'; // if somehow called with adapter slug directly
    const relevantRecords = isGenericBotero
      ? allRecords                                             // all locations
      : allRecords.filter(r => r.dealer_slug === targetSlug); // just this location

    if (!relevantRecords.length) {
      const msg = `[${targetSlug}] No location-tagged URLs found for this dealer (${allRecords.length} total across all Botero locations)`;
      result.summary.push(msg);
      await writeDiscoveryStatus(supabase, slug, 'no_new', msg);
      return;
    }

    // Diff against all known URLs across ALL botero dealers (source_url is globally unique).
    // MUST paginate: previous unpaginated PostgREST reads capped at 1000 rows and made
    // every new URL past the first 1000 look "already known" — the root cause of the
    // lastInsertedPendingCount=0 bug for Botero and other high-volume dealers.
    const [pendingKnown, existingListings] = await Promise.all([
      fetchAllPaginated<{ source_url: string }>(
        supabase,
        'pending_imports',
        'source_url',
      ),
      fetchAllPaginated<{ source_listing_url: string | null }>(
        supabase,
        'listings',
        'source_listing_url',
        (q) => q.not('source_listing_url', 'is', null),
      ),
    ]);
    const knownUrls = new Set<string>([
      ...pendingKnown.map((r) => r.source_url).filter((u): u is string => !!u),
      ...existingListings.map((r) => r.source_listing_url).filter((u): u is string => !!u),
    ]);

    const newRecords = relevantRecords.filter(r => !knownUrls.has(r.url));
    result.already_known = relevantRecords.length - newRecords.length;
    result.summary.push(`[${targetSlug}] ${relevantRecords.length} in sitemap | ${result.already_known} known | ${newRecords.length} new`);

    const toProcess = newRecords.slice(0, limit);
    const rows: any[] = [];
    for (const rec of toProcess) {
      result.processed++;
      const meta = parseSlug(rec.url, rec.dealer_slug);
      rows.push({
        dealer_slug:    rec.dealer_slug,
        source_url:     rec.url,
        raw_title:      `${meta.year || ''} ${meta.make || ''} ${meta.model || ''}`.trim() || rec.url.split('/').pop(),
        year:           meta.year,
        make:           meta.make,
        model:          meta.model,
        condition:      meta.condition,
        location_city:  rec.city,
        location_state: rec.state,
        status:         'pending',
      });
    }

    if (!dry_run && rows.length > 0) {
      const { error } = await supabase.from('pending_imports').upsert(rows, { onConflict: 'source_url', ignoreDuplicates: true });
      if (error) {
        result.errors++;
        result.summary.push(`[${targetSlug}] DB insert error: ${error.message}`);
        await writeDiscoveryStatus(supabase, slug, 'error', error.message);
      } else {
        result.new_queued = rows.length;
        await writeDiscoveryStatus(supabase, slug, 'ok', `Queued ${rows.length} new listings for ${targetSlug} (${relevantRecords.length} total in sitemap, ${result.already_known} already known)`);
        result.summary.push(`[${targetSlug}] Queued ${rows.length} new listings`);
      }
    } else if (dry_run) {
      result.new_queued = rows.length;
      result.summary.push(`[${targetSlug}] [DRY RUN] Would queue ${rows.length} listings`);
      rows.slice(0, 5).forEach(r => result.summary.push(`  → ${r.raw_title || r.source_url} (${r.location_city}, ${r.location_state})`));
    }
    return;

  } else if (adapterKey && ADAPTER_OVERRIDES[adapterKey]) {
    // URL-only override (jax)
    sitemapUrls = await ADAPTER_OVERRIDES[adapterKey]();
  } else if (strategy === 'gcr_sitemap' && dealer.inventory_source_url) {
    // GCR sitemap via registered inventory_source_url
    const parsed = (() => { try { return new URL(dealer.inventory_source_url!); } catch { return null; } })();
    const domain = dealer.canonical_domain || parsed?.hostname || '';
    const path   = parsed?.pathname || '/auto-listing-sitemap.xml';
    sitemapUrls  = await getGcrSitemapUrls(domain, path, true);
    if (!sitemapUrls.length) sitemapUrls = await getGcrSitemapUrls(domain, path, false);
  } else {
    // No adapter configured — attempt auto-detection
    sitemapUrls = await autoDetectSitemapUrls(dealer, supabase);
    if (!sitemapUrls.length) {
      const hasUrl = dealer.website_url || dealer.inventory_source_url;
      const msg = hasUrl
        ? `[${slug}] No GCR/listing sitemap found at ${dealer.canonical_domain || dealer.website_url} — site may need a custom adapter or browser_required=true`
        : `[${slug}] Discovery not configured — add inventory_source_url or assign adapter_key in dealers table`;
      result.summary.push(msg);
      await writeDiscoveryStatus(supabase, slug, 'not_configured', msg);
      return;
    }
  }

  if (!sitemapUrls.length) {
    const msg = `[${slug}] Sitemap returned 0 URLs (adapter=${adapterKey}, strategy=${strategy})`;
    result.summary.push(msg);
    await writeDiscoveryStatus(supabase, slug, 'no_new', msg);
    return;
  }

  // Get known URLs scoped to this dealer only (fast — avoids full-table scan).
  // Paginate past PostgREST's 1000-row cap so dealers with >1000 known URLs
  // don't silently treat every new URL as "already known".
  const [existing, pendingKnown] = await Promise.all([
    fetchAllPaginated<{ source_listing_url: string | null }>(
      supabase,
      'listings',
      'source_listing_url',
      (q) => q.eq('sync_source', slug).not('source_listing_url', 'is', null),
    ),
    fetchAllPaginated<{ source_url: string }>(
      supabase,
      'pending_imports',
      'source_url',
      (q) => q.eq('dealer_slug', slug),
    ),
  ]);

  const knownUrls = new Set<string>([
    ...existing.map((r) => r.source_listing_url).filter((u): u is string => !!u),
    ...pendingKnown.map((r) => r.source_url).filter((u): u is string => !!u),
  ]);

  const newUrls = sitemapUrls.filter(u => !knownUrls.has(u));
  result.already_known = sitemapUrls.length - newUrls.length;
  result.summary.push(`[${slug}] ${sitemapUrls.length} in sitemap | ${result.already_known} known | ${newUrls.length} new`);

  // Process up to limit new URLs — parse metadata from slug only (no page fetch)
  const toProcess = newUrls.slice(0, limit);
  const rows: any[] = [];

  for (const url of toProcess) {
    result.processed++;
    const meta = parseSlug(url, slug);
    rows.push({
      dealer_slug: slug,
      source_url: url,
      raw_title: `${meta.year || ''} ${meta.make || ''} ${meta.model || ''}`.trim() || url.split('/').pop(),
      year: meta.year,
      make: meta.make,
      model: meta.model,
      condition: meta.condition,
      status: 'pending',
    });
  }

  if (!dry_run && rows.length > 0) {
    // Batch insert, ignore conflicts on source_url unique constraint
    const { error } = await supabase.from('pending_imports').upsert(rows, { onConflict: 'source_url', ignoreDuplicates: true });
    if (error) {
      result.errors++;
      result.summary.push(`[${slug}] DB insert error: ${error.message}`);
    } else {
      result.new_queued += rows.length;
      result.summary.push(`[${slug}] Queued ${rows.length} new listings for review`);
    }
  } else if (dry_run) {
    result.new_queued = rows.length;
    result.summary.push(`[${slug}] [DRY RUN] Would queue ${rows.length} listings`);
    rows.slice(0, 5).forEach(r => result.summary.push(`  → ${r.raw_title} (${r.source_url})`));
  }

  // Auto-archive: mark active listings that are no longer in the dealer sitemap
  const archiveResult = await autoArchiveRemovedListings(slug, sitemapUrls, dry_run);
  archiveResult.summary.forEach(s => result.summary.push(s));
}

// ─── Text cleaner: strip HTML whitespace artifacts ─────────────────────────
function cleanText(s: string | null | undefined): string | null {
  if (!s) return null;
  const cleaned = s.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  return cleaned || null;
}

// Strip marketing noise from model names
function cleanModel(model: string | null | undefined, brand: string | null | undefined, year: number | null | undefined): string | null {
  if (!model) return null;
  let m = cleanText(model) || '';
  if (year && m.startsWith(String(year))) m = m.slice(4).trim();
  if (brand && m.toLowerCase().startsWith(brand.toLowerCase())) m = m.slice(brand.length).trim();
  m = m.replace(/^(new\s+\*[^*]*\*\s*|now available\s*[–\-]+\s*|just in\s*[–\-]+\s*|all new\s+|now in-stock\s*[–\-]+\s*|new arrival\s*[–\-]+\s*|new\s+\d{4}\s+)/i, '')
       .replace(/\*[^*]+\*/g, '').replace(/\*\*/g, '')
       .replace(/\s*[–—]\s*$/, '').replace(/!$/, '')
       .trim();
  return m || null;
}

// ─── Deal rating ──────────────────────────────────────────────────────────────
const MARKET_MEDIANS: Record<string, number> = {
  'Club Car': 9500, 'E-Z-GO': 9000, 'Yamaha': 8500, 'ICON': 11000,
  'Bintelli': 10500, 'Advanced EV': 11500, 'Star EV': 10000, 'MadJax': 8000,
  'Tara': 12000, 'DACH': 13000, 'Teko EV': 11000, 'Epic': 10000,
  'Evolution': 9500, 'Cushman': 14000, 'GEM': 12000, 'Navitas': 8500,
  'Sivo': 9000, 'HP': 8000,
};

function computeDealRating(price: number | null | undefined, brand: string | null | undefined, condition: string | null | undefined): string | null {
  if (!price || !brand) return null;
  const median = MARKET_MEDIANS[brand];
  if (!median) return null;
  const adj = (condition === 'used' || condition === 'demo') ? median * 0.6 : median;
  const diff = (price - adj) / adj;
  if (diff <= -0.15) return 'great_deal';
  if (diff <= -0.05) return 'good_deal';
  if (diff <= 0.05)  return 'fair_price';
  if (diff <= 0.15)  return 'slightly_high';
  return 'over_market';
}

// ─── GCR JSON-LD enrichment (HTTP only, no browser) ──────────────────────────

export interface ListingEnrichment {
  seating: number | null;
  power_type: string | null;
  lifted: boolean;
  color: string | null;
  warranty_included?: boolean | string | null;
  warranty_months?: number | null;
  warranty_notes?: string | null;
}

function parseSeatingFromModel(model: string): number | null {
  const m = model.match(/(\d+)\s*Passenger/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if ([2, 4, 6, 8].includes(n)) return n;
  }
  return null;
}

function parsePowerTypeFromModel(model: string): string | null {
  if (/electric|lithium/i.test(model)) return 'electric';
  if (/\bgas\b/i.test(model)) return 'gas';
  return null;
}

/**
 * Fetch a GCR/DX1 listing page and extract enrichment from its JSON-LD Product block.
 * No Playwright — GCR pages are SSR. Never throws: returns {} on any failure.
 */
export async function enrichFromJsonLd(listingPageUrl: string): Promise<Partial<ListingEnrichment>> {
  try {
    const res = await fetch(listingPageUrl, {
      headers: { 'User-Agent': 'CartIQ/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`[enrichFromJsonLd] ${listingPageUrl} returned ${res.status}`);
      return {};
    }
    const html = await res.text();

    const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
    let product: any = null;
    for (const block of blocks) {
      const jsonText = block.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, '').trim();
      try {
        const parsed = JSON.parse(jsonText);
        const candidates = Array.isArray(parsed) ? parsed : (Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed]);
        for (const c of candidates) {
          if (c && c['@type'] === 'Product') { product = c; break; }
        }
      } catch { /* skip malformed block */ }
      if (product) break;
    }

    // ── Warranty enrichment from page HTML (works for all dealers, not just JSON-LD) ──
    const warrantyEnrichment = parseWarrantyFromHtml(html);

    if (!product) {
      console.warn(`[enrichFromJsonLd] No JSON-LD Product found at ${listingPageUrl}`);
      return warrantyEnrichment;
    }

    const modelName: string = typeof product.model === 'string' ? product.model : '';

    return {
      seating: parseSeatingFromModel(modelName),
      power_type: parsePowerTypeFromModel(modelName),
      lifted: /lifted/i.test(modelName),
      color: typeof product.color === 'string' ? (cleanText(product.color) || null) : null,
      ...warrantyEnrichment,
    };
  } catch (e: any) {
    console.warn(`[enrichFromJsonLd] failed for ${listingPageUrl}: ${e?.message || e}`);
    return {};
  }
}

// ─── Warranty parser ─────────────────────────────────────────────────────────
function parseWarrantyFromHtml(html: string): Partial<ListingEnrichment> {
  // Lifetime warranty
  if (/lifetime\s+(?:lithium\s+)?(?:battery\s+)?warranty/i.test(html)) {
    return {
      warranty_included: true,
      warranty_notes: 'Lifetime Lithium battery warranty',
    };
  }
  // N-Year warranty
  const yearMatch = html.match(/(\d+)\s*[-\s]?[Yy]ear\s+(?:Eco\s+Battery\s+)?(?:Manufacturer\s+)?Warranty/i);
  if (yearMatch) {
    const years = parseInt(yearMatch[1], 10);
    return {
      warranty_included: true,
      warranty_months: years * 12,
      warranty_notes: `${years}-Year manufacturer warranty`,
    };
  }
  // Factory / Manufacturer warranty
  if (/(?:factory|manufacturer)\s+warranty/i.test(html)) {
    return {
      warranty_included: true,
      warranty_notes: 'Manufacturer warranty included',
    };
  }
  // Generic warranty mention
  if (/\bwarranty\b/i.test(html)) {
    return {
      warranty_included: true,
      warranty_notes: 'Warranty available',
    };
  }
  return {};
}

// ─── Slug generator ──────────────────────────────────────────────────────────
function makeSlug(title: string, city: string | null, suffix: number): string {
  const base = [title, city].filter(Boolean).join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base}-${suffix}`;
}

// ─── IMPORT: promote a pending_import into a real listing ────────────────────

async function runImport(import_id: number, dry_run: boolean, result: SyncResult) {
  const supabase = getSupabase();
  const { data: imp, error } = await supabase.from('pending_imports').select('*').eq('id', import_id).single();

  if (error || !imp) {
    result.errors++;
    result.summary.push(`Import #${import_id} not found`);
    return;
  }

  // Clean all text fields before inserting
  const brand     = cleanText(imp.make);
  const model     = cleanModel(imp.model, imp.make, imp.year);
  const city      = cleanText(imp.location_city);
  const rawTitle  = cleanText(imp.raw_title);

  // Build canonical title: "YEAR BRAND MODEL"
  const titleParts = [imp.year, brand, model].filter(Boolean);
  const title = titleParts.length > 0 ? titleParts.join(' ') : (rawTitle || `${imp.dealer_slug} listing`);

  // deal_rating and valuation_confidence intentionally left as defaults (unknown/low)
  // until comps are verified via the CartIQ admin valuation workflow.
  const slug = makeSlug(title, city, Date.now() % 1000000);

  // GCR JSON-LD enrichment + dealer_id lookup — only for gcr_wordpress dealers, never fatal.
  let enrichment: Partial<ListingEnrichment> = {};
  let dealerId: number | null = null;
  if (imp.dealer_slug && imp.source_url) {
    const { data: dealerRec } = await supabase
      .from('dealers')
      .select('id,platform_type')
      .eq('slug', imp.dealer_slug)
      .maybeSingle();
    if (dealerRec) {
      dealerId = dealerRec.id ?? null;
      if (dealerRec.platform_type === 'gcr_wordpress') {
        enrichment = await enrichFromJsonLd(imp.source_url);
      }
    }
  }

  const newListing = {
    title,
    slug,
    year: imp.year,
    brand,
    model,
    condition: imp.condition,
    asking_price: imp.price,
    image_url: imp.image_url,
    city,
    state: imp.location_state,
    source_listing_url: imp.source_url,
    source_type: 'dealer_site',
    sync_source: imp.dealer_slug,
    dealer_id: dealerId,              // set from dealer slug lookup
    verified_at: imp.price ? new Date().toISOString() : null,
    last_checked_at: new Date().toISOString(),
    price_confidence: imp.price ? 'confirmed' : 'estimated',
    deal_rating: 'unknown',           // always unknown on import — verify comps first
    valuation_confidence: 'low',      // always low on import — set via admin after review
    status: 'active',
    // Quality gate: only go public if there is a real contact path.
    // dealer_id is set above from the dealer slug lookup; source URL must
    // be a product page, not a raw image file.
    public_listing: (() => {
      const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|svg|avif)(\?|$)/i;
      if (dealerId) return true;
      if (imp.source_url && !IMAGE_EXT.test(imp.source_url)) return true;
      return false;
    })(),
    seller_type: 'dealer',
    ...(enrichment.seating != null ? { seating: enrichment.seating } : {}),
    ...(enrichment.power_type != null ? { power_type: enrichment.power_type } : {}),
    ...(enrichment.lifted != null ? { lifted: enrichment.lifted } : {}),
    ...(enrichment.color != null ? { color: enrichment.color } : {}),
    ...(enrichment.warranty_included != null ? { warranty_included: enrichment.warranty_included } : {}),
    ...(enrichment.warranty_months != null ? { warranty_months: enrichment.warranty_months } : {}),
    ...(enrichment.warranty_notes != null ? { warranty_notes: enrichment.warranty_notes } : {}),
  };

  result.processed++;

  if (!dry_run) {
    const { data: inserted, error: insErr } = await supabase.from('listings').insert(newListing).select('id').single();
    if (insErr) { result.errors++; result.summary.push(`Import failed: ${insErr.message}`); return; }
    await supabase.from('pending_imports').update({ status: 'imported', reviewed_at: new Date().toISOString(), imported_listing_id: inserted.id }).eq('id', import_id);
    result.new_queued++;
    result.summary.push(`Imported pending #${import_id} → listing #${inserted.id}: ${title}`);
  } else {
    result.summary.push(`[DRY RUN] Would import: ${title} @ $${imp.price ?? 'unknown'}`);
  }
}

// ─── AUTO-ARCHIVE: mark removed listings as archived ────────────────────────

/**
 * Compare live sitemap URLs against our active listings for a dealer.
 * Any listing whose source_listing_url is no longer in the sitemap gets
 * set to status=archived + public_listing=false.
 *
 * Safe: only touches listings with a source_listing_url (sync-tracked).
 * Never touches manually-imported listings.
 */
export async function autoArchiveRemovedListings(
  dealerSlug: string,
  liveSitemapUrls: string[],
  dryRun = false
): Promise<{ archived: number; summary: string[] }> {
  const supabase = getSupabase();
  const summary: string[] = [];
  const liveSet = new Set(liveSitemapUrls);

  const { data: activeListings, error } = await supabase
    .from('listings')
    .select('id, title, source_listing_url')
    .eq('sync_source', dealerSlug)
    .eq('status', 'active')
    .eq('public_listing', true)
    .not('source_listing_url', 'is', null);

  if (error) {
    summary.push(`[auto-archive] DB error: ${error.message}`);
    return { archived: 0, summary };
  }

  const removed = (activeListings || []).filter(
    (l: any) => l.source_listing_url && !liveSet.has(l.source_listing_url)
  );

  summary.push(`[auto-archive][${dealerSlug}] ${activeListings?.length ?? 0} active | ${removed.length} no longer in sitemap`);

  if (removed.length === 0) return { archived: 0, summary };

  if (dryRun) {
    removed.forEach((l: any) => summary.push(`  [DRY RUN] Would archive: #${l.id} ${l.title}`));
    return { archived: removed.length, summary };
  }

  const ids = removed.map((l: any) => l.id);
  const { error: updateErr } = await supabase
    .from('listings')
    .update({ status: 'archived', public_listing: false, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (updateErr) {
    summary.push(`[auto-archive] Update error: ${updateErr.message}`);
    return { archived: 0, summary };
  }

  removed.forEach((l: any) =>
    summary.push(`  ✓ Archived #${l.id}: ${l.title}`)
  );
  return { archived: removed.length, summary };
}

// ─── STATUS: pipeline health summary ─────────────────────────────────────────

async function getStatus(result: SyncResult) {
  const supabase = getSupabase();
  const [
    { count: total },
    { count: pending },
    { count: imported },
    { count: confirmed },
    { data: recent },
  ] = await Promise.all([
    supabase.from('pending_imports').select('*', { count: 'exact', head: true }),
    supabase.from('pending_imports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('pending_imports').select('*', { count: 'exact', head: true }).eq('status', 'imported'),
    supabase.from('listings').select('*', { count: 'exact', head: true }).eq('price_confidence', 'confirmed'),
    supabase.from('sync_log').select('dealer_slug, status, synced_at').order('synced_at', { ascending: false }).limit(5),
  ]);

  result.summary.push(`pending_imports: ${total} total | ${pending} pending review | ${imported} imported`);
  result.summary.push(`listings with confirmed prices: ${confirmed}`);
  if (recent?.length) {
    result.summary.push(`Recent sync activity:`);
    recent.forEach((r: any) => result.summary.push(`  ${r.dealer_slug} → ${r.status} @ ${r.synced_at}`));
  }
}
