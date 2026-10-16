// PR #49 default = zero SEO-visible change (Grey Beard, 2026-10-16).
// Expected values below were captured from the pre-P0 code at d58633e (main) and must not drift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveGoneMode, clientNoindex, showSoldBanner, goneResponse, sitemapExcludesNonCart } from '../shared/listing-lifecycle.ts';

const base = { status: 'active', public_listing: true, slug: 's', title: 'T', city: 'Austin', state: 'TX', dealer_id: 1, asking_price: 9000 };
export const SITEMAP_FIXTURE: Array<[string, any]> = [
  ['cart', { ...base, id: 1, slug: 'cart-1', title: '2026 DACH Apollo', brand: 'DACH', model: 'Apollo' }],
  ['ebike-2076', { ...base, id: 2076, slug: 'e-2076', title: 'Teal Denago Cruiser Step Thru eBike', brand: 'Denago EV', model: 'Cruiser Step Thru' }],
  ['ebike-2077', { ...base, id: 2077, slug: 'e-2077', title: 'Denago EV Commute 1 Step Thru', brand: 'Denago EV', model: 'Commute 1 Step Thru' }],
  ['ebike-2078', { ...base, id: 2078, slug: 'e-2078', title: 'White/Black Denago Fat Tire 1 Step Thru L/XL eBike', brand: 'Denago EV', model: 'Fat Tire 1 Step Thru' }],
  ['sold', { ...base, id: 5, status: 'sold' }],
  ['private', { ...base, id: 6, public_listing: false }],
  ['no-geo', { ...base, id: 7, city: null }],
];
// pre-P0 isListingSitemapEligible output (d58633e) for the fixture above
export const SITEMAP_BEFORE: Record<string, boolean> = { cart: true, 'ebike-2076': true, 'ebike-2077': true, 'ebike-2078': true, sold: false, private: false, 'no-geo': false };

const STATES = [
  { status: 'active', publicListing: true }, { status: 'active', publicListing: false }, { status: 'active' },
  { status: 'sold', publicListing: true }, { status: 'sold', publicListing: false }, { status: 'unavailable' },
  { status: 'expired' }, { status: null }, { status: 'pending', publicListing: true },
];
// verbatim pre-P0 client rule (ListingDetail.tsx @ d58633e)
const beforeNoindex = (l: any) => !(new Set(['active']).has(String(l.status ?? 'active')) && l.publicListing !== false);

test('default gone mode is legacy_noindex (unset / empty / unknown)', () => {
  for (const v of [undefined, null, '', '  ', 'bogus']) assert.equal(resolveGoneMode(v as any), 'legacy_noindex');
  assert.equal(resolveGoneMode('noindex'), 'legacy_noindex');
  assert.equal(resolveGoneMode('SOLD_PAGE'), 'sold_page');
  assert.equal(resolveGoneMode('gone_410'), 'gone_410');
  assert.equal(resolveGoneMode('redirect'), 'redirect');
});

test('default meta robots identical to before for every lifecycle state; no banner', () => {
  const mode = resolveGoneMode(undefined);
  for (const l of STATES) {
    assert.equal(clientNoindex(l as any, mode), beforeNoindex(l), JSON.stringify(l));
    assert.equal(showSoldBanner(l as any, mode), false, JSON.stringify(l));
  }
});

test('opt-in sold_page keeps gone pages indexable and shows banner', () => {
  assert.equal(clientNoindex({ status: 'sold' }, 'sold_page'), false);
  assert.equal(showSoldBanner({ status: 'sold' }, 'sold_page'), true);
  assert.equal(clientNoindex({ status: 'active' }, 'sold_page'), false);
});

test('default server headers identical to before (Link canonical + lifecycle, no X-Robots-Tag, 200 -> next)', () => {
  const mode = resolveGoneMode(undefined);
  const r = goneResponse('sold', 'https://golfcartiq.com/search?brand=DACH', mode);
  assert.equal(r.action, 'next');
  assert.deepEqual(r.headers, { Link: '<https://golfcartiq.com/search?brand=DACH>; rel="canonical"', 'X-Listing-Lifecycle': 'sold' });
  const r2 = goneResponse(null, null, mode);
  assert.deepEqual(r2, { action: 'next', headers: { 'X-Listing-Lifecycle': 'inactive' } });
});

test('opt-in server modes', () => {
  assert.equal(goneResponse('sold', 'https://x/f', 'redirect').action, 'redirect');
  assert.equal(goneResponse('sold', 'https://x/f', 'gone_410').action, 'gone_410');
  assert.deepEqual(goneResponse('sold', 'https://x/f', 'sold_page').headers, { 'X-Listing-Lifecycle': 'sold' });
});

test('sitemap non-cart exclusion is off by default', () => {
  for (const v of [undefined, '', 'false', '0', 'yes']) assert.equal(sitemapExcludesNonCart(v as any), false);
  assert.equal(sitemapExcludesNonCart('true'), true);
});

test('default sitemap entries identical to before; opt-in drops e-bikes 2076-2078 only', async () => {
  const { isListingSitemapEligible } = await import('../server/sitemaps.ts');
  const prev = process.env.LISTING_SITEMAP_EXCLUDE_NON_CART;
  try {
    delete process.env.LISTING_SITEMAP_EXCLUDE_NON_CART;
    for (const [k, l] of SITEMAP_FIXTURE) assert.equal(isListingSitemapEligible(l), SITEMAP_BEFORE[k], `default ${k}`);
    process.env.LISTING_SITEMAP_EXCLUDE_NON_CART = 'true';
    for (const [k, l] of SITEMAP_FIXTURE) assert.equal(isListingSitemapEligible(l), k.startsWith('ebike') ? false : SITEMAP_BEFORE[k], `opt-in ${k}`);
  } finally {
    if (prev === undefined) delete process.env.LISTING_SITEMAP_EXCLUDE_NON_CART; else process.env.LISTING_SITEMAP_EXCLUDE_NON_CART = prev;
  }
});
