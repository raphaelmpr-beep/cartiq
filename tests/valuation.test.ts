import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { runInNewContext } from "node:vm";

// Exercise the actual client implementation without importing its React page.
// Explicit boundaries make a future refactor fail loudly instead of testing a copy.
const source = readFileSync(new URL("../client/src/pages/seo/ValuePages.tsx", import.meta.url), "utf8");
const start = source.indexOf("function estimateValue(input:");
const end = source.indexOf("\nfunction formatCurrency", start);
assert.ok(start > 0 && end > start, "Estimator extraction boundaries exist");
const compiled = transformSync(source.slice(start, end), { loader: "ts" }).code;
const estimate = runInNewContext(`${compiled}; estimateValue`);
const base = {brand:"Club Car",model:"Onward",year:2023,condition:"Good",power:"Electric",batteryType:"Lithium"};

test("2023 Club Car lithium produces expected formula ranges", () => {
  const r = estimate(base);
  assert.equal(r.privateLow,8800);
  assert.equal(r.privateHigh,10800);
  assert.equal(r.tradeLow,6300);
  assert.equal(r.tradeHigh,8600);
});
test("old lead-acid applies its discount, not the lithium premium", () => {
  const r = estimate({...base,batteryType:"Lead-Acid",batteryAge:"5+ years"});
  assert.equal(r.privateLow,6700);
  assert.equal(r.privateHigh,8200);
});
test("gas ignores battery attributes", () => {
  const a=estimate({...base,power:"Gas",batteryAge:"5+ years"});
  const b=estimate({...base,power:"Gas",batteryType:undefined,batteryAge:undefined});
  assert.equal(JSON.stringify(a),JSON.stringify(b));
});
test("condition monotonically changes formula values", () => {
  const values=["Excellent","Good","Fair","Poor"].map(condition=>estimate({...base,condition}).privateLow);
  assert.ok(values.every((v,i)=>i===0||v<values[i-1]));
});
test("depreciation is monotonic across every configured age boundary", () => {
  const values=[2026,2025,2024,2023,2022,2021,2020,2019,2018,2016,2015].map(year=>estimate({...base,year}).privateLow);
  assert.ok(values.every((v,i)=>i===0||v<=values[i-1]));
});
test("warranty and comparable asking prices cannot alter the estimate", () => {
  const a=estimate(base);
  const b=estimate({...base,warrantyIncluded:true,warrantyMonths:120,askingPrice:99999,comparables:[{askingPrice:99999}]});
  assert.equal(JSON.stringify(a),JSON.stringify(b));
});
test("seats are matching-only and do not silently adjust the formula", () => {
  assert.equal(JSON.stringify(estimate({...base,seating:2})),JSON.stringify(estimate({...base,seating:8})));
});
test("all supported brands and conditions yield finite ordered ranges", () => {
  for(const brand of ["Club Car","E-Z-GO","Yamaha","ICON","Evolution","Bintelli","Denago EV","Epic","Venom EV","Teko EV"])
    for(const condition of ["Excellent","Good","Fair","Poor"])
      for(const year of [1990,2015,2023,2026,2027]) {
        const r=estimate({...base,brand,condition,year});
        assert.ok([r.privateLow,r.privateHigh,r.tradeLow,r.tradeHigh,r.iqScore].every(Number.isFinite));
        assert.ok(r.tradeLow<=r.tradeHigh && r.tradeHigh<r.privateHigh && r.privateLow<=r.privateHigh);
      }
});
