import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRobotsPolicy, robotsPolicyAllows, hostIntervalMs, retryAfterMs, detectBlock, PoliteFetcher, BOT_UA, botHeaders, MIN_HOST_INTERVAL_MS } from '../server/sync/polite-fetch.ts';
import { browserHeaders, sitemapHeaders } from '../server/sync/http-headers.ts';

test('robots: crawl-delay, own group preferred, allow beats shorter disallow', () => {
  const p = parseRobotsPolicy('User-agent: *\nDisallow: /a\nCrawl-delay: 10\n\nUser-agent: GolfCartIQ-Bot\nDisallow: /private\nAllow: /private/ok\nCrawl-delay: 30');
  assert.equal(p.crawlDelaySec, 30); assert.equal(robotsPolicyAllows(p, '/a'), true);
  assert.equal(robotsPolicyAllows(p, '/private/x'), false); assert.equal(robotsPolicyAllows(p, '/private/ok/1'), true);
  assert.equal(hostIntervalMs(p), 30_000);
  assert.equal(hostIntervalMs(parseRobotsPolicy('User-agent: *\nCrawl-delay: 3')), MIN_HOST_INTERVAL_MS);
});
test('retry-after parsing (min 1h)', () => {
  assert.equal(retryAfterMs('7200'), 7_200_000); assert.equal(retryAfterMs('5'), 3_600_000); assert.equal(retryAfterMs(null), 3_600_000);
});
test('block detection', () => {
  assert.equal(detectBlock(403, '<title>Just a moment...</title>'), 'challenge');
  assert.equal(detectBlock(403, 'nope'), 'http_403');
  assert.equal(detectBlock(202, '/.well-known/sgcaptcha/'), 'challenge');
  assert.equal(detectBlock(402), 'http_402'); assert.equal(detectBlock(429), 'http_429');
  assert.equal(detectBlock(200, '<html>fine</html>'), null); assert.equal(detectBlock(404), null);
});
test('honest headers only: no browser UA, no Referer', () => {
  for (const h of [browserHeaders('https://x.com/a'), sitemapHeaders('https://x.com/s.xml'), botHeaders('json')]) {
    assert.equal(h['User-Agent'], BOT_UA); assert.ok(!('Referer' in h)); assert.ok(!/Mozilla/.test(JSON.stringify(h)));
  }
});
test('fetcher: 429 Retry-After pauses host; long crawl-delay = policy-limited; circuit breaker', async () => {
  let n = 0;
  const f = (async (u: any) => {
    const s = String(u); n++;
    if (s === 'https://slow.com/robots.txt') return { status: 200, ok: true, url: s, headers: new Headers(), text: async () => 'User-agent: *\nCrawl-delay: 600' } as any;
    if (s.endsWith('/robots.txt')) return { status: 404, ok: false, url: s, headers: new Headers(), text: async () => '' } as any;
    if (s.startsWith('https://rl.com')) return { status: 429, ok: false, url: s, headers: new Headers({ 'retry-after': '7200' }), text: async () => '' } as any;
    if (s.startsWith('https://err.com')) return { status: 500, ok: false, url: s, headers: new Headers(), text: async () => '' } as any;
    return { status: 200, ok: true, url: s, headers: new Headers(), text: async () => 'ok' } as any;
  }) as any;
  const pf = new PoliteFetcher({ fetchImpl: f, sleepImpl: async () => {} });
  const a = await pf.get('https://rl.com/x'); assert.equal(a.block, 'http_429'); assert.equal(a.retryAfterMs, 7_200_000);
  const before = n; const b = await pf.get('https://rl.com/y'); assert.equal(b.block, 'http_429'); assert.equal(n, before, 'no request while paused');
  assert.equal((await pf.get('https://slow.com/p')).block, 'policy_crawl_delay');
  for (let i = 0; i < 3; i++) await pf.get('https://err.com/' + i);
  assert.equal((await pf.get('https://err.com/z')).block, 'circuit_open');
  const sent: any[] = [];
  const pf2 = new PoliteFetcher({ fetchImpl: (async (u: any, init: any) => { sent.push(init.headers); return { status: 404, ok: false, url: String(u), headers: new Headers(), text: async () => '' } as any; }) as any, sleepImpl: async () => {} });
  await pf2.get('https://h.com/a', { etag: '"abc"' });
  assert.ok(sent.every(h => h['User-Agent'] === BOT_UA)); assert.equal(sent[1]['If-None-Match'], '"abc"');
});
