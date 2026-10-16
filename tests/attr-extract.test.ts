import test from "node:test";
import assert from "node:assert/strict";
import { extractBattery, extractListingAttrs, unitWarranty, warrantyTerm, mainBlock } from "../server/sync/attr-extract.ts";

test("battery facts from page text", () => {
  assert.deepEqual(extractBattery("2024 EZGO RXV 48V Lithium 105Ah RoyPow pack, 5.1 kWh"), { chemistry: "lithium", voltage: 48, ah: 105, kwh: 5.1, brand: "RoyPow" });
  assert.equal(extractBattery("6 x 8V Trojan flooded batteries").chemistry, "lead_acid");
  assert.equal(extractBattery("no battery details").chemistry, null);
});
test("ambiguous mentions are skipped", () => {
  assert.equal(extractBattery("Upgrade from lead-acid to lithium today").chemistry, null);
  assert.equal(extractBattery("48V or 72V options, 105Ah or 150Ah").voltage, null);
  assert.equal(extractBattery("48V or 72V options, 105Ah or 150Ah").ah, null);
});
test("nav and related-listing noise is stripped (no false lithium)", () => {
  const html = `<html><head><title>2019 Club Car Precedent 48V Gas</title></head><body>
    <nav><a href="/lithium">Lithium Carts</a></nav><header class="site-header">Shop Lithium</header>
    <main><h1>2019 Club Car Precedent</h1><p>Gas engine, 4 passenger, new tires.</p>
    <h2>Similar listings</h2><div>2024 Venom EV 105Ah Lithium</div></main><footer>Lithium batteries in stock</footer></body></html>`;
  const a = extractListingAttrs(html);
  assert.equal(a.battery.chemistry, null);
  assert.equal(a.battery.ah, null);
  assert.ok(!/Lithium/i.test(mainBlock(html)));
});
test("unit warranty: positive with term, negative, conflicting", () => {
  assert.deepEqual(unitWarranty("Includes an 8-year lithium battery warranty. Call us."), { included: "yes", months: 96, quote: "Includes an 8-year lithium battery warranty." });
  assert.equal(unitWarranty("Sold as-is, no warranty. Cash only.").included, "no");
  assert.equal(unitWarranty("Sold as-is, no warranty. Comes with a 1 year warranty.").included, null);
  assert.equal(unitWarranty("Ask about our warranty programs.").included, null);
});
test("warrantyTerm back-compat", () => {
  assert.deepEqual(warrantyTerm("Includes an 8-year lithium battery warranty."), { years: 8, scope: "battery" });
});
import { buildAttrUpdate } from "../server/sync/attr-apply.ts";
test("attr update writes only page-stated facts; never clears", () => {
  const u = buildAttrUpdate({ battery: { chemistry: "lithium", voltage: 48, ah: null, kwh: null, brand: null }, warranty: { included: null, months: null, quote: null } }, "https://d.com/x", "T");
  assert.deepEqual(u, { battery_chemistry: "lithium", battery_voltage: 48, battery_source: "listing_page" });
  const w = buildAttrUpdate({ battery: { chemistry: null, voltage: null, ah: null, kwh: null, brand: null }, warranty: { included: "yes", months: 36, quote: "3-year warranty included." } }, "https://d.com/x", "T");
  assert.equal(w.warranty_included, "yes"); assert.equal(w.warranty_months, 36); assert.equal(w.warranty_source_url, "https://d.com/x");
  assert.ok(!("battery_type" in u) && !("battery_type" in w)); // legacy battery_type (meta/sitemap input) untouched
});
