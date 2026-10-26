import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MetricValue } from "../client/src/pages/Portal";

test("insufficient metric shows 'Not enough data yet — tracking since {date}', never a number", () => {
  const html = renderToStaticMarkup(<MetricValue label="Listing views" m={{ status: "insufficient", tracking_since: "2026-10-20T00:00:00Z" }} />);
  assert.match(html, /Not enough data yet — tracking since/);
  assert.doesNotMatch(html, />\s*0\s*</);
});
test("no tracking at all shows not-enough-data, not zero", () => {
  const html = renderToStaticMarkup(<MetricValue label="Lead clicks" m={{ status: "insufficient", tracking_since: null }} />);
  assert.match(html, /Not enough data yet/);
  const html2 = renderToStaticMarkup(<MetricValue label="Lead clicks" m={undefined} />);
  assert.match(html2, /Not enough data yet/);
});
test("ok metric renders the live value", () => {
  const html = renderToStaticMarkup(<MetricValue label="Listing views" m={{ status: "ok", value: 30, tracking_since: "2026-09-01T00:00:00Z" }} />);
  assert.match(html, />30</);
});

import { ZipSection } from "../client/src/pages/Portal";
test("ZIP purchase hidden with upgrade prompt when there is no active base plan", () => {
  for (const sub of [null, { status: "canceled", plan: "featured" }, { status: "active", plan: null }, { status: "past_due", plan: "insights" }]) {
    const html = renderToStaticMarkup(<ZipSection sub={sub} listings={[]} />);
    assert.match(html, /zip-upgrade-prompt/);
    assert.doesNotMatch(html, /Update ZIP billing/);
  }
});
