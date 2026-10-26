/**
 * Server-rendered, crawlable listing lists for /search, /golf-carts-for-sale/:slug
 * and /brands/:slug. Injected into <div id="root">; React's createRoot() replaces
 * it on mount, so users never see it twice.
 *
 * Counts and links come only from active + public listings that pass the same
 * eligibility rule as the listing sitemap (isListingSitemapEligible), so the
 * /search total always equals the number of listing URLs in the sitemap.
 */
import type { Listing } from "@shared/schema";
import { storage } from "./storage";
import { isListingSitemapEligible, canonicalListingUrl } from "./sitemaps";
import { CITY_CONFIGS } from "../client/src/lib/seo-config";
import { getBrandWiki } from "../client/src/lib/brand-wiki-data";
import { listingHeadlineCore } from "./listing-title";

export const SSR_PAGE_SIZE = 50;
const CACHE_MS = 5 * 60 * 1000;
const BRAND_SLUG_ALIASES: Record<string, string> = { ezgo: "e-z-go", denago: "denago-ev" };

let cache: { at: number; rows: Listing[] } | null = null;
type Loader = () => Promise<Listing[]>;
let loader: Loader = async () =>
  ((await storage.getListings({ limit: 50_000 })) as Listing[]).filter(isListingSitemapEligible);

/** Test hook. */
export function __setListingLoader(fn: Loader | null): void {
  cache = null;
  loader = fn ?? (async () =>
    ((await storage.getListings({ limit: 50_000 })) as Listing[]).filter(isListingSitemapEligible));
}

async function eligible(): Promise<Listing[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const rows = await loader();
  cache = { at: Date.now(), rows };
  return rows;
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface ListBlock { bodyContent: string; items: { name: string; url: string }[]; total: number; page: number; pages: number }

export function renderListBlock(opts: {
  kind: string; heading: string; basePath: string; rows: Listing[]; page: number;
}): ListBlock {
  const total = opts.rows.length;
  const pages = Math.max(1, Math.ceil(total / SSR_PAGE_SIZE));
  const page = Math.min(Math.max(1, opts.page), pages);
  const slice = opts.rows.slice((page - 1) * SSR_PAGE_SIZE, page * SSR_PAGE_SIZE);
  const items = slice.map((l) => {
    const cs = [l.city, l.state].filter(Boolean).join(", ");
    const name = cs ? `${listingHeadlineCore(l)} — ${cs}` : listingHeadlineCore(l);
    return { name, url: canonicalListingUrl(l) };
  });
  const countLine = `${total.toLocaleString("en-US")} golf cart${total === 1 ? "" : "s"} for sale`;
  const lis = items.map((it) => {
    const path = it.url.replace(/^https?:\/\/[^/]+/, "");
    return `<li><a href="${esc(path)}">${esc(it.name)}</a></li>`;
  }).join("");
  let nav = "";
  if (pages > 1) {
    const links: string[] = [];
    if (page > 1) links.push(`<a href="${esc(opts.basePath)}${page - 1 === 1 ? "" : `?page=${page - 1}`}" rel="prev">Previous</a>`);
    for (let p = 1; p <= pages; p++) {
      links.push(p === page
        ? `<span aria-current="page">${p}</span>`
        : `<a href="${esc(opts.basePath)}${p === 1 ? "" : `?page=${p}`}">${p}</a>`);
    }
    if (page < pages) links.push(`<a href="${esc(opts.basePath)}?page=${page + 1}" rel="next">Next</a>`);
    nav = `<nav aria-label="Listing pages">${links.join(" ")}</nav>`;
  }
  const bodyContent =
    `<section id="__seo_ssr__" data-seo="${esc(opts.kind)}" style="max-width:72rem;margin:0 auto;padding:1rem;font-family:system-ui,sans-serif">` +
    `<h1>${esc(opts.heading)}</h1>` +
    `<p>${esc(countLine)}${pages > 1 ? ` — page ${page} of ${pages}` : ""}</p>` +
    (lis ? `<ul>${lis}</ul>` : "") + nav +
    `</section>`;
  return { bodyContent, items, total, page, pages };
}

export function itemListJsonLd(name: string, description: string, url: string, block: ListBlock): object {
  const offset = (block.page - 1) * SSR_PAGE_SIZE;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name, description, url,
    numberOfItems: block.total,
    itemListElement: block.items.map((it, i) => ({
      "@type": "ListItem", position: offset + i + 1, name: it.name, url: it.url,
    })),
  };
}

/** Returns null when the path isn't a list page (or the city/brand is unknown). */
export async function buildListPage(normalized: string, page: number): Promise<ListBlock | null> {
  if (normalized === "/search") {
    const rows = await eligible();
    return renderListBlock({ kind: "search", heading: "Golf Carts for Sale in Florida & Georgia", basePath: "/search", rows, page });
  }
  if (normalized.startsWith("/golf-carts-for-sale/")) {
    const slug = normalized.slice("/golf-carts-for-sale/".length);
    const cfg = CITY_CONFIGS.find((c) => c.slug === slug);
    if (!cfg) return null;
    const city = cfg.city.toLowerCase();
    const rows = (await eligible()).filter((l) => String(l.state) === cfg.state && String(l.city ?? "").toLowerCase() === city);
    return renderListBlock({ kind: "city", heading: cfg.h1, basePath: normalized, rows, page });
  }
  if (normalized.startsWith("/brands/")) {
    const raw = normalized.slice("/brands/".length);
    const brand = getBrandWiki(BRAND_SLUG_ALIASES[raw] ?? raw);
    if (!brand) return null;
    const want = brand.dbBrand.toLowerCase();
    const rows = (await eligible()).filter((l) => String(l.brand ?? "").toLowerCase() === want);
    return renderListBlock({ kind: "brand", heading: `${brand.name} Golf Carts for Sale`, basePath: normalized, rows, page });
  }
  return null;
}
