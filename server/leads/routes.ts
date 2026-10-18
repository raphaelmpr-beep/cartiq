// Lead tracking routes (DRAFT). Registered ONLY when LEAD_TRACKING_ENABLED is on.
// With the flag off this function returns before touching the app, so no route,
// middleware or DB client exists and /api/leads/* falls through to today's 404.
import type { Express, Request, Response, RequestHandler } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  parseFlag, isBotUserAgent, validateEvent, validateLead, Deduper,
  LEAD_CONSENT_TEXT, MONTH_RE, volumeAlert,
} from "@shared/leadTracking";
import type { LeadsStore } from "./store";

export interface LeadRouteOptions {
  enabled?: boolean;
  store: () => LeadsStore; // lazy so nothing connects at registration time
  now?: () => number;
  ipSalt?: string;
  cronSecret?: string;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
  /** Fixture mode only: force the 429 response so the UI state can be shown. */
  forceRateLimit?: () => boolean;
  /** Fixture mode only: add `fixtureBlocked` to silent-block responses. */
  exposeBlockReason?: boolean;
  onBlocked?: (reason: string) => void;
}

/** Rate-limit rules. Counters live in Postgres (lead_rate_limits) via the store. */
export const LIMITS = {
  eventsPerIp:     { scope: "ev_ip",      windowMs: 60_000,           limit: 120 },
  leadsPerIp:      { scope: "lead_ip",    windowMs: 60 * 60_000,      limit: 5 },
  leadsPerIpListing: { scope: "lead_ip_listing", windowMs: 10 * 60_000, limit: 1 },
  leadsPerListing: { scope: "lead_listing", windowMs: 24 * 60 * 60_000, limit: 20 },
} as const;

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
  const salt = opts.ipSalt ?? process.env.LEAD_IP_SALT ?? randomBytes(16).toString("hex");
  const hashIp = (ip: string) => createHash("sha256").update(salt + ip).digest("hex").slice(0, 32);
  const cronSecret = opts.cronSecret ?? process.env.CRON_SECRET;

  // Dedupe stays in memory: it only drops repeat views/double clicks (a miss just
  // records one extra view); it is not an abuse control.
  const viewDedupe = new Deduper(30 * 60_000);
  const clickDedupe = new Deduper(10_000);

  let _store: LeadsStore | null = null;
  const getStore = () => (_store ??= opts.store());
  const noindex = (res: Response) => res.setHeader("X-Robots-Tag", "noindex");
  const hit = (rule: { scope: string; windowMs: number; limit: number }, key: string) =>
    getStore().hitRateLimit(rule.scope, key, rule.windowMs, rule.limit, now());

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
      if (opts.forceRateLimit?.()) return res.status(429).json({ error: "rate_limited" });
      const store = getStore();
      const ref = await store.getPublicListing(lead.listingId);
      if (!ref) return res.status(404).json({ error: "listing_unavailable" });
      if (ref.dealerId == null) {
        return res.status(422).json({ error: "contact_unavailable", message: "Contact isn't available for this listing." });
      }
      const ipH = hashIp(clientIp(req));
      if (!(await hit(LIMITS.leadsPerIp, ipH))) return res.status(429).json({ error: "rate_limited" });
      if (!(await hit(LIMITS.leadsPerIpListing, `${ipH}:${lead.listingId}`))) return res.status(429).json({ error: "rate_limited" });
      if (!(await hit(LIMITS.leadsPerListing, String(lead.listingId)))) return res.status(429).json({ error: "rate_limited" });
      await store.insertLead({ ...lead, dealerId: ref.dealerId, consentText: LEAD_CONSENT_TEXT, ipHash: ipH });
      // No email, SMS or webhook to any dealer. Leads wait for manual admin review.
      return res.status(200).json({ ok: true });
    } catch (err: any) {
      // Never a fake success: the shopper sees an error and can retry.
      log("lead write failed", { error: String(err?.message ?? err).slice(0, 200) });
      return res.status(500).json({ error: "server_error" });
    }
  });

  // Admin-only monthly report stub. ?month=YYYY-MM (default: current UTC month).
  app.get("/api/admin/leads/monthly-report", requireAdmin, async (req, res) => {
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
  app.get("/api/admin/leads/event-volume", requireAdmin, async (_req, res) => {
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
    if (cronSecret && auth.startsWith("Bearer ") && safeEq(auth.slice(7), cronSecret)) return next();
    return requireAdmin(req, res, next);
  };
  app.post("/api/cron/lead-retention", cronAuth, async (_req, res) => {
    noindex(res);
    try {
      res.json({ ok: true, deleted: await getStore().cleanup() });
    } catch {
      res.status(500).json({ error: "cleanup_failed" });
    }
  });
  return true;
}
