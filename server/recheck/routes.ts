import type { Express, RequestHandler } from "express";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "../supabase-admin";
import { runRecheck, advanceJob, buildQualityReport, fetchAllListingsForQuality } from "./runner";
import { computeQuality, dealerHealth, outlierIds, listingPrice } from "./core";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Fail closed if unset. */
export const requireCronSecret: RequestHandler = (req, res, next) => {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return res.status(503).json({ error: "CRON_SECRET not configured" });
  const got = String(req.headers.authorization || "");
  const want = `Bearer ${secret}`;
  if (got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want))) return next();
  return res.status(401).json({ error: "Unauthorized" });
};

export function registerRecheckRoutes(app: Express, requireAdmin: RequestHandler) {
  // ── Cron ────────────────────────────────────────────────────────────────────
  // Every 10 min: first advance a queued admin job, otherwise one rolling batch.
  app.get("/api/cron/recheck", requireCronSecret, async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const job = await advanceJob(40_000);
      if (job) return res.json({ mode: "job", job });
      const s = await runRecheck({ limit: 40, timeBudgetMs: 45_000 });
      const { items, ...counts } = s;
      res.json({ mode: "rolling", ...counts });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/cron/data-quality", requireCronSecret, async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try { const r = await buildQualityReport({ persist: true }); res.json({ ok: true, totals: r.totals }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Admin ───────────────────────────────────────────────────────────────────
  app.get("/api/admin/dealer-health", requireAdmin, async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const db = supabaseAdmin();
      const [rows, dealersRes, jobsRes, errLogRes] = await Promise.all([
        fetchAllListingsForQuality(db),
        db.from("dealers").select("slug,name,state,city,adapter_key,platform_type,sync_enabled,inventory_status,last_discovery_at,last_discovery_status,last_discovery_message").order("name"),
        db.from("recheck_jobs").select("*").order("created_at", { ascending: false }).limit(200),
        db.from("sync_log").select("dealer_slug,status,notes,synced_at").like("notes", "recheck:%").order("synced_at", { ascending: false }).limit(2000),
      ]);
      const q = computeQuality(rows);
      const byDealer = new Map(q.by_dealer.map(d => [d.dealer, d]));
      const jobs = jobsRes.error ? [] : (jobsRes.data ?? []);
      const lastRecheck = new Map<string, string>();
      for (const l of errLogRes.data ?? []) if (l.dealer_slug && !lastRecheck.has(l.dealer_slug) && !String(l.notes ?? "").startsWith("recheck:none")) lastRecheck.set(l.dealer_slug, l.synced_at);
      const dealers = (dealersRes.data ?? []).map((d: any) => {
        const c = byDealer.get(d.slug) ?? { active: 0, stale_7d: 0, stale_30d: 0, never_checked: 0, dead_pending: 0, missing_price: 0, outliers: 0, duplicates: 0 };
        const lastJob = jobs.find((j: any) => (j.dealer_slugs ?? []).includes(d.slug));
        const syncErr = d.last_discovery_status === "error" ? (d.last_discovery_message || "sync error") : null;
        const lastOk = [d.last_discovery_status === "ok" ? d.last_discovery_at : null, lastRecheck.get(d.slug) ?? null]
          .filter(Boolean).sort().pop() ?? null;
        return {
          slug: d.slug, name: d.name, state: d.state, city: d.city,
          adapter: d.adapter_key || d.platform_type || null, sync_enabled: !!d.sync_enabled, status: d.inventory_status ?? null,
          ...c, pct_stale: c.active ? Math.round((c.stale_7d / c.active) * 100) : 0,
          last_successful_sync: lastOk, error: syncErr, health: dealerHealth(c, syncErr),
          last_job: lastJob ? { id: lastJob.id, status: lastJob.status, processed: lastJob.processed, total: lastJob.total,
            archived: lastJob.archived, dead_pending: lastJob.dead_pending, errors: lastJob.errors, finished_at: lastJob.finished_at, dry_run: lastJob.dry_run } : null,
        };
      });
      res.json({ totals: q.totals, dealers, jobs_available: !jobsRes.error });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/dealer-health/:slug/listings", requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const all = await fetchAllListingsForQuality();
      const outs = outlierIds(all);
      const urls = new Map<string, number>();
      for (const l of all) if (l.source_listing_url) urls.set(l.source_listing_url, (urls.get(l.source_listing_url) ?? 0) + 1);
      const now = Date.now();
      const items = all.filter(l => l.sync_source === req.params.slug).map(l => {
        const age = l.last_checked_at ? Math.floor((now - Date.parse(l.last_checked_at)) / 86400000) : null;
        const flags: string[] = [];
        if (age == null) flags.push("never_checked"); else if (age > 30) flags.push("stale_30d"); else if (age > 7) flags.push("stale_7d");
        if ((l.recheck_fail_count ?? 0) > 0) flags.push("dead_pending");
        if (!listingPrice(l)) flags.push("missing_price");
        if (outs.has(l.id)) flags.push("price_outlier");
        if (l.source_listing_url && (urls.get(l.source_listing_url) ?? 0) > 1) flags.push("duplicate_url");
        return { id: l.id, title: [l.year, l.brand, l.model].filter(Boolean).join(" ") || `#${l.id}`, price: listingPrice(l),
          condition: l.condition, last_checked_at: l.last_checked_at, age_days: age, source_url: l.source_listing_url, flags };
      });
      res.json({ dealer: req.params.slug, items });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Queue a background refresh. Body: { dealer_slugs?: string[], scope?: "dealer"|"stale_dealers", dry_run?: boolean }
  app.post("/api/admin/recheck/jobs", requireAdmin, async (req, res) => {
    try {
      const db = supabaseAdmin();
      const scope = req.body?.scope === "stale_dealers" ? "stale_dealers" : "dealer";
      let slugs: string[] = Array.isArray(req.body?.dealer_slugs) ? req.body.dealer_slugs.map(String).slice(0, 200) : [];
      if (scope === "stale_dealers") {
        const q = computeQuality(await fetchAllListingsForQuality(db));
        slugs = q.by_dealer.filter(d => dealerHealth(d) !== "Fresh" && d.dealer !== "(none)").map(d => d.dealer);
      }
      if (!slugs.length) return res.status(400).json({ error: "No dealers selected" });
      const { data, error } = await db.from("recheck_jobs").insert({ scope, dealer_slugs: slugs, dry_run: !!req.body?.dry_run, requested_by: "admin" }).select().single();
      if (error) return res.status(error.code === "42P01" || error.code === "PGRST205" ? 501 : 500).json({ error: error.message });
      res.json(data);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/recheck/jobs", requireAdmin, async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const { data, error } = await supabaseAdmin().from("recheck_jobs").select("*").order("created_at", { ascending: false }).limit(25);
    if (error) return res.status(501).json({ error: error.message, jobs: [] });
    res.json({ jobs: data });
  });

  // Run one batch of the oldest queued job now (progress without waiting for cron).
  app.post("/api/admin/recheck/advance", requireAdmin, async (_req, res) => {
    try { res.json({ job: await advanceJob(40_000) }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Dry run: fetch + classify, no writes. Body: { dealer_slugs?: string[], limit?: number }
  app.post("/api/admin/recheck/dry-run", requireAdmin, async (req, res) => {
    try {
      const s = await runRecheck({ dryRun: true, limit: Math.min(Number(req.body?.limit) || 20, 60), timeBudgetMs: 45_000,
        dealerSlugs: Array.isArray(req.body?.dealer_slugs) ? req.body.dealer_slugs.map(String) : undefined });
      res.json(s);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get("/api/admin/data-quality", requireAdmin, async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const { data, error } = await supabaseAdmin().from("data_quality_reports").select("id,created_at,totals").order("created_at", { ascending: false }).limit(30);
    if (error) return res.status(501).json({ error: error.message, reports: [] });
    res.json({ reports: data });
  });
}
