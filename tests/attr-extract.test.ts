import test from "node:test";
import assert from "node:assert/strict";
import { extractBattery, warrantyQuotes, warrantyTerm } from "../server/sync/attr-extract.ts";
test("battery facts from page text", () => {
  assert.deepEqual(extractBattery("2024 EZGO RXV 48V Lithium 105Ah RoyPow pack, 5.1 kWh"), { type: "lithium", voltage: 48, ah: 105, kwh: 5.1, brand: "RoyPow" });
  assert.equal(extractBattery("6 x 8V Trojan flooded batteries").type, "lead_acid");
  assert.equal(extractBattery("no battery details").type, null);
  assert.equal(extractBattery("Phone 352-555-0100 ah").ah, null);
});
test("warranty wording is quoted verbatim, term parsed", () => {
  const t = "Great cart. Includes an 8-year lithium battery warranty from the manufacturer. Call us.";
  assert.deepEqual(warrantyQuotes(t), ["Includes an 8-year lithium battery warranty from the manufacturer."]);
  assert.deepEqual(warrantyTerm(t), { years: 8, scope: "battery" });
});
