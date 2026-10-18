import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import {
  parseFlag, isBotUserAgent, validateEvent, validateLead, Deduper, RateLimiter,
  LEAD_CONSENT_TEXT, LEAD_SUCCESS_TEXT, LEAD_MIN_FILL_MS,
} from "../shared/leadTracking";
import { registerLeadRoutes } from "../server/leads/routes";
import { aggregateMonthly, monthBounds, memoryRateLimits, memoryPaused, memoryLeads, windowStart, type LeadsStore } from "../server/leads/store";
import { volumeAlert } from "../shared/leadTracking";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const T0 = 1_760_000_000_000;
let leadN = 0;
const goodLead = (o: Record<string, unknown> = {}) => ({
  idempotencyKey: randomUUID(), listingId: 5, name: "Pat Smith", email: `pat${++leadN}@example.com`, phone: "", zip: "32801",
  message: "Is it still available?", consent: true, website: "", startedAt: T0 - 10_000, ...o,
});

test("flag parsing defaults off", () => {
  for (const v of [undefined, null, "", "0", "false", "off", "no", "nope"]) assert.equal(parseFlag(v as any), false);
  for (const v of ["1", "true", "ON", " yes "]) assert.equal(parseFlag(v), true);
});

test("bot filtering", () => {
  assert.equal(isBotUserAgent(UA), false);
  assert.equal(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"), false);
  for (const ua of ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Mozilla/5.0 (compatible; bingbot/2.0)",
    "curl/8.4.0", "python-requests/2.31", "Mozilla/5.0 HeadlessChrome/120", "GPTBot/1.0", "facebookexternalhit/1.1", "Chrome-Lighthouse", "", undefined])
    assert.equal(isBotUserAgent(ua as any), true, String(ua));
});

test("event validation", () => {
  assert.ok(validateEvent({ eventType: "listing_view", listingId: 1, sessionId: "abcdef123456" }).ok);
  assert.ok(validateEvent({ eventType: "contact_click", listingId: "7", dealerId: 3, sessionId: "abcdef123456" }).ok);
  assert.equal(validateEvent({ eventType: "impression", listingId: 1, sessionId: "abcdef123456" }).ok, false);
  assert.equal(validateEvent({ eventType: "listing_view", listingId: -1, sessionId: "abcdef123456" }).ok, false);
  assert.equal(validateEvent({ eventType: "listing_view", listingId: 1, sessionId: "a@b.com" }).ok, false);
  assert.equal(validateEvent({ eventType: "listing_view", listingId: 1, dealerId: "x", sessionId: "abcdef123456" }).ok, false);
});

test("dedupe window", () => {
  const d = new Deduper(1000);
  assert.equal(d.check("k", 0), true);
  assert.equal(d.check("k", 500), false);
  assert.equal(d.check("other", 500), true);
  assert.equal(d.check("k", 1001), true);
});

test("rate limiter", () => {
  const r = new RateLimiter(2, 1000);
  assert.equal(r.allow("ip", 0), true);
  assert.equal(r.allow("ip", 1), true);
  assert.equal(r.allow("ip", 2), false);
  assert.equal(r.allow("ip2", 2), true);
  assert.equal(r.allow("ip", 1000), true);
});

test("lead validation", () => {
  const ok = validateLead(goodLead(), T0);
  assert.ok(ok.ok);
  assert.ok(validateLead(goodLead({ email: "", phone: "(407) 555-0123" }), T0).ok);
  const bad: [Record<string, unknown>, string][] = [
    [{ email: "", phone: "" }, "contact_required"], [{ email: "nope" }, "email"], [{ email: "", phone: "123" }, "phone"],
    [{ zip: "3280" }, "zip"], [{ name: "x" }, "name"], [{ name: "Buy http://spam.ru" }, "name"], [{ name: "visit cheap.com" }, "name"],
    [{ name: "a".repeat(81) }, "name"], [{ message: "m".repeat(1001) }, "message"], [{ consent: false }, "consent"],
    [{ listingId: 0 }, "listingId"], [{ startedAt: T0 - 3 * 60 * 60_000 }, "stale_form"],
  ];
  for (const [o, err] of bad) { const r = validateLead(goodLead(o), T0); assert.equal(r.ok, false); assert.equal((r as any).error, err, JSON.stringify(o)); }
});

test("honeypot and min fill time are silent", () => {
  const h = validateLead(goodLead({ website: "http://x" }), T0);
  assert.deepEqual([h.ok, (h as any).silent], [false, true]);
  const f = validateLead(goodLead({ startedAt: T0 - (LEAD_MIN_FILL_MS - 1) }), T0);
  assert.deepEqual([f.ok, (f as any).silent], [false, true]);
});

test("consent and success copy (Inspector requirements)", () => {
  assert.match(LEAD_CONSENT_TEXT, /dealer selling this cart/);
  assert.match(LEAD_CONSENT_TEXT, /GolfCartIQ/);
  assert.match(LEAD_SUCCESS_TEXT, /No dealer has been contacted automatically/);
});

function memStore(nowFn: () => number = Date.now) {
  const events: any[] = [];
  const fail = { event: false, lead: false };
  const ml = memoryLeads([], nowFn);
  const leads = ml.rows;
  const paused = memoryPaused();
  const store: LeadsStore = {
    async getPublicListing(id) { return id === 404 ? null : { listingId: id, dealerId: id === 12 ? null : 9 }; },
    async insertEvent(e) { if (fail.event) throw new Error("db down"); events.push(e); },
    findDuplicateLead: (q) => ml.findDuplicateLead(q),
    async insertLead(l) { if (fail.lead) throw new Error("db down"); return ml.insertLead(l); },
    hitRateLimit: memoryRateLimits(),
    getPaused: paused.getPaused, setPaused: paused.setPaused, clearPaused: paused.clearPaused,
    async cleanup() { return { leads: 1, events: 2, rate_limits: 3 }; },
    async dailyEventCounts() { return Array.from({ length: 15 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, events: i === 14 ? 1000 : 100 })); },
    async monthlyReport(m) { return aggregateMonthly(m, events.map((e) => ({ event_type: e.eventType, dealer_id: e.dealerId })), leads.map((l) => ({ dealer_id: l.dealerId })), new Map([[9, "D9"]])); },
  };
  return { store, events, leads, fail, paused: paused.state };
}

async function withApp(enabled: boolean, fn: (base: string, m: ReturnType<typeof memStore>, clock: { t: number }) => Promise<void>) {
  const app = express();
  app.use(express.json());
  const clock = { t: T0 };
  const m = memStore(() => clock.t);
  const admin = (req: any, res: any, next: any) => (req.headers["x-admin-token"] === "pw" ? next() : res.status(401).end());
  const logs: string[] = [];
  const alerts: any[] = [];
  const registered = registerLeadRoutes(app, admin, { enabled, store: () => m.store, now: () => clock.t, ipSalt: "s", cronSecret: "cs", log: (msg) => logs.push(msg), notifier: (a) => alerts.push(a), pausedCacheMs: 0 });
  (m as any).alerts = alerts;
  (m as any).logs = logs;
  assert.equal(registered, enabled);
  app.use((_req, res) => res.status(404).send("fallthrough"));
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  try { await fn(base, m, clock); } finally { srv.close(); }
}
const post = (url: string, body: unknown, ua = UA, ip = "1.1.1.1") =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", "user-agent": ua, "x-forwarded-for": ip }, body: JSON.stringify(body) });
const tick = () => new Promise((r) => setTimeout(r, 20));

test("flag off: no routes registered (fall through to 404), nothing stored", async () => {
  await withApp(false, async (base, m) => {
    for (const p of ["/api/leads/event", "/api/leads/quote"]) assert.equal((await post(base + p, {})).status, 404);
    assert.equal((await fetch(base + "/api/admin/leads/monthly-report", { headers: { "x-admin-token": "pw" } })).status, 404);
    assert.equal(m.events.length + m.leads.length, 0);
  });
});

test("events: stored, dealer from DB, bots dropped, views deduped", async () => {
  await withApp(true, async (base, m, clock) => {
    const ev = { eventType: "listing_view", listingId: 5, dealerId: 777, sessionId: "abcdef123456" };
    const r = await post(base + "/api/leads/event", ev);
    assert.equal(r.status, 204);
    assert.equal(r.headers.get("x-robots-tag"), "noindex");
    await post(base + "/api/leads/event", ev);
    await post(base + "/api/leads/event", { ...ev, sessionId: "zzzzzz999999" }, "Googlebot/2.1 (+http://www.google.com/bot.html)");
    await post(base + "/api/leads/event", { ...ev, listingId: 404 });
    await tick();
    assert.equal(m.events.length, 1);
    assert.equal(m.events[0].dealerId, 9);
    clock.t += 31 * 60_000;
    await post(base + "/api/leads/event", ev);
    await post(base + "/api/leads/event", { ...ev, eventType: "contact_click" });
    await tick();
    assert.equal(m.events.length, 3);
  });
});

test("quote: stores lead, honeypot silent, per-IP and per-listing limits", async () => {
  await withApp(true, async (base, m, clock) => {
    const r = await post(base + "/api/leads/quote", goodLead());
    assert.equal(r.status, 200);
    assert.equal(m.leads.length, 1);
    assert.equal(m.leads[0].dealerId, 9);
    assert.equal(m.leads[0].consentText, LEAD_CONSENT_TEXT);
    assert.ok(!JSON.stringify(m.leads[0]).includes("1.1.1.1"));
    assert.equal((await post(base + "/api/leads/quote", goodLead({ website: "x" }), UA, "2.2.2.2")).status, 200);
    assert.equal(m.leads.length, 1);
    assert.equal((await post(base + "/api/leads/quote", goodLead({ zip: "x" }), UA, "2.2.2.2")).status, 400);
    assert.equal((await post(base + "/api/leads/quote", goodLead({ email: m.leads[0].email }), UA, "1.1.1.1")).status, 200); // same contact+listing: duplicate
    assert.equal(m.leads.length, 1);
    for (let i = 0; i < 4; i++) await post(base + "/api/leads/quote", goodLead({ listingId: 100 + i }), UA, "3.3.3.3");
    assert.equal((await post(base + "/api/leads/quote", goodLead({ listingId: 200 }), UA, "3.3.3.3")).status, 200);
    assert.equal((await post(base + "/api/leads/quote", goodLead({ listingId: 201 }), UA, "3.3.3.3")).status, 429); // 5/h per IP
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await post(base + "/api/leads/quote", goodLead({ listingId: 50 }), UA, `9.9.9.${i}`)).status;
    assert.equal(last, 429); // 20/day per listing
    assert.equal((await post(base + "/api/leads/quote", goodLead({ listingId: 404 }), UA, "8.8.8.8")).status, 404);
  });
});

test("monthly report: admin-only, shape", async () => {
  await withApp(true, async (base) => {
    await post(base + "/api/leads/event", { eventType: "listing_view", listingId: 5, sessionId: "abcdef123456" });
    await post(base + "/api/leads/event", { eventType: "outbound_click", listingId: 5, sessionId: "abcdef123456" });
    await post(base + "/api/leads/quote", goodLead());
    await tick();
    assert.equal((await fetch(base + "/api/admin/leads/monthly-report")).status, 401);
    assert.equal((await fetch(base + "/api/admin/leads/monthly-report?month=2026-13", { headers: { "x-admin-token": "pw" } })).status, 400);
    const j = await (await fetch(base + "/api/admin/leads/monthly-report?month=2026-10", { headers: { "x-admin-token": "pw" } })).json();
    assert.equal(j.month, "2026-10");
    assert.deepEqual(j.rows, [{ month: "2026-10", dealer_id: 9, dealer_name: "D9", views: 1, outbound_clicks: 1, leads: 1 }]);
  });
});

test("aggregateMonthly + monthBounds", () => {
  const rows = aggregateMonthly("2026-10",
    [{ event_type: "listing_view", dealer_id: 1 }, { event_type: "listing_view", dealer_id: 2 }, { event_type: "contact_click", dealer_id: 2 }, { event_type: "listing_view", dealer_id: null }],
    [{ dealer_id: 1, status: "new" }, { dealer_id: 1, status: "spam" }], new Map([[1, "A"]]));
  assert.deepEqual(rows.map((r) => [r.dealer_id, r.views, r.outbound_clicks, r.leads]), [[1, 1, 0, 1], [2, 1, 1, 0], [null, 1, 0, 0]]);
  assert.deepEqual(monthBounds("2026-12"), { start: "2026-12-01T00:00:00.000Z", end: "2027-01-01T00:00:00.000Z" });
});

test("draft SQL: RLS on, no policies, grants revoked, report columns", () => {
  const ddl = readFileSync(new URL("../db/drafts/20261018_lead_tracking_draft.sql", import.meta.url), "utf8");
  for (const t of ["listing_events", "listing_leads"]) {
    assert.match(ddl, new RegExp(`alter table public\\.${t}\\s+enable row level security`));
    assert.match(ddl, new RegExp(`revoke all on table public\\.${t}\\s+from public, anon, authenticated`));
  }
  assert.match(ddl, /alter table public\.lead_rate_limits enable row level security/);
  assert.match(ddl, /revoke all on table public\.lead_rate_limits from public, anon, authenticated/);
  assert.doesNotMatch(ddl, /create policy/i);
  assert.doesNotMatch(ddl, /grant [^;]* to [^;]*(anon|authenticated|public)/i);
  for (const f of ["20261018_lead_tracking_draft.sql", "20261018_lead_retention_draft.sql", "20261018_listing_events_volume.sql"]) {
    const sql = readFileSync(new URL(`../db/drafts/${f}`, import.meta.url), "utf8");
    const fns = Array.from(sql.matchAll(/create or replace function public\.(\w+)/g)).map((x) => x[1]);
    assert.ok(fns.length > 0, f);
    for (const fn of fns) assert.match(sql, new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`), `${f}:${fn}`);
  }
  const rpt = readFileSync(new URL("../db/drafts/20261018_dealer_monthly_report.sql", import.meta.url), "utf8");
  for (const c of ["month", "dealer_id", "dealer_name", "views", "outbound_clicks", "leads"]) assert.match(rpt, new RegExp(`as ${c}\\b`));
});

test("client: ListingDetail gates on build-time flag only", () => {
  const src = readFileSync(new URL("../client/src/pages/ListingDetail.tsx", import.meta.url), "utf8");
  assert.match(src, /if \(__LEAD_TRACKING_ENABLED__\) useLeadTracking\(listing\);/);
  assert.match(src, /__LEAD_TRACKING_ENABLED__ \? \(\s*<LeadContactButton/);
  assert.match(src, /data-testid="btn-contact-seller"><Phone className="h-4 w-4" \/> Contact Seller<\/Button>/);
  assert.match(src, /__LEAD_TRACKING_ENABLED__ \? \(\s*<>\s*<a href=\{`tel:/);
});

test("quote: listing without a dealer is blocked with a clear message", async () => {
  await withApp(true, async (base, m) => {
    const r = await post(base + "/api/leads/quote", goodLead({ listingId: 12 }), UA, "4.4.4.4");
    assert.equal(r.status, 422);
    assert.equal((await r.json()).error, "contact_unavailable");
    assert.equal(m.leads.length, 0);
  });
});

test("write failures: event dropped+logged (still 204), lead returns 500 not success", async () => {
  await withApp(true, async (base, m) => {
    m.fail.event = true; m.fail.lead = true;
    const r = await post(base + "/api/leads/event", { eventType: "listing_view", listingId: 5, sessionId: "abcdef123456" });
    assert.equal(r.status, 204);
    await tick();
    assert.ok((m as any).logs.includes("event write dropped"));
    const q = await post(base + "/api/leads/quote", goodLead(), UA, "4.4.4.5");
    assert.equal(q.status, 500);
    assert.deepEqual(await q.json(), { error: "server_error" });
    assert.ok((m as any).logs.includes("lead write failed"));
    assert.equal(m.leads.length, 0);
  });
});

test("retention cron: cron secret or admin only; volume monitor admin-only", async () => {
  await withApp(true, async (base) => {
    const c = (h: Record<string, string>) => fetch(base + "/api/cron/lead-retention", { method: "POST", headers: h });
    assert.equal((await c({})).status, 401);
    assert.equal((await c({ authorization: "Bearer wrong" })).status, 401);
    const j = await (await c({ authorization: "Bearer cs" })).json();
    assert.equal(j.ok, true);
    assert.deepEqual(j.deleted, { leads: 1, events: 2, rate_limits: 3 });
    assert.equal(j.volume.alert, true);
    assert.equal((await c({ "x-admin-token": "pw" })).status, 200);
    assert.equal((await fetch(base + "/api/admin/leads/event-volume")).status, 401);
    const v = await (await fetch(base + "/api/admin/leads/event-volume", { headers: { "x-admin-token": "pw" } })).json();
    assert.equal(v.alert, true);
    assert.equal(v.baseline, 100);
  });
  await withApp(false, async (base) => {
    assert.equal((await fetch(base + "/api/cron/lead-retention", { method: "POST", headers: { authorization: "Bearer cs" } })).status, 404);
  });
});

test("volumeAlert + windowStart", () => {
  const days = (xs: number[]) => xs.map((events, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, events }));
  assert.equal(volumeAlert(days([100, 100, 100])).reason, "insufficient_history");
  assert.equal(volumeAlert(days([100, 100, 100, 100, 100, 100, 100, 299])).alert, false);
  assert.equal(volumeAlert(days([100, 100, 100, 100, 100, 100, 100, 301])).alert, true);
  assert.equal(volumeAlert(days([5, 5, 5, 5, 5, 5, 5, 40])).alert, false); // baseline floor 50
  assert.equal(windowStart(Date.UTC(2026, 9, 18, 21, 17, 30), 10 * 60_000), "2026-10-18T21:10:00.000Z");
});

test("cron: volume alert sets lead_tracking_paused, logs LEAD_VOLUME_ALERT, then routes stop writing", async () => {
  await withApp(true, async (base, m) => {
    assert.equal((await (await fetch(base + "/api/leads/status")).json()).enabled, true);
    const j = await (await fetch(base + "/api/cron/lead-retention", { method: "POST", headers: { authorization: "Bearer cs" } })).json();
    assert.equal(j.pausedSet, true);
    assert.equal(m.paused.paused, true);
    assert.match(m.paused.reason!, /volume monitor/);
    assert.equal((m as any).alerts.length, 1);
    assert.equal((m as any).alerts[0].type, "LEAD_VOLUME_ALERT");
    // paused: UI flag off, events dropped, leads refused (no fake success)
    assert.equal((await (await fetch(base + "/api/leads/status")).json()).enabled, false);
    await post(base + "/api/leads/event", { eventType: "listing_view", listingId: 5, sessionId: "abcdef123456" });
    await tick();
    assert.equal(m.events.length, 0);
    const q = await post(base + "/api/leads/quote", goodLead(), UA, "4.4.9.9");
    assert.equal(q.status, 503);
    assert.equal(m.leads.length, 0);
    // admin clears it
    assert.equal((await fetch(base + "/api/admin/leads/paused/clear", { method: "POST" })).status, 401);
    assert.equal((await fetch(base + "/api/admin/leads/paused/clear", { method: "POST", headers: { "x-admin-token": "pw" } })).status, 200);
    assert.equal((await (await fetch(base + "/api/leads/status")).json()).enabled, true);
    assert.equal((await post(base + "/api/leads/quote", goodLead(), UA, "4.4.9.9")).status, 200);
  });
});

test("paused read failure fails closed", async () => {
  await withApp(true, async (base, m) => {
    (m.paused as any).failRead = true;
    assert.equal((await (await fetch(base + "/api/leads/status")).json()).enabled, false);
    assert.equal((await post(base + "/api/leads/quote", goodLead(), UA, "4.4.8.8")).status, 503);
    await post(base + "/api/leads/event", { eventType: "listing_view", listingId: 5, sessionId: "abcdef123456" });
    await tick();
    assert.equal(m.events.length + m.leads.length, 0);
    assert.ok((m as any).logs.includes("lead_tracking_paused read failed; failing closed"));
  });
});

test("paused gate is cached (default 30 s)", async () => {
  const app = express(); app.use(express.json());
  const m = memStore(); let reads = 0; const orig = m.store.getPaused;
  m.store.getPaused = async () => { reads++; return orig(); };
  const clock = { t: T0 };
  registerLeadRoutes(app, (_q, r) => { r.status(401).end(); }, { enabled: true, store: () => m.store, now: () => clock.t, ipSalt: "s" });
  const srv = app.listen(0); const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  try {
    for (let i = 0; i < 3; i++) await fetch(base + "/api/leads/status");
    assert.equal(reads, 1);
    clock.t += 31_000; await fetch(base + "/api/leads/status");
    assert.equal(reads, 2);
  } finally { srv.close(); }
});

test("client UI flag: leadTrackingLive is off on paused/error/non-OK", async () => {
  const realFetch = globalThis.fetch;
  const { leadTrackingLive } = await import("../client/src/components/leads/LeadTracking");
  const cases: [() => Promise<Response>, boolean][] = [
    [async () => new Response(JSON.stringify({ enabled: false })), false],
    [async () => new Response("", { status: 404 }), false],
    [async () => { throw new Error("net"); }, false],
    [async () => new Response(JSON.stringify({ enabled: true })), true],
  ];
  const realNow = Date.now; let t = 0; Date.now = () => (t += 61_000);
  try {
    for (const [f, want] of cases) { globalThis.fetch = f as any; assert.equal(await leadTrackingLive(), want); }
  } finally { globalThis.fetch = realFetch; Date.now = realNow; }
});

test("draft SQL: lead_tracking_paused locked down", () => {
  const sql = readFileSync(new URL("../db/drafts/20261018_lead_tracking_paused_draft.sql", import.meta.url), "utf8");
  assert.match(sql, /alter table public\.lead_tracking_paused enable row level security/);
  assert.match(sql, /revoke all on table public\.lead_tracking_paused from public, anon, authenticated/);
  assert.doesNotMatch(sql, /create policy|create (or replace )?function|grant /i);
});

test("notifier: structured LEAD_VOLUME_ALERT line only", async () => {
  const { logNotifier } = await import("../server/leads/notifier");
  const lines: string[] = [];
  logNotifier((l) => lines.push(l))({ type: "LEAD_VOLUME_ALERT", at: "x", reason: "r", latest: null, baseline: 1, pausedSet: true });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^LEAD_VOLUME_ALERT \{"type":"LEAD_VOLUME_ALERT"/);
});

test("UI: contact control hidden for no-dealer, paused, failed or pending status", async () => {
  const { contactButtonMode, LeadContactButton } = await import("../client/src/components/leads/LeadTracking");
  for (const variant of ["contact", "quote"] as const) {
    assert.equal(contactButtonMode({ live: true, dealerId: undefined, variant }), "hidden");   // no dealer
    assert.equal(contactButtonMode({ live: true, dealerId: null, variant }), "hidden");
    assert.equal(contactButtonMode({ live: false, dealerId: 9001, variant }), "hidden");      // paused / status failed / pending
    assert.equal(contactButtonMode({ live: true, dealerId: 9001, variant }), variant);
  }
  // First render (before the status check resolves) emits no markup: no dead button flash.
  const React = await import("react");
  const { renderToString } = await import("react-dom/server");
  for (const variant of ["contact", "quote"] as const) {
    assert.equal(renderToString(React.createElement(LeadContactButton, { listingId: 1, dealerId: 9001, variant })), "");
    assert.equal(renderToString(React.createElement(LeadContactButton, { listingId: 1, variant })), "");
  }
});

test("double submit: same idempotency key twice -> one lead, both succeed, not counted", async () => {
  await withApp(true, async (base, m) => {
    const lead = goodLead({ listingId: 61 });
    const a = await post(base + "/api/leads/quote", lead, UA, "6.1.1.1");
    const b = await post(base + "/api/leads/quote", lead, UA, "6.1.1.1");
    assert.deepEqual([a.status, b.status], [200, 200]);
    assert.deepEqual(await b.json(), { ok: true });
    assert.equal(m.leads.length, 1);
    // duplicate didn't consume the per-IP budget (5/h): 4 more distinct leads still pass
    for (let i = 0; i < 4; i++) assert.equal((await post(base + "/api/leads/quote", goodLead({ listingId: 70 + i }), UA, "6.1.1.1")).status, 200);
  });
});

test("double submit: same listing + same contact within 10 min, new key -> one lead", async () => {
  await withApp(true, async (base, m, clock) => {
    const a = await post(base + "/api/leads/quote", goodLead({ listingId: 62, email: "same@example.com" }), UA, "6.2.1.1");
    clock.t += 5 * 60_000;
    const b = await post(base + "/api/leads/quote", goodLead({ listingId: 62, email: "SAME@example.com", startedAt: clock.t - 10_000 }), UA, "6.2.1.2");
    assert.deepEqual([a.status, b.status], [200, 200]);
    assert.equal(m.leads.length, 1);
    clock.t += 6 * 60_000; // > 10 min after the first: a genuine new request
    const c = await post(base + "/api/leads/quote", goodLead({ listingId: 62, email: "same@example.com", startedAt: clock.t - 10_000 }), UA, "6.2.1.3");
    assert.equal(c.status, 200);
    assert.equal(m.leads.length, 2);
  });
});

test("double submit: concurrent POSTs race -> unique conflict caught, one lead, both succeed", async () => {
  await withApp(true, async (base, m) => {
    // Force both requests past the pre-check so the insert-level uniqueness decides.
    m.store.findDuplicateLead = async () => false;
    const lead = goodLead({ listingId: 63 });
    const rs = await Promise.all([1, 2, 3].map(() => post(base + "/api/leads/quote", lead, UA, "6.3.1.1")));
    assert.deepEqual(rs.map((r) => r.status), [200, 200, 200]);
    assert.equal(m.leads.length, 1);
  });
});

test("supabase store maps unique violation 23505 to duplicate, other errors throw", async () => {
  const { supabaseLeadsStore } = await import("../server/leads/store");
  const mk = (error: any) => ({ from: () => ({ insert: async () => ({ error }) }) }) as any;
  const row: any = { ...goodLead(), dealerId: 1, consentText: "c", ipHash: null, contactHash: "a".repeat(32), dedupeBucket: 1 };
  assert.deepEqual(await supabaseLeadsStore(mk({ code: "23505", message: "dup" })).insertLead(row), { duplicate: true });
  assert.deepEqual(await supabaseLeadsStore(mk(null)).insertLead(row), { duplicate: false });
  await assert.rejects(() => supabaseLeadsStore(mk({ code: "08006", message: "down" })).insertLead(row));
});

test("idempotency key required and UUID-shaped", () => {
  assert.equal((validateLead(goodLead({ idempotencyKey: undefined }), T0) as any).error, "idempotency_key");
  assert.equal((validateLead(goodLead({ idempotencyKey: "abc" }), T0) as any).error, "idempotency_key");
});

test("form checks: ZIP same rule as server with ZIP message; contact error; server code -> field", async () => {
  const { checkLeadForm, serverErrorField, ZIP_MESSAGE } = await import("../shared/leadTracking");
  const ok = { name: "Pat Smith", email: "p@example.com", phone: "", zip: "32801", consent: true };
  assert.deepEqual(checkLeadForm(ok), {});
  for (const zip of ["3280", "abcde", "32801-12", ""]) {
    assert.equal(checkLeadForm({ ...ok, zip }).zip, ZIP_MESSAGE);
    assert.equal(validateLead(goodLead({ zip }), T0).ok, false); // server agrees
  }
  assert.equal(checkLeadForm({ ...ok, zip: "32801-1234" }).zip, undefined);
  assert.equal(checkLeadForm({ ...ok, email: "", phone: "" }).contact, "Add an email or a phone number.");
  assert.ok(checkLeadForm({ ...ok, phone: "123" }).phone);
  assert.ok(checkLeadForm({ ...ok, name: "see x.com" }).name);
  assert.equal(serverErrorField("zip"), "zip");
  assert.equal(serverErrorField("contact_required"), "contact");
  assert.equal(serverErrorField("rate_limited"), null);
});

test("form markup: labels, aria wiring, 44px targets, idempotency + no auto-resend", async () => {
  const src = readFileSync(new URL("../client/src/components/leads/LeadQuoteForm.tsx", import.meta.url), "utf8");
  for (const k of ["name", "email", "phone", "zip", "message", "consent"]) {
    assert.match(src, new RegExp(`htmlFor=\\{id\\("${k}"\\)\\}`), `label for ${k}`);
    assert.match(src, new RegExp(`id=\\{id\\("${k}"\\)\\}`), `control id ${k}`);
  }
  assert.doesNotMatch(src, /placeholder=/); // labels, not placeholders
  assert.match(src, /"aria-invalid"/);
  assert.match(src, /"aria-describedby"/);
  assert.match(src, /a11y\("email", "contact"\)/);
  assert.match(src, /a11y\("phone", "contact"\)/);
  assert.match(src, /<fieldset aria-describedby=\{fe\.contact \? id\("contact-err"\)/);
  assert.equal((src.match(/style=\{TAP\}/g) ?? []).length, 5); // name, email, phone, zip, submit
  assert.match(src, /const TAP = \{ minHeight: 44 \}/);
  assert.match(src, /idempotencyKey: idemKey\.current/);
  assert.match(src, /if \(inFlight\.current\) return;/);
  assert.match(src, /disabled=\{state === "sending"\}/);
  const tr = readFileSync(new URL("../client/src/components/leads/LeadTracking.tsx", import.meta.url), "utf8");
  assert.equal((tr.match(/style=\{\{ minHeight: 44 \}\}/g) ?? []).length, 2); // quote + contact buttons
  const { newIdempotencyKey } = await import("../client/src/components/leads/LeadQuoteForm");
  const k1 = newIdempotencyKey(), k2 = newIdempotencyKey();
  assert.match(k1, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(k1, k2);
});

test("draft SQL: idempotency file keeps lockdown", () => {
  const sql = readFileSync(new URL("../db/drafts/20261018_lead_idempotency_draft.sql", import.meta.url), "utf8");
  assert.match(sql, /create unique index if not exists uq_listing_leads_idempotency_key/);
  assert.match(sql, /create unique index if not exists uq_listing_leads_contact_bucket/);
  assert.match(sql, /revoke all on table public\.listing_leads from public, anon, authenticated/);
  assert.doesNotMatch(sql, /create policy|create (or replace )?function|grant /i);
});
