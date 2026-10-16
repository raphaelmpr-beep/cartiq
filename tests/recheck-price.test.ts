import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { priceFromDealerPage } from '../server/recheck/runner.ts';

const fx = (n: string) => readFileSync(new URL(`./fixtures/price/${n}`, import.meta.url), 'utf8');

test('recheck refreshes Botero prices with the sale price, not Original Price', () => {
  assert.equal(priceFromDealerPage('https://boterocarts.com/listing/x-55/', fx('botero-55.html')), 3995);
  assert.equal(priceFromDealerPage('https://boterocarts.com/listing/new-2026-lithium-ion-dach-falcon-ultra-ocala-fl-43185/', fx('botero-105.html')), 11995);
});
test('RECHECK_PRICE_ALL_FEEDS=false: unknown hosts stay liveness-only (no price write)', () => {
  assert.equal(priceFromDealerPage('https://example.com/x', fx('botero-55.html'), false), null);
});
test('Botero sale-vs-original label HTML picks the sale price', () => {
  const html = '<div class="listing-price"><span>Original Price:</span> <span>$9,995</span> <span>Sale Price:</span> <span>$8,495</span></div>';
  assert.equal(priceFromDealerPage('https://www.boterocarts.com/listing/y/', html), 8495);
});
