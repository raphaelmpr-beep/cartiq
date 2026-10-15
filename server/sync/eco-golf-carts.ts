import { load, type CheerioAPI } from 'cheerio';
import { browserHeaders, sitemapHeaders } from './http-headers.js';

export const ECO_SLUG = 'eco-golf-carts-ponte-vedra';
export const ECO_ADAPTER = 'eco_golf_carts';
export const ECO_INVENTORY = 'https://ecogolfcarts.com/inventory/';
export const ECO_SITEMAP = 'https://ecogolfcarts.com/glc_listing-sitemap.xml';
export const ECO_ROBOTS = 'https://ecogolfcarts.com/robots.txt';
const ORIGIN = 'https://ecogolfcarts.com';
const text = (s: string) => s.replace(/\s+/g, ' ').trim();

export interface EcoUnit {
  source_url: string;
  source_id: string;
  raw_title: string;
  year: number;
  make: string;
  model: string;
  condition: string;
  price: number;
  image_url: string;
  image_urls_json: string;
  specs_json: string;
  location_city: 'Ponte Vedra';
  location_state: 'FL';
}
export interface EcoCandidate { url: string; price: number }
export interface EcoDiscovery {
  units: EcoUnit[];
  candidates: number;
  pendingSkipped: number;
  detailUnavailableSkipped: number;
  sitemapUrls: number;
}

/** Only the verified dealer origin and individual GCR listing IDs are accepted. */
export function canonicalEcoUrl(value: string): string {
  const url = new URL(value.trim(), ORIGIN);
  if (url.protocol !== 'https:' || url.hostname !== 'ecogolfcarts.com' ||
      url.port || url.username || url.password ||
      !/^\/listing\/[a-z0-9-]+-\d+\/?$/i.test(url.pathname)) {
    throw new Error(`Invalid Eco detail URL: ${value}`);
  }
  return `${ORIGIN}${url.pathname.replace(/\/?$/, '/')}`;
}

export function parseEcoSitemap(xml: string): Set<string> {
  const $ = load(xml, { xml: true });
  if ($('urlset').length !== 1 || $('urlset > url').length === 0) {
    throw new Error('Eco sitemap is missing or malformed');
  }
  const urls = new Set<string>();
  $('urlset > url > loc').each((_, el) => {
    const value = text($(el).text());
    if (value === `${ORIGIN}/listing/`) return;
    urls.add(canonicalEcoUrl(value));
  });
  if (!urls.size) throw new Error('Eco sitemap has no detail URLs');
  return urls;
}

/** GCR calls the crossed-out OLD price listing-sale-price. Never use it as asking price. */
export function parseEcoPrice(html: string): number | null {
  const $ = load(html);
  const root = $('.listing-price');
  if (root.length !== 1) throw new Error('Expected one scoped Eco price');
  const status = text(root.text());
  if (/\b(sold|pending|reserved|unavailable|out of stock)\b/i.test(status)) return null;
  root.find('.listing-sale-price, del, s, script, style').remove();
  const value = text(root.text());
  if (!/^\$(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?$/.test(value)) {
    throw new Error(`Missing or ambiguous Eco asking price: ${value}`);
  }
  const price = Number(value.slice(1).replace(/,/g, ''));
  // pending_imports.price is an integer. Never silently round a cent-denominated price.
  if (!Number.isSafeInteger(price) || price <= 0) throw new Error('Unsupported Eco price');
  return price;
}

export function parseEcoInventory(html: string): { candidates: EcoCandidate[]; pendingSkipped: number } {
  const $ = load(html);
  const template = $('.facetwp-template[data-name="listings"]');
  if (template.length !== 1) throw new Error('Eco inventory template missing');
  const marker = template.find('p').filter((_, el) =>
    text($(el).text()) === '// End of Available Inventory for Sale //');
  // Stop rather than silently omit active carts when they span another page.
  if (marker.length !== 1) throw new Error('Eco available/sold boundary missing; pagination review required');
  const available = marker.prevAll('ul.job_listings');
  if (available.length !== 1) throw new Error('Ambiguous Eco available inventory section');
  const candidates: EcoCandidate[] = [];
  const seen = new Set<string>();
  let pendingSkipped = 0;
  available.children('li.listing-card').each((_, el) => {
    const card = $(el);
    const link = card.find('.job_listing-title a');
    if (link.length !== 1) throw new Error('Eco card identity missing');
    const url = canonicalEcoUrl(link.attr('href') || '');
    if (seen.has(url)) throw new Error('Duplicate Eco inventory card');
    seen.add(url);
    const id = url.match(/-(\d+)\/$/)![1];
    if (card.attr('id') !== `listing-${id}`) throw new Error('Eco card ID mismatch');
    const price = parseEcoPrice(card.find('.listing-price').prop('outerHTML') || '');
    if (price === null) { pendingSkipped++; return; }
    candidates.push({ url, price });
  });
  return { candidates, pendingSkipped };
}

function specValues($: CheerioAPI): Record<string, string> {
  const values: Record<string, string> = {};
  if ($('.listing-specs-container').length !== 1) throw new Error('Eco specifications missing');
  $('.listing-specs-container strong').each((_, el) => {
    const key = text($(el).text()).replace(/:$/, '').toLowerCase();
    if (key in values) throw new Error(`Duplicate Eco specification: ${key}`);
    values[key] = text($(el).parent().next().text());
  });
  return values;
}

export function parseEcoDetail(html: string, sourceUrl: string): EcoUnit | null {
  const url = canonicalEcoUrl(sourceUrl);
  const $ = load(html);
  if ($('link[rel="canonical"]').length !== 1 ||
      canonicalEcoUrl($('link[rel="canonical"]').attr('href') || '') !== url) {
    throw new Error('Eco canonical identity mismatch');
  }
  const sourceId = url.match(/-(\d+)\/$/)![1];
  if (!$('body').hasClass(`postid-${sourceId}`)) throw new Error('Eco page ID mismatch');
  const header = $('.listing-header');
  if (header.length !== 1 || header.find('h1.job_listing-title').length !== 1) {
    throw new Error('Eco detail header missing');
  }
  // Scope availability to this unit, not the related/sold carousels elsewhere on the page.
  const price = parseEcoPrice(header.find('.listing-price').prop('outerHTML') || '');
  if (price === null) return null;
  const specs = specValues($);
  if (specs.location !== 'Ponte Vedra FL') throw new Error('Eco location mismatch');
  if (!/^(19|20)\d{2}$/.test(specs.year || '') || !specs.make || !specs.model ||
      !/^(New|Used|Refurbished|Demo|Certified)$/i.test(specs.condition || '')) {
    throw new Error('Eco required specifications missing');
  }
  const images: string[] = [];
  $('.listing-gallery .listing-gallery__item img').each((_, el) => {
    const image = new URL($(el).attr('src') || '', ORIGIN);
    if (image.origin !== ORIGIN || !/^\/wp-content\/uploads\/\d{4}\/\d{2}\//.test(image.pathname) ||
        !/\.(?:jpe?g|png|webp)$/i.test(image.pathname)) throw new Error('Invalid Eco unit image');
    if (!images.includes(image.href)) images.push(image.href);
  });
  if (!images.length) throw new Error('Eco unit images missing');
  const title = text(header.find('h1.job_listing-title').text());
  if (!title) throw new Error('Eco title missing');
  const seating = text(header.find('.content-single-job_listing-title-category').text())
    .match(/\b(\d{1,2}) Passenger\b/);
  return {
    source_url: url, source_id: sourceId, raw_title: title,
    year: Number(specs.year), make: specs.make, model: specs.model,
    condition: specs.condition.toLowerCase(), price, image_url: images[0],
    image_urls_json: JSON.stringify(images),
    specs_json: JSON.stringify({
      source_id: sourceId, power_type_raw: specs['power type'] || null,
      seating: seating ? Number(seating[1]) : null, color: specs.color || null,
      // Preserve source statements; do not infer battery warranty or electrical specs.
      source_specs: specs,
    }),
    location_city: 'Ponte Vedra', location_state: 'FL',
  };
}

export type EcoFetchText = (url: string) => Promise<string>;
export async function fetchEcoText(url: string): Promise<string> {
  if (url !== ECO_INVENTORY && url !== ECO_SITEMAP && url !== ECO_ROBOTS && canonicalEcoUrl(url) !== url) {
    throw new Error('Unexpected Eco fetch URL');
  }
  const response = await fetch(url, {
    headers: url === ECO_SITEMAP ? sitemapHeaders(url) : browserHeaders(url),
    redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Eco HTTP ${response.status}: ${url}`);
  const body = await response.text();
  if (!body || body.length > 3_000_000) throw new Error('Invalid Eco response size');
  return body;
}

/** Conservative policy: stop for review on ANY nonempty Disallow rule.
 * This intentionally under-crawls rather than guessing agent/path precedence.
 */
export function verifyEcoRobots(robots: string): void {
  const lines = robots.split(/\r?\n/).map(line => line.replace(/#.*$/, '').trim());
  if (!lines.some(line => /^user-agent:\s*\*$/i.test(line)) ||
      !lines.some(line => /^disallow:\s*$/i.test(line)) ||
      lines.some(line => /^disallow:\s*\S/i.test(line)) ||
      /<html|<!doctype/i.test(robots)) {
    throw new Error('Eco crawl rules need review');
  }
}

/** Complete read-only discovery. Any parse/fetch error aborts before queue writes. */
export async function discoverEcoInventory(fetchText: EcoFetchText = fetchEcoText): Promise<EcoDiscovery> {
  verifyEcoRobots(await fetchText(ECO_ROBOTS));
  const sitemap = parseEcoSitemap(await fetchText(ECO_SITEMAP));
  const { candidates, pendingSkipped } = parseEcoInventory(await fetchText(ECO_INVENTORY));
  if (candidates.length > 40) throw new Error('Eco active inventory exceeds reviewed safety cap');
  const units: EcoUnit[] = [];
  let detailUnavailableSkipped = 0;
  for (const candidate of candidates) {
    if (!sitemap.has(candidate.url)) throw new Error('Eco active card missing from sitemap');
    const unit = parseEcoDetail(await fetchText(candidate.url), candidate.url);
    if (!unit) { detailUnavailableSkipped++; continue; }
    if (unit.price !== candidate.price) throw new Error(`Eco card/detail price conflict: ${candidate.url}`);
    units.push(unit);
  }
  return { units, candidates: candidates.length, pendingSkipped, detailUnavailableSkipped, sitemapUrls: sitemap.size };
}

/** Explicit field mapping: no public listing writes and no invented metadata. */
export function ecoPendingRows(units: EcoUnit[], knownUrls: Iterable<string>, limit: number) {
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 100) throw new Error('Invalid Eco queue limit');
  const known = new Set(Array.from(knownUrls, canonicalEcoUrl));
  const unique = new Map(units.map(unit => [unit.source_url, unit]));
  if (unique.size !== units.length) throw new Error('Duplicate Eco unit');
  return units.filter(unit => !known.has(unit.source_url)).slice(0, limit).map(unit => ({
    dealer_slug: ECO_SLUG, source_url: unit.source_url, raw_title: unit.raw_title,
    year: unit.year, make: unit.make, model: unit.model, condition: unit.condition,
    price: unit.price, image_url: unit.image_url, image_urls_json: unit.image_urls_json,
    specs_json: unit.specs_json, location_city: unit.location_city,
    location_state: unit.location_state, status: 'pending' as const,
  }));
}
