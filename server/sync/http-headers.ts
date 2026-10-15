/**
 * Shared HTTP header helpers for sitemap / listing-page fetches.
 *
 * Compliance: these return ONLY our honest, stable bot identity (see polite-fetch.ts).
 * Browser-UA rotation and forged Referer headers were removed (Oct 2026): if a dealer site
 * blocks GolfCartIQ-Bot, we stop, auto-pause the dealer, and ask for permission or a feed.
 */
import { botHeaders } from "./polite-fetch.js";

/** Honest headers for HTML pages. `url` is accepted for backwards compatibility and ignored (no Referer). */
export function browserHeaders(_url?: string, extra?: Record<string, string>): Record<string, string> {
  return botHeaders("html", extra);
}

/** Honest headers for sitemap / XML fetches. */
export function sitemapHeaders(_url?: string): Record<string, string> {
  return botHeaders("xml");
}
