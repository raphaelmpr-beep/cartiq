import test from "node:test";
import assert from "node:assert/strict";
import { cleanComps, computeIMV, priceReview, enrichListing, calculateGolfCartWiseValue } from "../server/pricing.ts";

const c = (p: number, conf = "confirmed") => ({ asking_price: p, price_confidence: conf });

test("comps: drop down-payment/monthly, unavailable and Tukey outliers", () => {
  const out = cleanComps([c(999), c(12000), c(12500), c(13000), c(13500), c(14000), c(60000), c(12800, "unavailable")]).map(x => x.asking_price);
  assert.deepEqual(out, [12000, 12500, 13000, 13500, 14000]);
});

test("IMV is the median of cleaned real comps", () => {
  const r = computeIMV({ brand: "E-Z-GO", year: 2024, condition: "used" }, [c(1000), c(12000), c(13000), c(14000), c(95000)]);
  assert.equal(r.compTier, 1);
  assert.equal(r.imv, 13000);
});

test("needs-review reasons", () => {
  assert.deepEqual(priceReview({ asking_price: null }).reasons, ["no_price"]);
  assert.ok(priceReview({ asking_price: 950, price_confidence: "confirmed" }).reasons.includes("below_min_plausible"));
  assert.ok(priceReview({ asking_price: 12000, price_confidence: "estimated" }).reasons.includes("price_estimated"));
  assert.ok(priceReview({ asking_price: 5000, price_confidence: "confirmed", cartiq_estimated_value: 14000, valuation_confidence: "high" }).reasons.includes("outlier_low_vs_comps"));
  assert.equal(priceReview({ asking_price: 13000, price_confidence: "confirmed", cartiq_estimated_value: 14000, valuation_confidence: "high" }).needsReview, false);
});

test("outlier guard: no deal badge on a down-payment-sized or far-below-comps price", () => {
  const comps = [c(12000), c(12500), c(13000), c(13500), c(14000)];
  const low = enrichListing({ asking_price: 4000, brand: "E-Z-GO", model: "RXV", year: 2024, condition: "used" }, comps);
  assert.equal(low.deal_rating, "unknown");
  const fair = enrichListing({ asking_price: 12000, brand: "E-Z-GO", model: "RXV", year: 2024, condition: "used" }, comps);
  assert.equal(fair.deal_rating, "good_deal");
});

test("Deal Checker uses real comps when supplied", () => {
  const comps = [c(12000), c(12500), c(13000), c(13500), c(14000)];
  const withComps = calculateGolfCartWiseValue({ askingPrice: 13000, brand: "E-Z-GO", model: "RXV", year: 2024, condition: "used" }, comps);
  assert.equal(withComps.cartiqMarketValue, 13000);
  assert.equal(withComps.priceConfidence, "medium");
  const dp = calculateGolfCartWiseValue({ askingPrice: 999, brand: "E-Z-GO", model: "RXV", year: 2024, condition: "used" }, comps);
  assert.equal(dp.dealRating, "unknown");
  assert.ok(dp.redFlags.some(f => /down payment/.test(f)));
});
