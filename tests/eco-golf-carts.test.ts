import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import WebSocket from 'ws';
import {
  canonicalEcoUrl, parseEcoSitemap, parseEcoInventory, parseEcoDetail, parseEcoPrice,
  discoverEcoInventory, ecoPendingRows, fetchEcoText, verifyEcoRobots,
  ECO_INVENTORY, ECO_SITEMAP, ECO_ROBOTS, ECO_SLUG, ECO_ADAPTER,
} from '../server/sync/eco-golf-carts';
import { runLambdaSync } from '../server/sync/pipeline-lambda';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/eco/${name}`, import.meta.url), 'utf8');
const inventory = fixture('inventory.html');
const sitemap = fixture('sitemap.xml');
const availableUrl = 'https://ecogolfcarts.com/listing/new-2026-hp-lithium-ion-conquest-carts-s6l-10644/';
const pendingUrl = 'https://ecogolfcarts.com/listing/new-2026-173ah-atlas-carts-max-10632/';
const soldUrl = 'https://ecogolfcarts.com/listing/used-2024-hp-lithium-ion-atlas-carts-max-10674/';
const detail = (url: string) => fixture(`${url.split('/').filter(Boolean).at(-1)}.html`);
const fixtureFetch = async (url: string) => url === ECO_INVENTORY ? inventory :
  url === ECO_SITEMAP ? sitemap : url === ECO_ROBOTS ? fixture('robots.txt') : detail(url);
function modifyDetail(action: (s: ReturnType<typeof load>) => void) {
  const $ = load(detail(availableUrl)); action($); return $.html();
}

test('real sitemap excludes archive and yields 118 unique unit URLs', () => {
  const urls = parseEcoSitemap(sitemap);
  assert.equal(urls.size, 118);
  assert.ok(urls.has(availableUrl));
  assert.ok(!urls.has('https://ecogolfcarts.com/listing/'));
});
test('canonicalization normalizes tracking/trailing slash and refuses foreign/navigation URLs', () => {
  assert.equal(canonicalEcoUrl(`${availableUrl.slice(0, -1)}?utm_source=test#x`), availableUrl);
  for (const url of ['https://evil.example/listing/cart-123/', 'http://ecogolfcarts.com/listing/cart-123/',
    'https://ecogolfcarts.com:123/listing/cart-123/', 'https://x@ecogolfcarts.com/listing/cart-123/',
    '/listing/', '/inventory/', '/listing/cart-without-id/']) assert.throws(() => canonicalEcoUrl(url));
});
test('malformed sitemap and foreign URLs fail closed', () => {
  assert.throws(() => parseEcoSitemap('<html>Access denied</html>'));
  assert.throws(() => parseEcoSitemap('<urlset><url><loc>https://evil.example/listing/cart-123/</loc></url></urlset>'));
});
test('crawl rules must explicitly allow access; restrictions or malformed pages stop discovery', async () => {
  verifyEcoRobots(fixture('robots.txt'));
  for (const rules of ['User-agent: *\nDisallow: /', 'User-agent: *\nDisallow:\nDisallow: /listing/',
    '<html>Forbidden</html>', 'User-agent: *\n']) assert.throws(() => verifyEcoRobots(rules));
  await assert.rejects(discoverEcoInventory(async url => url === ECO_ROBOTS
    ? 'User-agent: *\nDisallow: /' : fixtureFetch(url)), /crawl rules/);
});
test('inventory selects six available units, excluding one pending and sold section', () => {
  const result = parseEcoInventory(inventory);
  assert.equal(result.candidates.length, 6);
  assert.equal(result.pendingSkipped, 1);
  assert.ok(!result.candidates.some(c => c.url === soldUrl || c.url === pendingUrl));
  assert.deepEqual(result.candidates.map(c => c.price).sort(), [11999, 12999, 12999, 12999, 16999, 17999]);
});
test('missing sold boundary or inventory template stops rather than assuming pagination completeness', () => {
  assert.throws(() => parseEcoInventory(inventory.replace('End of Available Inventory for Sale', 'Next page')));
  assert.throws(() => parseEcoInventory('<html>Access denied</html>'));
});
test('duplicate cards and card ID mismatch fail closed', () => {
  const $ = load(inventory);
  const card = $('li.listing-card').first();
  card.after(card.clone());
  assert.throws(() => parseEcoInventory($.html()), /Duplicate/);
  assert.throws(() => parseEcoInventory(inventory.replace('id="listing-10644"', 'id="listing-123"')), /ID mismatch/);
});
test('sale price uses current text rather than misleading old-price class', () => {
  assert.equal(parseEcoPrice('<div class="listing-price"><span class="listing-sale-price">$18,999</span> $17,999</div>'), 17999);
  assert.equal(parseEcoPrice('<div class="listing-price">$9455.00</div>'), 9455);
});
test('ambiguous, nonpositive, cent-denominated, and finance prices are rejected', () => {
  for (const price of ['$9,455.71', '$12,999 $13,999', '$99/month', 'Call for price', '$0', '$1,23', '$-500']) {
    assert.throws(() => parseEcoPrice(`<div class="listing-price">${price}</div>`));
  }
});
test('sold/pending status wins even when a numeric price remains', () => {
  for (const status of ['SOLD', 'Pending', 'Reserved', 'Unavailable', 'Out of stock']) {
    assert.equal(parseEcoPrice(`<div class="listing-price">${status} $17,999</div>`), null);
  }
});
test('available detail preserves source identity, specs, and unit gallery only', () => {
  const unit = parseEcoDetail(detail(availableUrl), availableUrl)!;
  assert.equal(unit.price, 17999);
  assert.equal(unit.source_id, '10644');
  assert.equal(unit.make, 'Conquest Carts');
  assert.equal(unit.model, 'S6L');
  assert.equal(JSON.parse(unit.specs_json).seating, 6);
  assert.equal(JSON.parse(unit.specs_json).color, 'Frozen Gray');
  assert.equal(JSON.parse(unit.image_urls_json).length, 4);
  assert.equal('warranty_included' in unit, false);
});
test('related pending/sold units do not contaminate the primary detail status or price', () => {
  const html = detail(availableUrl).replace('</body>',
    '<aside><div class="listing-price">SOLD</div><div class="listing-price">Pending</div></aside></body>');
  assert.equal(parseEcoDetail(html, availableUrl)?.price, 17999);
});
test('real pending and sold details return no eligible unit', () => {
  assert.equal(parseEcoDetail(detail(pendingUrl), pendingUrl), null);
  assert.equal(parseEcoDetail(detail(soldUrl), soldUrl), null);
});
test('canonical URL, page ID, and location mismatch are rejected', () => {
  assert.throws(() => parseEcoDetail(detail(availableUrl), pendingUrl), /identity mismatch/);
  assert.throws(() => parseEcoDetail(detail(availableUrl).replace('postid-10644', 'postid-123'), availableUrl), /ID mismatch/);
  assert.throws(() => parseEcoDetail(detail(availableUrl).replaceAll('Ponte Vedra FL', 'Jacksonville FL'), availableUrl), /location/);
});
test('missing primary header, required specifications, or gallery fails closed', () => {
  for (const selector of ['.listing-header', '.listing-specs-container', '.listing-gallery-container']) {
    assert.throws(() => parseEcoDetail(modifyDetail($ => { $(selector).remove(); }), availableUrl));
  }
});
test('full captured discovery cross-checks sitemap, inventory and each detail', async () => {
  const result = await discoverEcoInventory(fixtureFetch);
  assert.equal(result.units.length, 6);
  assert.equal(result.sitemapUrls, 118);
  assert.equal(result.pendingSkipped, 1);
  assert.equal(result.detailUnavailableSkipped, 0);
});
test('detail becoming pending is excluded even if inventory card is available', async () => {
  const changed = modifyDetail($ => { $('.listing-header .listing-price').text('Pending'); });
  const result = await discoverEcoInventory(async url => url === availableUrl ? changed : fixtureFetch(url));
  assert.equal(result.units.length, 5);
  assert.equal(result.detailUnavailableSkipped, 1);
});
test('inventory/detail price disagreement aborts the complete discovery', async () => {
  const changed = modifyDetail($ => { $('.listing-header .listing-price').text('$15,000'); });
  await assert.rejects(discoverEcoInventory(async url => url === availableUrl ? changed : fixtureFetch(url)), /price conflict/);
});
test('missing sitemap candidate or failed detail fetch aborts discovery', async () => {
  await assert.rejects(discoverEcoInventory(async url => url === ECO_SITEMAP
    ? sitemap.replace(availableUrl, 'https://ecogolfcarts.com/listing/other-123/')
    : fixtureFetch(url)), /missing from sitemap/);
  await assert.rejects(discoverEcoInventory(async url => {
    if (url === availableUrl) throw new Error('HTTP 503');
    return fixtureFetch(url);
  }), /503/);
});
test('queue mapping is pending-only, retains source evidence, and deduplicates known URLs', async () => {
  const { units } = await discoverEcoInventory(fixtureFetch);
  const rows = ecoPendingRows(units, [availableUrl.slice(0, -1)], 100);
  assert.equal(rows.length, 5);
  assert.ok(rows.every(r => r.status === 'pending' && r.dealer_slug === ECO_SLUG && !('public_listing' in r)));
  assert.ok(rows.every(r => JSON.parse(r.specs_json).source_id && JSON.parse(r.image_urls_json).length));
  assert.equal(ecoPendingRows(units, units.map(u => u.source_url), 100).length, 0);
  assert.equal(ecoPendingRows(units, [], 2).length, 2);
  assert.throws(() => ecoPendingRows(units, [], 0));
  assert.throws(() => ecoPendingRows([units[0], units[0]], [], 100), /Duplicate/);
});

// Exercise actual runLambdaSync using mocked HTTP, not a duplicate queue implementation.
// No real database endpoint or secret is used in any test.
async function pipelineScenario(options: {
  dry?: boolean; enabled?: boolean; blocked?: boolean; blockError?: boolean; dbError?: boolean;
  known?: boolean; badDetail?: boolean; wrongAdapter?: boolean; modeAll?: boolean; missingBlockTable?: boolean;
}) {
  const requests: Array<{ table: string; method: string; body: any }> = [];
  const realFetch = globalThis.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_KEY;
  const oldWebSocket = globalThis.WebSocket;
  // Production targets Node 22; the sandbox is Node 20. Supply the repository's
  // existing ws transport so Supabase can construct its client during integration tests.
  (globalThis as any).WebSocket = WebSocket;
  process.env.SUPABASE_URL = 'https://eco-adapter-test.invalid';
  process.env.SUPABASE_KEY = 'not-a-real-key';
  const dealer = { slug: ECO_SLUG, adapter_key: options.wrongAdapter ? null : ECO_ADAPTER,
    canonical_domain: 'ecogolfcarts.com', sync_enabled: options.enabled !== false, browser_required: false };
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url || input.toString());
    if (url.hostname === 'ecogolfcarts.com') {
      if (options.badDetail && url.href === availableUrl) return new Response('Down', { status: 503 });
      return new Response(await fixtureFetch(url.href), { status: 200 });
    }
    assert.equal(url.hostname, 'eco-adapter-test.invalid', 'Unexpected network request');
    const table = url.pathname.split('/').at(-1)!;
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ table, method, body });
    const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status,
      headers: { 'Content-Type': 'application/json' } });
    if (table === 'dealers' && method === 'GET') return json(options.modeAll ? [dealer] : dealer);
    if (table === 'dealer_block_log') return options.missingBlockTable
      ? json({ code: 'PGRST205', message: 'table absent' }, 404)
      : options.blockError ? json({ code: '42501', message: 'permission denied' }, 403)
      : json(options.blocked ? { block_reason: 'robots_disallow' } : null);
    if (table === 'listings') {
      assert.equal(method, 'GET', 'Eco discovery must never publish listings');
      return json([]);
    }
    if (table === 'pending_imports' && method === 'GET') return json(options.known
      ? parseEcoInventory(inventory).candidates.map(c => ({ source_url: c.url })) : []);
    if (table === 'pending_imports' && method === 'POST') return options.dbError
      ? json({ message: 'queue unavailable' }, 403) : json(body.map((r: any) => ({ source_url: r.source_url })), 201);
    if (table === 'dealers' && method === 'PATCH') return new Response(null, { status: 204 });
    if (table === 'sync_log' && method === 'POST') return new Response(null, { status: 201 });
    throw new Error(`Unexpected database call: ${method} ${table}`);
  }) as typeof fetch;
  try {
    const result = await runLambdaSync({ mode: 'discover_sitemap', dealer: options.modeAll ? 'all' : ECO_SLUG,
      limit: 100, dry_run: options.dry || false });
    return { result, requests };
  } finally {
    globalThis.fetch = realFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_KEY; else process.env.SUPABASE_KEY = oldKey;
    if (oldWebSocket === undefined) delete (globalThis as any).WebSocket;
    else globalThis.WebSocket = oldWebSocket;
  }
}
test('real pipeline dry run queues six hypothetically and makes zero writes', async () => {
  const { result, requests } = await pipelineScenario({ dry: true, enabled: false });
  assert.equal(result.errors, 0);
  assert.equal(result.new_queued, 6);
  assert.ok(requests.every(r => r.method === 'GET'));
});
test('real pipeline writes only six pending rows and discovery telemetry', async () => {
  const { result, requests } = await pipelineScenario({});
  assert.equal(result.errors, 0);
  assert.equal(result.new_queued, 6);
  const writes = requests.filter(r => r.table === 'pending_imports' && r.method === 'POST');
  assert.equal(writes.length, 1);
  assert.ok(writes[0].body.every((r: any) => r.status === 'pending' && r.dealer_slug === ECO_SLUG));
  assert.equal(writes[0].body.length, 6);
});
test('all-dealer dispatch uses the registered Eco adapter', async () => {
  const { result } = await pipelineScenario({ modeAll: true, dry: true });
  assert.equal(result.errors, 0);
  assert.equal(result.new_queued, 6);
});
test('missing optional block table uses mandatory live robots verification', async () => {
  const { result } = await pipelineScenario({ missingBlockTable: true, dry: true });
  assert.equal(result.errors, 0);
  assert.equal(result.new_queued, 6);
});
test('repeat discovery is idempotent against existing pending URLs', async () => {
  const { result, requests } = await pipelineScenario({ known: true });
  assert.equal(result.errors, 0);
  assert.equal(result.new_queued, 0);
  assert.equal(result.already_known, 6);
  assert.ok(!requests.some(r => r.table === 'pending_imports' && r.method === 'POST'));
});
test('disabled, blocked, unconfigured, permission failure and malformed source never write inventory', async () => {
  for (const options of [{ enabled: false }, { blocked: true }, { blockError: true },
    { wrongAdapter: true }, { badDetail: true }]) {
    const { result, requests } = await pipelineScenario(options);
    assert.equal(result.errors, 1);
    assert.equal(result.new_queued, 0);
    assert.ok(!requests.some(r => r.table === 'pending_imports' && r.method === 'POST'));
  }
});
test('database insert failure cannot be reported as success', async () => {
  const { result } = await pipelineScenario({ dbError: true });
  assert.equal(result.errors, 1);
  assert.equal(result.new_queued, 0);
});
test('HTTP errors and redirects are not interpreted as empty inventory', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: any, init: any) => {
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal);
    return new Response('Denied', { status: 403 });
  }) as typeof fetch;
  try { await assert.rejects(fetchEcoText(ECO_INVENTORY), /403/); }
  finally { globalThis.fetch = realFetch; }
});
