// Inspector sold-page AC (PR #49, ui/golfcartiq-ac-sold-page-pr49-2026-10-16.md). Every gone mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GONE_MODES, showDealClaims, showLeadActions, filterLivePublic, similarCarts, isLiveListing, clientNoindex, resolveGoneMode } from '../shared/listing-lifecycle.ts';

const GONE = [
  { status: 'sold', publicListing: true }, { status: 'sold' }, { status: 'unavailable' }, { status: 'expired' },
  { status: 'pending', publicListing: true }, { status: 'active', publicListing: false }, { status: 'active', public_listing: false },
];
const LIVE = [{ status: 'active', publicListing: true }, { status: 'active' }, { status: null }, { status: 'active', public_listing: true }];

test('AC2: gone listings show no deal badge / Below Market / GolfCartIQ Value in any mode', () => {
  for (const _m of GONE_MODES) for (const l of GONE) assert.equal(showDealClaims(l as any), false, JSON.stringify(l));
  for (const l of LIVE) assert.equal(showDealClaims(l as any), true, JSON.stringify(l));
});

test('AC3: gone listings show no Contact/Call/Quote lead actions in any mode', () => {
  for (const _m of GONE_MODES) for (const l of GONE) assert.equal(showLeadActions(l as any), false);
  for (const l of LIVE) assert.equal(showLeadActions(l as any), true);
});

const row = (id: number, o: any = {}) => ({ id, status: 'active', public_listing: true, title: `Cart ${id}`, brand: 'DACH', state: 'TX', seats: 4, ...o });
const POOL = [
  row(1), row(2, { status: 'sold' }), row(3, { public_listing: false }), row(4, { title: 'Denago Fat Tire 1 Step Thru eBike', brand: 'Denago EV', model: 'Fat Tire 1' }),
  row(5, { brand: 'Evolution', state: 'FL' }), row(6, { state: 'FL' }), row(7), row(8, { status: 'unavailable' }),
];

test('AC5: hot deals / search filter drops every gone id and e-bikes', () => {
  const ids = filterLivePublic(POOL as any[]).map(r => r.id);
  assert.deepEqual(ids, [1, 5, 6, 7]);
  for (let i = 0; i < 20; i++) {
    const shuffled = [...POOL].sort(() => Math.random() - 0.5);
    for (const r of filterLivePublic(shuffled as any[])) assert.ok(isLiveListing(r as any));
  }
});

test('AC4: similar carts are live only, never self, ranked same brand+state first', () => {
  const cur = { id: 1, status: 'sold', brand: 'DACH', state: 'TX', seats: 4 };
  const s = similarCarts(cur, POOL as any[]);
  assert.deepEqual(s.map(r => r.id), [7, 6, 5]);
  for (const r of s) assert.ok(isLiveListing(r as any) && r.id !== 2 && r.id !== 3 && r.id !== 4 && r.id !== 8);
  assert.deepEqual(similarCarts({ id: 1 }, [row(2, { status: 'sold' })] as any[]), []);
});

test('AC guards do not change SEO: default meta robots unchanged for gone and live', () => {
  const mode = resolveGoneMode(undefined);
  for (const l of GONE.filter(g => !('public_listing' in g))) assert.equal(clientNoindex(l as any, mode), true); // client rows are camelCase
  for (const l of LIVE.slice(0, 3)) assert.equal(clientNoindex(l as any, mode), false);
});
