/**
 * CartIQ Dealer Adapters
 * Each adapter knows how to:
 *   1. Get listing URLs from a dealer's sitemap
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

// ─── Sitemap fetchers ──────────────────────────────────────────────────────────

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

  // Filter to FL/GA listings by URL slug keywords
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

export async function getDiscoveryListingUrls(): Promise<string[]> {
  // Discovery uses GCR platform — sitemap not accessible, use known base URL pattern
  // Fallback: fetch their inventory page in browser and extract hrefs
  return []; // populated by Playwright scraper
}

// ─── Page parsers (Playwright-based) ─────────────────────────────────────────

/**
 * Parse a Botero Carts listing page.
 * Botero uses the GCR (Golf Cart Listings) WordPress plugin.
 * All data is in the DOM after JS renders — needs Playwright.
 */
export async function parseBoteroListing(
  page: import('playwright').Page,
  url: string
): Promise<ListingData> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500); // wait for GCR JS to render

  const data = await page.evaluate(() => {
    // Price: GCR renders into .glc-price or .listing-price spans
    const priceEl =
      document.querySelector('.glc-price .amount') ||
      document.querySelector('.listing-price') ||
      document.querySelector('[class*="price"] .amount') ||
      document.querySelector('[class*="sale-price"]') ||
      document.querySelector('.glc-listing-price');

    const rawPrice = priceEl?.textContent?.replace(/[^0-9.]/g, '') || null;

    // Title
    const title =
      document.querySelector('h1.entry-title')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() || null;

    // Meta fields rendered by GCR plugin
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

    // Images: GCR uses a gallery slider
    const imgEls = document.querySelectorAll(
      '.glc-gallery img, .listing-gallery img, .wp-block-gallery img, .slick-slide img, figure img'
    );
    const images = [...imgEls]
      .map(img => (img as HTMLImageElement).src || (img as HTMLImageElement).dataset.src || '')
      .filter(src => src.startsWith('http') && !src.includes('placeholder'))
      .filter((v, i, a) => a.indexOf(v) === i); // dedupe

    // Location
    const locationEl =
      document.querySelector('.glc-location, .listing-location, [class*="location"]')?.textContent?.trim() ||
      null;

    return {
      title,
      rawPrice,
      year: getMeta('year'),
      make: getMeta('make'),
      model: getMeta('model'),
      condition: getMeta('condition'),
      battery: getMeta('battery') || getMeta('power'),
      seating: getMeta('seat') || getMeta('passenger'),
      location: locationEl,
      images,
    };
  });

  return normalizeListing(data, url, 'botero');
}

/**
 * Parse a JAX Golf Carts listing page.
 * JAX uses Fusion theme / custom WP — SiteGround JS challenge, needs Playwright.
 */
export async function parseJaxListing(
  page: import('playwright').Page,
  url: string
): Promise<ListingData> {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    const title = document.querySelector('h1')?.textContent?.trim() || null;

    // Price: JAX uses WooCommerce-style price spans
    const priceEl =
      document.querySelector('.price ins .amount') ||
      document.querySelector('.price .amount') ||
      document.querySelector('.woocommerce-Price-amount') ||
      document.querySelector('[class*="price"]');
    const rawPrice = priceEl?.textContent?.replace(/[^0-9.]/g, '') || null;

    // Specs table or list
    const specs: Record<string, string> = {};
    document.querySelectorAll('.vehicle-details li, .specs-table tr, .listing-details li').forEach(el => {
      const text = el.textContent || '';
      const [k, ...rest] = text.split(':');
      if (k && rest.length) specs[k.trim()] = rest.join(':').trim();
    });

    // Images
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

  // Derive year/make/model from title if not in specs
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
 * Parse a Discovery Golf Cars listing page.
 * Discovery also runs GCR platform — same structure as Botero.
 */
export async function parseDiscoveryListing(
  page: import('playwright').Page,
  url: string
): Promise<ListingData> {
  // Same GCR structure as Botero
  return parseBoteroListing(page, url); // reuse adapter, override dealer_slug below
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeListing(raw: any, url: string, dealer_slug: string): ListingData {
  const price = raw.rawPrice ? Math.round(parseFloat(raw.rawPrice.replace(/,/g, ''))) : null;

  const conditionMap: Record<string, ListingData['condition']> = {
    new: 'new',
    used: 'used',
    'pre-owned': 'used',
    preowned: 'used',
    refurbished: 'refurbished',
    refurb: 'refurbished',
    certified: 'refurbished',
  };
  const rawCond = (raw.condition || '').toLowerCase().trim();
  const condition = conditionMap[rawCond] || null;

  const seatingStr = (raw.seating || '').replace(/[^0-9]/g, '');
  const seating = seatingStr ? parseInt(seatingStr) : null;

  const images: string[] = Array.isArray(raw.images) ? raw.images.filter(Boolean) : [];

  // Parse location "City, ST" or "City ST ZIP"
  let location_city: string | null = null;
  let location_state: string | null = null;
  if (raw.location) {
    const locMatch = raw.location.match(/([A-Za-z\s]+),?\s*([A-Z]{2})\b/);
    if (locMatch) {
      location_city = locMatch[1].trim();
      location_state = locMatch[2];
    }
  }

  // Parse year/make/model from structured fields
  const year = raw.year ? parseInt(raw.year) : null;

  return {
    source_url: url,
    dealer_slug,
    raw_title: raw.title || '',
    year,
    make: raw.make?.trim() || null,
    model: raw.model?.trim() || null,
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

  // Model is what comes after make (before descriptors)
  const modelRaw = title.slice(modelStart).replace(/^\s*[-–]\s*/, '').split(/\s*[-–|,]\s*/)[0].trim();
  const model = modelRaw.length > 2 && modelRaw.length < 40 ? modelRaw : null;

  return { year, make, model };
}
