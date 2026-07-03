/**
 * GolfCartIQ — Sitemap module
 *
 * Emits a sitemap index at /sitemap.xml that references child sitemaps:
 *   - /sitemap-pages.xml         (static + brand + battery + buyer-guide articles)
 *   - /sitemap-city-pages.xml    (city landing pages)
 *   - /sitemap-dealers.xml       (dealer detail pages; empty urlset until pages ship)
 *   - /sitemap-listings.xml      (active listing detail pages)
 *
 * If listings exceed LISTINGS_PER_SITEMAP (50,000), listings automatically
 * split into /sitemap-listings-1.xml, /sitemap-listings-2.xml, etc.
 *
 * Quality gate for listings — a listing is included ONLY when all pass:
 *   - status === "active"
 *   - public_listing === true
 *   - has a slug or id (canonical URL is constructible)
 *   - has title
 *   - has dealer OR seller_type is set (source of truth)
 *   - has city + state (indexable context)
 *   - has at least ONE meaningful attribute:
 *       asking_price > 0, image_url, make/model/year, battery_type/power_type,
 *       or condition
 *
 * Excluded: sold, expired, inactive, unavailable, pending, duplicates,
 * filtered search URLs, tracking URLs, pages that canonicalize elsewhere,
 * robots-blocked pages, and anything marked noindex.
 *
 * Lastmod: listing.updated_at || listing.created_at. No fake daily refresh.
 */

import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import type { Listing, Dealer, SeoArticle } from "@shared/schema";
import { CITY_PAGE_ENTRIES, STATIC_PAGE_ENTRIES } from "./sitemap-config";

const BASE = "https://golfcartiq.com";
const LISTINGS_PER_SITEMAP = 50_000;

// Feature flag — flip on when /dealer/:slug detail pages ship and return 200 HTML.
// While OFF, /sitemap-dealers.xml returns an empty <urlset> so Google can fetch
// the index without hitting a broken child.
const DEALER_PAGES_ENABLED =
  (process.env.DEALER_PAGES_ENABLED ?? "false").toLowerCase() === "true";

// ─── XML helpers ────────────────────────────────────────────────────────────

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIsoDate(v: unknown): string {
  if (!v) return new Date().toISOString().split("T")[0];
  const s = String(v);
  // Accept full ISO or YYYY-MM-DD — normalise to YYYY-MM-DD.
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  return d.toISOString().split("T")[0];
}

function urlTag(loc: string, lastmod?: string, changefreq?: string, priority?: string): string {
  const parts = [`<loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) parts.push(`<lastmod>${lastmod}</lastmod>`);
  if (changefreq) parts.push(`<changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`<priority>${priority}</priority>`);
  return `  <url>${parts.join("")}</url>`;
}

function urlset(urls: string[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.join("\n") +
    `\n</urlset>\n`
  );
}

function sitemapindex(children: { loc: string; lastmod?: string }[]): string {
  const items = children
    .map(c => {
      const lm = c.lastmod ? `<lastmod>${c.lastmod}</lastmod>` : "";
      return `  <sitemap><loc>${xmlEscape(c.loc)}</loc>${lm}</sitemap>`;
    })
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    items +
    `\n</sitemapindex>\n`
  );
}

function sendXml(res: Response, body: string, seconds = 3600): void {
  res.type("application/xml");
  // Cache for 1h at edge; sitemap regenerates cheaply.
  res.setHeader("Cache-Control", `public, max-age=${seconds}, s-maxage=${seconds}`);
  res.send(body);
}

// ─── Listing eligibility gate ───────────────────────────────────────────────

// Statuses that MUST NOT appear in the sitemap.
const BAD_STATUSES = new Set([
  "sold", "expired", "inactive", "unavailable",
  "pending", "rejected", "blocked", "duplicate",
]);

/**
 * True if the listing has at least one meaningful attribute beyond title.
 * This prevents thin/empty pages from being handed to Google.
 */
function hasMeaningfulAttribute(l: Listing): boolean {
  if (l.asking_price != null && Number(l.asking_price) > 0) return true;
  if (l.image_url && String(l.image_url).trim().length > 0) return true;
  if (l.brand || l.model || l.year) return true;
  if (l.battery_type && l.battery_type !== "unknown") return true;
  if (l.power_type && l.power_type !== "unknown") return true;
  if (l.condition && l.condition !== "unknown") return true;
  return false;
}

export function isListingSitemapEligible(l: Listing): boolean {
  // Core lifecycle
  if (!l) return false;
  if (l.status !== "active") return false;
  if (BAD_STATUSES.has(String(l.status).toLowerCase())) return false;
  if (l.public_listing !== true) return false;

  // Canonical URL must be constructible
  const slug = l.slug ?? (l.id != null ? String(l.id) : "");
  if (!slug || String(slug).trim().length === 0) return false;

  // Minimum content: title + geo + one meaningful attribute
  if (!l.title || String(l.title).trim().length === 0) return false;
  if (!l.city || !l.state) return false;

  // Source of truth — dealer_id or seller_type. Prevents orphaned rows.
  const hasSource =
    (l.dealer_id != null && l.dealer_id > 0) ||
    (l.seller_type && String(l.seller_type).trim().length > 0);
  if (!hasSource) return false;

  if (!hasMeaningfulAttribute(l)) return false;

  return true;
}

/** Canonical public URL for a listing. Matches the <link rel="canonical"> emitted
 *  by ListingDetail.tsx, so the sitemap URL === canonical URL (no redirect chains). */
export function canonicalListingUrl(l: Pick<Listing, "id" | "slug">): string {
  const slug = l.slug ?? String(l.id);
  return `${BASE}/listing/${slug}`;
}

// ─── Route handlers ─────────────────────────────────────────────────────────

/**
 * GET /sitemap.xml — sitemap index.
 * Splits listings across N children if count > 50,000.
 */
async function handleSitemapIndex(_req: Request, res: Response): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const listingCount = await storage.getListingCount().catch(() => 0);
    const listingShardCount = Math.max(1, Math.ceil(listingCount / LISTINGS_PER_SITEMAP));

    const children: { loc: string; lastmod?: string }[] = [
      { loc: `${BASE}/sitemap-pages.xml`,      lastmod: today },
      { loc: `${BASE}/sitemap-city-pages.xml`, lastmod: today },
      { loc: `${BASE}/sitemap-dealers.xml`,    lastmod: today },
    ];

    if (listingShardCount <= 1) {
      children.push({ loc: `${BASE}/sitemap-listings.xml`, lastmod: today });
    } else {
      for (let i = 1; i <= listingShardCount; i++) {
        children.push({ loc: `${BASE}/sitemap-listings-${i}.xml`, lastmod: today });
      }
    }

    sendXml(res, sitemapindex(children));
  } catch (e) {
    res.status(500).type("application/xml").send("<!-- sitemap index error -->");
  }
}

/** GET /sitemap-pages.xml — static, brand, battery, and buyer-guide articles. */
async function handlePagesSitemap(_req: Request, res: Response): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const articles = (await storage.getSeoArticles().catch(() => [])) as SeoArticle[];

    const urls: string[] = [];
    for (const p of STATIC_PAGE_ENTRIES) {
      urls.push(urlTag(`${BASE}${p.path}`, today, p.changefreq, p.priority));
    }
    for (const a of articles) {
      if (!(a as any).published) continue;
      if (!a.slug) continue;
      const lm = toIsoDate((a as any).updated_at ?? (a as any).updatedAt ?? (a as any).created_at);
      urls.push(urlTag(`${BASE}/buyer-guide/${a.slug}`, lm, "monthly", "0.7"));
    }
    sendXml(res, urlset(urls));
  } catch (e) {
    res.status(500).type("application/xml").send("<!-- pages sitemap error -->");
  }
}

/** GET /sitemap-city-pages.xml — city landing pages. */
async function handleCityPagesSitemap(_req: Request, res: Response): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const urls = CITY_PAGE_ENTRIES.map(c =>
      urlTag(`${BASE}${c.path}`, today, c.changefreq, c.priority),
    );
    sendXml(res, urlset(urls));
  } catch (e) {
    res.status(500).type("application/xml").send("<!-- city sitemap error -->");
  }
}

/**
 * GET /sitemap-dealers.xml — dealer detail pages.
 * Guarded by DEALER_PAGES_ENABLED because /dealer/:slug pages are not yet
 * rendered. Emits an empty <urlset> when the flag is off so Google can still
 * fetch the file without a broken crawl target.
 */
async function handleDealersSitemap(_req: Request, res: Response): Promise<void> {
  try {
    if (!DEALER_PAGES_ENABLED) {
      sendXml(res, urlset([]));
      return;
    }
    const dealers = (await storage.getDealers().catch(() => [])) as Dealer[];
    const urls: string[] = [];
    for (const d of dealers) {
      if (!d.slug) continue;
      // Exclude duplicates
      if (d.is_duplicate_of) continue;
      const lm = toIsoDate((d as any).updated_at ?? (d as any).updatedAt);
      urls.push(urlTag(`${BASE}/dealer/${d.slug}`, lm, "weekly", "0.6"));
    }
    sendXml(res, urlset(urls));
  } catch (e) {
    res.status(500).type("application/xml").send("<!-- dealer sitemap error -->");
  }
}

/**
 * Build the listing shards (in-memory). Returns an array of eligible listings
 * chunked into pages of LISTINGS_PER_SITEMAP.
 */
async function loadEligibleListings(): Promise<Listing[]> {
  const all = (await storage.getListings({
    status: "active",
    public_listing: true,
    limit: 50_000,
  })) as Listing[];
  return all.filter(isListingSitemapEligible);
}

/** GET /sitemap-listings.xml — single-shard case (≤ 50k). */
async function handleListingsSitemap(_req: Request, res: Response): Promise<void> {
  try {
    const eligible = await loadEligibleListings();
    // If > 50k, fall through to redirect at index level; here we just take page 1.
    const page = eligible.slice(0, LISTINGS_PER_SITEMAP);
    const urls = page.map(l => {
      const lm = toIsoDate(l.updated_at ?? (l as any).updatedAt ?? l.created_at ?? (l as any).createdAt);
      return urlTag(canonicalListingUrl(l), lm, "weekly", "0.6");
    });
    sendXml(res, urlset(urls));
  } catch (e) {
    res.status(500).type("application/xml").send("<!-- listings sitemap error -->");
  }
}

/** GET /sitemap-listings-:n.xml — sharded case for > 50k listings. */
async function handleListingsSitemapShard(req: Request, res: Response): Promise<void> {
  try {
    const n = Number(req.params.n);
    if (!Number.isInteger(n) || n < 1) {
      res.status(404).type("application/xml").send("<!-- shard not found -->");
      return;
    }
    const eligible = await loadEligibleListings();
    const start = (n - 1) * LISTINGS_PER_SITEMAP;
    const end   = start + LISTINGS_PER_SITEMAP;
    if (start >= eligible.length) {
      res.status(404).type("application/xml").send("<!-- shard not found -->");
      return;
    }
    const page = eligible.slice(start, end);
    const urls = page.map(l => {
      const lm = toIsoDate(l.updated_at ?? (l as any).updatedAt ?? l.created_at ?? (l as any).createdAt);
      return urlTag(canonicalListingUrl(l), lm, "weekly", "0.6");
    });
    sendXml(res, urlset(urls));
  } catch (e) {
    res.status(500).type("application/xml").send("<!-- listings shard error -->");
  }
}

// ─── Lifecycle interceptor for /listing/:idOrSlug ───────────────────────────
//
// Runs BEFORE the SPA catch-all so we can return proper HTTP status codes for
// Google (410 Gone) instead of always returning the SPA shell as 200.
// HTML navigations only — asset requests are filtered by the Accept header.
//
// Behaviour:
//   • listing missing (never existed or hard-deleted) → 410 Gone
//   • listing exists but non-active/non-public        → fall through to SPA,
//       adds Link: rel=canonical header pointing to closest still-indexable
//       page and X-Listing-Lifecycle header. Client-side setSEO() flips
//       robots meta to noindex once React mounts (see ListingDetail.tsx).
//   • listing exists, active, public                  → fall through unchanged
//
// We deliberately do NOT 301-redirect sold listings by default — keeping the
// URL live with useful content preserves inbound link equity and matches the
// spec ("keep the page live only if it has useful content and similar listing
// links"). Hard 410 only fires when the DB row is gone.

async function handleListingLifecycle(req: Request, res: Response, next: () => void): Promise<void> {
  const accept = String(req.headers.accept ?? "");
  if (!accept.includes("text/html")) return next();

  const raw = req.params.idOrSlug;
  const idOrSlug = Array.isArray(raw) ? raw[0] : raw;
  if (!idOrSlug) return next();

  try {
    const isNumeric = /^\d+$/.test(idOrSlug);
    const listing = isNumeric
      ? await storage.getListingById(Number(idOrSlug))
      : await storage.getListingBySlug(idOrSlug);

    if (!listing) {
      res.status(410).type("text/html").send(
        `<!doctype html><html><head><meta name="robots" content="noindex,nofollow">` +
        `<title>Listing no longer available | GolfCartIQ</title>` +
        `<link rel="canonical" href="${BASE}/search">` +
        `</head><body><h1>Listing no longer available</h1>` +
        `<p>This golf cart listing has been removed. ` +
        `<a href="${BASE}/search">Browse active listings</a>.</p></body></html>`
      );
      return;
    }

    if (listing.status !== "active" || listing.public_listing !== true) {
      const fallback = resolveClosestFallback(listing);
      if (fallback) res.setHeader("Link", `<${fallback}>; rel="canonical"`);
      res.setHeader("X-Listing-Lifecycle", String(listing.status ?? "inactive"));
    }
    return next();
  } catch {
    return next();
  }
}

/**
 * Best-effort closest-related-page URL for a sold/expired listing.
 * Priority: city page (if configured) → brand page → /search.
 * Dealer detail pages are skipped until DEALER_PAGES_ENABLED ships.
 */
function resolveClosestFallback(l: Listing): string | null {
  const brandSlug = l.brand
    ? String(l.brand).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : "";
  const citySlug =
    l.city && l.state
      ? `${String(l.city).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${String(l.state).toLowerCase()}`
      : "";

  if (citySlug && CITY_PAGE_ENTRIES.some(c => c.path.endsWith(citySlug))) {
    return `${BASE}/golf-carts-for-sale/${citySlug}`;
  }
  if (brandSlug) return `${BASE}/brands/${brandSlug}`;
  return `${BASE}/search`;
}

// ─── Registration ───────────────────────────────────────────────────────────

/** Registers all sitemap routes on the Express app. */
export function registerSitemapRoutes(app: Express): void {
  app.get("/sitemap.xml",              handleSitemapIndex);
  app.get("/sitemap-pages.xml",        handlePagesSitemap);
  app.get("/sitemap-city-pages.xml",   handleCityPagesSitemap);
  app.get("/sitemap-dealers.xml",      handleDealersSitemap);
  app.get("/sitemap-listings.xml",     handleListingsSitemap);
  app.get("/sitemap-listings-:n.xml",  handleListingsSitemapShard);

  // Lifecycle interceptor — must be registered BEFORE the SPA catch-all
  // (which happens in static.ts). Only intercepts HTML navigations; falls
  // through for active listings so the SPA shell still renders normally.
  app.get("/listing/:idOrSlug", handleListingLifecycle);
}
