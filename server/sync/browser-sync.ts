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
  /** Regex matching individual listing URLs in the sitemap/index page */
  listingUrlPattern: RegExp;
  adapterKey: string;
  locationCity: string;
  locationState: string;
  /**
   * If true (or if adapterKey has no page parser), only queue source_url +
   * slug-parsed metadata to pending_imports — no per-page parsing. This lets
   * us onboard many dealers without writing a per-platform Playwright parser.
   * Rich enrichment happens later via approve-time page fetches or the weekly
   * pplx.app cron path.
   */
  urlOnly?: boolean;
  /**
   * Optional URL for a paginated inventory listing page. When set, the
   * browser opens this page (waits for network idle) and extracts <a href>
   * links matching `listingUrlPattern` — used for dealers whose inventory
   * is a rendered HTML index instead of a plain XML sitemap.
   */
  indexPageUrl?: string;
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

  // ── URL-only browser discovery ─────────────────────────────────────────────
  // These dealers only need discovery (source_url + slug-parsed metadata).
  // Full parsing (price, specs, images) is deferred until approve-time or the
  // weekly cron. This lets us stop showing 34 dealers as "needs_browser" in
  // the Inventory Gap Audit without writing a per-platform Playwright parser
  // for each. Rich adapters can be added later, one platform at a time.

  // DealerSpike (12) — inventory listing pages use /inventory/ links
  'advantage-golf-cars-fl':          { slug: 'advantage-golf-cars-fl',          name: 'Advantage Golf Cars',                 sitemapUrl: 'https://www.advantagegolfcars.com/inventory/',       indexPageUrl: 'https://www.advantagegolfcars.com/inventory/',       listingUrlPattern: /advantagegolfcars\.com\/inventory\/.+-\d+/i,        adapterKey: 'dealerspike_generic', locationCity: 'FL',                  locationState: 'FL', urlOnly: true },
  'affordable-carts-bonita-springs': { slug: 'affordable-carts-bonita-springs', name: 'Affordable Carts — Bonita Springs',    sitemapUrl: 'https://www.affordablecarts.com/inventory/',         indexPageUrl: 'https://www.affordablecarts.com/inventory/',          listingUrlPattern: /affordablecarts\.com\/inventory\/.+-\d+/i,          adapterKey: 'dealerspike_generic', locationCity: 'Bonita Springs',      locationState: 'FL', urlOnly: true },
  'electric-cart-company-santa-rosa':{ slug: 'electric-cart-company-santa-rosa',name: 'Electric Cart Company — Santa Rosa',   sitemapUrl: 'https://www.electriccartcompany.com/inventory/',     indexPageUrl: 'https://www.electriccartcompany.com/inventory/',      listingUrlPattern: /electriccartcompany\.com\/inventory\/.+-\d+/i,      adapterKey: 'dealerspike_generic', locationCity: 'Santa Rosa Beach',    locationState: 'FL', urlOnly: true },
  'g-five-motorsports-plant-city':   { slug: 'g-five-motorsports-plant-city',   name: 'G-Five Motorsports — Plant City',      sitemapUrl: 'https://gfive.com/inventory/',                       indexPageUrl: 'https://gfive.com/inventory/',                        listingUrlPattern: /gfive\.com\/inventory\/.+-\d+/i,                    adapterKey: 'dealerspike_generic', locationCity: 'Plant City',          locationState: 'FL', urlOnly: true },
  'golf-cart-center-rockledge':      { slug: 'golf-cart-center-rockledge',      name: 'Golf Cart Center — Rockledge',         sitemapUrl: 'https://www.golfcartcenters.com/--inventory',        indexPageUrl: 'https://www.golfcartcenters.com/--inventory',         listingUrlPattern: /golfcartcenters\.com\/[^?#]*inventory[^?#]*-\d+/i,  adapterKey: 'dealerspike_generic', locationCity: 'Rockledge',           locationState: 'FL', urlOnly: true },
  'golf-carts-st-augustine':         { slug: 'golf-carts-st-augustine',         name: 'Golf Carts of St. Augustine',          sitemapUrl: 'https://www.golfcartsofstaugustine.com/inventory/',  indexPageUrl: 'https://www.golfcartsofstaugustine.com/inventory/',   listingUrlPattern: /golfcartsofstaugustine\.com\/inventory\/.+-\d+/i,   adapterKey: 'dealerspike_generic', locationCity: 'St. Augustine',       locationState: 'FL', urlOnly: true },
  'golf-carts-unlimited-melbourne':  { slug: 'golf-carts-unlimited-melbourne',  name: 'Golf Carts Unlimited — Melbourne',     sitemapUrl: 'https://www.golfcarts-unlimited.com/inventory/',     indexPageUrl: 'https://www.golfcarts-unlimited.com/inventory/',      listingUrlPattern: /golfcarts-unlimited\.com\/inventory\/.+-\d+/i,      adapterKey: 'dealerspike_generic', locationCity: 'Melbourne',           locationState: 'FL', urlOnly: true },
  'golf-carts-vero-beach':           { slug: 'golf-carts-vero-beach',           name: 'Golf Carts of Vero Beach',             sitemapUrl: 'https://www.golfcartsofverobeach.com/inventory/',    indexPageUrl: 'https://www.golfcartsofverobeach.com/inventory/',     listingUrlPattern: /golfcartsofverobeach\.com\/inventory\/.+-\d+/i,     adapterKey: 'dealerspike_generic', locationCity: 'Vero Beach',          locationState: 'FL', urlOnly: true },
  'hidden-creek-golf-carts-brooksville': { slug: 'hidden-creek-golf-carts-brooksville', name: 'Hidden Creek Golf Carts — Brooksville', sitemapUrl: 'https://www.hiddencreekgolfcarts.com/inventory/', indexPageUrl: 'https://www.hiddencreekgolfcarts.com/inventory/', listingUrlPattern: /hiddencreekgolfcarts\.com\/inventory\/.+-\d+/i, adapterKey: 'dealerspike_generic', locationCity: 'Brooksville', locationState: 'FL', urlOnly: true },
  'love-esports-homosassa':          { slug: 'love-esports-homosassa',          name: 'Love E-Sports — Homosassa',            sitemapUrl: 'https://loveesports.com/inventory/',                 indexPageUrl: 'https://loveesports.com/inventory/',                  listingUrlPattern: /loveesports\.com\/inventory\/.+-\d+/i,              adapterKey: 'dealerspike_generic', locationCity: 'Homosassa',           locationState: 'FL', urlOnly: true },
  'paradise-powersports-nsb':        { slug: 'paradise-powersports-nsb',        name: 'Paradise Powersports — New Smyrna Beach', sitemapUrl: 'https://paradisepowersports.com/inventory/',      indexPageUrl: 'https://paradisepowersports.com/inventory/',          listingUrlPattern: /paradisepowersports\.com\/inventory\/.+-\d+/i,      adapterKey: 'dealerspike_generic', locationCity: 'New Smyrna Beach',    locationState: 'FL', urlOnly: true },
  'total-golf-cart-vero-beach':      { slug: 'total-golf-cart-vero-beach',      name: 'Total Golf Cart — Vero Beach',         sitemapUrl: 'https://www.totalgolfcart.com/inventory/',           indexPageUrl: 'https://www.totalgolfcart.com/inventory/',            listingUrlPattern: /totalgolfcart\.com\/inventory\/.+-\d+/i,           adapterKey: 'dealerspike_generic', locationCity: 'Vero Beach',          locationState: 'FL', urlOnly: true },

  // Custom platform (7)
  'revel-golf-cars-jacksonville':    { slug: 'revel-golf-cars-jacksonville',    name: 'Revel Golf Cars — Jacksonville',       sitemapUrl: 'https://www.revelgolfcars.com/inventory/v1/',        indexPageUrl: 'https://www.revelgolfcars.com/inventory/v1/',         listingUrlPattern: /revelgolfcars\.com\/inventory[^?#]*\/(v1\/)?[a-z0-9-]+-?\d+/i, adapterKey: 'custom_generic', locationCity: 'Jacksonville',      locationState: 'FL', urlOnly: true },
  'ge-vehicles-fort-myers':          { slug: 'ge-vehicles-fort-myers',          name: 'GE Vehicles — Fort Myers',             sitemapUrl: 'https://gevehicles.com/inventory/',                  indexPageUrl: 'https://gevehicles.com/inventory/',                   listingUrlPattern: /gevehicles\.com\/inventory\/[a-z0-9-]+/i,           adapterKey: 'custom_generic',      locationCity: 'Fort Myers',          locationState: 'FL', urlOnly: true },
  'ge-vehicles-jacksonville':        { slug: 'ge-vehicles-jacksonville',        name: 'GE Vehicles — Jacksonville',           sitemapUrl: 'https://gevehicles.com/inventory/',                  indexPageUrl: 'https://gevehicles.com/inventory/',                   listingUrlPattern: /gevehicles\.com\/inventory\/[a-z0-9-]+/i,           adapterKey: 'custom_generic',      locationCity: 'Jacksonville',        locationState: 'FL', urlOnly: true },
  'ge-vehicles-orlando':             { slug: 'ge-vehicles-orlando',             name: 'GE Vehicles — Orlando',                sitemapUrl: 'https://gevehicles.com/inventory/',                  indexPageUrl: 'https://gevehicles.com/inventory/',                   listingUrlPattern: /gevehicles\.com\/inventory\/[a-z0-9-]+/i,           adapterKey: 'custom_generic',      locationCity: 'Orlando',             locationState: 'FL', urlOnly: true },
  'orlando-golf-cars':               { slug: 'orlando-golf-cars',               name: 'Orlando Golf Cars',                    sitemapUrl: 'https://www.orlandogolfcars.com/inventory/v1/',      indexPageUrl: 'https://www.orlandogolfcars.com/inventory/v1/',       listingUrlPattern: /orlandogolfcars\.com\/inventory[^?#]*\/[a-z0-9-]+/i, adapterKey: 'custom_generic',    locationCity: 'Orlando',             locationState: 'FL', urlOnly: true },
  'the-golf-cart-company-clermont':  { slug: 'the-golf-cart-company-clermont',  name: 'The Golf Cart Company — Clermont',     sitemapUrl: 'https://www.thegolfcartcompany.com/inventory/v1/',   indexPageUrl: 'https://www.thegolfcartcompany.com/inventory/v1/',    listingUrlPattern: /thegolfcartcompany\.com\/inventory[^?#]*\/[a-z0-9-]+/i, adapterKey: 'custom_generic', locationCity: 'Clermont',         locationState: 'FL', urlOnly: true },
  'west-coast-golf-cars-sun-city':   { slug: 'west-coast-golf-cars-sun-city',   name: 'West Coast Golf Cars — Sun City',      sitemapUrl: 'http://www.westcoastgolfcars.com/inventory/v1/',     indexPageUrl: 'http://www.westcoastgolfcars.com/inventory/v1/',      listingUrlPattern: /westcoastgolfcars\.com\/inventory[^?#]*\/[a-z0-9-]+/i, adapterKey: 'custom_generic', locationCity: 'Sun City Center',   locationState: 'FL', urlOnly: true },

  // GCR WordPress (4 — jax already registered above with full parser)
  'discovery-golf-cars-clearwater':  { slug: 'discovery-golf-cars-clearwater',  name: 'Discovery Golf Cars — Clearwater',     sitemapUrl: 'https://www.discoverygolfcars.com/inventory/',       indexPageUrl: 'https://www.discoverygolfcars.com/inventory/',        listingUrlPattern: /discoverygolfcars\.com\/(inventory|Golf-Cart)[^?#]*/i,                adapterKey: 'gcr_generic',        locationCity: 'Clearwater',          locationState: 'FL', urlOnly: true },
  'discovery-golf-cars-land-o-lakes':{ slug: 'discovery-golf-cars-land-o-lakes',name: 'Discovery Golf Cars — Land O\' Lakes', sitemapUrl: 'https://www.discoverygolfcars.com/inventory/',       indexPageUrl: 'https://www.discoverygolfcars.com/inventory/',        listingUrlPattern: /discoverygolfcars\.com\/(inventory|Golf-Cart)[^?#]*/i,                adapterKey: 'gcr_generic',        locationCity: 'Land O\' Lakes',      locationState: 'FL', urlOnly: true },
  'cshell-carts-naples':             { slug: 'cshell-carts-naples',             name: 'C-Shell Carts — Naples',               sitemapUrl: 'https://cshellcarts.com/make/venom-ev/',             indexPageUrl: 'https://cshellcarts.com/make/venom-ev/',              listingUrlPattern: /cshellcarts\.com\/(product|inventory)\/[a-z0-9-]+/i,                   adapterKey: 'gcr_generic',        locationCity: 'Naples',              locationState: 'FL', urlOnly: true },
  'gator-golf-cars-delray-beach':    { slug: 'gator-golf-cars-delray-beach',    name: 'Gator Golf Cars — Delray Beach',       sitemapUrl: 'https://gatorgolfcarts.com/make/venom-ev/',          indexPageUrl: 'https://gatorgolfcarts.com/make/venom-ev/',           listingUrlPattern: /gatorgolfcarts\.com\/(product|inventory)\/[a-z0-9-]+/i,                 adapterKey: 'gcr_generic',        locationCity: 'Delray Beach',        locationState: 'FL', urlOnly: true },

  // WooCommerce (4)
  'carts-and-clubs':                 { slug: 'carts-and-clubs',                 name: 'Carts & Clubs',                        sitemapUrl: 'https://cartsandclubs.com/inventory/',               indexPageUrl: 'https://cartsandclubs.com/inventory/',                listingUrlPattern: /cartsandclubs\.com\/product\/[a-z0-9-]+/i,          adapterKey: 'woo_generic',         locationCity: 'Ocala',               locationState: 'FL', urlOnly: true },
  'cart-world-golf-cars':            { slug: 'cart-world-golf-cars',            name: 'Cart World Golf Cars',                 sitemapUrl: 'https://cartworldgolfcars.com/new/',                 indexPageUrl: 'https://cartworldgolfcars.com/new/',                  listingUrlPattern: /cartworldgolfcars\.com\/product\/[a-z0-9-]+/i,      adapterKey: 'woo_generic',         locationCity: 'Lady Lake',           locationState: 'FL', urlOnly: true },
  'golf-cart-world-ponte-vedra-beach': { slug: 'golf-cart-world-ponte-vedra-beach', name: 'Golf Cart World — Ponte Vedra Beach', sitemapUrl: 'https://golfcartwld.net/shop/',                                 indexPageUrl: 'https://golfcartwld.net/shop/',                       listingUrlPattern: /golfcartwld\.net\/product\/[a-z0-9-]+/i,             adapterKey: 'woo_generic',        locationCity: 'Ponte Vedra Beach',   locationState: 'FL', urlOnly: true },
  'hidden-creek-golf-carts':         { slug: 'hidden-creek-golf-carts',         name: 'Hidden Creek Golf Carts — Wildwood',   sitemapUrl: 'https://www.hiddencreekgolfcarts.com/inventory/',    indexPageUrl: 'https://www.hiddencreekgolfcarts.com/inventory/',     listingUrlPattern: /hiddencreekgolfcarts\.com\/product\/[a-z0-9-]+/i,     adapterKey: 'woo_generic',        locationCity: 'Wildwood',            locationState: 'FL', urlOnly: true },

  // Wix (2)
  'coastal-golf-carts-port-orange':  { slug: 'coastal-golf-carts-port-orange',  name: 'Coastal Golf Carts — Port Orange',     sitemapUrl: 'https://www.coastalgolfcartsfl.com/items',           indexPageUrl: 'https://www.coastalgolfcartsfl.com/items',            listingUrlPattern: /coastalgolfcartsfl\.com\/item\/[a-z0-9-]+/i,        adapterKey: 'wix_generic',         locationCity: 'Port Orange',         locationState: 'FL', urlOnly: true },
  'ocala-golf-cart-supercenter':     { slug: 'ocala-golf-cart-supercenter',     name: 'Ocala Golf Cart Supercenter',          sitemapUrl: 'https://www.ocalagolfcart.com/inventory',            indexPageUrl: 'https://www.ocalagolfcart.com/inventory',             listingUrlPattern: /ocalagolfcart\.com\/item\/[a-z0-9-]+/i,             adapterKey: 'wix_generic',         locationCity: 'Ocala',               locationState: 'FL', urlOnly: true },

  // Bare WordPress (2)
  'fast-eddies-golf-carts':          { slug: 'fast-eddies-golf-carts',          name: 'Fast Eddie\'s Golf Carts',             sitemapUrl: 'https://fasteddiesgc.com/',                          indexPageUrl: 'https://fasteddiesgc.com/',                           listingUrlPattern: /fasteddiesgc\.com\/(inventory|listing|product)\/[a-z0-9-]+/i, adapterKey: 'wp_generic',      locationCity: 'The Villages',        locationState: 'FL', urlOnly: true },
  'jb-golf-carts':                   { slug: 'jb-golf-carts',                   name: 'JB Golf Carts',                        sitemapUrl: 'https://jbgolfcarts.webbreservations.com/inventory/', indexPageUrl: 'https://jbgolfcarts.webbreservations.com/inventory/', listingUrlPattern: /jbgolfcarts\.webbreservations\.com\/inventory\/[a-z0-9-]+/i, adapterKey: 'wp_generic',        locationCity: 'Lady Lake',           locationState: 'FL', urlOnly: true },

  // Miscellaneous singletons
  'one-stop-golf-carts':             { slug: 'one-stop-golf-carts',             name: 'One Stop Golf Carts',                  sitemapUrl: 'https://www.onestop-fl.com/Inventory/All-Inventory-In-Stock', indexPageUrl: 'https://www.onestop-fl.com/Inventory/All-Inventory-In-Stock', listingUrlPattern: /onestop-fl\.com\/Inventory\/[a-z0-9-]+/i,         adapterKey: 'aspnet_generic',      locationCity: 'Wildwood',            locationState: 'FL', urlOnly: true },
  'village-discount-golf-car':       { slug: 'village-discount-golf-car',       name: 'Village Discount Golf Car',            sitemapUrl: 'https://villagediscountgolfcars.com/golf-car-inventory-search/', indexPageUrl: 'https://villagediscountgolfcars.com/golf-car-inventory-search/', listingUrlPattern: /villagediscountgolfcars\.com\/(inventory|product|listing)\/[a-z0-9-]+/i, adapterKey: 'facetwp_generic', locationCity: 'Lady Lake',           locationState: 'FL', urlOnly: true },
  'nextgen-carts-ponte-vedra':       { slug: 'nextgen-carts-ponte-vedra',       name: 'NextGen Carts — Ponte Vedra',          sitemapUrl: 'https://www.nextgencarts.com/products',              indexPageUrl: 'https://www.nextgencarts.com/products',               listingUrlPattern: /nextgencarts\.com\/products\/[a-z0-9-]+/i,          adapterKey: 'ueni_generic',        locationCity: 'Ponte Vedra Beach',   locationState: 'FL', urlOnly: true },
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
    // Try the XML sitemap first (works for jax + any real sitemap). If it
    // yields nothing (common for dealers whose "sitemapUrl" is actually an
    // HTML inventory index), fall back to scraping <a href> from indexPageUrl.
    let urls: string[] = [];

    try {
      await page.goto(dealer.sitemapUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500); // allow JS challenge to resolve
      const content = await page.content();

      // Try XML <loc> extraction first
      const locMatches = [...content.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map(m => m[1].trim())
        .filter(u => dealer.listingUrlPattern.test(u));
      if (locMatches.length > 0) {
        urls = [...new Set(locMatches)];
      } else {
        // HTML index fallback — collect <a href> attributes
        const hrefs = await page.$$eval('a[href]', (as) =>
          (as as HTMLAnchorElement[]).map(a => a.href)
        );
        urls = [...new Set(hrefs.filter(u => dealer.listingUrlPattern.test(u)))];
      }
    } catch (e: any) {
      // Ignore navigation error — try indexPageUrl next
    }

    // If sitemap fetch got nothing and dealer has a separate indexPageUrl, try it
    if (urls.length === 0 && dealer.indexPageUrl && dealer.indexPageUrl !== dealer.sitemapUrl) {
      try {
        await page.goto(dealer.indexPageUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(2500); // let listings render
        const hrefs = await page.$$eval('a[href]', (as) =>
          (as as HTMLAnchorElement[]).map(a => a.href)
        );
        urls = [...new Set(hrefs.filter(u => dealer.listingUrlPattern.test(u)))];
      } catch { /* swallow */ }
    }

    return limit > 0 ? urls.slice(0, limit) : urls;
  } finally {
    await page.close();
  }
}

// ── Slug-based metadata extractor (URL-only mode) ────────────────────────────
// Same lightweight logic pipeline-lambda.parseSlug uses — kept here to avoid
// an import cycle. Extracts year/make/model/condition from a listing URL.
function parseSlugForUrl(url: string): { year: number | null; make: string | null; model: string | null; condition: string | null } {
  let slug = '';
  try {
    slug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
  } catch { slug = url.split('/').filter(Boolean).pop() || ''; }

  const yearMatch = slug.match(/\b(20\d{2}|19\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  const condMatch = slug.match(/^(new|used|refurbished|certified)/i);
  const condition = condMatch ? condMatch[1].toLowerCase() : null;

  const makeMap: [string, string][] = [
    ['e-z-go', 'E-Z-GO'], ['ezgo', 'E-Z-GO'], ['club-car', 'Club Car'],
    ['yamaha', 'Yamaha'], ['icon', 'ICON'], ['bintelli', 'Bintelli'],
    ['advanced-ev', 'Advanced EV'], ['star-ev', 'Star EV'], ['gem', 'GEM'],
    ['evolution', 'Evolution'], ['denago', 'Denago'], ['dach', 'Dach'],
    ['apollo', 'Apollo'], ['teko', 'Teko'], ['venom', 'Venom EV'],
  ];
  let make: string | null = null;
  const lower = slug.toLowerCase();
  for (const [pattern, name] of makeMap) {
    if (lower.includes(pattern)) { make = name; break; }
  }

  const modelSlug = slug
    .replace(/^(new|used|refurbished|certified)-/i, '')
    .replace(/\b(20\d{2}|19\d{2})\b-?/, '')
    .replace(/lithium-ion-?|lithium-?|electric-?|gas-?/gi, '')
    .split('-').filter(p => p && !/^\d+$/.test(p)).slice(0, 4).join(' ')
    .replace(/\s+/g, ' ').trim();

  return { year, make, model: modelSlug || null, condition };
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
  const useUrlOnly = dealerCfg.urlOnly || !parseFn;
  if (!parseFn && !dealerCfg.urlOnly) {
    result.summary.push(`[${dealerSlug}] No page parser for adapter_key="${dealerCfg.adapterKey}" (mark urlOnly:true to enable URL-only discovery)`);
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

      const parseTasks = newUrls.map(url => async (): Promise<ListingData | null> => {
        const page = await context.newPage();
        try {
          log(`  Parsing: ${url}`);
          const data = await parseFn!(page, url);

          // Fallback: fill in city/state from dealer config if parser couldn't extract it
          if (!data.location_city) data.location_city = dealerCfg.locationCity;
          if (!data.location_state) data.location_state = dealerCfg.locationState;

    const parseResults = await runWithConcurrency(parseTasks, MAX_CONCURRENCY);
    await parseBrowser.close();
    const validListings = parseResults.filter((l): l is ListingData => l !== null);
    result.listings = validListings;

      const parseResults = await runWithConcurrency(parseTasks, MAX_CONCURRENCY);
      validListings = parseResults.filter((l): l is ListingData => l !== null);
      result.listings = validListings;

      log(`[BrowserSync] Parsed ${validListings.length}/${newUrls.length} successfully`);
    }

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

    // ── Step 5: Update dealer discovery status + sync_log ──────────────────────
    const statusMsg = result.new_queued > 0
      ? `Browser sync OK — ${result.new_queued} new listing(s) queued for review`
      : `Browser sync OK — no new listings found`;
    const bsStatus = result.new_queued > 0 ? 'ok' : 'no_new';
    await supabase.from('dealers').update({
      last_discovery_status:  bsStatus,
      last_discovery_message: statusMsg,
      last_discovery_at:      new Date().toISOString(),
    }).eq('slug', dealerSlug);
    // Emit sync_log row so the Inventory Gap Audit shows lastSyncAt for
    // browser-based discovery runs (previously only verify path wrote sync_log).
    try {
      await supabase.from('sync_log').insert({
        dealer_slug: dealerSlug,
        status:      bsStatus,
        synced_at:   new Date().toISOString(),
        notes:       statusMsg,
      });
    } catch { /* non-fatal */ }

    result.summary.push(
      `[${dealerSlug}] Done — ${result.new_queued} queued | ${result.parse_errors} parse errors | ${result.db_errors} DB errors`
    );

  } catch (e: any) {
    result.summary.push(`[${dealerSlug}] Unexpected error: ${String(e?.message || e)}`);
  }

  result.duration_ms = Date.now() - start;
  return result;
}
