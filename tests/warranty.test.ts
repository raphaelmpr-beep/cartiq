import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeWarranty, normalizeWarrantyMonths, normalizeWarrantyFields, warrantyLabel } from "../shared/warranty";
import { computeIMV, computeWiseScore } from "../server/pricing";

for (const [expected, values] of [
  ["yes", [true, 1, "yes", "true", "1", " TRUE ", "Yes"]],
  ["no", [false, 0, "no", "false", "0", " FALSE ", "No"]],
  ["unknown", [null, undefined, "", "unknown", "available", "no warranty", "lifetime", {}, [], 2]],
] as const) {
  for (const value of values) test(`${String(value)} normalizes to ${expected}`, () => assert.equal(normalizeWarranty(value), expected));
}
test("term validation refuses decimals, negatives, zero and prose", () => {
  for (const value of [0, -1, 1.5, "1.5", "", "lifetime", null, true, Infinity, "12 months"]) assert.equal(normalizeWarrantyMonths(value), null);
  assert.equal(normalizeWarrantyMonths(" 12 "), 12);
});
test("normalization preserves notes and omission; does not infer inclusion", () => {
  const input = { warranty_months: "12", warranty_notes: "5 Year Battery Warranty, 1 Year Cart Warranty" };
  const output = normalizeWarrantyFields(input);
  assert.equal(output.warranty_months, 12);
  assert.equal(output.warranty_notes, input.warranty_notes);
  assert.equal("warranty_included" in output, false);
  assert.equal(input.warranty_months, "12");
  assert.equal(normalizeWarrantyFields({ warrantyIncluded: " true ", batteryWarrantyIncluded: false }).warrantyIncluded, "yes");
});
test("yes/no labels agree with legacy badge inputs", () => {
  assert.equal(warrantyLabel("true"), "Yes");
  assert.equal(warrantyLabel(false), "No");
  assert.equal(warrantyLabel("unverified"), "Unknown");
});
test("warranty affects buyer confidence but never IMV", () => {
  const input = { brand: "Club Car", model: "Tempo", year: 2020, condition: "refurbished", powerType: "electric", batteryType: "lithium", seating: 2 };
  assert.deepEqual(computeIMV({ ...input, warrantyIncluded: "yes" }, []), computeIMV({ ...input, warrantyIncluded: "no" }, []));
  assert.equal(computeWiseScore({ ...input, warrantyIncluded: " TRUE ", warrantyMonths: 12 }, "fair_price"), computeWiseScore({ ...input, warrantyIncluded: true, warrantyMonths: 12 }, "fair_price"));
  assert.ok(computeWiseScore({ ...input, warrantyIncluded: "yes" }, "fair_price") > computeWiseScore({ ...input, warrantyIncluded: "unknown" }, "fair_price"));
});
test("whole-page warranty extraction cannot invent coverage", () => {
  const source = readFileSync("server/sync/pipeline-lambda.ts", "utf8");
  const body = source.match(/function parseWarrantyFromHtml\(html: string\): Partial<ListingEnrichment> \{([\s\S]*?)\n\}/)![1];
  const parse = new Function("html", body);
  for (const html of ["No warranty", "Lifetime chassis warranty", "Buy a warranty", "5 Year Battery Warranty", "<footer>Manufacturer warranty</footer>"]) assert.deepEqual(parse(html), {});
});
