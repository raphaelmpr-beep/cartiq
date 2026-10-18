// Lead tracking routes (DRAFT). Registered ONLY when LEAD_TRACKING_ENABLED is on.
// With the flag off this function returns before touching the app, so no route,
// middleware or DB client exists and /api/leads/* falls through to today's 404.
import type { Express, Request, Response, RequestHandler } from "express";
import { createHash, randomBytes } from "node:crypto";
import {
  parseFlag, isBotUserAgent, validateEvent, validateLead, Deduper, RateLimiter,
  LEAD_CONSENT_TEXT, MONTH_RE,
} from "@shared/leadTracking";
import type { LeadsStore } from "./store";

export interface LeadRouteOptions {
  enabled?: boolean;
  store: () => LeadsStore; // lazy so nothing connects at registration time
  now?: () => number;
  ipSalt?: string;
  /** Fixture mode only: force the 429 response so the UI state can be shown. */
  forceRateLimit?: () => boolean;
  /** Fixture mode only: add `fixtureBlocked` to silent-block responses. */
  exposeBlockReason?: boolean;
  onBlocked?: (reason: string) => void;
}

export function clientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  const first = (Array.isArray(xff) ? xff[0] : xff ?? "").split(",")[0].trim();
  return first || req.socket?.remoteAddress || "unknown";
}

export function registerLeadRoutes(app: Express, requireAdmin: RequestHandler, opts: LeadRouteOptions): boolean {
  const enabled = opts.enabled ?? parseFlag(process.env.LEAD_TRACKING_ENABLED);
  if (!enabled) return false;
  const now = opts.now ?? Date.now;
  const salt = opts.ipSalt ?? process.env.LEAD_IP_SALT ?? randomBytes(16).toString("hex");
  const hashIp = (ip: string) => createHash("sha256").update(salt + ip).digest("hex").slice(0, 32);

  const viewDedupe = new Deduper(30 * 60_000);
  const clickDedupe = new Deduper(10_000);       // double-clicks
  const eventsPerIp = new RateLimiter(120, 60_000);
  const leadsPerIp = new RateLimiter(5, 60 * 60_000);
  const leadsPerListing = new RateLimiter(20, 24 * 60 * 60_000);
  const leadsPerIpListing = new Deduper(10 * 60_000); // same person, same cart: one lead per 10 min

  let _store: LeadsStore | null = null;
  const getStore = () => (_store ??= opts.store());
  const noindex = (res: Response) => res.setHeader("X-Robots-Tag", "noindex");

  // Events: fire-and-forget. Always 204 so the beacon never retries or surfaces errors.
  app.post("/api/leads/event", async (req, res) => {
    noindex(res);
    res.status(204).end();
    try {
      if (isBotUserAgent(req.get("user-agent"))) return;
      const ip = clientIp(req);
      if (!eventsPerIp.allow(hashIp(ip), now())) return;
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const v = validateEvent(body);
      if (!v.ok) return;
      const e = v.value;
      const key = `${e.sessionId}:${e.listingId}:${e.eventType}`;
      const fresh = e.eventType === "listing_view" ? viewDedupe.check(key, now()) : clickDedupe.check(key, now());
      if (!fresh) return;
      const store = getStore();
      const ref = await store.getPublicListing(e.listingId);
      if (!ref) return;
      // dealer_id comes from the DB, not the client, so it can't be spoofed.
      await store.insertEvent({ ...e, dealerId: ref.dealerId });
    } catch { /* telemetry never crashes the app */ }
  });

  app.post("/api/leads/quote", async (req, res) => {
    noindex(res);
    try {
      if (opts.forceRateLimit?.()) return res.status(429).json({ error: "rate_limited" });
      const ipH = hashIp(clientIp(req));
      if (!leadsPerIp.allow(ipH, now())) return res.status(429).json({ error: "rate_limited" });
      const v = validateLead(req.body, now());
      if (!v.ok) {
        // Honeypot / too-fast: pretend success so bots learn nothing; store nothing.
        if (v.silent) {
          const reason = v.error === "too_fast" ? "min-fill" : v.error;
          opts.onBlocked?.(reason);
          return res.status(200).json(opts.exposeBlockReason ? { ok: true, fixtureBlocked: reason } : { ok: true });
        }
        return res.status(400).json({ error: v.error });
      }
      const lead = v.value;
      if (!leadsPerIpListing.check(`${ipH}:${lead.listingId}`, now())) return res.status(429).json({ error: "rate_limited" });
      if (!leadsPerListing.allow(String(lead.listingId), now())) return res.status(429).json({ error: "rate_limited" });
      const store = getStore();
      const ref = await store.getPublicListing(lead.listingId);
      if (!ref) return res.status(404).json({ error: "listing_unavailable" });
      await store.insertLead({ ...lead, dealerId: ref.dealerId, consentText: LEAD_CONSENT_TEXT, ipHash: ipH });
      // No email, SMS or webhook to any dealer. Leads wait for manual admin review.
      return res.status(200).json({ ok: true });
    } catch {
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
    } catch (e: any) {
      res.status(500).json({ error: "report_failed" });
    }
  });
  return true;
}
