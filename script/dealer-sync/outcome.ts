/**
 * Outcome rules from DE data spec §2 ("Outcome rules SE's adapters must follow").
 * Pure functions so they can be unit-tested without a database or any network.
 */
import type { ErrorCause, FetchGroup, FetchResult, RunFinishArgs, RunOutcome, SiteCountSource } from "./types";
import { BLOCKED_CAUSES } from "./types";

/** Thrown by adapters for a failed fetch. Messages must never contain secrets or full query strings. */
export class FetchError extends Error {
  constructor(
    message: string,
    public readonly cause: ErrorCause,
    public readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

/** Map an HTTP status to DE's error causes. 402 stays "antibot" per DE's seed (Pooler question open, DE §5 Q2). */
export function causeForHttpStatus(status: number): ErrorCause {
  if (status === 401 || status === 402 || status === 403) return "blocked_antibot";
  if (status === 429) return "blocked_rate_limited";
  return "http_error";
}

export function outcomeForCause(cause: ErrorCause): RunOutcome {
  if (BLOCKED_CAUSES.has(cause)) return "blocked";
  if (cause === "pagination_incomplete" || cause === "location_split_unknown") return "partial";
  return "failed";
}

export function classifyError(err: unknown): { cause: ErrorCause; httpStatus: number | null; message: string } {
  if (err instanceof FetchError) return { cause: err.cause, httpStatus: err.httpStatus, message: err.message };
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return { cause: "adapter_exception", httpStatus: null, message };
}

/**
 * Per-sibling result for one group fetch.
 * - 0 URLs overall → failed/zero_urls (NEVER success, NEVER no_new).
 * - Shared feed with any untaggable item → partial/location_split_unknown.
 * - Adapter says incomplete → partial/pagination_incomplete.
 * - Sibling's tagged share is 0 → failed/zero_urls.
 * - fetched_count is counted AFTER location tagging, per dealer.
 */
export function siblingFinish(group: FetchGroup, dealerId: number, result: FetchResult): RunFinishArgs {
  const mine = result.items.filter((i) => i.dealerId === dealerId);
  const fetchedCount = mine.length;
  const sc = result.siteCounts?.get(dealerId);
  const siteCount: number | null = sc ? sc.count : null;
  const siteCountSource: SiteCountSource | null = sc ? sc.source : null;
  const base = { httpStatus: result.httpStatus, fetchedCount, siteCount, siteCountSource };

  if (result.items.length === 0) {
    return { ...base, outcome: "failed", errorCause: "zero_urls", message: "fetch returned 0 inventory URLs" };
  }
  const shared = group.fetchGroup !== null;
  const untagged = result.items.filter((i) => i.dealerId === null).length;
  if (shared && untagged > 0) {
    return {
      ...base,
      outcome: "partial",
      errorCause: "location_split_unknown",
      message: `shared feed: ${untagged} of ${result.items.length} items could not be tagged to a location`,
    };
  }
  if (!result.complete) {
    return { ...base, outcome: "partial", errorCause: "pagination_incomplete", message: "adapter reported an incomplete fetch" };
  }
  if (fetchedCount === 0) {
    return { ...base, outcome: "failed", errorCause: "zero_urls", message: "0 inventory URLs tagged to this dealer" };
  }
  return { ...base, outcome: "success", errorCause: null, message: null };
}
