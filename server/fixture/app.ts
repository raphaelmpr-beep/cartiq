// Fixture-mode API (dev only). No Supabase client, no network: listings come
// from fixtures.json, lead/event writes go to an in-memory store and the console.
import express, { type Express } from "express";
import { readFileSync } from "node:fs";
import { registerLeadRoutes } from "../leads/routes";
import { makeRequireAdmin } from "../leads/admin-auth";

/** Fixed dev admin password for fixture mode only (never used by the real server). */
export const FIXTURE_ADMIN_PASSWORD = "gcq-fixture-admin";
import { aggregateMonthly, memoryRateLimits, memoryPaused, memoryLeads, type LeadsStore } from "../leads/store";

type Fx = { dealers: any[]; listings: any[] };

export function loadFixtures(path = new URL("./fixtures.json", import.meta.url)): Fx {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function createFixtureApp(opts: { log?: (...a: unknown[]) => void; fixtures?: Fx } = {}) {
  const log = opts.log ?? ((...a: unknown[]) => console.log("[fixture]", ...a));
  const fx = opts.fixtures ?? loadFixtures();
  const events: any[] = [];
  const memLeads = memoryLeads([], Date.now, (listingId) => {
    const l = fx.listings.find((x) => x.id === listingId);
    const d = l?.dealerId ? fx.dealers.find((x) => x.id === l.dealerId) : undefined;
    return { title: l?.title, slug: l?.slug, dealerName: d?.name };
  });
  const leads = memLeads.rows;
  const state = { forceRateLimit: false, saltMissing: false };
  const pausedSw = memoryPaused();
  const store: LeadsStore = {
    async getPublicListing(id) {
      const l = fx.listings.find((x) => x.id === id && x.publicListing && x.status === "active");
      return l ? { listingId: id, dealerId: l.dealerId ?? null } : null;
    },
    async insertEvent(e) { events.push({ ...e, created_at: new Date().toISOString() }); log("listing_events insert", e); },
    findDuplicateLead: async (q) => { const d = await memLeads.findDuplicateLead(q); if (d) log("lead duplicate (idempotency/contact) — original success returned, not stored"); return d; },
    async insertLead(l) {
      const r = await memLeads.insertLead(l);
      if (r.duplicate) log("lead duplicate on insert (unique conflict) — not stored");
      else log("listing_leads insert", { ...l, email: l.email ? "<redacted>" : null, phone: l.phone ? "<redacted>" : null });
      return r;
    },
    async monthlyReport(m) {
      return aggregateMonthly(m, events.map((e) => ({ event_type: e.eventType, dealer_id: e.dealerId })),
        leads.map((l) => ({ dealer_id: l.dealerId })), new Map(fx.dealers.map((d) => [d.id, d.name])));
    },
    hitRateLimit: memoryRateLimits(),
    async cleanup() { log("cleanup (fixture no-op)"); return { leads: 0, events: 0, rate_limits: 0 }; },
    async dailyEventCounts() { return []; },
    listLeads: (p, n) => memLeads.listLeads(p, n),
    markContacted: async (id, at) => { const r = await memLeads.markContacted(id, at); log("lead marked contacted", { id, found: !!r }); return r; },
    getPaused: pausedSw.getPaused, setPaused: pausedSw.setPaused, clearPaused: pausedSw.clearPaused,
  };

  const app: Express = express();
  app.use(express.json({ limit: "32kb" }));
  app.get("/api/listings/:id", (req, res) => {
    const l = fx.listings.find((x) => String(x.id) === req.params.id);
    return l ? res.json(l) : res.status(404).json({ error: "not found" });
  });
  app.get("/api/dealers/:slug", (req, res) => {
    const d = fx.dealers.find((x) => x.slug === req.params.slug);
    return d ? res.json(d) : res.status(404).json({ error: "not found" });
  });
  // Dev debug toggle: GET /api/__fixture/rate-limit?on=1 | ?on=0
  app.get("/api/__fixture/rate-limit", (req, res) => {
    if (req.query.on !== undefined) state.forceRateLimit = /^(1|true|on)$/i.test(String(req.query.on));
    log("forceRateLimit =", state.forceRateLimit);
    res.json({ forceRateLimit: state.forceRateLimit });
  });
  // Dev debug toggle: GET /api/__fixture/paused?on=1 | ?on=0 (lead_tracking_paused stand-in)
  app.get("/api/__fixture/paused", async (req, res) => {
    if (req.query.on !== undefined) { if (/^(1|true|on)$/i.test(String(req.query.on))) await pausedSw.setPaused("fixture toggle"); else await pausedSw.clearPaused(); }
    log("paused =", pausedSw.state.paused);
    res.json({ paused: pausedSw.state.paused });
  });
  // Dev debug toggle: GET /api/__fixture/salt-missing?on=1 | ?on=0 — same fail-closed path as a missing LEAD_IP_SALT.
  app.get("/api/__fixture/salt-missing", (req, res) => {
    if (req.query.on !== undefined) state.saltMissing = /^(1|true|on)$/i.test(String(req.query.on));
    log("saltMissing =", state.saltMissing);
    res.json({ saltMissing: state.saltMissing });
  });
  app.get("/api/__fixture/store", (_req, res) => res.json({ events, leads: leads.length, forceRateLimit: state.forceRateLimit }));
  const admin = makeRequireAdmin(FIXTURE_ADMIN_PASSWORD);
  // Existing Admin page sign-in check (same contract as the real /api/admin/verify).
  app.get("/api/admin/verify", admin, (_req, res) => res.json({ ok: true }));
  registerLeadRoutes(app, admin, {
    enabled: true, store: () => store, ipSalt: "gcq-fixture-dev-salt-not-a-secret", // fixed dev salt (fixture only)
    forceRateLimit: () => state.forceRateLimit,
    exposeBlockReason: true,
    pausedCacheMs: 0,
    simulateSaltMissing: () => state.saltMissing,
    onBlocked: (reason) => log(`lead blocked (${reason}) — success shown, nothing stored`),
  });
  // Other admin/list data the Admin page loads: empty in fixture mode (no database).
  app.get(/^\/api\/admin\/.*/, admin, (_req, res) => res.json([]));
  app.get(["/api/listings", "/api/dealers", "/api/inventory-sources"], (_req, res) => res.json([]));
  app.use("/api", (_req, res) => res.status(404).json({ error: "not available in fixture mode" }));
  return { app, store, events, leads, state, paused: pausedSw.state };
}
