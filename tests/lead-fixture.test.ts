import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import type { AddressInfo } from "node:net";
import { build } from "esbuild";
import { randomUUID } from "node:crypto";
import { assertFixtureAllowed, fixtureModeRequested } from "../server/fixture/guard";

test("fixture guard: refuses production, ignores APP_ENV", () => {
  assert.throws(() => assertFixtureAllowed({ GCQ_FIXTURE_MODE: "1", NODE_ENV: "production" }), /refused/);
  assert.throws(() => assertFixtureAllowed({ GCQ_FIXTURE_MODE: "1", VERCEL_ENV: "production" }), /refused/);
  assert.throws(() => assertFixtureAllowed({ GCQ_FIXTURE_MODE: "1", VERCEL_ENV: " Production " }), /refused/);
  assert.throws(() => assertFixtureAllowed({ NODE_ENV: "development" }), /not set/);
  assert.doesNotThrow(() => assertFixtureAllowed({ GCQ_FIXTURE_MODE: "1", NODE_ENV: "development", APP_ENV: "production" }));
  assert.equal(fixtureModeRequested({}), false);
});

test("fixture import graph contains no Supabase client code", async () => {
  const r = await build({
    entryPoints: ["server/fixture/app.ts"], bundle: true, platform: "node", format: "esm", write: false,
    metafile: true, packages: "external", alias: { "@shared": "./shared" }, logLevel: "silent",
  });
  const inputs = Object.keys(r.metafile!.inputs);
  assert.ok(inputs.some((i) => i.includes("server/leads/routes.ts")));
  for (const i of inputs) assert.doesNotMatch(i, /supabase/i, i);
  const imports = Object.values(r.metafile!.outputs).flatMap((o) => o.imports.map((x) => x.path));
  for (const p of imports) assert.doesNotMatch(p, /supabase|pg\b|postgres/i, p);
});

test("fixture app: no Supabase client constructed, no outbound network", async () => {
  const outbound: string[] = [];
  const realConnect = net.Socket.prototype.connect;
  (net.Socket.prototype as any).connect = function (...args: any[]) {
    const o = typeof args[0] === "object" ? args[0] : { port: args[0], host: args[1] };
    const host = String(o?.host ?? "localhost");
    if (!/^(127\.0\.0\.1|localhost|::1)$/.test(host) && !o?.path) outbound.push(`${host}:${o?.port}`);
    return (realConnect as any).apply(this, args);
  };
  const realFetch = globalThis.fetch;
  const fetched: string[] = [];
  globalThis.fetch = (async (u: any, i?: any) => { const s = String(u); if (!s.startsWith("http://127.0.0.1:")) fetched.push(s); return realFetch(u, i); }) as typeof fetch;
  const saved = { ...process.env };
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const { createFixtureApp } = await import("../server/fixture/app");
    const logs: unknown[][] = [];
    const fx = createFixtureApp({ log: (...a) => logs.push(a) });
    const srv = fx.app.listen(0, "127.0.0.1");
    await new Promise((r) => srv.once("listening", r));
    const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
    const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
    const post = (p: string, b: unknown, ip = "5.5.5.5") => fetch(base + p, { method: "POST", headers: { "content-type": "application/json", "user-agent": UA, "x-forwarded-for": ip }, body: JSON.stringify((b as any)?.name ? { idempotencyKey: randomUUID(), ...(b as any), email: `f${Math.random().toString(36).slice(2)}@example.com` } : b) });
    try {
      assert.equal((await (await fetch(base + "/api/listings/990001")).json()).dealerId, 9001);
      assert.equal((await (await fetch(base + "/api/listings/990002")).json()).dealerId, undefined);
      await post("/api/leads/event", { eventType: "contact_click", listingId: 990002, sessionId: "abcdef123456" });
      await new Promise((r) => setTimeout(r, 20));
      assert.deepEqual(fx.events.map((e) => [e.eventType, e.dealerId]), [["contact_click", null]]);
      const lead = { listingId: 990001, name: "Pat Smith", email: "pat@example.com", zip: "32801", consent: true, website: "" };
      assert.deepEqual(await (await post("/api/leads/quote", { ...lead, startedAt: Date.now() })).json(), { ok: true, fixtureBlocked: "min-fill" });
      assert.deepEqual(await (await post("/api/leads/quote", { ...lead, website: "x", startedAt: Date.now() - 5000 }, "6.6.6.6")).json(), { ok: true, fixtureBlocked: "honeypot" });
      assert.equal(fx.leads.length, 0);
      assert.equal((await post("/api/leads/quote", { ...lead, startedAt: Date.now() - 5000 }, "7.7.7.7")).status, 200);
      assert.equal(fx.leads[0].dealerId, 9001);
      await fetch(base + "/api/__fixture/rate-limit?on=1");
      assert.equal((await post("/api/leads/quote", { ...lead, startedAt: Date.now() - 5000 }, "8.8.4.4")).status, 429);
      assert.equal((await post("/api/leads/quote", { ...lead, listingId: 990002, startedAt: Date.now() - 5000 }, "9.9.1.1")).status, 429); // forced
      await fetch(base + "/api/__fixture/rate-limit?on=0");
      const nd = await post("/api/leads/quote", { ...lead, listingId: 990002, startedAt: Date.now() - 5000 }, "9.9.1.2");
      assert.equal(nd.status, 200);
      assert.equal(fx.leads.at(-1)!.dealerId, null); // no-dealer lead stored
      // salt-missing toggle: same fail-closed path as a missing LEAD_IP_SALT
      await fetch(base + "/api/__fixture/salt-missing?on=1");
      assert.equal((await (await fetch(base + "/api/leads/status")).json()).enabled, false);
      const before = fx.leads.length;
      assert.equal((await post("/api/leads/quote", { ...lead, startedAt: Date.now() - 5000 }, "9.9.1.3")).status, 503);
      assert.equal(fx.leads.length, before);
      await fetch(base + "/api/__fixture/salt-missing?on=0");
      assert.equal((await (await fetch(base + "/api/leads/status")).json()).enabled, true);
      // fixture admin: header-only dev password
      const { FIXTURE_ADMIN_PASSWORD } = await import("../server/fixture/app");
      assert.equal((await fetch(base + "/api/admin/leads")).status, 401);
      assert.equal((await fetch(base + "/api/admin/leads?token=" + FIXTURE_ADMIN_PASSWORD)).status, 400);
      const list = await (await fetch(base + "/api/admin/leads", { headers: { "x-admin-token": FIXTURE_ADMIN_PASSWORD } })).json();
      assert.equal(list.rows[0].dealer_name, null);
      assert.equal(list.rows[0].listing_title, "FIXTURE 2021 EZGO Valor Private Seller");
      assert.equal((await fetch(base + "/api/anything-else")).status, 404);
      assert.ok(logs.some((l) => String(l[0]).includes("blocked (min-fill)")));
    } finally { srv.close(); }
    assert.deepEqual(outbound, []);
    assert.deepEqual(fetched, []);
  } finally {
    net.Socket.prototype.connect = realConnect; globalThis.fetch = realFetch; Object.assign(process.env, saved);
  }
});
