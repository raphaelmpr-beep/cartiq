// Ingest cron + stall alert. No network, no DB: all deps are fakes.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateStall, runIngestCron, STALL_DAYS, DEFAULT_PENDING_MAX_AGE_HOURS, pendingMaxAgeHours, type IngestDeps } from "../script/dealer-sync/ingest-cron";
import { sendOwnerAlert } from "../script/dealer-sync/owner-alert";
import { INGEST_OWNER } from "../script/dealer-sync/owner";
import vercel from "../vercel.json" with { type: "json" };

const NOW = new Date("2026-10-16T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
function deps(over: Partial<IngestDeps> = {}, env: Record<string, string> = {}) {
  const calls = { sync: 0, read: 0, alerts: [] as string[] };
  const d: IngestDeps = {
    env: { CRON_SECRET: "s", SYNC_SCHEDULER_ENABLED: "true", ...env },
    now: () => NOW,
    runSync: async () => { calls.sync++; return { new_queued: 1, errors: 0 }; },
    latestNewListingAt: async () => { calls.read++; return daysAgo(1); },
    sendAlert: async (m) => { calls.alerts.push(m.subject + "\n" + m.text); return { sent: true }; },
    ...over,
  };
  return { d, calls };
}

test("owner is Raphael", () => assert.equal(INGEST_OWNER.name, "Raphael Martinez"));
test("stall threshold is 6 days", () => assert.equal(STALL_DAYS, 6));
test("unauthorized without CRON_SECRET bearer: nothing runs", async () => {
  const { d, calls } = deps();
  assert.equal((await runIngestCron("Bearer wrong", d)).status, "UNAUTHORIZED");
  assert.equal((await runIngestCron(undefined, { ...d, env: { SYNC_SCHEDULER_ENABLED: "true" } })).status, "UNAUTHORIZED");
  assert.equal(calls.sync + calls.read + calls.alerts.length, 0);
});
test("disabled by default: no sync, no DB read, no alert", async () => {
  for (const v of [undefined, "", "false", "1", "TRUE"]) {
    const { d, calls } = deps({}, {});
    d.env = { CRON_SECRET: "s", ...(v === undefined ? {} : { SYNC_SCHEDULER_ENABLED: v }) };
    assert.equal((await runIngestCron("Bearer s", d)).status, "DISABLED");
    assert.equal(calls.sync + calls.read + calls.alerts.length, 0);
  }
});
test("healthy run: calls existing ingest, no alert", async () => {
  const { d, calls } = deps();
  const r = await runIngestCron("Bearer s", d);
  assert.equal(r.status, "RAN"); assert.equal(calls.sync, 1); assert.equal(calls.alerts.length, 0);
});
test("exactly 6 days is not a stall; >6 days alerts owner", async () => {
  assert.equal(evaluateStall({ now: NOW, lastNewListingAt: daysAgo(6), runOk: true }).alert, false);
  const { d, calls } = deps({ latestNewListingAt: async () => daysAgo(6.5) });
  await runIngestCron("Bearer s", d);
  assert.equal(calls.alerts.length, 1); assert.match(calls.alerts[0], /6\.5 days/); assert.match(calls.alerts[0], /Raphael/);
});
test("failed run alerts even when listings are fresh (throw or errors>0)", async () => {
  const a = deps({ runSync: async () => { throw new Error("boom"); } });
  const r = await runIngestCron("Bearer s", a.d);
  assert.equal(r.status === "RAN" && r.runOk, false); assert.match(a.calls.alerts[0], /failed: boom/);
  const b = deps({ runSync: async () => ({ errors: 3 }) });
  await runIngestCron("Bearer s", b.d); assert.match(b.calls.alerts[0], /3 error/);
});
test("no timestamp found (or read error) alerts", async () => {
  const { d, calls } = deps({ latestNewListingAt: async () => { throw new Error("db"); } });
  await runIngestCron("Bearer s", d); assert.match(calls.alerts[0], /no ingested listing timestamp/);
});
test("email path: skips without config, posts to Resend with owner address, never logs key", async () => {
  assert.equal((await sendOwnerAlert({ subject: "x", text: "y" }, {})).skipped !== undefined, true);
  let seen: any;
  const r = await sendOwnerAlert({ subject: "x", text: "y" }, { GCQ_RESEND_API_KEY: "k", OWNER_ALERT_EMAIL: "o@example.com" },
    async (url, init) => { seen = { url, init }; return { ok: true, status: 200 }; });
  assert.equal(r.sent, true); assert.equal(seen.url, "https://api.resend.com/emails");
  assert.deepEqual(JSON.parse(seen.init.body).to, ["o@example.com"]);
  assert.equal(JSON.stringify(r).includes("k\""), false);
});
test("vercel.json registers the cron on /api/cron/ingest", () => {
  assert.ok((vercel as any).crons.some((c: any) => c.path === "/api/cron/ingest"));
});

test("Resend: uses GCQ_RESEND_API_KEY only (TAW's RESEND_API_KEY ignored) and returns message id", async () => {
  let calls = 0;
  const f = async () => { calls++; return { ok: true, status: 200, json: async () => ({ id: "re_123" }) }; };
  const skip = await sendOwnerAlert({ subject: "x", text: "y" }, { RESEND_API_KEY: "taw", OWNER_ALERT_EMAIL: "o@example.com" }, f);
  assert.equal(skip.sent, false); assert.equal(calls, 0); assert.match(skip.skipped!, /GCQ_RESEND_API_KEY/);
  const r = await sendOwnerAlert({ subject: "x", text: "y" }, { GCQ_RESEND_API_KEY: "k", OWNER_ALERT_EMAIL: "o@example.com" }, f);
  assert.equal(r.messageId, "re_123");
  const bad = await sendOwnerAlert({ subject: "x", text: "y" }, { GCQ_RESEND_API_KEY: "k", OWNER_ALERT_EMAIL: "o@example.com" },
    async () => ({ ok: false, status: 500, json: async () => ({ id: "nope" }) }));
  assert.equal(bad.sent, false); assert.equal(bad.messageId, null);
});
test("run log records alert_message_id; null when no alert or send failed", async () => {
  const a = deps({ latestNewListingAt: async () => daysAgo(9), sendAlert: async () => ({ sent: true, messageId: "re_9" }) });
  const r = await runIngestCron("Bearer s", a.d);
  assert.ok(r.status === "RAN"); assert.deepEqual(r.runLog, { run_ok: true, error_summary: null, alert_sent: true, alert_message_id: "re_9" });
  const b = deps();
  const r2 = await runIngestCron("Bearer s", b.d);
  assert.ok(r2.status === "RAN"); assert.equal(r2.runLog.alert_sent, false); assert.equal(r2.runLog.alert_message_id, null);
  const c = deps({ latestNewListingAt: async () => daysAgo(9), sendAlert: async () => ({ sent: true }) });
  const r3 = await runIngestCron("Bearer s", c.d);
  assert.ok(r3.status === "RAN"); assert.equal(r3.runLog.alert_sent && r3.runLog.alert_message_id === null, true); // SRE monitor case
});
test("oldest-pending alert: names Raphael, threshold default 72h and configurable", async () => {
  assert.equal(pendingMaxAgeHours({}), DEFAULT_PENDING_MAX_AGE_HOURS);
  assert.equal(DEFAULT_PENDING_MAX_AGE_HOURS, 72);
  assert.equal(pendingMaxAgeHours({ PENDING_MAX_AGE_HOURS: "24" }), 24);
  assert.equal(pendingMaxAgeHours({ PENDING_MAX_AGE_HOURS: "junk" }), 72);
  assert.equal(evaluateStall({ now: NOW, lastNewListingAt: daysAgo(1), runOk: true, oldestPendingAt: daysAgo(2) }).alert, false);
  const a = deps({ oldestPendingAt: async () => daysAgo(4) });
  await runIngestCron("Bearer s", a.d);
  assert.equal(a.calls.alerts.length, 1); assert.match(a.calls.alerts[0], /oldest pending_imports.*96\.0 h \(> 72 h\); reviewer: Raphael Martinez/);
  const b = deps({ oldestPendingAt: async () => daysAgo(2) }, { PENDING_MAX_AGE_HOURS: "24" });
  await runIngestCron("Bearer s", b.d); assert.match(b.calls.alerts[0], /> 24 h/);
  const c = deps({ oldestPendingAt: async () => { throw new Error("db"); } });
  await runIngestCron("Bearer s", c.d); assert.equal(c.calls.alerts.length, 0);
});
test("disabled scheduler never reads pending queue", async () => {
  let n = 0; const { d } = deps({ oldestPendingAt: async () => { n++; return daysAgo(30); } });
  d.env = { CRON_SECRET: "s" };
  assert.equal((await runIngestCron("Bearer s", d)).status, "DISABLED"); assert.equal(n, 0);
});
test("SQL draft: message id column, revokes, index, check, UNKNOWN partial index", () => {
  const sql = readFileSync(new URL("../supabase/drafts/ingest_cron_runs.DRAFT.sql", import.meta.url), "utf8");
  assert.match(sql, /alert_message_id text/);
  assert.match(sql, /revoke all on public\.ingest_cron_runs from anon, authenticated;/);
  assert.match(sql, /revoke all on sequence public\.ingest_cron_runs_id_seq from anon, authenticated;/);
  assert.match(sql, /\(started_at desc\)/);
  assert.match(sql, /check \(finished_at is null or finished_at >= started_at\)/);
  assert.match(sql, /pending_imports \(found_at\) where status = 'pending'/);
  assert.match(sql, /UNKNOWN/); assert.match(sql, /NOT APPLIED/);
});
