import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import type { AddressInfo } from "node:net";
import {
  parseFlag, isBotUserAgent, validateEvent, validateLead, Deduper, RateLimiter,
  LEAD_CONSENT_TEXT, LEAD_SUCCESS_TEXT, LEAD_MIN_FILL_MS,
} from "../shared/leadTracking";
import { registerLeadRoutes } from "../server/leads/routes";
import { aggregateMonthly, monthBounds, memoryRateLimits, windowStart, type LeadsStore } from "../server/leads/store";
import { volumeAlert } from "../shared/leadTracking";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const T0 = 1_760_000_000_000;
const goodLead = (o: Record<string, unknown> = {}) => ({
  listingId: 5, name: "Pat Smith", email: "pat@example.com", phone: "", zip: "32801",
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

function memStore() {
  const events: any[] = [], leads: any[] = [];
  const fail = { event: false, lead: false };
  const store: LeadsStore = {
    async getPublicListing(id) { return id === 404 ? null : { listingId: id, dealerId: id === 12 ? null : 9 }; },
    async insertEvent(e) { if (fail.event) throw new Error("db down"); events.push(e); },
    async insertLead(l) { if (fail.lead) throw new Error("db down"); leads.push(l); },
    hitRateLimit: memoryRateLimits(),
    async cleanup() { return { leads: 1, events: 2, rate_limits: 3 }; },
    async dailyEventCounts() { return Array.from({ length: 15 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, events: i === 14 ? 1000 : 100 })); },
    async monthlyReport(m) { return aggregateMonthly(m, events.map((e) => ({ event_type: e.eventType, dealer_id: e.dealerId })), leads.map((l) => ({ dealer_id: l.dealerId })), new Map([[9, "D9"]])); },
  };
  return { store, events, leads, fail };
}

async function withApp(enabled: boolean, fn: (base: string, m: ReturnType<typeof memStore>, clock: { t: number }) => Promise<void>) {
  const app = express();
  app.use(express.json());
  const m = memStore();
  const clock = { t: T0 };
  const admin = (req: any, res: any, next: any) => (req.headers["x-admin-token"] === "pw" ? next() : res.status(401).end());
  const logs: string[] = [];
  const registered = registerLeadRoutes(app, admin, { enabled, store: () => m.store, now: () => clock.t, ipSalt: "s", cronSecret: "cs", log: (msg) => logs.push(msg) });
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
    assert.equal((await post(base + "/api/leads/quote", goodLead(), UA, "1.1.1.1")).status, 429); // same ip+listing
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
    assert.deepEqual(await (await c({ authorization: "Bearer cs" })).json(), { ok: true, deleted: { leads: 1, events: 2, rate_limits: 3 } });
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
