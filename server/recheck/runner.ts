/**
 * Listing re-check runner (server-only; uses the secret-key admin client).
 * Small batches sized for one serverless invocation. Polite: honest UA,
 * robots.txt respected, >= PER_HOST_INTERVAL_MS between requests per host.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabase-admin";
import { parseEcoPrice } from "../sync/eco-golf-carts";
import {
  RECHECK_UA, PER_HOST_INTERVAL_MS, isAutoArchiveExcluded, classifyResponse, nextState, parseRobots, robotsAllows,
  computeQuality, type CheckResult, type DQListing,
} from "./core";

export interface RecheckOptions {
  dryRun?: boolean;
  limit?: number;            // max listings this invocation
  timeBudgetMs?: number;     // stop starting new fetches after this
  dealerSlugs?: string[];    // restrict to dealers (admin "Refresh now")
  notRecheckedSince?: string; // ISO; only listings not re-checked since (job pass)
  fetchImpl?: typeof fetch;
  db?: SupabaseClient;
}
export interface RecheckItem { id: number; dealer: string | null; url: string; prevFails: number; result: CheckResult;
  action: "touch" | "mark_dead_1" | "archive" | "needs_review" | "none"; priceUpdate?: { from: number | null; to: number } }
export interface RecheckSummary { dryRun: boolean; selected: number; processed: number; alive: number; dead_pending: number;
  archived: number; needs_review: number; errors: number; price_updates: number; stopped_early: boolean; items: RecheckItem[] }

/** Existing per-dealer price parsers that work without a browser. Others: liveness only. */
const PRICE_ADAPTERS: { host: RegExp; parse: (html: string) => number | null }[] = [
  { host: /(^|\.)ecogolfcarts\.com$/i, parse: parseEcoPrice },
];

/** Map a re-check action onto the legacy sync_log status vocabulary. */
export function syncLogStatus(it: Pick<RecheckItem, "action" | "priceUpdate">): "ok" | "price_mismatch" | "not_found" | "error" {
  if (it.action === "touch") return it.priceUpdate ? "price_mismatch" : "ok";
  if (it.action === "mark_dead_1" || it.action === "archive" || it.action === "needs_review") return "not_found";
  return "error";
}

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
  const rows = ((data ?? []) as any[]).map(r => ({ ...r, source_listing_url: r.source_listing_url || r.source_url }));

  // Group by host; hosts run in parallel, each host strictly sequential + spaced.
  const byHost = new Map<string, any[]>();
  for (const r of rows) {
    let host = "invalid"; try { host = new URL(r.source_listing_url).host.toLowerCase(); } catch {}
    (byHost.get(host) ?? byHost.set(host, []).get(host)!).push(r);
  }
  const summary: RecheckSummary = { dryRun, selected: rows.length, processed: 0, alive: 0, dead_pending: 0, archived: 0, needs_review: 0,
    errors: 0, price_updates: 0, stopped_early: false, items: [] };

  async function robotsFor(origin: string): Promise<string[] | "unreachable"> {
    try {
      const r = await doFetch(origin + "/robots.txt", { headers: { "User-Agent": RECHECK_UA }, redirect: "follow", signal: AbortSignal.timeout(8000) });
      if (r.status >= 400 && r.status < 500) return []; // no robots.txt → allowed
      if (!r.ok) return "unreachable";
      return parseRobots((await r.text()).slice(0, 200_000));
    } catch { return "unreachable"; }
  }

  async function checkOne(r: any, disallow: string[] | "unreachable"): Promise<RecheckItem> {
    const url: string = r.source_listing_url;
    const prevFails = Number(r.recheck_fail_count ?? 0);
    let result: CheckResult;
    let html = "";
    if (disallow === "unreachable") result = { status: "error", reason: "robots_unreachable" };
    else if (!robotsAllows(disallow, new URL(url).pathname)) result = { status: "blocked_robots", reason: "robots_disallow" };
    else {
      try {
        const res = await doFetch(url, { headers: { "User-Agent": RECHECK_UA, Accept: "text/html,*/*;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
        html = res.ok ? (await res.text()).slice(0, 1_500_000) : "";
        result = classifyResponse(url, res.status, res.url || url, html);
      } catch (e: any) { result = { status: "error", reason: `fetch_error:${String(e?.name || e).slice(0, 40)}` }; }
    }
    const st = nextState(prevFails, result);
    const excluded = isAutoArchiveExcluded(r.sync_source, url);
    if (excluded) st.archive = false; // never auto-archive excluded dealers
    const item: RecheckItem = { id: r.id, dealer: r.sync_source, url, prevFails, result,
      action: result.status === "alive" ? "touch" : (excluded && result.status === "dead") ? "needs_review"
        : st.archive ? "archive" : result.status === "dead" ? "mark_dead_1" : "none" };

    if (result.status === "alive" && html) {
      const host = new URL(url).host;
      const ad = PRICE_ADAPTERS.find(a => a.host.test(host));
      const p = ad ? ad.parse(html) : null;
      const cur = r.sale_price ?? r.asking_price ?? r.regular_price ?? null;
      if (p && p !== cur) item.priceUpdate = { from: cur, to: p };
    }

    if (!dryRun) {
      const now = new Date().toISOString();
      const upd: Record<string, any> = { recheck_fail_count: st.failCount, recheck_last_status: result.status,
        recheck_last_reason: result.reason.slice(0, 200), recheck_last_at: now };
      if (st.touchLastChecked) upd.last_checked_at = now;
      if (st.archive) { upd.status = "archived"; upd.public_listing = false; upd.recheck_archived_at = now; }
      if (item.priceUpdate) { upd.asking_price = item.priceUpdate.to; upd.verified_at = now; upd.price_confidence = "confirmed"; }
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
    }
    return item;
  }

  await Promise.all(Array.from(byHost.entries()).map(async ([host, list]) => {
    if (host === "invalid") {
      for (const r of list) summary.items.push({ id: r.id, dealer: r.sync_source, url: r.source_listing_url, prevFails: 0,
        result: { status: "skipped", reason: "invalid_url" }, action: "none" });
      return;
    }
    const origin = new URL(list[0].source_listing_url).origin;
    const disallow = await robotsFor(origin);
    for (let i = 0; i < list.length; i++) {
      if (Date.now() > deadline) { summary.stopped_early = true; return; }
      if (i > 0) await sleep(PER_HOST_INTERVAL_MS);
      summary.items.push(await checkOne(list[i], disallow));
    }
  }));

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
  const cols = "id,sync_source,status,public_listing,asking_price,sale_price,regular_price,brand,model,year,condition,seating,last_checked_at,source_listing_url,recheck_fail_count";
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
