import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGoneMode, shouldHide, isGolfCartListing } from '../shared/listing-lifecycle.ts';

test('gone mode defaults to sold_page; 410/noindex/redirect are opt-in', () => {
  assert.equal(resolveGoneMode(undefined), 'sold_page');
  assert.equal(resolveGoneMode(''), 'sold_page');
  assert.equal(resolveGoneMode('bogus'), 'sold_page');
  assert.equal(resolveGoneMode('GONE_410'), 'gone_410');
  assert.equal(resolveGoneMode('noindex'), 'noindex');
  assert.equal(resolveGoneMode('redirect'), 'redirect');
});
test('never hide on unseen or stale', () => {
  assert.equal(shouldHide({ kind: 'unseen', days: 365 }), false);
  assert.equal(shouldHide({ kind: 'stale', days: 90 }), false);
});
test('dealer page sold/404 hides only after confirmations', () => {
  assert.equal(shouldHide({ kind: 'dealer_page', status: 'http_404', confirmations: 1 }), false);
  assert.equal(shouldHide({ kind: 'dealer_page', status: 'http_404', confirmations: 2 }), true);
  assert.equal(shouldHide({ kind: 'dealer_page', status: 'sold', confirmations: 2 }), true);
});
test('feed absence hides only for a successful, complete feed', () => {
  assert.equal(shouldHide({ kind: 'feed', feedRunSucceeded: true, feedComplete: true, presentInFeed: false }), true);
  assert.equal(shouldHide({ kind: 'feed', feedRunSucceeded: false, feedComplete: true, presentInFeed: false }), false);
  assert.equal(shouldHide({ kind: 'feed', feedRunSucceeded: true, feedComplete: false, presentInFeed: false }), false);
  assert.equal(shouldHide({ kind: 'feed', feedRunSucceeded: true, feedComplete: true, presentInFeed: true }), false);
});
test('e-bikes 2076/2077/2078 are not golf carts', () => {
  assert.equal(isGolfCartListing({ id: 2076, title: 'Teal Denago Cruiser Step Thru eBike', brand: 'Denago EV', model: 'Cruiser Step Thru' } as any), false);
  assert.equal(isGolfCartListing({ title: 'Denago EV Commute 1 Step Thru', brand: 'Denago EV', model: 'Commute 1 Step Thru' }), false);
  assert.equal(isGolfCartListing({ title: 'White/Black Denago Fat Tire 1 Step Thru L/XL eBike', brand: 'Denago EV', model: 'Fat Tire 1 Step Thru' }), false);
});
test('real golf carts pass (incl. Denago carts)', () => {
  for (const t of ['2026 Cushman Shuttle 2+2 EFI Gas', '2026 DACH Apollo', 'Yamaha QuieTech EFI', 'Lithium-Ion 2026 Dach Falcon Ultra'])
    assert.equal(isGolfCartListing({ title: t }), true, t);
  assert.equal(isGolfCartListing({ title: 'Denago Nomad XL', brand: 'Denago EV', model: 'Nomad XL' }), true);
  assert.equal(isGolfCartListing({ title: 'Denago Rover XL', brand: 'Denago', model: 'Rover XL' }), true);
});
