import { test } from "node:test";
import assert from "node:assert/strict";
import { effChemistry, effKwh, kwhBucket, matchBatteryComps, safeChemParam } from "../shared/battery";
import { computeIMV } from "../server/pricing";
test("effective chemistry prefers new column, falls back to legacy", () => {
  assert.equal(effChemistry({ battery_chemistry: "agm", battery_type: "lithium" }), "agm");
  assert.equal(effChemistry({ battery_type: "lithium" }), "lithium");
  assert.equal(effChemistry({ battery_type: "unknown" }), null);
});
test("kWh from V×Ah, buckets", () => {
  assert.equal(effKwh({ battery_voltage: 48, battery_ah: 105 }), 5);
  assert.equal(kwhBucket(5), "4-6"); assert.equal(kwhBucket(null), null);
});
test("battery comp grouping only when known and ≥3 like comps", () => {
  const c = (p: number, ch: string | null, k?: number) => ({ asking_price: p, battery_chemistry: ch, battery_kwh: k });
  const comps = [c(10000, "lithium", 5), c(10500, "lithium", 5), c(11000, "lithium", 5), c(7000, "lead_acid"), c(7200, "lead_acid")];
  assert.equal(matchBatteryComps({ battery_type: "lithium" }, comps).length, 3);
  assert.equal(matchBatteryComps({}, comps).length, 5);
  assert.equal(matchBatteryComps({ battery_type: "lead_acid" }, comps).length, 5); // only 2 like comps
});
test("IMV uses like-battery comps", () => {
  const c = (p: number, ch: string) => ({ asking_price: p, price_confidence: "confirmed", battery_chemistry: ch });
  const comps = [c(10000, "lithium"), c(10400, "lithium"), c(10200, "lithium"), c(7000, "lead_acid"), c(7100, "lead_acid"), c(6900, "lead_acid")];
  assert.equal(computeIMV({ batteryType: "lithium" } as any, comps as any).imv, 10200);
  assert.equal(computeIMV({ batteryType: "lead_acid" } as any, comps as any).imv, 7000);
});
test("filter param sanitised", () => {
  assert.equal(safeChemParam("lithium"), "lithium");
  assert.equal(safeChemParam("x),or(id.gt.0"), null);
});

test("capacity-known uses kWh bucket even without chemistry", () => {
  const c = (p: number, k: number | null, ch: string | null = null) => ({ asking_price: p, battery_kwh: k, battery_chemistry: ch });
  const comps = [c(9000, 5), c(9200, 5), c(9100, 5), c(12000, 8), c(12500, 8), c(12200, 8, "lithium")];
  assert.equal(matchBatteryComps({ battery_voltage: 48, battery_ah: 105 }, comps).length, 3);
  assert.equal(matchBatteryComps({ battery_kwh: 8, battery_chemistry: "lithium" }, comps).length, 3);
  assert.equal(matchBatteryComps({ battery_kwh: 2 }, comps).length, 6);
});
