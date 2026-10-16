// PR #49 Director scope: re-check covers ALL feeds; LIVE_FLAG_ACTION default queue_review. Synthetic fixtures only
// (no holdout_ids.txt exists in /workspace/gciq-accuracy-2026-10, so results.csv is not used).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceFromDealerPage, recheckPriceAllFeeds, resolveLiveFlagAction, flaggedAction } from '../server/recheck/runner.ts';
import { classifyResponse, nextState } from '../server/recheck/core.ts';

test('LIVE_FLAG_ACTION defaults to queue_review; only exact auto_hide opts in', () => {
  for (const v of [undefined, '', 'bogus', 'hide', 'queue_review']) assert.equal(resolveLiveFlagAction(v as any), 'queue_review');
  assert.equal(resolveLiveFlagAction('AUTO_HIDE'), 'auto_hide');
});
test('queue_review never hides, even on confirmed dead', () => {
  assert.equal(flaggedAction(true, true, false, 'queue_review'), 'needs_review');
  assert.equal(flaggedAction(false, true, false, 'queue_review'), 'mark_dead_1');
});
test('auto_hide hides only on confirmed positive evidence', () => {
  assert.equal(flaggedAction(true, true, false, 'auto_hide'), 'archive');
  assert.equal(flaggedAction(false, true, false, 'auto_hide'), 'mark_dead_1');
  assert.equal(flaggedAction(false, false, false, 'auto_hide'), 'none'); // error/robots/timeouts never hide
  assert.equal(flaggedAction(true, true, true, 'auto_hide'), 'needs_review'); // excluded dealers
});
test('errors and stale never count as evidence', () => {
  const st = nextState(5, { status: 'error', reason: 'timeout' } as any);
  assert.equal(st.archive, false);
});
test('sold marker on any feed host is dead (liveness covers all feeds)', () => {
  const r = classifyResponse('https://anydealer.example/cart/1', 200, 'https://anydealer.example/cart/1', '<p>This cart has been sold</p>');
  assert.equal(r.status, 'dead');
  assert.equal(classifyResponse('https://other.example/x', 404, 'https://other.example/x', '').status, 'dead');
});
test('price refresh covers non-Eco/Botero feeds (sale over original, never MSRP)', () => {
  assert.equal(recheckPriceAllFeeds(undefined), true);
  assert.equal(recheckPriceAllFeeds('false'), false);
  const html = '<div><span>Original Price:</span> <span>$12,995</span> <span>Sale Price:</span> <span>$10,495</span></div>';
  assert.equal(priceFromDealerPage('https://village.example/cart/9', html), 10495);
  assert.equal(priceFromDealerPage('https://village.example/cart/9', '<p>MSRP: $15,000</p>'), null);
  assert.equal(priceFromDealerPage('https://village.example/cart/9', '<p>no price here</p>'), null);
});
test('Botero still uses Sale Price, never Original Price', () => {
  const html = '<div class="listing-price"><span>Original Price:</span> <span>$9,995</span> <span>Sale Price:</span> <span>$8,495</span></div>';
  assert.equal(priceFromDealerPage('https://boterocarts.com/listing/z/', html), 8495);
});
