import { test } from "node:test";
import assert from "node:assert/strict";
import { redactForLog } from "../server/log-redact";
test("redactForLog removes session tokens and checkout/portal urls, keeps the rest", () => {
  const r: any = redactForLog({ session: { access_token: "eyJx", refresh_token: "r" }, url: "https://checkout.stripe.com/c/pay/cs_test_x", ok: true, claim: { status: "pending" }, list: [{ access_token: "a", id: 1 }] });
  assert.doesNotMatch(JSON.stringify(r), /eyJx|cs_test_x|"r"|"a"/);
  assert.equal(r.ok, true); assert.equal(r.claim.status, "pending"); assert.equal(r.list[0].id, 1);
});
test("redactForLog passes primitives through", () => { assert.equal(redactForLog(null), null); assert.equal(redactForLog(3), 3); });
