// Lead tracking routes (DRAFT). Registered ONLY when LEAD_TRACKING_ENABLED is on.
// With the flag off this function returns before touching the app, so no route,
// middleware or DB client exists and /api/leads/* falls through to today's 404.
import type { Express, Request, Response, RequestHandler } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  parseFlag, isBotUserAgent, validateEvent, validateLead, Deduper,
  LEAD_CONSENT_TEXT, MONTH_RE, volumeAlert, LEAD_DEDUPE_MS,
} from "@shared/leadTracking";
import type { LeadsStore } from "./store";
import { logNotifier, type Notifier } from "./notifier";
import { rejectQueryTokens } from "./admin-auth";

export interface LeadRouteOptions {
  enabled?: boolean;
  store: () => LeadsStore; // lazy so nothing connects at registration time
  now?: () => number;
  ipSalt?: string;
  cronSecret?: string;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
  /** Alert sink for the volume monitor. Default: structured LEAD_VOLUME_ALERT log line. */
  notifier?: Notifier;
  /** How long a lead_tracking_paused read is cached (ms). Default 30 s. */
  pausedCacheMs?: number;
  /** Fixture mode only: force the 429 response so the UI state can be shown. */
  forceRateLimit?: () => boolean;
  /** Fixture mode only: add `fixtureBlocked` to silent-block responses. */
  exposeBlockReason?: boolean;
  onBlocked?: (reason: string) => void;
  /** Fixture mode only: simulate a missing LEAD_IP_SALT without a restart. */
  simulateSaltMissing?: () => boolean;
}

/** Rate-limit rules. Counters live in Postgres (lead_rate_limits) via the store. */
export const LIMITS = {
  eventsPerIp:     { scope: "ev_ip",      windowMs: 60_000,           limit: 120 },
  leadsPerIp:      { scope: "lead_ip",    windowMs: 60 * 60_000,      limit: 5 },
  // (lead_ip_listing removed: "same person, same cart within 10 min" is now handled by
  //  the contact-hash duplicate check, which returns the original success instead of 429.)
  leadsPerListing: { scope: "lead_listing", windowMs: 24 * 60 * 60_000, limit: 20 },
} as const;

export const MIN_SECRET_LEN = 16;
export const LEADS_PAGE_SIZE = 50;

export function clientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  const first = (Array.isArray(xff) ? xff[0] : xff ?? "").split(",")[0].trim();
  return first || req.socket?.remoteAddress || "unknown";
}

function safeEq(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function registerLeadRoutes(app: Express, requireAdmin: RequestHandler, opts: LeadRouteOptions): boolean {
  const enabled = opts.enabled ?? parseFlag(process.env.LEAD_TRACKING_ENABLED);
  if (!enabled) return false;
  const now = opts.now ?? Date.now;
  const log = opts.log ?? ((msg, meta) => console.warn(`[leads] ${msg}`, meta ?? ""));
  // LEAD_IP_SALT is required (>= 16 chars). Missing/short = lead tracking OFF (fail
  // closed, like the pause switch). No random fallback: a per-instance salt would break
  // cross-instance duplicate detection and make hashes unstable. Values are never logged.
  const rawSalt = opts.ipSalt ?? process.env.LEAD_IP_SALT;
  const saltConfigured = typeof rawSalt === "string" && rawSalt.length >= MIN_SECRET_LEN;
  const salt = saltConfigured ? rawSalt! : "";
  const saltOk = () => saltConfigured && !opts.simulateSaltMissing?.();
  const hashIp = (ip: string) => createHash("sha256").update(salt + ip).digest("hex").slice(0, 32);
  // CRON_SECRET: missing/short = the bearer path is disabled (admin token still works).
  const rawCron = opts.cronSecret ?? process.env.CRON_SECRET;
  const cronSecret = typeof rawCron === "string" && rawCron.length >= MIN_SECRET_LEN ? rawCron : undefined;
  let lastConfigLog = -Infinity;
  const configError = (what: string) => {
    if (now() - lastConfigLog < 60_000) return; // rate-limited: at most one line per minute
    lastConfigLog = now();
    console.error(`LEAD_CONFIG_ERROR ${JSON.stringify({ problem: what, effect: "lead tracking off" })}`);
  };
  // Contact hash for duplicate detection (same listing + same email/phone within 10 min).
  // Salted like the IP hash; set LEAD_IP_SALT so it is stable across instances.
  const contactHash = (email: string | null, phone: string | null) =>
    createHash("sha256").update(`${salt}|c|${email ?? ""}|${phone ?? ""}`).digest("hex").slice(0, 32);

  // Dedupe stays in memory: it only drops repeat views/double clicks (a miss just
  // records one extra view); it is not an abuse control.
  const viewDedupe = new Deduper(30 * 60_000);
  const clickDedupe = new Deduper(10_000);

  let _store: LeadsStore | null = null;
  const getStore = () => (_store ??= opts.store());
  const noindex = (res: Response) => res.setHeader("X-Robots-Tag", "noindex");
  const notify = opts.notifier ?? logNotifier();
  const pausedCacheMs = opts.pausedCacheMs ?? 30_000;

  // Runtime gate: tracking is ON only if the env flag is on (checked above) AND the
  // lead_tracking_paused row reads paused=false. A failed read fails CLOSED (off).
  let gate: { active: boolean; at: number } | null = null;
  async function isActive(): Promise<boolean> {
    if (!saltOk()) { configError("LEAD_IP_SALT missing or shorter than 16 chars"); return false; }
    if (gate && now() - gate.at < pausedCacheMs) return gate.active;
    let active = false;
    try {
      active = !(await getStore().getPaused()).paused;
    } catch (err: any) {
      log("lead_tracking_paused read failed; failing closed", { error: String(err?.message ?? err).slice(0, 200) });
    }
    gate = { active, at: now() };
    return active;
  }
  let lastPausedLog = -Infinity;
  const logPausedSkip = (what: string) => {
    if (now() - lastPausedLog < 60_000) return; // at most one error line per minute
    lastPausedLog = now();
    console.error(`[leads] ERROR lead tracking paused or unverifiable; ${what} not written`);
  };

  const hit = (rule: { scope: string; windowMs: number; limit: number }, key: string) =>
    getStore().hitRateLimit(rule.scope, key, rule.windowMs, rule.limit, now());

  // Runtime UI flag: the client asks this before showing the form or sending events.
  app.get("/api/leads/status", async (_req, res) => {
    noindex(res);
    res.setHeader("Cache-Control", "no-store");
    res.json({ enabled: await isActive() });
  });

  // Events: fire-and-forget. Always 204 so the beacon never retries or surfaces
  // errors. Any failure (DB down, bad input) is dropped and logged without PII.
  app.post("/api/leads/event", async (req, res) => {
    noindex(res);
    res.status(204).end();
    try {
      if (isBotUserAgent(req.get("user-agent"))) return;
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const v = validateEvent(body);
      if (!v.ok) return;
      const e = v.value;
      const key = `${e.sessionId}:${e.listingId}:${e.eventType}`;
      const fresh = e.eventType === "listing_view" ? viewDedupe.check(key, now()) : clickDedupe.check(key, now());
      if (!fresh) return;
      if (!(await isActive())) { logPausedSkip("event"); return; }
      if (!(await hit(LIMITS.eventsPerIp, hashIp(clientIp(req))))) return;
      const store = getStore();
      const ref = await store.getPublicListing(e.listingId);
      if (!ref) return;
      // dealer_id comes from the DB, not the client, so it can't be spoofed.
      await store.insertEvent({ ...e, dealerId: ref.dealerId });
    } catch (err: any) {
      log("event write dropped", { error: String(err?.message ?? err).slice(0, 200) });
    }
  });

  app.post("/api/leads/quote", async (req, res) => {
    noindex(res);
    // 1st filter (cheap, no DB): honeypot + min fill time + format validation.
    const v = validateLead(req.body, now());
    if (!v.ok) {
      if (v.silent) {
        // Pretend success so bots learn nothing; store nothing.
        const reason = v.error === "too_fast" ? "min-fill" : v.error;
        opts.onBlocked?.(reason);
        return res.status(200).json(opts.exposeBlockReason ? { ok: true, fixtureBlocked: reason } : { ok: true });
      }
      return res.status(400).json({ error: v.error });
    }
    const lead = v.value;
    try {
      if (!(await isActive())) {
        logPausedSkip("lead");
        return res.status(503).json({ error: "temporarily_unavailable" });
      }
      if (opts.forceRateLimit?.()) return res.status(429).json({ error: "rate_limited" });
      const store = getStore();
      const ref = await store.getPublicListing(lead.listingId);
      if (!ref) return res.status(404).json({ error: "listing_unavailable" });
      // Leads go to GolfCartIQ (not dealers); listings without a dealer are accepted (dealer_id null).
      // Duplicate (double submit / resend): return the original success, don't store
      // again and don't count it against the rate limits.
      const cHash = contactHash(lead.email, lead.phone);
      const t = now();
      if (await store.findDuplicateLead({ listingId: lead.listingId, idempotencyKey: lead.idempotencyKey, contactHash: cHash, since: new Date(t - LEAD_DEDUPE_MS).toISOString() })) {
        return res.status(200).json({ ok: true });
      }
      const ipH = hashIp(clientIp(req));
      if (!(await hit(LIMITS.leadsPerIp, ipH))) return res.status(429).json({ error: "rate_limited" });
      if (!(await hit(LIMITS.leadsPerListing, String(lead.listingId)))) return res.status(429).json({ error: "rate_limited" });
      // Race: a concurrent identical POST can pass the check above; the unique
      // constraints catch it and the loser also gets the original success.
      await store.insertLead({ ...lead, dealerId: ref.dealerId, consentText: LEAD_CONSENT_TEXT, ipHash: ipH,
        contactHash: cHash, dedupeBucket: Math.floor(t / LEAD_DEDUPE_MS) });
      // No email, SMS or webhook to any dealer. Leads wait for manual admin review.
      return res.status(200).json({ ok: true });
    } catch (err: any) {
      // Never a fake success: the shopper sees an error and can retry.
      log("lead write failed", { error: String(err?.message ?? err).slice(0, 200) });
      return res.status(500).json({ error: "server_error" });
    }
  });

  // Admin: leads list (newest first, 50/page) and mark-contacted. Existing admin auth
  // (x-admin-token header); tokens in the URL are refused.
  app.get("/api/admin/leads", rejectQueryTokens, requireAdmin, async (req, res) => {
    noindex(res);
    res.setHeader("Cache-Control", "no-store");
    const page = Math.max(1, Math.min(10_000, Number.parseInt(String(req.query.page ?? "1"), 10) || 1));
    try {
      const { rows, total } = await getStore().listLeads(page, LEADS_PAGE_SIZE);
      res.json({ page, pageSize: LEADS_PAGE_SIZE, total, rows });
    } catch { res.status(500).json({ error: "list_failed" }); }
  });
  app.post("/api/admin/leads/:id/contacted", rejectQueryTokens, requireAdmin, async (req, res) => {
    noindex(res);
    const rawId = String(req.params.id);
    const id = Number.parseInt(rawId, 10);
    if (!Number.isInteger(id) || id <= 0 || String(id) !== rawId) return res.status(400).json({ error: "bad_id" });
    try {
      const r = await getStore().markContacted(id, new Date(now()).toISOString());
      if (!r) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true, lead: r });
    } catch { res.status(500).json({ error: "update_failed" }); }
  });

  // Admin-only monthly report stub. ?month=YYYY-MM (default: current UTC month).
  app.get("/api/admin/leads/monthly-report", rejectQueryTokens, requireAdmin, async (req, res) => {
    noindex(res);
    const d = new Date(now());
    const month = typeof req.query.month === "string" ? req.query.month
      : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!MONTH_RE.test(month)) return res.status(400).json({ error: "month must be YYYY-MM" });
    try {
      res.json({ month, rows: await getStore().monthlyReport(month) });
    } catch {
      res.status(500).json({ error: "report_failed" });
    }
  });

  // Admin-only volume monitor (for SRE): daily listing_events counts + 3x alert.
  app.get("/api/admin/leads/event-volume", rejectQueryTokens, requireAdmin, async (_req, res) => {
    noindex(res);
    try {
      const days = await getStore().dailyEventCounts(15, now());
      res.json({ days, ...volumeAlert(days) });
    } catch {
      res.status(500).json({ error: "volume_failed" });
    }
  });

  // Retention cron stub: admin token OR `Authorization: Bearer $CRON_SECRET`.
  const cronAuth: RequestHandler = (req, res, next) => {
    const auth = req.get("authorization") ?? "";
    if (!cronSecret && auth.startsWith("Bearer ")) configError("CRON_SECRET missing or shorter than 16 chars; bearer auth disabled");
    if (cronSecret && auth.startsWith("Bearer ") && safeEq(auth.slice(7), cronSecret)) return next();
    return requireAdmin(req, res, next);
  };
  // Daily job (one schedule covers both; suggest 09:00 UTC, not set here):
  // 1) retention cleanup, 2) volume monitor -> on alert set lead_tracking_paused
  // and log LEAD_VOLUME_ALERT. Runs even while paused. Each run logs LEAD_CRON_RUN.
  app.post("/api/cron/lead-retention", cronAuth, async (_req, res) => {
    noindex(res);
    if (!saltOk()) {
      configError("LEAD_IP_SALT missing or shorter than 16 chars");
      console.log(`LEAD_CRON_RUN ${JSON.stringify({ at: new Date(now()).toISOString(), ok: false, configError: true })}`);
      return res.status(503).json({ ok: false, error: "config_error" });
    }
    const out: Record<string, unknown> = {};
    let ok = true;
    try { out.deleted = await getStore().cleanup(); }
    catch { ok = false; out.cleanupError = true; log("cleanup failed"); }
    try {
      const days = await getStore().dailyEventCounts(15, now());
      const v = volumeAlert(days);
      out.volume = { alert: v.alert, reason: v.reason, latest: v.latest, baseline: v.baseline };
      if (v.alert) {
        let pausedSet = false;
        try { await getStore().setPaused(`volume monitor: ${v.reason}`); pausedSet = true; gate = null; }
        catch { ok = false; log("setting lead_tracking_paused failed"); }
        out.pausedSet = pausedSet;
        notify({ type: "LEAD_VOLUME_ALERT", at: new Date(now()).toISOString(), reason: v.reason, latest: v.latest, baseline: v.baseline, pausedSet });
      }
    } catch { ok = false; out.monitorError = true; log("volume monitor failed"); }
    console.log(`LEAD_CRON_RUN ${JSON.stringify({ at: new Date(now()).toISOString(), ok, ...out })}`);
    res.status(ok ? 200 : 500).json({ ok, ...out });
  });

  // Admin: read / clear the pause switch.
  app.get("/api/admin/leads/paused", rejectQueryTokens, requireAdmin, async (_req, res) => {
    noindex(res);
    try { res.json(await getStore().getPaused()); } catch { res.status(500).json({ error: "read_failed" }); }
  });
  app.post("/api/admin/leads/paused/clear", rejectQueryTokens, requireAdmin, async (_req, res) => {
    noindex(res);
    try { await getStore().clearPaused(); gate = null; console.log("[leads] lead_tracking_paused cleared by admin"); res.json({ ok: true }); }
    catch { res.status(500).json({ error: "clear_failed" }); }
  });
  return true;
}
