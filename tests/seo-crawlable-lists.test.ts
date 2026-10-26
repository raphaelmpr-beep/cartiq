import test from "node:test";
import assert from "node:assert/strict";
import { parseScraperSlugTitle, listingHeadlineCore, isScraperSlugTitle } from "../server/listing-title.ts";
import { renderListBlock, itemListJsonLd, buildListPage, __setListingLoader, SSR_PAGE_SIZE } from "../server/seo-ssr-lists.ts";
import { getRouteMetaAsync, getRouteMeta } from "../server/seo-meta.ts";

function mk(i: number, over: any = {}): any {
  return { id: i, slug: `cart-${i}`, title: `Cart ${i}`, status: "active", public_listing: true,
    city: "The Villages", state: "FL", brand: "Club Car", model: "Onward", year: 2024, condition: "used", ...over };
}

test("scraper-ID title becomes year/brand/model", () => {
  const t = "Golf-Carts-E-Z-GO-RXV-2019-Douglas-GA-2050b2fc-0eb6-4ed7-be84-b4d700d94854";
  assert.ok(isScraperSlugTitle(t));
  assert.deepEqual(parseScraperSlugTitle(t, "Douglas", "GA"), { year: "2019", brandModel: "E-Z-GO RXV" });
  assert.equal(listingHeadlineCore({ title: t, city: "Douglas", state: "GA" } as any), "2019 E-Z-GO RXV");
  assert.equal(listingHeadlineCore({ title: "Nice red cart", year: null, brand: null, model: null } as any), "Nice red cart");
  assert.equal(listingHeadlineCore({ title: "x", year: 2026, brand: "Alset EV", model: "Mako" } as any), "2026 Alset EV Mako");
});

test("list block: real count, 50 links, pagination, no invented numbers", () => {
  const rows = Array.from({ length: 123 }, (_, i) => mk(i + 1));
  const b = renderListBlock({ kind: "search", heading: "H", basePath: "/search", rows, page: 1 });
  assert.equal(b.total, 123); assert.equal(b.pages, 3);
  assert.equal((b.bodyContent.match(/href="\/listing\//g) ?? []).length, SSR_PAGE_SIZE);
  assert.match(b.bodyContent, /123 golf carts for sale/);
  assert.match(b.bodyContent, /href="\/search\?page=2"/);
  assert.doesNotMatch(b.bodyContent, /\bhidden\b/);
  const b3 = renderListBlock({ kind: "search", heading: "H", basePath: "/search", rows, page: 3 });
  assert.equal(b3.items.length, 23);
  const ld: any = itemListJsonLd("t", "d", "https://golfcartiq.com/search", b3);
  assert.equal(ld["@type"], "ItemList"); assert.equal(ld.numberOfItems, 123);
  assert.equal(ld.itemListElement[0].position, 101);
  const empty = renderListBlock({ kind: "city", heading: "H", basePath: "/x", rows: [], page: 1 });
  assert.match(empty.bodyContent, /0 golf carts for sale/); assert.doesNotMatch(empty.bodyContent, /<ul>/);
});

test("escapes listing text", () => {
  const b = renderListBlock({ kind: "s", heading: "H", basePath: "/search", rows: [mk(1, { year: null, brand: null, model: null, title: "<script>x</script>" })], page: 1 });
  assert.doesNotMatch(b.bodyContent, /<script>/);
});

test("route meta: list pages keep title/canonical/description, add block + ItemList", async () => {
  __setListingLoader(async () => [
    mk(1), mk(2, { city: "Wildwood" }), mk(3, { brand: "Yamaha" }), mk(4, { state: "GA", city: "Peachtree City" }),
  ]);
  for (const p of ["/search", "/golf-carts-for-sale/the-villages-fl", "/brands/club-car"]) {
    const base = getRouteMeta(p); const m = await getRouteMetaAsync(p, "");
    assert.equal(m.title, base.title); assert.equal(m.canonical, base.canonical); assert.equal(m.description, base.description);
    assert.ok(m.bodyContent && /href="\/listing\//.test(m.bodyContent), p);
    assert.equal((m.jsonLd as any)["@type"], "ItemList");
  }
  assert.equal((await buildListPage("/search", 1))!.total, 4);
  assert.equal((await buildListPage("/golf-carts-for-sale/the-villages-fl", 1))!.total, 2);
  assert.equal((await buildListPage("/brands/club-car", 1))!.total, 3);
  assert.equal(await buildListPage("/brands/not-a-brand", 1), null);
  __setListingLoader(async () => { throw new Error("db down"); });
  const m = await getRouteMetaAsync("/search", "");
  assert.equal(m.bodyContent, undefined);
  __setListingLoader(null);
});
