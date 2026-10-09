/**
 * Dealer-sync scheduler: shared types.
 *
 * DRAFT (code-only). Contracts follow the Database Engineer's data spec §2/§5
 * (dealer_sync_runs, dealer_sync_run_urls, dealer_sync_run_start/finish/sweep).
 * Nothing in this folder writes to `listings` or `pending_imports`.
 */

export type RunOutcome = "success" | "partial" | "failed" | "blocked";

/** Error causes seeded by DE in dealer_sync_error_causes (draft-gcq-dealer-sync-runs.sql). */
export type ErrorCause =
  | "blocked_antibot"
  | "blocked_rate_limited"
  | "blocked_tos_robots"
  | "http_error"
  | "network"
  | "timeout"
  | "zero_urls"
  | "parse_error"
  | "pagination_incomplete"
  | "location_split_unknown"
  | "needs_browser"
  | "not_configured"
  | "db_error"
  | "adapter_exception";
// NOTE: "abandoned" is set only by dealer_sync_runs_sweep(); the runner never reports it.

export const BLOCKED_CAUSES: ReadonlySet<ErrorCause> = new Set([
  "blocked_antibot",
  "blocked_rate_limited",
  "blocked_tos_robots",
]);

export type SiteCountSource =
  | "sitemap_urls"
  | "api_total"
  | "html_index"
  | "dealer_feed"
  | "page_counter"
  | "manual"
  | "none";

/** Minimal dealer row the scheduler reads (read-only SELECT on `dealers`). */
export interface DealerRow {
  id: number;
  slug: string;
  adapter_key: string | null;
  sync_enabled: boolean | null;
}

/** One fetch per group; one run row per sibling dealer in the group. */
export interface FetchGroup {
  /** Adapter used for this group ("generic" when the dealer has no adapter_key). */
  adapterKey: string;
  /** Shared-fetch key, NULL when the dealer is fetched alone (DE §2 `fetch_group`). */
  fetchGroup: string | null;
  dealers: DealerRow[];
}

/** One item the adapter saw, tagged to a dealer (location tagging) or null if untaggable. */
export interface SeenItem {
  url: string;
  imageUrl?: string | null;
  dealerId: number | null;
}

export interface FetchResult {
  httpStatus: number | null;
  items: SeenItem[];
  /** False when the adapter knows the fetch is incomplete (e.g. a later page failed). */
  complete: boolean;
  /** Dealer's own-site count per dealer id, only when the adapter actually observed it. Never guessed. */
  siteCounts?: Map<number, { count: number; source: SiteCountSource }>;
}

/** Adapter port. Implementations MUST honor G4 (no stealth, robots/Crawl-delay respected). */
export interface DealerFetcher {
  readonly adapterKey: string;
  readonly version: string;
  fetch(group: FetchGroup): Promise<FetchResult>;
}

export interface RunStartArgs {
  runId: string;
  dealerId: number;
  runner: string;
  parserVersion: string;
  adapterKey: string | null;
  fetchGroup: string | null;
}

export interface RunFinishArgs {
  outcome: RunOutcome;
  httpStatus: number | null;
  fetchedCount: number | null;
  siteCount: number | null;
  siteCountSource: SiteCountSource | null;
  errorCause: ErrorCause | null;
  message: string | null;
}

export interface RunUrlRow {
  url_norm: string;
  url_raw: string;
  image_url: string | null;
}

/** Writer for DE's run tables. All writes go through DE's functions / tables only. */
export interface RunStore {
  /** Cheap read-only probe: do DE's tables exist? Never writes. */
  probeTables(): Promise<{ present: boolean; missing: string[] }>;
  listDealers(): Promise<DealerRow[]>;
  sweep(maxMinutes: number): Promise<number>;
  start(args: RunStartArgs): Promise<number>;
  writeUrls(runRowId: number, rows: RunUrlRow[]): Promise<void>;
  finish(runRowId: number, args: RunFinishArgs): Promise<void>;
}
