import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyResponse, isRootOrIndexRedirect, nextState, parseRobots, robotsAllows, soldMarker, computeQuality, dealerHealth, outlierIds, isAutoArchiveExcluded } from '../server/recheck/core.ts';
import { runRecheck, syncLogStatus } from '../server/recheck/runner.ts';

const U = 'https://boterocarts.com/listing/used-2022-gas-yamaha-drive2-peachtree-city-ga-31128/';

test('404/410 are dead; 5xx/403/429 are errors', () => {
  assert.equal(classifyResponse(U, 404, U, '').status, 'dead');
  assert.equal(classifyResponse(U, 410, U, '').status, 'dead');
  for (const s of [500, 503, 403, 429, 0]) assert.equal(classifyResponse(U, s, U, '').status, 'error');
});
test('redirect to homepage or inventory index is dead; same page is alive', () => {
  assert.ok(isRootOrIndexRedirect(U, 'https://boterocarts.com/'));
  assert.ok(isRootOrIndexRedirect('https://golfcartsjacksonville.com/listing/2023-ezgo-x/', 'https://golfcartsjacksonville.com/golf-carts-for-sale-jacksonville-fl-new-used-electric-gas/'));
  assert.ok(isRootOrIndexRedirect(U, 'https://boterocarts.com/inventory/'));
  assert.ok(!isRootOrIndexRedirect(U, U));
  assert.ok(!isRootOrIndexRedirect(U, U.replace(/\/$/, '')));
  assert.ok(!isRootOrIndexRedirect('http://www.x.com/cart/123', 'https://x.com/cart/123'));
  assert.ok(!isRootOrIndexRedirect(U, 'https://boterocarts.com/listing/used-2022-gas-yamaha-drive2-peachtree-city-ga-31128-2/'));
});
test('sold markers: strong phrases only', () => {
  assert.ok(soldMarker('<p>This cart has been sold.</p>'));
  assert.ok(soldMarker('{"availability":"https://schema.org/SoldOut"}'));
  assert.equal(soldMarker('<nav><a href="/sold">Sold Units</a></nav><p>We have sold 1000 carts</p>'), null);
  assert.equal(classifyResponse(U, 200, U, '<span class="badge-sold">SOLD</span>').status, 'dead');
  assert.equal(classifyResponse(U, 200, U, '<h1>2022 Yamaha</h1>$12,995').status, 'alive');
});
test('two consecutive dead results are required to archive', () => {
  const dead = { status: 'dead' as const, reason: 'http_404' };
  assert.deepEqual(nextState(0, dead), { failCount: 1, archive: false, touchLastChecked: false });
  assert.deepEqual(nextState(1, dead), { failCount: 2, archive: true, touchLastChecked: false });
  assert.deepEqual(nextState(1, { status: 'alive', reason: 'ok' }), { failCount: 0, archive: false, touchLastChecked: true });
  assert.deepEqual(nextState(1, { status: 'error', reason: 'http_503' }), { failCount: 1, archive: false, touchLastChecked: false });
});
test('robots parsing respects our group, else *', () => {
  const r = 'User-agent: *\nDisallow: /wp-admin/\nDisallow: /private*\n\nUser-agent: GolfCartIQ-Bot\nDisallow: /listing/\n';
  assert.deepEqual(parseRobots(r), ['/listing/']);
  assert.ok(!robotsAllows(parseRobots(r), '/listing/x'));
  const s = parseRobots('User-agent: *\nDisallow: /wp-admin/\nDisallow: /private*');
  assert.ok(robotsAllows(s, '/listing/x')); assert.ok(!robotsAllows(s, '/private-stuff'));
  assert.ok(!robotsAllows(parseRobots('User-agent: *\nDisallow: /'), '/anything'));
  assert.ok(robotsAllows(parseRobots('User-agent: *\nDisallow:'), '/anything'));
});
test('quality metrics and health', () => {
  const now = Date.parse('2026-10-15T00:00:00Z');
  const mk = (id: number, p: number | null, days: number | null, extra: any = {}) => ({ id, sync_source: 'd1', status: 'active', public_listing: true,
    asking_price: p, sale_price: null, regular_price: null, brand: 'Club Car', model: 'Onward', year: 2026, condition: 'new', seating: 4,
    last_checked_at: days == null ? null : new Date(now - days * 86400000).toISOString(), source_listing_url: `https://x.com/${id}`, ...extra });
  const rows = [mk(1, 14000, 1), mk(2, 14500, 2), mk(3, 15000, 10), mk(4, 13800, 40), mk(5, 1000, null), mk(6, null, 1, { recheck_fail_count: 1 }), mk(7, 14200, 1, { source_listing_url: 'https://x.com/1' })];
  const q = computeQuality(rows as any, now);
  assert.equal(q.totals.active, 7); assert.equal(q.totals.stale_7d, 3); assert.equal(q.totals.stale_30d, 2); assert.equal(q.totals.never_checked, 1);
  assert.equal(q.totals.missing_price, 1); assert.equal(q.totals.dead_pending, 1); assert.equal(q.totals.duplicates, 2);
  assert.ok(outlierIds(rows as any).has(5));
  assert.equal(dealerHealth({ active: 10, stale_7d: 1, dead_pending: 0 }), 'Fresh');
  assert.equal(dealerHealth({ active: 10, stale_7d: 5, dead_pending: 0 }), 'Stale');
  assert.equal(dealerHealth({ active: 10, stale_7d: 0, dead_pending: 2 }), 'Failing');
  assert.equal(dealerHealth({ active: 10, stale_7d: 0, dead_pending: 0 }, 'boom'), 'Failing');
});

function fakeDb(rows: any[], writes: any[], extra: { blocks?: any[]; dealers?: any[] } = {}) {
  const chain = (table: string) => {
    const c: any = { _t: table };
    for (const m of ['select', 'eq', 'not', 'order', 'limit', 'in', 'or']) c[m] = () => c;
    const data = table === 'dealer_block_log' ? (extra.blocks ?? []) : table === 'dealers' ? (extra.dealers ?? []) : rows;
    c.then = (res: any) => res({ data, error: null });
    c.maybeSingle = () => Promise.resolve({ data: null, error: null });
    c.update = (v: any) => ({ eq: (_k: string, id: number) => { writes.push({ table, op: 'update', id, v }); return Promise.resolve({ error: null }); } });
    c.insert = (v: any) => { writes.push({ table, op: 'insert', v }); return Promise.resolve({ error: null }); };
    c.upsert = (v: any) => { writes.push({ table, op: 'upsert', v }); return Promise.resolve({ error: null }); };
    return c;
  };
  return { from: chain } as any;
}
const fakeFetch = (map: Record<string, { status: number; url?: string; body?: string; headers?: Record<string, string> }>) => (async (input: any) => {
  const u = String(input); const hit = map[u] ?? (u.endsWith('/robots.txt') ? { status: 404 } : { status: 200, body: 'ok' });
  return { status: hit.status, ok: hit.status < 400, url: hit.url ?? u, headers: new Headers((hit as any).headers ?? {}), text: async () => hit.body ?? '' } as any;
}) as any;

test('runner: dry run makes no writes; live run writes transitions + sync_log (LIVE_FLAG_ACTION=auto_hide)', async () => {
  const prevFlag = process.env.LIVE_FLAG_ACTION; process.env.LIVE_FLAG_ACTION = 'auto_hide';
  try {
  const rows = [
    { id: 1, sync_source: 'a', source_listing_url: 'https://a.com/cart/1', recheck_fail_count: 0 },
    { id: 2, sync_source: 'a', source_listing_url: 'https://a.com/cart/2', recheck_fail_count: 1 },
    { id: 3, sync_source: 'b', source_listing_url: 'https://b.com/cart/3', recheck_fail_count: 0 },
  ];
  const f = fakeFetch({ 'https://a.com/cart/2': { status: 404 }, 'https://b.com/cart/3': { status: 200, url: 'https://b.com/' } });
  const w1: any[] = [];
  const dry = await runRecheck({ dryRun: true, db: fakeDb(rows, w1), fetchImpl: f, timeBudgetMs: 60000, sleepImpl: async () => {} });
  assert.equal(w1.length, 0);
  assert.equal(dry.alive, 1); assert.equal(dry.archived, 1); assert.equal(dry.dead_pending, 1);
  const w2: any[] = [];
  await runRecheck({ dryRun: false, db: fakeDb(rows, w2), fetchImpl: f, timeBudgetMs: 60000, sleepImpl: async () => {} });
  const upd = (id: number) => w2.find(x => x.op === 'update' && x.id === id).v;
  assert.ok(upd(1).last_checked_at); assert.equal(upd(1).recheck_fail_count, 0);
  assert.equal(upd(2).status, 'archived'); assert.equal(upd(2).public_listing, false);
  assert.equal(upd(3).recheck_fail_count, 1); assert.equal(upd(3).status, undefined); assert.equal(upd(3).last_checked_at, undefined);
  assert.equal(w2.filter(x => x.table === 'sync_log').length, 3);
  } finally { if (prevFlag === undefined) delete process.env.LIVE_FLAG_ACTION; else process.env.LIVE_FLAG_ACTION = prevFlag; }
});
test('runner: default LIVE_FLAG_ACTION=queue_review never hides a confirmed-dead listing', async () => {
  delete process.env.LIVE_FLAG_ACTION;
  const rows = [{ id: 2, sync_source: 'a', source_listing_url: 'https://a.com/cart/2', recheck_fail_count: 1 }];
  const f = fakeFetch({ 'https://a.com/cart/2': { status: 404 } });
  const w: any[] = [];
  const s = await runRecheck({ dryRun: false, db: fakeDb(rows, w), fetchImpl: f, timeBudgetMs: 60000, sleepImpl: async () => {} });
  assert.equal(s.archived, 0); assert.equal(s.needs_review, 1);
  const u = w.find(x => x.op === 'update' && x.id === 2).v;
  assert.equal(u.status, undefined); assert.equal(u.public_listing, undefined);
});
test('runner: robots disallow skips fetch', async () => {
  const rows = [{ id: 9, sync_source: 'c', source_listing_url: 'https://c.com/listing/9', recheck_fail_count: 0 }];
  let fetched = 0;
  const f = (async (u: any) => { if (String(u).endsWith('/robots.txt')) return { status: 200, ok: true, url: String(u), text: async () => 'User-agent: *\nDisallow: /listing/' } as any; fetched++; return { status: 200, ok: true, url: String(u), text: async () => '' } as any; }) as any;
  const s = await runRecheck({ dryRun: true, db: fakeDb(rows, []), fetchImpl: f, sleepImpl: async () => {} });
  assert.equal(fetched, 0); assert.equal(s.items[0].result.status, 'blocked_robots');
});
test('runner: Botero dealers are never auto-archived (needs_review, still logged)', async () => {
  const rows = [
    { id: 21, sync_source: 'botero-carts-jacksonville', source_listing_url: 'https://boterocarts.com/inventory/x', recheck_fail_count: 1 },
    { id: 22, sync_source: 'other', source_listing_url: 'https://www.boterocarts.com/inventory/y', recheck_fail_count: 5 },
  ];
  const f = fakeFetch({ 'https://boterocarts.com/inventory/x': { status: 200, url: 'https://boterocarts.com/' },
    'https://www.boterocarts.com/inventory/y': { status: 404 } });
  const w: any[] = [];
  const s = await runRecheck({ dryRun: false, db: fakeDb(rows, w), fetchImpl: f, timeBudgetMs: 60000, sleepImpl: async () => {} });
  assert.equal(s.archived, 0); assert.equal(s.needs_review, 2);
  for (const id of [21, 22]) { const u = w.find(x => x.op === 'update' && x.id === id).v; assert.equal(u.status, undefined); assert.equal(u.public_listing, undefined); }
  const logs = w.filter(x => x.table === 'sync_log');
  assert.equal(logs.length, 2); assert.ok(logs.every(l => l.v.status === 'not_found' && /^recheck:needs_review \| needs manual review/.test(l.v.notes)));
});
test('isAutoArchiveExcluded', () => {
  assert.equal(isAutoArchiveExcluded('botero-carts-ocala'), true);
  assert.equal(isAutoArchiveExcluded('boterox'), false);
  assert.equal(isAutoArchiveExcluded('golf-rider', 'https://golfrider.com/a'), false);
});

test('sync_log status stays within legacy CHECK vocabulary', () => {
  const ok = new Set(['ok','price_mismatch','not_found','error']);
  for (const a of ['touch','mark_dead_1','archive','needs_review','none'] as const) assert.ok(ok.has(syncLogStatus({ action: a })));
  assert.equal(syncLogStatus({ action: 'touch', priceUpdate: { from: 1, to: 2 } }), 'price_mismatch');
});

test('runner: 403 auto-pauses all dealers on the host and stops that host', async () => {
  const rows = [1, 2, 3].map(i => ({ id: 30 + i, sync_source: i === 3 ? 'botero-carts-ocala' : 'botero-carts-clearwater', source_listing_url: `https://boterocarts.com/listing/x-${i}/`, recheck_fail_count: 0 }));
  let pageHits = 0;
  const base = fakeFetch({});
  const f = (async (u: any) => { if (!String(u).endsWith('/robots.txt')) pageHits++; return String(u).endsWith('/robots.txt') ? base(u) : { status: 403, ok: false, url: String(u), headers: new Headers(), text: async () => 'Forbidden' } as any; }) as any;
  const w: any[] = [];
  const s = await runRecheck({ dryRun: false, db: fakeDb(rows, w, { dealers: [{ slug: 'botero-carts-jacksonville', name: 'Botero J', website_url: 'https://www.boterocarts.com/' }] }), fetchImpl: f, timeBudgetMs: 60000, sleepImpl: async () => {} });
  assert.equal(pageHits, 1, 'stops after first block');
  assert.equal(s.host_blocks.length, 1); assert.equal(s.host_blocks[0].kind, 'http_403');
  const ups = w.filter(x => x.table === 'dealer_block_log' && x.op === 'upsert').map(x => x.v.dealer_slug).sort();
  assert.deepEqual(ups, ['botero-carts-clearwater', 'botero-carts-jacksonville', 'botero-carts-ocala']);
  assert.ok(w.filter(x => x.table === 'listings').every(x => x.v.status === undefined), 'block never archives');
});
test('runner: dry run records blocks in summary but writes nothing', async () => {
  const rows = [{ id: 41, sync_source: 'x', source_listing_url: 'https://x.com/a', recheck_fail_count: 1 }];
  const f = fakeFetch({ 'https://x.com/a': { status: 202, body: '<script src="/.well-known/sgcaptcha/?r=1"></script>' } });
  const w: any[] = [];
  const s = await runRecheck({ dryRun: true, db: fakeDb(rows, w), fetchImpl: f, sleepImpl: async () => {} });
  assert.equal(w.length, 0); assert.equal(s.host_blocks[0].kind, 'challenge'); assert.equal(s.items[0].result.reason, 'blocked_challenge');
});
test('runner: paused dealers are skipped; expired Retry-After pauses resume', async () => {
  const rows = [{ id: 51, sync_source: 'p', source_listing_url: 'https://p.com/a', recheck_fail_count: 0 },
    { id: 52, sync_source: 'q', source_listing_url: 'https://q.com/a', recheck_fail_count: 0 }];
  const blocks = [{ dealer_slug: 'p', block_reason: 'http_403', paused_until: null },
    { dealer_slug: 'q', block_reason: 'http_429', paused_until: new Date(Date.now() - 1000).toISOString() }];
  const s = await runRecheck({ dryRun: true, db: fakeDb(rows, [], { blocks }), fetchImpl: fakeFetch({}), sleepImpl: async () => {} });
  assert.equal(s.paused_dealers_skipped, 1); assert.deepEqual(s.items.map(i => i.id), [52]);
});
test('runner: crawl-delay honored between requests to one host', async () => {
  const rows = [1, 2, 3].map(i => ({ id: 60 + i, sync_source: 'd', source_listing_url: `https://d.com/c/${i}`, recheck_fail_count: 0 }));
  const sleeps: number[] = [];
  const f = fakeFetch({ 'https://d.com/robots.txt': { status: 200, body: 'User-agent: *\nCrawl-delay: 20\nDisallow:' } });
  let t = 1_000_000;
  const realNow = Date.now;
  const s = await runRecheck({ dryRun: true, db: fakeDb(rows, []), fetchImpl: f, timeBudgetMs: 10 * 60_000, sleepImpl: async (ms) => { sleeps.push(ms); } });
  assert.equal(s.processed, 3);
  assert.equal(sleeps.length, 2); assert.ok(sleeps.every(ms => ms >= 19_000), `slept ${sleeps}`);
});
