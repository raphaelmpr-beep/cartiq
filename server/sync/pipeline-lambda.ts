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

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );
}

// ─── Sitemap fetchers (HTTP only, no browser) ─────────────────────────────────

async function getBoteroSitemapUrls(flGaOnly = true): Promise<string[]> {
  const sitemaps = [
    'https://boterocarts.com/glc_listing-sitemap.xml',
    'https://boterocarts.com/glc_listing-sitemap2.xml',
    'https://boterocarts.com/glc_listing-sitemap3.xml',
  ];
  const allUrls: string[] = [];
  for (const url of sitemaps) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'CartIQ/1.0' }, signal: AbortSignal.timeout(10000) });
      const xml = await res.text();
      const matches = [...xml.matchAll(/<loc>(https:\/\/boterocarts\.com\/listing\/[^<]+)<\/loc>/g)];
      allUrls.push(...matches.map(m => m[1].trim()));
    } catch { /* skip failed sitemaps */ }
  }
  if (!flGaOnly) return allUrls;
  const flGaKw = ['peachtree', 'cumming', 'ocala', 'jacksonville', 'gainesville', 'savannah', 'augusta', 'macon', '-fl-', '-ga-', 'florida', 'georgia'];
  return allUrls.filter(u => flGaKw.some(kw => u.toLowerCase().includes(kw)));
}

async function getJaxSitemapUrls(): Promise<string[]> {
  try {
    const res = await fetch('https://golfcartsjacksonville.com/auto-listing-sitemap.xml', {
      headers: { 'User-Agent': 'CartIQ/1.0' }, signal: AbortSignal.timeout(10000)
    });
    const xml = await res.text();
    const matches = [...xml.matchAll(/<loc>(https:\/\/golfcartsjacksonville\.com\/listing\/[^<]+)<\/loc>/g)];
    return matches.map(m => m[1].trim());
  } catch { return []; }
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

// ─── Main sync entry point (Lambda-safe) ─────────────────────────────────────

export interface SyncOptions {
  mode: 'discover_sitemap' | 'import' | 'status';
  dealer?: 'botero' | 'jax' | 'all';
  limit?: number;
  import_id?: number;
  dry_run?: boolean;
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
    const dealers = opts.dealer === 'all' ? ['botero', 'jax'] : [opts.dealer || 'botero'];
    for (const dealer of dealers) {
      await runDiscoverSitemap(dealer, opts.limit || 50, opts.dry_run || false, result);
    }
  } else if (opts.mode === 'status') {
    await getStatus(result);
  }

  result.duration_ms = Date.now() - start;
  return result;
}

// ─── DISCOVER_SITEMAP: diff sitemap vs DB, queue new URL stubs ────────────────

async function runDiscoverSitemap(dealer: string, limit: number, dry_run: boolean, result: SyncResult) {
  const supabase = getSupabase();

  // Get all URLs from sitemap
  let sitemapUrls: string[] = [];
  if (dealer === 'botero') sitemapUrls = await getBoteroSitemapUrls(true);
  if (dealer === 'jax') sitemapUrls = await getJaxSitemapUrls();

  if (!sitemapUrls.length) {
    result.summary.push(`[${dealer}] Sitemap returned 0 URLs`);
    return;
  }

  // Get known URLs from both tables
  const [{ data: existing }, { data: pending }] = await Promise.all([
    supabase.from('listings').select('source_listing_url').not('source_listing_url', 'is', null),
    supabase.from('pending_imports').select('source_url'),
  ]);

  const knownUrls = new Set([
    ...(existing || []).map((r: any) => r.source_listing_url),
    ...(pending || []).map((r: any) => r.source_url),
  ]);

  const newUrls = sitemapUrls.filter(u => !knownUrls.has(u));
  result.already_known = sitemapUrls.length - newUrls.length;
  result.summary.push(`[${dealer}] ${sitemapUrls.length} in sitemap | ${result.already_known} known | ${newUrls.length} new`);

  // Process up to limit new URLs — parse metadata from slug only (no page fetch)
  const toProcess = newUrls.slice(0, limit);
  const rows: any[] = [];

  for (const url of toProcess) {
    result.processed++;
    const meta = parseSlug(url, dealer);
    rows.push({
      dealer_slug: dealer,
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
      result.summary.push(`[${dealer}] DB insert error: ${error.message}`);
    } else {
      result.new_queued += rows.length;
      result.summary.push(`[${dealer}] Queued ${rows.length} new listings for review`);
    }
  } else if (dry_run) {
    result.new_queued = rows.length;
    result.summary.push(`[${dealer}] [DRY RUN] Would queue ${rows.length} listings`);
    // Show first 5 as preview
    rows.slice(0, 5).forEach(r => result.summary.push(`  → ${r.raw_title} (${r.source_url})`));
  }
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

  const title = imp.raw_title || `${imp.year || ''} ${imp.make || ''} ${imp.model || ''}`.trim();
  const newListing = {
    title,
    year: imp.year,
    brand: imp.make,
    model: imp.model,
    condition: imp.condition,
    asking_price: imp.price,
    image_url: imp.image_url,
    city: imp.location_city,
    state: imp.location_state,
    source_listing_url: imp.source_url,
    source_type: 'dealer_site',
    sync_source: imp.dealer_slug,
    verified_at: imp.price ? new Date().toISOString() : null,
    last_checked_at: new Date().toISOString(),
    price_confidence: imp.price ? 'confirmed' : 'estimated',
    status: 'active',
    public_listing: true,
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
