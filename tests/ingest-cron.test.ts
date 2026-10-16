// Ingest cron + stall alert. No network, no DB: all deps are fakes.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateStall, runIngestCron, STALL_DAYS, type IngestDeps } from "../script/dealer-sync/ingest-cron";
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
  const r = await sendOwnerAlert({ subject: "x", text: "y" }, { RESEND_API_KEY: "k", OWNER_ALERT_EMAIL: "o@example.com" },
    async (url, init) => { seen = { url, init }; return { ok: true, status: 200 }; });
  assert.equal(r.sent, true); assert.equal(seen.url, "https://api.resend.com/emails");
  assert.deepEqual(JSON.parse(seen.init.body).to, ["o@example.com"]);
  assert.equal(JSON.stringify(r).includes("k\""), false);
});
test("vercel.json registers the cron on /api/cron/ingest", () => {
  assert.ok((vercel as any).crons.some((c: any) => c.path === "/api/cron/ingest"));
});
