/**
 * Adapter registry.
 *
 * INTENTIONALLY EMPTY in this draft. G4: no dealer-site fetching from this workstream until
 * G1 (dump + Raphael OK) and G2 (key rotation) clear and Crawl-delay/robots honoring is merged.
 * With no fetchers registered, main.ts exits SKIPPED_NO_FETCHER before any DB write.
 *
 * TODO(Spec 1): wrap existing adapters (server/sync/pipeline-lambda.ts runDiscoverSitemap paths:
 *   DX1, Botero, Advantage, GCR sitemap, auto-detect) as DealerFetcher implementations that:
 *   - return per-item dealer tags (location tagging) and an observed site_count with its source;
 *   - throw FetchError with the real HTTP status (no `[]` on non-OK; no `no_new` on failure);
 *   - honor robots.txt + Crawl-delay (Advantage 600s); never use server/sync/stealth-fetcher.ts.
 * TODO(Spec 2): HTML-index parser for urlOnly dealers (sale vs regular vs asking price).
 */
import type { DealerFetcher } from "./types";

export const FETCHERS: ReadonlyMap<string, DealerFetcher> = new Map();
