import test from "node:test";
import assert from "node:assert/strict";
import { PoliteFetcher, fetchSitemapsPolite, rotate, sitemapLocs } from "../server/sync/polite-fetch.ts";

function harness(pages: Record<string, { status?: number; body: string }>, robots = "User-agent: *\nCrawl-delay: 10\n") {
  let t = 0; const calls: Array<{ url: string; at: number }> = [];
  const fetchImpl = (async (url: string) => {
    calls.push({ url, at: t });
    if (url.endsWith("/robots.txt")) return new Response(robots, { status: 200 });
    const p = pages[url]; if (!p) return new Response("nf", { status: 404 });
    return new Response(p.body, { status: p.status ?? 200 });
  }) as unknown as typeof fetch;
  const fetcher = new PoliteFetcher({ fetchImpl, sleepImpl: async ms => { t += ms; }, now: () => t });
  return { fetcher, calls, now: () => t };
}
const urlset = (...u: string[]) => `<urlset>${u.map(x => `<url><loc>${x}</loc></url>`).join("")}</urlset>`;
const index = (...u: string[]) => `<sitemapindex>${u.map(x => `<sitemap><loc>${x}</loc></sitemap>`).join("")}</sitemapindex>`;

test("crawl-delay is honored between sub-sitemaps", async () => {
  const h = harness({
    "https://d.com/sitemap.xml": { body: index("https://d.com/a.xml", "https://d.com/b.xml") },
    "https://d.com/a.xml": { body: urlset("https://d.com/listing/x-1") },
    "https://d.com/b.xml": { body: urlset("https://d.com/listing/y-2") },
  }, "User-agent: *\nCrawl-delay: 15\n");
  const r = await fetchSitemapsPolite(["https://d.com/sitemap.xml"], { fetcher: h.fetcher, now: h.now, rotateKey: 0, budgetMs: 120_000 });
  assert.deepEqual(r.urls.sort(), ["https://d.com/listing/x-1", "https://d.com/listing/y-2"]);
  assert.equal(r.partial, false);
  const at = h.calls.filter(c => !c.url.endsWith("robots.txt")).map(c => c.at);
  for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 15_000, `gap ${at[i] - at[i - 1]}`);
});

test("stops before the time budget and reports deferred (partial)", async () => {
  const pages: Record<string, { body: string }> = {};
  const subs = [1, 2, 3, 4, 5, 6].map(i => `https://v.com/p${i}.xml`);
  subs.forEach((s, i) => { pages[s] = { body: urlset(`https://v.com/product/c-${i}`) }; });
  const h = harness(pages);
  const r = await fetchSitemapsPolite(subs, { fetcher: h.fetcher, now: h.now, rotateKey: 0, budgetMs: 25_000 });
  assert.equal(r.partial, true);
  assert.equal(r.fetched.length, 3); // t=0,10s,20s; 30s would exceed 25s
  assert.equal(r.deferred.length, 3);
  assert.ok(h.now() <= 25_000);
});

test("rotation resumes at a different sub-sitemap on the next slot", async () => {
  const subs = ["a", "b", "c", "d"];
  assert.deepEqual(rotate(subs, 0), ["a", "b", "c", "d"]);
  assert.deepEqual(rotate(subs, 1), ["b", "c", "d", "a"]);
  assert.deepEqual(rotate(subs, 6), ["c", "d", "a", "b"]);
});

test("a block stops the crawl for that host without retry", async () => {
  const h = harness({
    "https://b.com/1.xml": { status: 403, body: "forbidden" },
    "https://b.com/2.xml": { body: urlset("https://b.com/listing/z-1") },
  });
  const r = await fetchSitemapsPolite(["https://b.com/1.xml", "https://b.com/2.xml"], { fetcher: h.fetcher, now: h.now, rotateKey: 0, budgetMs: 60_000 });
  assert.equal(r.block, "http_403");
  assert.equal(r.partial, true);
  assert.equal(h.calls.filter(c => c.url.endsWith("2.xml")).length, 0);
});

test("crawl-delay above 60s is a policy block", async () => {
  const h = harness({ "https://s.com/x.xml": { body: urlset("https://s.com/l/1") } }, "User-agent: *\nCrawl-delay: 120\n");
  const r = await fetchSitemapsPolite(["https://s.com/x.xml"], { fetcher: h.fetcher, now: h.now, rotateKey: 0 });
  assert.equal(r.block, "policy_crawl_delay");
  assert.equal(r.urls.length, 0);
});

test("Dealer Spike xsitemap locs decode &amp; and match the new patterns", () => {
  const locs = sitemapLocs(urlset("https://www.affordablecarts.com/New-Inventory-2026-E-Z-GO-Golf-Cart-RXV-Port-Charlotte-19270930", "https://www.affordablecarts.com/default.asp?page=xsitemap&amp;s=NewInventory"));
  const pat = /affordablecarts\.com\/(New|Pre-owned)-Inventory-[^?#]+-\d+$/i;
  assert.deepEqual(locs.filter(u => pat.test(u)), ["https://www.affordablecarts.com/New-Inventory-2026-E-Z-GO-Golf-Cart-RXV-Port-Charlotte-19270930"]);
  assert.ok(locs[1].includes("&s=NewInventory"));
});
