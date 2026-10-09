// Unit tests for the dealer-sync scheduler draft. No network, no database: MemoryRunStore + fake fetchers.
import test from "node:test";
import assert from "node:assert/strict";
import { gcqUrlNorm } from "../script/dealer-sync/url-norm";
import { planFetchGroups } from "../script/dealer-sync/plan";
import { FetchError, causeForHttpStatus } from "../script/dealer-sync/outcome";
import { runGroup } from "../script/dealer-sync/runner";
import { MemoryRunStore } from "../script/dealer-sync/store-memory";
import { preflight } from "../script/dealer-sync/gates";
import { redact } from "../script/dealer-sync/redact";
import { main } from "../script/dealer-sync/main";
import type { DealerFetcher, DealerRow, FetchGroup, FetchResult } from "../script/dealer-sync/types";

const d = (id: number, slug: string, adapter_key: string | null, sync_enabled = true): DealerRow => ({ id, slug, adapter_key, sync_enabled });
const fetcherOf = (key: string, fn: (g: FetchGroup) => Promise<FetchResult>): DealerFetcher => ({ adapterKey: key, version: "0", fetch: fn });
const opts = (f: DealerFetcher) => ({ runId: "00000000-0000-0000-0000-000000000000", gitSha: "abcdef1234", fetchers: new Map([[f.adapterKey, f]]) });

test("gcqUrlNorm mirrors DE gcq_url_norm and is idempotent", () => {
  assert.equal(gcqUrlNorm(" HTTPS://www.Hawgsav.com/Inventory/Cart-1/?a=1#x "), "hawgsav.com/inventory/cart-1");
  assert.equal(gcqUrlNorm("http://example.com///"), "example.com");
  assert.equal(gcqUrlNorm("https://www."), null);
  for (const u of ["https://www.a.com/b/", "a.com/b?x"]) assert.equal(gcqUrlNorm(gcqUrlNorm(u)), gcqUrlNorm(u));
});

test("plan: keeps adapter_key NULL dealers, groups shared adapters, drops disabled", () => {
  const groups = planFetchGroups([d(7, "botero-a", "botero"), d(8, "botero-b", "botero"), d(9, "solo", null), d(10, "off", "x", false), d(11, "dx1", "golf_rider")]);
  assert.deepEqual(groups.map((g) => [g.adapterKey, g.fetchGroup, g.dealers.map((x) => x.id)]), [
    ["botero", "botero", [7, 8]],
    ["generic", null, [9]],
    ["golf_rider", null, [11]],
  ]);
});

test("0-URL fetch is failed/zero_urls, never success", async () => {
  const store = new MemoryRunStore();
  const f = fetcherOf("a", async () => ({ httpStatus: 200, items: [], complete: true }));
  await runGroup(store, { adapterKey: "a", fetchGroup: null, dealers: [d(1, "one", "a")] }, opts(f));
  assert.equal(store.runs[0].finished!.outcome, "failed");
  assert.equal(store.runs[0].finished!.errorCause, "zero_urls");
});

test("shared feed: one row per sibling, fetched_count after location tagging, seen URLs per sibling", async () => {
  const store = new MemoryRunStore();
  const f = fetcherOf("botero", async () => ({
    httpStatus: 200, complete: true,
    items: [
      { url: "https://www.x.com/c1", dealerId: 7 }, { url: "https://x.com/c1/", dealerId: 7 },
      { url: "https://x.com/c2", dealerId: 7 }, { url: "https://x.com/c3", dealerId: 8 },
    ],
    siteCounts: new Map([[7, { count: 3, source: "sitemap_urls" as const }]]),
  }));
  await runGroup(store, { adapterKey: "botero", fetchGroup: "botero", dealers: [d(7, "a", "botero"), d(8, "b", "botero")] }, opts(f));
  assert.equal(store.runs.length, 2);
  assert.ok(store.runs.every((r) => r.fetchGroup === "botero"));
  const [r7, r8] = store.runs;
  assert.equal(r7.finished!.outcome, "success");
  assert.equal(r7.finished!.fetchedCount, 3);
  assert.equal(r7.finished!.siteCount, 3);
  assert.equal(r7.urls.length, 2); // url_norm dedupe
  assert.equal(r8.finished!.fetchedCount, 1);
  assert.equal(r8.finished!.siteCount, null); // never guessed
});

test("shared feed with untaggable items is partial/location_split_unknown", async () => {
  const store = new MemoryRunStore();
  const f = fetcherOf("shiver", async () => ({ httpStatus: 200, complete: true, items: [{ url: "https://s.com/a", dealerId: null }, { url: "https://s.com/b", dealerId: 96 }] }));
  await runGroup(store, { adapterKey: "shiver", fetchGroup: "shiver", dealers: [d(96, "t", "shiver"), d(97, "v", "shiver")] }, opts(f));
  assert.ok(store.runs.every((r) => r.finished!.outcome === "partial" && r.finished!.errorCause === "location_split_unknown"));
});

test("errors: 403 → blocked, 429 → blocked, 404 → failed/http_error, exception → adapter_exception; rows always finished", async () => {
  assert.equal(causeForHttpStatus(404), "http_error");
  for (const [err, outcome, cause] of [
    [new FetchError("forbidden", causeForHttpStatus(403), 403), "blocked", "blocked_antibot"],
    [new FetchError("slow down", causeForHttpStatus(429), 429), "blocked", "blocked_rate_limited"],
    [new FetchError("gone", causeForHttpStatus(404), 404), "failed", "http_error"],
    [new TypeError("boom"), "failed", "adapter_exception"],
  ] as const) {
    const store = new MemoryRunStore();
    const f = fetcherOf("a", async () => { throw err; });
    await runGroup(store, { adapterKey: "a", fetchGroup: null, dealers: [d(1, "one", "a")] }, opts(f));
    assert.equal(store.runs[0].finished!.outcome, outcome);
    assert.equal(store.runs[0].finished!.errorCause, cause);
  }
});

test("no fetcher for adapter → failed/not_configured", async () => {
  const store = new MemoryRunStore();
  const f = fetcherOf("other", async () => ({ httpStatus: 200, items: [], complete: true }));
  await runGroup(store, { adapterKey: "a", fetchGroup: null, dealers: [d(1, "one", "a")] }, opts(f));
  assert.equal(store.runs[0].finished!.errorCause, "not_configured");
});

test("preflight gates", () => {
  assert.equal(preflight({}).kind, "DISABLED");
  assert.equal(preflight({ SYNC_SCHEDULER_ENABLED: "true" }).kind, "BLOCKED_G2");
  const m = preflight({ SYNC_SCHEDULER_ENABLED: "true", GCQ_G2_ROTATION_CONFIRMED: "true", SUPABASE_URL: "https://p.supabase.co" });
  assert.equal(m.kind, "MISSING_ENV");
  assert.deepEqual((m as { missing: string[] }).missing, ["SUPABASE_SERVICE_ROLE_KEY"]);
});

test("main: tables absent → SKIPPED_NO_TABLES, exit 0, zero writes; no fetchers → zero writes", async () => {
  const env = { SYNC_SCHEDULER_ENABLED: "true", GCQ_G2_ROTATION_CONFIRMED: "true", SUPABASE_URL: "https://p.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-placeholder-not-a-key" };
  const absent = new MemoryRunStore([d(1, "one", "a")], false);
  assert.equal(await main(env, () => absent, new Map()), 0);
  assert.equal(absent.runs.length, 0);
  const present = new MemoryRunStore([d(1, "one", "a")], true);
  assert.equal(await main(env, () => present, new Map()), 0);
  assert.equal(present.runs.length, 0);
  assert.equal(await main({}, () => { throw new Error("store must not be created when disabled"); }, new Map()), 0);
});

test("redact masks env secrets, JWT-shaped tokens and query strings", () => {
  const env = { SUPABASE_SERVICE_ROLE_KEY: "placeholder-secret-value" };
  const out = redact("k=placeholder-secret-value t=eyJabcdefghij.eyJabcdefghij.abcdefghijkl u=https://d.com/api?key=zzz", env);
  assert.ok(!out.includes("placeholder-secret-value") && !out.includes("eyJabcdefghij") && !out.includes("zzz"));
});
