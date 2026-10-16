/**
 * RunStore backed by Supabase (PostgREST), service_role ONLY, and ONLY after G2 rotation.
 * Every write goes to DE's run objects: dealer_sync_run_start / dealer_sync_run_finish /
 * dealer_sync_runs_sweep (RPC) and dealer_sync_run_urls (insert). No listings writes.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DealerRow, RunFinishArgs, RunStartArgs, RunStore, RunUrlRow } from "./types";

/** DE objects the runner needs. If any is absent → SKIPPED_NO_TABLES (no writes). */
export const REQUIRED_TABLES = ["dealer_sync_runs", "dealer_sync_run_urls", "dealer_sync_error_causes"] as const;

/** PostgREST / Postgres codes meaning "relation does not exist". */
const MISSING_CODES = new Set(["PGRST205", "42P01"]);

export class SupabaseRunStore implements RunStore {
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  async probeTables(): Promise<{ present: boolean; missing: string[] }> {
    const missing: string[] = [];
    for (const table of REQUIRED_TABLES) {
      // HEAD request, LIMIT 1: read-only, returns no rows.
      const { error } = await this.db.from(table).select("*", { head: true }).limit(1);
      if (!error) continue;
      if (MISSING_CODES.has(error.code ?? "")) missing.push(table);
      else throw new Error(`probe ${table} failed: ${error.code ?? "?"} ${error.message}`);
    }
    return { present: missing.length === 0, missing };
  }

  async listDealers(): Promise<DealerRow[]> {
    const { data, error } = await this.db
      .from("dealers")
      .select("id, slug, adapter_key, sync_enabled")
      .eq("sync_enabled", true)
      .order("id");
    if (error) throw new Error(`list dealers failed: ${error.code ?? "?"} ${error.message}`);
    return (data ?? []) as DealerRow[];
  }

  async sweep(maxMinutes: number): Promise<number> {
    const { data, error } = await this.db.rpc("dealer_sync_runs_sweep", { p_max_minutes: maxMinutes });
    if (error) throw new Error(`sweep failed: ${error.code ?? "?"} ${error.message}`);
    return Number(data ?? 0);
  }

  async start(a: RunStartArgs): Promise<number> {
    const { data, error } = await this.db.rpc("dealer_sync_run_start", {
      p_run_id: a.runId,
      p_dealer_id: a.dealerId,
      p_runner: a.runner,
      p_parser_version: a.parserVersion,
      p_adapter_key: a.adapterKey,
      p_fetch_group: a.fetchGroup,
    });
    if (error) throw new Error(`run_start failed: ${error.code ?? "?"} ${error.message}`);
    return Number(data);
  }

  async writeUrls(runRowId: number, rows: RunUrlRow[]): Promise<void> {
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({ run_row_id: runRowId, ...r }));
      const { error } = await this.db.from("dealer_sync_run_urls").insert(chunk);
      if (error) throw new Error(`run_urls insert failed: ${error.code ?? "?"} ${error.message}`);
    }
  }

  async finish(runRowId: number, f: RunFinishArgs): Promise<void> {
    const { error } = await this.db.rpc("dealer_sync_run_finish", {
      p_id: runRowId,
      p_outcome: f.outcome,
      p_http_status: f.httpStatus,
      p_fetched_count: f.fetchedCount,
      p_site_count: f.siteCount,
      p_site_count_source: f.siteCountSource,
      p_error_cause: f.errorCause,
      p_message: f.message,
      // This draft never queues, promotes or archives: leave those counters NULL (not 0) = "not done by this runner".
      p_new_queued: null,
      p_promoted_count: null,
      p_archived_count: null,
      p_listed_count: null,
      p_notes: null,
    });
    if (error) throw new Error(`run_finish failed: ${error.code ?? "?"} ${error.message}`);
  }
}
