/**
 * Listing re-check runner (server-only; uses the secret-key admin client).
 * Small batches sized for one serverless invocation. All requests go through PoliteFetcher:
 * honest bot UA, robots Disallow + Crawl-delay honored, >= 10s per host, Retry-After honored,
 * auto-pause (dealer_block_log) on 401/402/403/429/challenge, circuit breaker on repeated errors.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase-admin";
import { parseEcoPrice } from "../sync/eco-golf-carts";
import { extractListingPrice } from "../sync/price-extract";
import {
  isAutoArchiveExcluded, classifyResponse, nextState,
  computeQuality, type CheckResult, type DQListing,
} from "./core";
import { PoliteFetcher, type BlockKind } from "../sync/polite-fetch";
import { loadActiveBlocks, recordHostBlock, type HostBlock } from "../sync/dealer-blocks";

export interface RecheckOptions {
  dryRun?: boolean;
  limit?: number;            // max listings this invocation
  timeBudgetMs?: number;     // stop starting new fetches after this
  dealerSlugs?: string[];    // restrict to dealers (admin "Refresh now")
  notRecheckedSince?: string; // ISO; only listings not re-checked since (job pass)
  sleepImpl?: (ms: number) => Promise<void>; // tests
  minIntervalMs?: number;     // tests only; production uses the 10s floor
  fetchImpl?: typeof fetch;
  db?: SupabaseClient;
}
export interface RecheckItem { id: number; dealer: string | null; url: string; prevFails: number; result: CheckResult;
  action: "touch" | "mark_dead_1" | "archive" | "needs_review" | "none"; priceUpdate?: { from: number | null; to: number } }
export interface RecheckSummary { dryRun: boolean; selected: number; processed: number; alive: number; dead_pending: number;
  archived: number; needs_review: number; errors: number; price_updates: number; stopped_early: boolean;
  paused_dealers_skipped: number; host_blocks: HostBlock[]; items: RecheckItem[] }

/** Existing per-dealer price parsers that work without a browser. Others: liveness only. */
export const PRICE_ADAPTERS: { host: RegExp; parse: (html: string) => number | null }[] = [
  { host: /(^|\.)ecogolfcarts\.com$/i, parse: parseEcoPrice },
  // Botero: shared extractor (#41) prefers Sale/Our Price over Original/Regular, never MSRP or monthly.
  { host: /(^|\.)boterocarts\.com$/i, parse: (html) => extractListingPrice(html).price },
];
export function priceFromDealerPage(url: string, html: string): number | null {
  let host = ""; try { host = new URL(url).host; } catch { return null; }
  const ad = PRICE_ADAPTERS.find(a => a.host.test(host));
  return ad ? ad.parse(html) : null;
}

/** Map a re-check action onto the legacy sync_log status vocabulary. */
export function syncLogStatus(it: Pick<RecheckItem, "action" | "priceUpdate">): "ok" | "price_mismatch" | "not_found" | "error" {
  if (it.action === "touch") return it.priceUpdate ? "price_mismatch" : "ok";
  if (it.action === "mark_dead_1" || it.action === "archive" || it.action === "needs_review") return "not_found";
  return "error";
}

import { extractListingAttrs } from "../sync/attr-extract";
import { buildAttrUpdate, applyAttrUpdate } from "../sync/attr-apply";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function runRecheck(opts: RecheckOptions = {}): Promise<RecheckSummary> {
  const db = opts.db ?? supabaseAdmin();
  const doFetch = opts.fetchImpl ?? fetch;
  const dryRun = opts.dryRun ?? false;
  const limit = Math.min(opts.limit ?? 40, 500);
  const deadline = Date.now() + (opts.timeBudgetMs ?? 45_000);

  const base = "id,sync_source,source_listing_url,source_url,asking_price,sale_price,regular_price,last_checked_at";
  const build = (withRecheckCols: boolean) => {
    let q = db.from("listings")
      .select(withRecheckCols ? base + ",recheck_fail_count,recheck_last_at" : base)
      .eq("status", "active").eq("public_listing", true)
      // ~590 active rows only have source_url (e.g. village-discount-golf-car).
      .or("source_listing_url.not.is.null,source_url.not.is.null")
      // Rolling queue: least-recently re-checked first (null = never re-checked).
      .order(withRecheckCols ? "recheck_last_at" : "last_checked_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (opts.dealerSlugs?.length) q = q.in("sync_source", opts.dealerSlugs);
    if (opts.notRecheckedSince && withRecheckCols) q = q.or(`recheck_last_at.is.null,recheck_last_at.lt.${opts.notRecheckedSince}`);
    return q;
  };
  let { data, error } = await build(true);
  // Before the migration is applied the recheck_* columns don't exist; allow DRY RUNS only.
  if (error && /recheck_/.test(error.message)) {
    if (!dryRun) throw new Error("listing recheck columns missing: apply migration 20261015_listing_recheck.sql");
    ({ data, error } = await build(false) as any);
  }
  if (error) throw new Error(`recheck select failed: ${error.message}`);
  // Auto-paused dealers (dealer_block_log, unresolved) are skipped entirely.
  const paused = await loadActiveBlocks(db);
  const allRows = ((data ?? []) as any[]).map(r => ({ ...r, source_listing_url: r.source_listing_url || r.source_url }));
  const rows = allRows.filter(r => !paused.has(String(r.sync_source)));

  // Group by host; hosts run in parallel, each host strictly sequential + spaced.
  const byHost = new Map<string, any[]>();
  for (const r of rows) {
    let host = "invalid"; try { host = new URL(r.source_listing_url).host.toLowerCase(); } catch {}
    (byHost.get(host) ?? byHost.set(host, []).get(host)!).push(r);
  }
  const summary: RecheckSummary = { dryRun, selected: rows.length, processed: 0, alive: 0, dead_pending: 0, archived: 0, needs_review: 0,
    errors: 0, price_updates: 0, stopped_early: false, paused_dealers_skipped: allRows.length - rows.length, host_blocks: [], items: [] };
  const pf = new PoliteFetcher({ fetchImpl: opts.fetchImpl, sleepImpl: opts.sleepImpl, minIntervalMs: opts.minIntervalMs });

  async function checkOne(r: any): Promise<RecheckItem & { block?: BlockKind; retryAfterMs?: number }> {
    const url: string = r.source_listing_url;
    const prevFails = Number(r.recheck_fail_count ?? 0);
    let result: CheckResult;
    let html = "";
    const res = await pf.get(url, { kind: "html" });
    if (res.block === "robots_disallow") result = { status: "blocked_robots", reason: "robots_disallow" };
    else if (res.block) result = { status: "error", reason: `blocked_${res.block}`, httpStatus: res.status };
    else if (res.error) result = { status: "error", reason: res.error };
    else { html = res.body; result = classifyResponse(url, res.status, res.finalUrl, html); }
    const st = nextState(prevFails, result);
    const excluded = isAutoArchiveExcluded(r.sync_source, url);
    if (excluded) st.archive = false; // never auto-archive excluded dealers
    const item: RecheckItem = { id: r.id, dealer: r.sync_source, url, prevFails, result,
      action: result.status === "alive" ? "touch" : (excluded && result.status === "dead") ? "needs_review"
        : st.archive ? "archive" : result.status === "dead" ? "mark_dead_1" : "none" };

    if (result.status === "alive" && html) {
      const p = priceFromDealerPage(url, html);
      const cur = r.sale_price ?? r.asking_price ?? r.regular_price ?? null;
      if (p && p !== cur) item.priceUpdate = { from: cur, to: p };
    }

    if (!dryRun) {
      const now = new Date().toISOString();
      const upd: Record<string, any> = { recheck_fail_count: st.failCount, recheck_last_status: result.status,
        recheck_last_reason: result.reason.slice(0, 200), recheck_last_at: now };
      if (st.touchLastChecked) upd.last_checked_at = now;
      if (st.archive) { upd.status = "archived"; upd.public_listing = false; upd.recheck_archived_at = now; }
      if (item.priceUpdate) {
        // Displayed price = sale_price ?? asking_price, so a stale sale_price must be overwritten too,
        // otherwise the page keeps the old price and the next pass re-detects the same mismatch.
        upd.asking_price = item.priceUpdate.to; if (r.sale_price != null) upd.sale_price = item.priceUpdate.to;
        upd.verified_at = now; upd.price_confidence = "confirmed";
      }
      const { error: uErr } = await db.from("listings").update(upd).eq("id", r.id);
      if (uErr) { item.result = { ...result, status: "error", reason: `db_update:${uErr.message}`.slice(0, 200) }; }
      // Legacy sync_log has CHECK (status IN ('ok','price_mismatch','not_found','error')), so the
      // re-check action is encoded in notes as "recheck:<action> | ...".
      const { error: lErr } = await db.from("sync_log").insert({
        listing_id: r.id, dealer_slug: r.sync_source ?? "unknown", source_url: url,
        price_found: item.priceUpdate?.to ?? null, price_changed: !!item.priceUpdate,
        status: syncLogStatus(item),
        notes: `recheck:${item.action} | ${item.action === "needs_review" ? "needs manual review (auto-archive excluded) | " : ""}${result.status}:${result.reason}`.slice(0, 500),
        synced_at: now,
      });
      if (lErr) console.warn(`[recheck] sync_log insert failed for listing ${r.id}: ${lErr.message}`);
      // Page-stated battery/warranty facts (main listing block only). Separate, tolerant write.
      if (result.status === "alive" && html) {
        try { await applyAttrUpdate(db, r.id, buildAttrUpdate(extractListingAttrs(html), url, now)); } catch { /* never fail the re-check */ }
      }
    }
    return res.block && res.block !== "robots_disallow" ? { ...item, block: res.block, retryAfterMs: res.retryAfterMs } : item;
  }

  await Promise.all(Array.from(byHost.entries()).map(async ([host, list]) => {
    if (host === "invalid") {
      for (const r of list) summary.items.push({ id: r.id, dealer: r.sync_source, url: r.source_listing_url, prevFails: 0,
        result: { status: "skipped", reason: "invalid_url" }, action: "none" });
      return;
    }
    for (let i = 0; i < list.length; i++) {
      if (Date.now() > deadline) { summary.stopped_early = true; return; }
      const it = await checkOne(list[i]);
      summary.items.push(it);
      if (it.block) {
        // Per-site cutoff: stop this host for the run and auto-pause its dealers.
        const dealers = Array.from(new Set(list.map(r => String(r.sync_source)).filter(Boolean)));
        summary.host_blocks.push({ host, dealers, kind: it.block, httpStatus: it.result.httpStatus ?? 0, url: it.url,
          pausedUntil: it.retryAfterMs ? new Date(Date.now() + it.retryAfterMs).toISOString() : null });
        return;
      }
      // Don't start a wait that would overrun the time budget.
      if (i + 1 < list.length && pf.nextAllowedAt(host) > deadline) { summary.stopped_early = true; return; }
    }
  }));

  if (!dryRun) for (const b of summary.host_blocks) await recordHostBlock(db, b);
  for (const it of summary.items) {
    summary.processed++;
    if (it.action === "touch") summary.alive++;
    else if (it.action === "mark_dead_1") summary.dead_pending++;
    else if (it.action === "archive") summary.archived++;
    else if (it.action === "needs_review") summary.needs_review++;
    else summary.errors++;
    if (it.priceUpdate) summary.price_updates++;
  }
  return summary;
}

// ── Background jobs (admin Refresh now / Refresh all stale) ──────────────────
/** Advance the oldest queued/running job by one batch. Returns the job after update, or null. */
export async function advanceJob(timeBudgetMs = 40_000, db: SupabaseClient = supabaseAdmin()) {
  const { data: job } = await db.from("recheck_jobs").select("*").in("status", ["queued", "running"])
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!job) return null;
  const startedAt = job.started_at ?? new Date().toISOString();
  if (job.status === "queued") {
    const cq = db.from("listings").select("id", { count: "exact", head: true })
      .eq("status", "active").eq("public_listing", true).or("source_listing_url.not.is.null,source_url.not.is.null").in("sync_source", job.dealer_slugs);
    const { count } = await cq;
    await db.from("recheck_jobs").update({ status: "running", started_at: startedAt, total: count ?? 0, updated_at: new Date().toISOString() }).eq("id", job.id);
  }
  try {
    // Only listings not checked since the job started → each listing visited once per job.
    const res = await runRecheck({ db, dryRun: job.dry_run, dealerSlugs: job.dealer_slugs, limit: 60, timeBudgetMs,
      notRecheckedSince: startedAt });
    const processed = job.processed + res.processed;
    const done = res.selected === 0 || processed >= (job.total || 0) || job.dry_run;
    const upd = { processed, alive: job.alive + res.alive, dead_pending: job.dead_pending + res.dead_pending + res.needs_review,
      archived: job.archived + res.archived, errors: job.errors + res.errors,
      status: done ? "done" : "running", finished_at: done ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
    await db.from("recheck_jobs").update(upd).eq("id", job.id);
    return { ...job, ...upd };
  } catch (e: any) {
    await db.from("recheck_jobs").update({ status: "failed", last_error: String(e?.message || e).slice(0, 500), finished_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
    throw e;
  }
}

// ── Data-quality report ───────────────────────────────────────────────────────
export async function fetchAllListingsForQuality(db: SupabaseClient = supabaseAdmin()): Promise<DQListing[]> {
  const cols = "id,sync_source,status,public_listing,asking_price,sale_price,regular_price,price_confidence,cartiq_estimated_value,valuation_confidence,brand,model,year,condition,seating,last_checked_at,source_listing_url,recheck_fail_count";
  const out: DQListing[] = [];
  for (let from = 0; from < 100_000; from += 1000) {
    let { data, error } = await db.from("listings").select(cols).eq("status", "active").eq("public_listing", true).order("id").range(from, from + 999);
    if (error && /recheck_fail_count/.test(error.message)) {
      ({ data, error } = await db.from("listings").select(cols.replace(",recheck_fail_count", "")).eq("status", "active").eq("public_listing", true).order("id").range(from, from + 999) as any);
    }
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as any));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function buildQualityReport(opts: { persist: boolean; db?: SupabaseClient }) {
  const db = opts.db ?? supabaseAdmin();
  const rows = await fetchAllListingsForQuality(db);
  const report = computeQuality(rows);
  if (opts.persist) {
    const { error } = await db.from("data_quality_reports").insert({ totals: report.totals, by_dealer: report.by_dealer });
    if (error) throw new Error(`data_quality_reports insert failed: ${error.message}`);
  }
  return report;
}
