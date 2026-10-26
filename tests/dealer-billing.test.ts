import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Stripe from "stripe";
import { handleStripeEvent, verifyStripeEvent, priceForQuantity, type BillingDb, type SubscriptionRow } from "../server/dealer-billing";

// Dummy test-mode values (not real credentials).
const SECRET = "whsec_unit_test_only";
process.env.STRIPE_PRICE_FEATURED = "price_featured_test";
process.env.STRIPE_PRICE_INSIGHTS = "price_insights_test";
process.env.STRIPE_PRICE_ZIP_FEATURED = "price_zipf_test";
process.env.STRIPE_PRICE_ZIP_LISTINGS = "price_zipl_test";
const stripe = new Stripe("sk_test_unit_test_only");

function memDb() {
  const events = new Set<string>(); const subs = new Map<number, SubscriptionRow>(); let writes = 0; const synced: number[] = [];
  const db: BillingDb = {
    async hasEvent(id) { return events.has(id); },
    async recordEvent(id) { events.add(id); },
    async upsertSubscription(r) { writes++; subs.set(r.dealer_id, r); },
    async syncZipPlacements(id) { synced.push(id); },
    async findDealerBySubscription(id) { for (const r of subs.values()) if (r.stripe_subscription_id === id) return r.dealer_id; return null; },
  };
  return { db, subs, events, synced, writes: () => writes };
}
const sub = (over: any = {}): any => ({ id: "sub_1", object: "subscription", customer: "cus_1", status: "active", cancel_at_period_end: false,
  current_period_end: 1893456000, metadata: { dealer_id: "7", plan: "featured" }, items: { data: [{ price: { id: "price_featured_test" } }] }, ...over });
const ev = (id: string, type: string, object: any): any => ({ id, type, data: { object } });

test("bad signature is rejected", () => {
  const body = JSON.stringify(ev("evt_x", "customer.subscription.updated", sub()));
  assert.throws(() => verifyStripeEvent(stripe, Buffer.from(body), "t=1,v1=deadbeef", SECRET));
  assert.throws(() => verifyStripeEvent(stripe, Buffer.from(body), undefined, SECRET));
  const header = stripe.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_other" });
  assert.throws(() => verifyStripeEvent(stripe, Buffer.from(body), header, SECRET));
});

test("valid signature over raw body is accepted; tampered body rejected", () => {
  const body = JSON.stringify(ev("evt_ok", "customer.subscription.updated", sub()));
  const header = stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });
  assert.equal(verifyStripeEvent(stripe, Buffer.from(body), header, SECRET).id, "evt_ok");
  assert.throws(() => verifyStripeEvent(stripe, Buffer.from(body.replace("featured", "insights")), header, SECRET));
});

test("checkout.session.completed creates active row with right plan", async () => {
  const m = memDb();
  const r = await handleStripeEvent(ev("evt_1", "checkout.session.completed", { mode: "subscription", subscription: "sub_1", metadata: { dealer_id: "7", plan: "insights" } }),
    m.db, async () => sub({ items: { data: [{ price: { id: "price_insights_test" } }] } }));
  assert.equal(r, "processed");
  assert.equal(m.subs.get(7)?.status, "active");
  assert.equal(m.subs.get(7)?.plan, "insights");
});

test("same event twice makes no duplicate changes", async () => {
  const m = memDb();
  const e = ev("evt_dup", "customer.subscription.updated", sub());
  assert.equal(await handleStripeEvent(e, m.db, async () => sub()), "processed");
  const snapshot = JSON.stringify([...m.subs]); const w = m.writes();
  assert.equal(await handleStripeEvent(e, m.db, async () => sub()), "duplicate");
  assert.equal(m.writes(), w);
  assert.equal(JSON.stringify([...m.subs]), snapshot.replace(/"updated_at":"[^"]+"/, (x) => x));
});

test("plan switch, past_due, cancel-at-period-end, deleted", async () => {
  const m = memDb();
  await handleStripeEvent(ev("e1", "customer.subscription.updated", sub()), m.db, async () => sub());
  await handleStripeEvent(ev("e2", "customer.subscription.updated", sub({ items: { data: [{ price: { id: "price_insights_test" } }] } })), m.db, async () => sub());
  assert.equal(m.subs.get(7)?.plan, "insights");
  await handleStripeEvent(ev("e3", "customer.subscription.updated", sub({ status: "past_due" })), m.db, async () => sub());
  assert.equal(m.subs.get(7)?.status, "past_due");
  await handleStripeEvent(ev("e4", "customer.subscription.updated", sub({ cancel_at_period_end: true })), m.db, async () => sub());
  assert.equal(m.subs.get(7)?.status, "active"); assert.equal(m.subs.get(7)?.cancel_at_period_end, true);
  await handleStripeEvent(ev("e5", "customer.subscription.deleted", sub({ status: "canceled", metadata: {} })), m.db, async () => sub());
  assert.equal(m.subs.get(7)?.status, "canceled");
});

test("HTTP: /api/stripe/webhook returns 400 on bad signature", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_unit_test_only";
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  const { registerDealerRoutes } = await import("../server/dealer-portal");
  const app = express();
  app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
  registerDealerRoutes(app as any, (_q: any, r: any) => r.status(401).end());
  const srv = app.listen(0); const port = (srv.address() as any).port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=bad" }, body: "{}" });
    assert.equal(res.status, 400);
    const res2 = await fetch(`http://127.0.0.1:${port}/api/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(res2.status, 400);
    const res3 = await fetch(`http://127.0.0.1:${port}/api/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(res3.status, 401, "checkout requires auth");
  } finally { srv.close(); }
});

test("bot filter", async () => {
  const { isBotUserAgent } = await import("../server/dealer-portal");
  assert.equal(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(isBotUserAgent(undefined), true);
  assert.equal(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Safari/604.1"), false);
});

test("webhook syncs ZIP quantities per product and triggers placement sync", async () => {
  const m = memDb();
  const items = { data: [{ price: { id: "price_featured_test" }, quantity: 1 }, { price: { id: "price_zipf_test" }, quantity: 4 }, { price: { id: "price_zipl_test" }, quantity: 2 }] };
  await handleStripeEvent(ev("z1", "customer.subscription.updated", sub({ items })), m.db, async () => sub());
  assert.equal(m.subs.get(7)?.plan, "featured");
  assert.equal(m.subs.get(7)?.zip_featured_quantity, 4);
  assert.equal(m.subs.get(7)?.zip_listings_quantity, 2);
  assert.deepEqual(m.synced, [7]);
  // zip-only subscription (no base plan), quantity drops
  await handleStripeEvent(ev("z2", "customer.subscription.updated", sub({ items: { data: [{ price: { id: "price_zipf_test" }, quantity: 1 }] } })), m.db, async () => sub());
  assert.equal(m.subs.get(7)?.plan, null);
  assert.equal(m.subs.get(7)?.zip_featured_quantity, 1);
  assert.equal(m.subs.get(7)?.zip_listings_quantity, 0);
  // deleted => canceled + sync (placements then go inactive in SQL)
  await handleStripeEvent(ev("z3", "customer.subscription.deleted", sub({ status: "canceled", items: { data: [{ price: { id: "price_zipf_test" }, quantity: 1 }] } })), m.db, async () => sub());
  assert.equal(m.subs.get(7)?.status, "canceled");
  assert.deepEqual(m.synced, [7, 7, 7]);
});

test("price preview: graduated tiers make the total rise with every ZIP", () => {
  const graduated = { billing_scheme: "tiered", tiers_mode: "graduated", tiers: [
    { up_to: 3, unit_amount: 4900, flat_amount: null }, { up_to: 10, unit_amount: 3900, flat_amount: null }, { up_to: null, unit_amount: 2900, flat_amount: null }] };
  assert.equal(priceForQuantity(graduated, 0), 0);
  assert.equal(priceForQuantity(graduated, 1), 4900);
  assert.equal(priceForQuantity(graduated, 3), 14700);
  assert.equal(priceForQuantity(graduated, 5), 14700 + 2 * 3900);
  assert.equal(priceForQuantity(graduated, 12), 14700 + 7 * 3900 + 2 * 2900);
  let prev = 0; for (let n = 1; n <= 30; n++) { const t = priceForQuantity(graduated, n); assert.ok(t > prev); prev = t; }
  assert.equal(priceForQuantity({ billing_scheme: "per_unit", unit_amount: 5000 }, 3), 15000);
  assert.equal(priceForQuantity({ billing_scheme: "tiered", tiers_mode: "volume", tiers: [{ up_to: 3, unit_amount: 4900, flat_amount: null }, { up_to: null, unit_amount: 3900, flat_amount: null }] }, 4), 15600);
});
