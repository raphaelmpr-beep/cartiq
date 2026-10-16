// Auto-publish gate. Pure functions; no network, no DB.
import test from "node:test";
import assert from "node:assert/strict";
import { autopublishEnabled, checkListing, decideAutopublish, extractSalePrice, pageShowsSold, urlIsListing, type Candidate, type PageFacts } from "../script/dealer-sync/autopublish";

const URL1 = "https://www.dealer.com/inventory/2024-evolution-d5-123";
const cand: Candidate = { url: URL1, price: 9995, year: 2024, make: "Evolution", model: "D5 Maverick" };
const page = (o: Partial<PageFacts> = {}): PageFacts => ({ requestedUrl: URL1, finalUrl: URL1, status: 200, sold: false, salePrice: 9995, year: 2024, make: "EVOLUTION", model: "D5-Maverick", ...o });
const ON = { INGEST_AUTOPUBLISH_ENABLED: "true" };

test("off by default: everything queues", () => {
  for (const v of [undefined, "", "1", "TRUE", "false"]) {
    const env = v === undefined ? {} : { INGEST_AUTOPUBLISH_ENABLED: v };
    assert.equal(autopublishEnabled(env), false);
    assert.equal(decideAutopublish(env, cand, page()).action, "queue");
  }
});
test("all four checks pass -> publish", () => assert.deepEqual(decideAutopublish(ON, cand, page()), { action: "publish", reasons: [] }));
test("(a) redirect to dealer homepage with 200 -> queue", () => {
  const d = decideAutopublish(ON, cand, page({ finalUrl: "https://www.dealer.com/" }));
  assert.equal(d.action, "queue"); assert.match(d.reasons[0], /url_is_listing: resolves to dealer homepage/);
});
test("(a) redirect to category / off-site / non-2xx -> fail", () => {
  assert.equal(urlIsListing(URL1, "https://www.dealer.com/inventory").ok, false);
  assert.match(urlIsListing(URL1, "https://other.com/inventory/2024-evolution-d5-123").reason!, /off-site/);
  assert.equal(urlIsListing(URL1, URL1 + "/").ok, true);
  assert.equal(urlIsListing(URL1, "https://dealer.com/inventory/2024-evolution-d5-123").ok, true);
  assert.match(decideAutopublish(ON, cand, page({ status: 404 })).reasons[0], /HTTP 404/);
});
test("(b) sold / removed marker -> queue", () => {
  assert.equal(pageShowsSold("<span class=x>SOLD</span>"), true);
  assert.equal(pageShowsSold("This listing has been removed"), true);
  assert.equal(pageShowsSold("No longer available"), true);
  assert.equal(pageShowsSold("Great cart, buy today"), false);
  assert.match(decideAutopublish(ON, cand, page({ sold: true })).reasons[0], /not_sold/);
});
test("(c) Botero: reads Sale Price, never Original Price", () => {
  const html = `<div>Original Price: <b>$11,495</b></div><div>Sale Price: <b>$9,995</b></div>`;
  assert.equal(extractSalePrice(html), 9995);
  assert.equal(extractSalePrice(`Sale Price: $9,995 Original Price: $11,495`), 9995);
  assert.equal(extractSalePrice(`Original Price: $11,495`), null); // only original shown -> ambiguous, queue
  assert.equal(extractSalePrice(`Price $8,500`), 8500);
  assert.equal(extractSalePrice(`$8,500 or $7,900`), null);
});
test("(c) stored price != sale price (e.g. we stored the original) -> queue", () => {
  const d = decideAutopublish(ON, { ...cand, price: 11495 }, page());
  assert.equal(d.action, "queue"); assert.match(d.reasons[0], /sale_price: stored price 11495 != page sale price 9995/);
  assert.match(decideAutopublish(ON, cand, page({ salePrice: null })).reasons[0], /no unambiguous sale price/);
  assert.equal(decideAutopublish(ON, { ...cand, price: null }, page()).action, "queue");
});
test("(d) year/make/model mismatch or missing -> queue", () => {
  assert.match(decideAutopublish(ON, cand, page({ year: 2023 })).reasons[0], /ymm: mismatch: year 2024\/2023/);
  assert.match(decideAutopublish(ON, cand, page({ make: "Icon" })).reasons[0], /make/);
  assert.match(decideAutopublish(ON, cand, page({ model: "D3" })).reasons[0], /model/);
  assert.equal(decideAutopublish(ON, { ...cand, model: null }, page({ model: null })).action, "queue");
});
test("multiple failures are all logged; unfetchable page queues", () => {
  const g = checkListing(cand, page({ finalUrl: "https://dealer.com/", sold: true, salePrice: 1, year: 2020 }));
  assert.deepEqual(g.failures.map((f) => f.check), ["url_is_listing", "not_sold", "sale_price", "ymm"]);
  assert.deepEqual(decideAutopublish(ON, cand, null), { action: "queue", reasons: ["dealer page could not be fetched"] });
});
