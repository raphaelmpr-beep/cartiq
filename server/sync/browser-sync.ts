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
    // ── Step 1: Fetch sitemap via browser (bypasses SG Captcha) ────────────────
    log(`[BrowserSync] Fetching sitemap: ${dealerCfg.sitemapUrl}`);
    const allUrls = await fetchSitemapUrlsViaBrowser(context, dealerCfg, limit);
    result.discovered = allUrls.length;
    log(`[BrowserSync] Found ${allUrls.length} listing URL(s) in sitemap`);

    if (allUrls.length === 0) {
      result.summary.push(
        `[${dealerSlug}] Sitemap returned 0 listing URLs — SG Captcha may still be blocking, or sitemap is empty`
      );
      await browser.close();
      result.duration_ms = Date.now() - start;
      return result;
    }

    // ── Step 2: Diff against known URLs (listings + pending_imports) ────────────
    // Paginate past PostgREST's 1000-row cap so dealers with >1000 known URLs
    // (e.g. jax) don't silently treat every new URL as "already known".
    async function fetchAllPagesBS<T = any>(
      table: string,
      select: string,
      build: (q: any) => any,
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

    const [existingListings, existingPending] = await Promise.all([
      fetchAllPagesBS<{ source_listing_url: string | null }>(
        'listings',
        'source_listing_url',
        (q) => q.eq('sync_source', dealerSlug).not('source_listing_url', 'is', null),
      ),
      fetchAllPagesBS<{ source_url: string }>(
        'pending_imports',
        'source_url',
        (q) => q.eq('dealer_slug', dealerSlug),
      ),
    ]);

    const knownUrls = new Set<string>([
      ...existingListings.map((r) => r.source_listing_url).filter((u): u is string => !!u),
      ...existingPending.map((r) => r.source_url).filter((u): u is string => !!u),
    ]);

    const newUrls = allUrls.filter(u => !knownUrls.has(u));
    result.already_known = allUrls.length - newUrls.length;
    log(`[BrowserSync] ${result.already_known} already known, ${newUrls.length} new`);

    result.summary.push(
      `[${dealerSlug}] ${allUrls.length} in sitemap | ${result.already_known} known | ${newUrls.length} new`
    );

    if (newUrls.length === 0) {
      result.summary.push(`[${dealerSlug}] No new listings — nothing to queue`);
      await browser.close();
      result.duration_ms = Date.now() - start;
      return result;
    }

    if (dry_run) {
      result.new_queued = newUrls.length;
      result.summary.push(`[${dealerSlug}] [DRY RUN] Would parse+queue ${newUrls.length} listing(s):`);
      newUrls.slice(0, 10).forEach(u => result.summary.push(`  → ${u}`));
      await browser.close();
      result.duration_ms = Date.now() - start;
      return result;
    }

    // ── Step 3: Parse each new listing page (or skip in URL-only mode) ─────────
    let validListings: ListingData[] = [];

    if (useUrlOnly) {
      // URL-only mode: skip Playwright page fetches, just derive metadata from
      // the URL slug. Rich enrichment happens later via approve-time or the
      // weekly cron. This is the pattern that unblocks the 34 dealers that
      // were previously stuck in "needs_browser" with no per-page parser.
      log(`[BrowserSync] URL-only mode — queuing ${newUrls.length} listing URLs (no page parse)`);
      validListings = newUrls.map(url => {
        const meta = parseSlugForUrl(url);
        return {
          source_url:     url,
          dealer_slug:    dealerSlug,
          raw_title:      [meta.year, meta.make, meta.model].filter(Boolean).join(' ') || (url.split('/').pop() || url),
          year:           meta.year,
          make:           meta.make,
          model:          meta.model,
          condition:      (meta.condition === 'new' || meta.condition === 'used' || meta.condition === 'refurbished') ? meta.condition : null,
          price:          null,
          image_url:      null,
          image_urls:     [],
          location_city:  dealerCfg.locationCity,
          location_state: dealerCfg.locationState,
          battery_type:   null,
          seating:        null,
          specs:          {},
        } satisfies ListingData;
      });
      result.listings = validListings;
    } else {
      log(`[BrowserSync] Parsing ${newUrls.length} listing pages (max ${MAX_CONCURRENCY} parallel)...`);

      const parseTasks = newUrls.map(url => async (): Promise<ListingData | null> => {
        const page = await context.newPage();
        try {
          log(`  Parsing: ${url}`);
          const data = await parseFn!(page, url);

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
      validListings = parseResults.filter((l): l is ListingData => l !== null);
      result.listings = validListings;

      log(`[BrowserSync] Parsed ${validListings.length}/${newUrls.length} successfully`);
    }

    // ── Step 4: Insert into pending_imports ─────────────────────────────────────
    for (const listing of validListings) {
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
        // deal_rating + valuation_confidence set at approve time (unknown / low)
      };

      const { error } = await supabase
        .from('pending_imports')
        .upsert(row, { onConflict: 'source_url', ignoreDuplicates: true });

      if (error) {
        result.db_errors++;
        console.error(`  [DB ERROR] ${listing.source_url}: ${error.message}`);
        result.summary.push(`  ✗ DB error: ${listing.source_url} — ${error.message}`);
      } else {
        result.new_queued++;
        log(`  + Queued: ${listing.raw_title || listing.source_url} | $${listing.price} | ${listing.location_city}`);
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

  } finally {
    await browser.close();
  }

  result.duration_ms = Date.now() - start;
  return result;
}
