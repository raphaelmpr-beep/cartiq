/**
 * Runner: per fetch group → start a run row per sibling BEFORE the fetch, fetch once,
 * write the seen-URL set per sibling, finish every row in `finally`.
 *
 * Writes ONLY DE's run tables via RunStore. Never touches listings / pending_imports.
 * TODO(Spec 3): promote (pending_imports → listings with dealer_id set) — NOT in this draft.
 * TODO(Spec 3 / G3): archive/sold via dealer_sync_apply_removals only — NOT in this draft.
 * TODO(Spec 4): dealer_sync_daily_snapshot() + alerts/dead-man switch — NOT in this draft.
 */
import { classifyError, outcomeForCause, siblingFinish } from "./outcome";
import { log } from "./redact";
import { gcqUrlNorm } from "./url-norm";
import type { DealerFetcher, FetchGroup, FetchResult, RunFinishArgs, RunStore, RunUrlRow } from "./types";

export const RUNNER_NAME = "gha-dealer-sync";

export interface RunnerOptions {
  runId: string;
  gitSha: string;
  fetchers: ReadonlyMap<string, DealerFetcher>;
  concurrency?: number;
}

export interface GroupSummary {
  adapterKey: string;
  fetchGroup: string | null;
  rows: { dealerId: number; runRowId: number; outcome: string; errorCause: string | null; fetchedCount: number | null }[];
}

function urlRowsFor(dealerId: number, result: FetchResult): RunUrlRow[] {
  const seen = new Map<string, RunUrlRow>();
  for (const item of result.items) {
    if (item.dealerId !== dealerId) continue;
    const norm = gcqUrlNorm(item.url);
    if (!norm || seen.has(norm)) continue;
    seen.set(norm, { url_norm: norm, url_raw: item.url, image_url: item.imageUrl ?? null });
  }
  return Array.from(seen.values());
}

export async function runGroup(store: RunStore, group: FetchGroup, opts: RunnerOptions): Promise<GroupSummary> {
  const fetcher = opts.fetchers.get(group.adapterKey);
  const parserVersion = `${opts.gitSha.slice(0, 7)}/${group.adapterKey}@${fetcher?.version ?? "none"}`;

  // 1. start a row per sibling BEFORE fetching, so a crash is visible (sweeper → failed/abandoned).
  const started: { dealerId: number; runRowId: number }[] = [];
  for (const d of group.dealers) {
    const runRowId = await store.start({
      runId: opts.runId,
      dealerId: d.id,
      runner: RUNNER_NAME,
      parserVersion,
      adapterKey: group.adapterKey,
      fetchGroup: group.fetchGroup,
    });
    started.push({ dealerId: d.id, runRowId });
  }

  const finishes = new Map<number, RunFinishArgs>();
  let result: FetchResult | null = null;
  try {
    if (!fetcher) {
      for (const s of started) {
        finishes.set(s.dealerId, {
          outcome: "failed", httpStatus: null, fetchedCount: null, siteCount: null, siteCountSource: null,
          errorCause: "not_configured", message: `no fetcher registered for adapter '${group.adapterKey}'`,
        });
      }
    } else {
      result = await fetcher.fetch(group);
      // Solo dealer: an untagged item can only belong to that dealer.
      if (group.fetchGroup === null && group.dealers.length === 1) {
        const only = group.dealers[0].id;
        result = { ...result, items: result.items.map((i) => (i.dealerId === null ? { ...i, dealerId: only } : i)) };
      }
      for (const s of started) finishes.set(s.dealerId, siblingFinish(group, s.dealerId, result));
    }
  } catch (err) {
    const c = classifyError(err);
    for (const s of started) {
      finishes.set(s.dealerId, {
        outcome: outcomeForCause(c.cause), httpStatus: c.httpStatus, fetchedCount: null, siteCount: null,
        siteCountSource: null, errorCause: c.cause, message: c.message,
      });
    }
  } finally {
    // 2. seen-URL set (before finish), then 3. finish every started row exactly once.
    for (const s of started) {
      let fin = finishes.get(s.dealerId) ?? {
        outcome: "failed" as const, httpStatus: null, fetchedCount: null, siteCount: null, siteCountSource: null,
        errorCause: "adapter_exception" as const, message: "runner exited before a result was recorded",
      };
      if (result && (fin.outcome === "success" || fin.outcome === "partial")) {
        try {
          await store.writeUrls(s.runRowId, urlRowsFor(s.dealerId, result));
        } catch (err) {
          fin = { ...fin, outcome: "failed", errorCause: "db_error", message: `seen-URL write failed: ${classifyError(err).message}` };
        }
      }
      try {
        await store.finish(s.runRowId, fin);
      } catch (err) {
        // Leave the row in flight; dealer_sync_runs_sweep() closes it as failed/abandoned.
        log("finish_failed", { runRowId: s.runRowId, dealerId: s.dealerId, error: classifyError(err).message });
      }
      finishes.set(s.dealerId, fin);
    }
  }

  return {
    adapterKey: group.adapterKey,
    fetchGroup: group.fetchGroup,
    rows: started.map((s) => {
      const f = finishes.get(s.dealerId)!;
      return { ...s, outcome: f.outcome, errorCause: f.errorCause, fetchedCount: f.fetchedCount };
    }),
  };
}

export async function runAll(store: RunStore, groups: FetchGroup[], opts: RunnerOptions): Promise<GroupSummary[]> {
  const limit = Math.max(1, opts.concurrency ?? 4);
  const out: GroupSummary[] = new Array(groups.length);
  let next = 0;
  async function worker() {
    while (next < groups.length) {
      const i = next++;
      out[i] = await runGroup(store, groups[i], opts);
      log("group_done", { adapter: out[i].adapterKey, fetchGroup: out[i].fetchGroup, rows: out[i].rows });
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, groups.length) }, worker));
  return out;
}
