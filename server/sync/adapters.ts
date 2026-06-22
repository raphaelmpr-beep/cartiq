/**
 * CartIQ Dealer Adapters
 * Each adapter knows how to:
 *   1. Get listing URLs from a dealer's inventory page / sitemap
 *   2. Parse a listing page (via Playwright) into a normalized ListingData object
 */

export interface ListingData {
  source_url: string;
  dealer_slug: string;
  raw_title: string;
  year: number | null;
  make: string | null;
  model: string | null;
  condition: 'new' | 'used' | 'refurbished' | null;
  price: number | null;           // USD, integer
  image_url: string | null;       // primary image
  image_urls: string[];           // all images
  location_city: string | null;
  location_state: string | null;
  battery_type: string | null;
  seating: number | null;
  specs: Record<string, string>;
}

// ── Shared utilities ─────────────────────────────────────────────────────────

/**
 * Strip HTML whitespace artifacts: \r, \n, \t and collapse runs of spaces.
 * Needed for dealers whose pages have multi-line text nodes.
 */
export function cleanHtmlWhitespace(s: string | null | undefined): string | null {
  if (!s) return null;
  const cleaned = s.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  return cleaned || null;
}

/**
 * Return true if a URL looks like a nav/category/sitemap page rather than
 * an individual listing. Used to filter sitemap contamination.
 */
export function isNavPage(url: string): boolean {
  const NAV_PATTERNS = [
    /\/sitemap/i,
    /\.xml$/i,
    /\/inventory\/?$/i,
    /\/new-inventory\/?$/i,
    /\/used-inventory\/?$/i,
    /\/all-inventory\/?$/i,
    /\/shop-our-inventory\/?$/i,
    /\/shop-brp\/?$/i,
    /\/about/i,
    /\/contact/i,
    /\/privacy/i,
    /\/ccpa/i,
    /\/accessibility/i,
    /\/financing/i,
    /\/finance-application/i,
    /\/promotions/i,
    /\/parts-accessories/i,
    /\/registration/i,
    /\/request-a-model/i,
    /\/compare/i,
    /\/brands/i,
    /\/locations?\/?$/i,
    /\/avon-park\/?$/i,
    /\/fort-meade\/?$/i,
    /\/showroom\/?$/i,
    /\/cricket-carts\/?$/i,
    /\/special\//i,
    /\/model-details\/?$/i,
    /\/terms\/?$/i,
  ];
  return NAV_PATTERNS.some(p => p.test(url));
}

// ── Sitemap / inventory index fetchers ────────────────────────────────────────

export async function getBoteroListingUrls(flGaOnly = true): Promise<string[]> {
  const sitemaps = [
    'https://boterocarts.com/glc_listing-sitemap.xml',
    'https://boterocarts.com/glc_listing-sitemap2.xml',
    'https://boterocarts.com/glc_listing-sitemap3.xml',
  ];

  const allUrls: string[] = [];
  for (const sitemapUrl of sitemaps) {
    try {
      const res = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'CartIQ-Sync/1.0' },
      });
      const xml = await res.text();
      const matches = [...xml.matchAll(/<loc>(https:\/\/boterocarts\.com\/listing\/[^<]+)<\/loc>/g)];
      allUrls.push(...matches.map(m => m[1].trim()));
    } catch (e) {
      console.warn(`Sitemap fetch failed: ${sitemapUrl}`, e);
    }
  }

  if (!flGaOnly) return allUrls;

  const flGaKeywords = [
    'peachtree-city', 'peachtree_city', 'cumming', 'ocala',
    'jacksonville', 'gainesville', 'savannah', 'augusta', 'macon',
    '-fl-', '-ga-', '_fl_', '_ga_',
    'florida', 'georgia',
  ];
  return allUrls.filter(url =>
    flGaKeywords.some(kw => url.toLowerCase().includes(kw))
  );
}

export async function getJaxListingUrls(): Promise<string[]> {
  const res = await fetch('https://golfcartsjacksonville.com/auto-listing-sitemap.xml', {
    headers: { 'User-Agent': 'CartIQ-Sync/1.0' },
  });
  const xml = await res.text();
  const matches = [...xml.matchAll(/<loc>(https:\/\/golfcartsjacksonville\.com\/listing\/[^<]+)<\/loc>/g)];
  return matches.map(m => m[1].trim());
}

/**
 * Generic GCR-platform sitemap fetcher.
 * GCR dealers (Jenkins, Golf Rider, Golf Cars of Woodstock, Shiver Carts,
 * Fat Boys, Woodstock, Mike's GA) all use the same WordPress/GCR pattern:
 *   - Sitemap at /auto-listing-sitemap.xml
 *   - Individual listing URLs contain /Golf-Carts- or /Golf-Cart-
 *
 * Filters out:
 *   - Nav / category pages (isNavPage)
 *   - Sitemap index XML files
 *   - Non-golf-cart product URLs for multi-line stores (Lawn-Mowers, etc.)
 *
 * @param domain     Base domain, e.g. 'www.jenkinsmotorsports.com'
 * @param sitemapPath  Path to the listing sitemap (default '/auto-listing-sitemap.xml')
 * @param golfCartOnly  If true, only return URLs containing 'Golf-Cart' or 'Golf-Carts' path segment
 */
export async function getGcrSitemapUrls(
  domain: string,
  sitemapPath = '/auto-listing-sitemap.xml',
  golfCartOnly = true
): Promise<string[]> {
  const sitemapUrl = `https://${domain}${sitemapPath}`;
  try {
    const res = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'CartIQ-Sync/1.0' },
      signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined,
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // Extract all <loc> URLs
    const allMatches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(m => m[1].trim())
      .filter(u => u.startsWith('http'));

    return allMatches.filter(u => {
      // Drop sitemap index files, XML files, nav pages
      if (isNavPage(u)) return false;
      // For multi-product dealers, only keep golf cart URLs
      if (golfCartOnly && !/\/Golf-Cart/i.test(u)) return false;
      return true;
    });
  } catch {
    return [];
  }
}

export async function getJenkinsListingUrls(): Promise<string[]> {
  return getGcrSitemapUrls('www.jenkinsmotorsports.com', '/auto-listing-sitemap.xml', true);
}

export async function getGolfRiderListingUrls(): Promise<string[]> {
  return getGcrSitemapUrls('www.golfrider.com', '/auto-listing-sitemap.xml', true);
}

export async function getGolfCarsWoodstockListingUrls(): Promise<string[]> {
  return getGcrSitemapUrls('www.golfcarsofwoodstock.com', '/auto-listing-sitemap.xml', true);
}

export async function getShiverCartsListingUrls(): Promise<string[]> {
  return getGcrSitemapUrls('www.shivercarts.com', '/auto-listing-sitemap.xml', true);
}

export async function getFatBoysListingUrls(): Promise<string[]> {
  return getGcrSitemapUrls('www.fatboyscarts.com', '/auto-listing-sitemap.xml', true);
}

export async function getMikesGaListingUrls(): Promise<string[]> {
  // Mike's GA is a multi-product dealer — filter to Golf-Cart URLs only
  return getGcrSitemapUrls('www.mikesgolfcartsga.com', '/auto-listing-sitemap.xml', true);
}

/**
 * Woodstock Golf Carts (different from Golf Cars of Woodstock).
 * woodstockgolfcarts.com — same GCR platform.
 */
export async function getWoodstockListingUrls(): Promise<string[]> {
  return getGcrSitemapUrls('woodstockgolfcarts.com', '/auto-listing-sitemap.xml', true);
}

/**
 * Collect Discovery Golf Cars listing URLs by crawling their inventory page.
 * Discovery uses GCR (Golf Cart Retailer) WordPress plugin -- JS-rendered.
 * Must use Playwright; static fetch returns 403 on /inventory/.
 *
 * @param page  - Playwright page (already open, browser launched by caller)
 * @param limit - Max URLs to return (0 = no limit). Use 5 for test runs.
 */
export async function getDiscoveryListingUrls(
  page: import('playwright').Page,
  limit = 0
): Promise<string[]> {
  const allUrls: string[] = [];
  const seen = new Set<string>();

  const inventoryPages = [
    'https://discoverygolfcars.com/inventory/',
    'https://discoverygolfcars.com/used-golf-carts/',
  ];

  for (const pageUrl of inventoryPages) {
    try {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for GCR listing cards to render
      await page.waitForSelector(
        'a[href*="/listing/"], .glc-listing a, .listing-card a, article.type-glc_listing a',
        { timeout: 12000 }
      ).catch(() => {}); // continue even if selector not found
      await page.waitForTimeout(1500);

      let currentPageNum = 1;
      const MAX_PAGES = 30;

      while (currentPageNum <= MAX_PAGES) {
        const hrefs: string[] = await page.evaluate(() => {
          const anchors = document.querySelectorAll('a[href*="/listing/"]');
          const results: string[] = [];
          anchors.forEach(a => {
            const href = (a as HTMLAnchorElement).href;
            if (href.includes('/listing/') && !href.includes('#')) {
              results.push(href.split('#')[0].split('?')[0].replace(/\/$/, ''));
            }
          });
          return [...new Set(results)];
        });

        let newFound = 0;
        for (const href of hrefs) {
          if (!seen.has(href)) { seen.add(href); allUrls.push(href); newFound++; }
        }

        if (limit > 0 && allUrls.length >= limit) break;

        // Check for next page
        const nextBtn = await page.$(
          'a.next, a[rel="next"], .pagination .next a, .glc-pagination a.next, ' +
          '.nav-links .next, [aria-label="Next page"]'
        );
        if (!nextBtn) break;

        await nextBtn.click();
        await page.waitForSelector('a[href*="/listing/"]', { timeout: 12000 }).catch(() => {});
        await page.waitForTimeout(1500);
        currentPageNum++;
        if (newFound === 0 && currentPageNum > 2) break; // no new listings on new page
      }
    } catch (e) {
      console.warn(`[Discovery] Failed to crawl ${pageUrl}:`, (e as Error).message);
    }

    if (limit > 0 && allUrls.length >= limit) break;
  }

  return limit > 0 ? allUrls.slice(0, limit) : allUrls;
}

// ── Page parsers (Playwright-based) ───────────────────────────────────────────

/**
 * Parse a Botero Carts listing page.
 * Botero uses the GCR (Golf Cart Listings) WordPress plugin.
 * All data is in the DOM after JS renders -- needs Playwright.
 */
export async function parseBoteroListing(
  page: import('playwright').Page,
  url: string
): Promise<ListingData> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);

  const data = await page.evaluate(() => {
    const priceEl =
      document.querySelector('.glc-price .amount') ||
      document.querySelector('.listing-price') ||
      document.querySelector('[class*="price"] .amount') ||
      document.querySelector('[class*="sale-price"]') ||
      document.querySelector('.glc-listing-price');

    const rawPrice = priceEl?.textContent?.replace(/[^0-9.]/g, '') || null;

    const title =
      document.querySelector('h1.entry-title')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() || null;

    const getMeta = (label: string) => {
      const els = document.querySelectorAll('.glc-detail-label, .glc-meta-label, td, .listing-detail');
      for (const el of els) {
        if (el.textContent?.toLowerCase().includes(label.toLowerCase())) {
          return (
            el.nextElementSibling?.textContent?.trim() ||
            el.parentElement?.querySelector('.glc-detail-value, .listing-value, td + td')?.textContent?.trim() ||
            null
          );
        }
      }
      return null;
    };

    const imgEls = document.querySelectorAll(
      '.glc-gallery img, .listing-gallery img, .wp-block-gallery img, .slick-slide img, figure img'
    );
    const images = [...imgEls]
      .map(img => (img as HTMLImageElement).src || (img as HTMLImageElement).dataset.src || '')
      .filter(src => src.startsWith('http') && !src.includes('placeholder'))
      .filter((v, i, a) => a.indexOf(v) === i);

    const locationEl =
      document.querySelector('.glc-location, .listing-location, [class*="location"]')?.textContent?.trim() ||
      null;

    return {
      title, rawPrice,
      year: getMeta('year'), make: getMeta('make'), model: getMeta('model'),
      condition: getMeta('condition'), battery: getMeta('battery') || getMeta('power'),
      seating: getMeta('seat') || getMeta('passenger'),
      location: locationEl, images,
    };
  });

  return normalizeListing(data, url, 'botero');
}

/**
 * Parse a JAX Golf Carts listing page.
 */
export async function parseJaxListing(
  page: import('playwright').Page,
  url: string
): Promise<ListingData> {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    const title = document.querySelector('h1')?.textContent?.trim() || null;

    const priceEl =
      document.querySelector('.price ins .amount') ||
      document.querySelector('.price .amount') ||
      document.querySelector('.woocommerce-Price-amount') ||
      document.querySelector('[class*="price"]');
    const rawPrice = priceEl?.textContent?.replace(/[^0-9.]/g, '') || null;

    const specs: Record<string, string> = {};
    document.querySelectorAll('.vehicle-details li, .specs-table tr, .listing-details li').forEach(el => {
      const text = el.textContent || '';
      const [k, ...rest] = text.split(':');
      if (k && rest.length) specs[k.trim()] = rest.join(':').trim();
    });

    const imgEls = document.querySelectorAll(
      '.wp-post-image, .vehicle-gallery img, .woocommerce-product-gallery img, figure img, .slider img'
    );
    const images = [...imgEls]
      .map(img => (img as HTMLImageElement).src || (img as HTMLImageElement).dataset.lazySrc || '')
      .filter(src => src.startsWith('http') && src.includes('wp-content'))
      .filter((v, i, a) => a.indexOf(v) === i);

    const locationEl = document.querySelector('.dealer-location, .location, address')?.textContent?.trim() || null;

    return { title, rawPrice, specs, images, location: locationEl };
  });

  const parsed = normalizeListing(data, url, 'jax');
  if (!parsed.year || !parsed.make) {
    const fromTitle = parseYearMakeModelFromTitle(data.title || '');
    parsed.year = parsed.year || fromTitle.year;
    parsed.make = parsed.make || fromTitle.make;
    parsed.model = parsed.model || fromTitle.model;
  }
  return parsed;
}

/**
 * Parse a Discovery Golf Cars individual listing page.
 * Discovery uses GCR platform (same base as Botero) -- JS-rendered.
 * Determines dealer_slug (clearwater vs land-o-lakes) from listing city.
 * Does NOT publish directly -- inserts into pending_imports via discoverySync.
 */
export async function parseDiscoveryListing(
  page: import('playwright').Page,
  url: string
): Promise<ListingData> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(1800);

  const data = await page.evaluate(() => {
    const priceEl =
      document.querySelector('.glc-price .amount') ||
      document.querySelector('.listing-price .amount') ||
      document.querySelector('[class*="price"] .amount') ||
      document.querySelector('.glc-listing-price') ||
      document.querySelector('[data-price]');
    const rawPrice = priceEl?.textContent?.replace(/[^0-9.]/g, '') || null;

    const title =
      document.querySelector('h1.entry-title')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() || null;

    const getMeta = (label: string): string | null => {
      const labels = document.querySelectorAll(
        '.glc-detail-label, .glc-meta-label, .glc-field-label, ' +
        '.listing-detail-label, .vehicle-detail-label, td'
      );
      for (const el of labels) {
        const text = el.textContent?.toLowerCase().trim() || '';
        if (text.includes(label.toLowerCase())) {
          const val =
            el.nextElementSibling?.textContent?.trim() ||
            el.closest('tr')?.querySelector('td:last-child')?.textContent?.trim() ||
            el.parentElement?.querySelector('.glc-detail-value, .glc-field-value, td + td')?.textContent?.trim();
          return val || null;
        }
      }
      return null;
    };

    const imgEls = document.querySelectorAll(
      '.glc-gallery img, .listing-gallery img, .slick-slide img, ' +
      '.wp-block-gallery img, figure.wp-block-image img, .gallery img'
    );
    const images = [...imgEls]
      .map(img => {
        const el = img as HTMLImageElement;
        return el.dataset.src || el.dataset.lazySrc || el.src || '';
      })
      .filter(src => src.startsWith('http') && !src.includes('placeholder'))
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 10);

    // og:image fallback
    const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;
    if (ogImg && !images.includes(ogImg)) images.unshift(ogImg);

    const locationEl =
      document.querySelector('.glc-location, .glc-dealer-location, .listing-location')?.textContent?.trim() ||
      document.querySelector('[class*="location"]')?.textContent?.trim() ||
      null;

    const specs: Record<string, string> = {};
    document.querySelectorAll('.glc-details-row, .listing-spec, .glc-field, tr').forEach(row => {
      const cells = row.querySelectorAll('td, .glc-field-label + .glc-field-value, .glc-detail-label + .glc-detail-value');
      if (cells.length >= 2) {
        const key = cells[0].textContent?.trim();
        const val = cells[1].textContent?.trim();
        if (key && val && key.length < 40 && val.length < 100) specs[key] = val;
      }
    });

    return {
      title, rawPrice,
      year: getMeta('year'), make: getMeta('make'), model: getMeta('model'),
      condition: getMeta('condition') || getMeta('type'),
      battery: getMeta('battery') || getMeta('power'),
      seating: getMeta('seat') || getMeta('passenger'),
      location: locationEl, images, specs,
    };
  });

  const normalized = normalizeListing(data, url, 'discovery');

  // Map city to specific dealer slug
  const city = normalized.location_city?.toLowerCase() || '';
  if (city.includes('clearwater') || city.includes('tampa') || city.includes('pinellas') || city.includes('st. pete')) {
    normalized.dealer_slug = 'discovery-golf-cars-clearwater';
  } else if (city.includes('land o') || city.includes('wesley') || city.includes('hudson') || city.includes('new port richey')) {
    normalized.dealer_slug = 'discovery-golf-cars-land-o-lakes';
  } else {
    normalized.dealer_slug = 'discovery'; // unknown -- admin review
  }

  // Fallback: parse from URL slug when DOM returns nothing
  if (!normalized.make || !normalized.year) {
    const slugParts = url.split('/listing/')[1]?.replace(/\/+$/, '').split('-') || [];
    const yearIdx = slugParts.findIndex(p => /^20\d{2}$/.test(p));
    if (yearIdx >= 0) {
      normalized.year = normalized.year || parseInt(slugParts[yearIdx]);
      const SLUG_BRANDS: Record<string, string> = {
        'icon': 'ICON', 'evolution': 'Evolution', 'club': 'Club Car', 'e': 'E-Z-GO',
        'yamaha': 'Yamaha', 'bintelli': 'Bintelli', 'denago': 'Denago EV',
        'advanced': 'Advanced EV', 'blue': 'Blue Cell', 'star': 'Star EV',
      };
      const afterYear = slugParts.slice(yearIdx + 2); // skip power type
      const brandKey = afterYear[0]?.toLowerCase();
      normalized.make = normalized.make || SLUG_BRANDS[brandKey] || null;
    }
  }

  return normalized;
}

// ── Normalizer ─────────────────────────────────────────────────────────────────

function normalizeListing(raw: any, url: string, dealer_slug: string): ListingData {
  const price = raw.rawPrice ? Math.round(parseFloat(raw.rawPrice.replace(/,/g, ''))) : null;

  const conditionMap: Record<string, ListingData['condition']> = {
    new: 'new', used: 'used', 'pre-owned': 'used', preowned: 'used',
    refurbished: 'refurbished', refurb: 'refurbished', certified: 'refurbished',
  };
  const rawCond = (raw.condition || '').toLowerCase().trim();
  const condition = conditionMap[rawCond] || null;

  const seatingStr = (raw.seating || '').replace(/[^0-9]/g, '');
  const seating = seatingStr ? parseInt(seatingStr) : null;

  const images: string[] = Array.isArray(raw.images) ? raw.images.filter(Boolean) : [];

  let location_city: string | null = null;
  let location_state: string | null = null;
  if (raw.location) {
    const locMatch = raw.location.match(/([A-Za-z\s]+),?\s*([A-Z]{2})\b/);
    if (locMatch) {
      location_city = locMatch[1].trim();
      location_state = locMatch[2];
    }
  }

  const year = raw.year ? parseInt(raw.year) : null;

  // Always clean HTML whitespace artifacts from title, make, model
  const cleanTitle = cleanHtmlWhitespace(raw.title) || '';
  const cleanMake  = cleanHtmlWhitespace(raw.make);
  const cleanModel = cleanHtmlWhitespace(raw.model);

  return {
    source_url: url,
    dealer_slug,
    raw_title: cleanTitle,
    year,
    make: cleanMake || null,
    model: cleanModel || null,
    condition,
    price,
    image_url: images[0] || null,
    image_urls: images,
    location_city,
    location_state,
    battery_type: raw.battery?.trim() || null,
    seating,
    specs: raw.specs || {},
  };
}

function parseYearMakeModelFromTitle(title: string): { year: number | null; make: string | null; model: string | null } {
  const yearMatch = title.match(/\b(20\d{2}|19\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  const makes = ['EZGO', 'E-Z-GO', 'Club Car', 'Yamaha', 'ICON', 'Bintelli', 'Advanced EV', 'Star EV', 'GEM', 'Evolution', 'Denago'];
  let make: string | null = null;
  let modelStart = 0;
  for (const m of makes) {
    if (title.toLowerCase().includes(m.toLowerCase())) {
      make = m;
      modelStart = title.toLowerCase().indexOf(m.toLowerCase()) + m.length;
      break;
    }
  }

  const modelRaw = title.slice(modelStart).replace(/^\s*[-]\s*/, '').split(/\s*[-|,]\s*/)[0].trim();
  const model = modelRaw.length > 2 && modelRaw.length < 40 ? modelRaw : null;

  return { year, make, model };
}
