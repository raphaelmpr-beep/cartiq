import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractListingPrice, priceFromLabels, priceFromFeed, priceFromElementText, parseMoney, priceFromWoo } from '../server/sync/price-extract.ts';

const fx = (n: string) => readFileSync(new URL(`./fixtures/price/${n}`, import.meta.url), 'utf8');

test('Botero #55: sale price $3,995, not the regular $4,995 (trimmed real page fixture)', () => {
  const r = extractListingPrice(fx('botero-55.html'));
  assert.equal(r.price, 3995);
});
test('Botero #105: real price $11,995, not the $1,000 upgrade / $229/month (trimmed real page fixture)', () => {
  const r = extractListingPrice(fx('botero-105.html'));
  assert.equal(r.price, 11995);
});
test('labels without JSON-LD: Sale > Regular, carousel ignored, monthly rejected', () => {
  const html = `<div class="listing-price"><div class="listing-original-price"><span>Regular Price:</span> <span class="listing-sale-price">$4,995</span></div>
    <div class="sale-price-callout"><span>Sale Price:</span> <span>$3,995</span></div>
    <span class="listing-finance-incentive__amount">$333<small>/month</small></span></div>
    <div class="dealer-carousel-item__price"><span>Our Price:</span> <span>$6,999</span></div>`;
  const r = priceFromLabels(html)!;
  assert.equal(r.price, 3995); assert.equal(r.regular, 4995); assert.equal(r.source, 'label_sale');
});
test('down payment / as-low-as / per month never become the price', () => {
  assert.equal(priceFromLabels('<p>Down payment: $1,000</p><p>As low as $229/mo</p>'), null);
  assert.equal(priceFromElementText('$1,000', 'Down Payment $1,000'), null);
  assert.equal(priceFromElementText('$229/month'), null);
  assert.equal(priceFromElementText('$899'), null, 'implausible for a cart');
  assert.equal(priceFromElementText('$12,995', 'Price $12,995'), 12995);
});
test('MSRP is never the price', () => {
  const r = priceFromLabels('<div>MSRP: $15,999</div>')!;
  assert.equal(r.price, null); assert.equal(r.msrp, 15999); assert.equal(r.source, 'msrp_only');
  assert.equal(priceFromElementText('$15,999', 'MSRP $15,999'), null);
  const f = priceFromFeed({ Price: '', SalePrice: null, Msrp: 15999 });
  assert.equal(f.price, null); assert.equal(f.msrp, 15999);
});
test('feeds: SalePrice before Price', () => {
  assert.equal(priceFromFeed({ Price: 12995, SalePrice: 11995, Msrp: 14000 }).price, 11995);
  assert.equal(priceFromFeed({ Price: '12,995' }).price, 12995);
});
test('no price → null (leave blank)', () => {
  const r = extractListingPrice('<h1>2024 Club Car Onward</h1><p>Call for price</p>');
  assert.equal(r.price, null); assert.equal(r.source, 'none');
});
test('woo: <ins> sale before <del> regular', () => {
  const html = '<p class="price"><del><span class="woocommerce-Price-amount amount"><bdi>$9,995</span></bdi></del> <ins><span class="woocommerce-Price-amount amount"><bdi>$8,995</span></bdi></ins></p>';
  const r = priceFromWoo(html)!; assert.equal(r.price, 8995); assert.equal(r.regular, 9995);
});
test('parseMoney strictness', () => {
  assert.equal(parseMoney('$12,995.00'), 12995); assert.equal(parseMoney('abc'), null); assert.equal(parseMoney(0), null);
});
test('Botero fixtures without JSON-LD still pick the right price via labels', () => {
  const noLd = (s: string) => s.replace(/<script[^>]+ld\+json[\s\S]*?<\/script>/g, '');
  assert.equal(extractListingPrice(noLd(fx('botero-55.html'))).price, 3995);
  assert.equal(extractListingPrice(noLd(fx('botero-105.html'))).price, 11995);
});
