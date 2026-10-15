/**
 * Price extraction rules (audit 2026-10-15, step 2):
 *   1. Structured data first: JSON-LD Product/Vehicle offers.price (the listing's own main entity).
 *   2. Then labeled prices in the MAIN listing price block only (never carousels / "similar carts"):
 *      Sale > Our/Internet/Now/Price > Regular. MSRP is never used as the price.
 *   3. Never a financing amount: anything followed by /mo, /month, "per month", or labeled
 *      down / deposit / payment / as low as / starting at / upgrade / save / off / financing.
 *   4. Plausibility: cart prices must be $1,500–$100,000; otherwise no price.
 *   5. No price found → null (leave blank, "Call for price"). Never a fallback number.
 */
export interface PriceInfo { price: number | null; regular: number | null; msrp: number | null; source: string }

const AFTER_BAD = /^\s*(\/\s*mo|\/\s*month|per\s+month|a\s+month|mo\b|monthly|down\b|deposit)/i;
export const MIN_CART_PRICE = 1500;
export const MAX_CART_PRICE = 100_000;
const BAD_CONTEXT = /(\/\s*mo\b|\/\s*month|per\s+month|monthly|\bmo\.|down\s*payment|\bdown\b|deposit|payment|as\s+low\s+as|starting\s+at|from\s+only|upgrade|\bsave\b|savings|\boff\b|financ|\bapr\b|rebate|incentive)/i;

/** Strict money parse of ONE amount: "$12,995", "12995", "$12,995.00". Returns null for anything else. */
export function parseMoney(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  if (typeof s === "number") return isFinite(s) && s > 0 ? Math.round(s) : null;
  const m = String(s).replace(/&#0*36;|&dollar;/g, "$").match(/\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/);
  if (!m) return null;
  const n = Math.round(parseFloat(m[1].replace(/,/g, "") + (m[2] ? "." + m[2] : "")));
  return isFinite(n) && n > 0 ? n : null;
}
export const plausible = (n: number | null): number | null => (n != null && n >= MIN_CART_PRICE && n <= MAX_CART_PRICE ? n : null);
export const isFinancingContext = (ctx: string) => BAD_CONTEXT.test(ctx);

function walkLd(node: any, out: any[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const n of node) walkLd(n, out); return; }
  const t = ([] as string[]).concat(node["@type"] ?? []).map(String);
  if (t.some(x => /^(Product|Vehicle|Car|IndividualProduct|Motorcycle)$/i.test(x))) out.push(node);
  if (node["@graph"]) walkLd(node["@graph"], out);
}
/** JSON-LD: first Product/Vehicle entity's offer price (sale if present). */
export function priceFromJsonLd(html: string): PriceInfo | null {
  const blocks = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)).map(m => m[1]);
  for (const b of blocks) {
    let j: any; try { j = JSON.parse(b.trim()); } catch { continue; }
    const ents: any[] = []; walkLd(j, ents);
    for (const e of ents) {
      const offers = ([] as any[]).concat(e.offers ?? []);
      for (const o of offers) {
        const p = plausible(parseMoney(o?.price ?? o?.lowPrice ?? o?.priceSpecification?.price));
        if (p) return { price: p, regular: null, msrp: null, source: "jsonld" };
      }
    }
  }
  return null;
}

const strip = (h: string) => h.replace(/<small[^>]*>/gi, "").replace(/<\/small>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&#0*36;|&dollar;/g, "$").replace(/\s+/g, " ");

/**
 * Labeled prices from the main listing block. `mainHtml` should be the listing's own price area;
 * when a whole page is passed, only the FIRST price block (before any carousel/related section) is used.
 */
export function priceFromLabels(html: string): PriceInfo | null {
  let main = html;
  const cut = main.search(/class="[^"]*(dealer-carousel|related|similar|you-may-also|recently-viewed|upsell|cross-sell)/i);
  if (cut > 0) main = main.slice(0, cut);
  const text = strip(main);
  const re = /(sale\s*price|now|our\s*price|internet\s*price|your\s*price|special|price|regular\s*price|was|list\s*price|msrp|retail)\s*:?\s*\$\s?(\d{1,3}(?:,\d{3})+|\d{4,6})(\.\d{2})?(?=([^$]{0,24}))/gi;
  let sale: number | null = null, ours: number | null = null, regular: number | null = null, msrp: number | null = null;
  for (const m of Array.from(text.matchAll(re))) {
    const label = m[1].toLowerCase().replace(/\s+/g, " ");
    const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
    const after = m[4] || "";
    // Reject only when the amount itself is a monthly/down figure, or the label right before it is financing.
    if (AFTER_BAD.test(after) || isFinancingContext(before.slice(-25))) continue;
    const n = plausible(parseMoney(m[2] + (m[3] || "")));
    if (!n) continue;
    if (/msrp|retail|list price/.test(label)) { if (msrp == null) msrp = n; continue; }
    if (/regular|was/.test(label)) { if (regular == null) regular = n; continue; }
    if (/sale|now|special/.test(label)) { if (sale == null) sale = n; continue; }
    if (ours == null) ours = n;
  }
  const price = sale ?? ours ?? regular;
  if (!price) return msrp ? { price: null, regular: null, msrp, source: "msrp_only" } : null;
  return { price, regular: regular && regular !== price ? regular : null, msrp, source: sale ? "label_sale" : ours ? "label_price" : "label_regular" };
}

/** WooCommerce: <ins> is the sale price, <del> the regular price. */
export function priceFromWoo(html: string): PriceInfo | null {
  const ins = html.match(/<ins[^>]*>[\s\S]{0,300}?woocommerce-Price-amount[^>]*>([\s\S]{0,120}?)<\/span>\s*<\/(?:bdi|span)>/i);
  const del = html.match(/<del[^>]*>[\s\S]{0,300}?woocommerce-Price-amount[^>]*>([\s\S]{0,120}?)<\/span>\s*<\/(?:bdi|span)>/i);
  const sale = ins ? plausible(parseMoney(strip(ins[1]))) : null;
  const reg = del ? plausible(parseMoney(strip(del[1]))) : null;
  if (sale) return { price: sale, regular: reg && reg !== sale ? reg : null, msrp: null, source: "woo_sale" };
  return null;
}

/** Full page → best price, following the rules above. */
export function extractListingPrice(html: string): PriceInfo {
  return priceFromJsonLd(html) ?? priceFromWoo(html) ?? priceFromLabels(html) ?? { price: null, regular: null, msrp: null, source: "none" };
}

/** A single element's text (legacy selectors): strict money, financing/MSRP rejected, plausibility-checked. */
export function priceFromElementText(text: string | null | undefined, context = ""): number | null {
  if (!text) return null;
  if (isFinancingContext(text) || isFinancingContext(context)) return null;
  if (/msrp|retail/i.test(context)) return null;
  return plausible(parseMoney(text));
}

/** Feed fields (DealerSpike/DX1 style): sale price first, then price; MSRP never used as the price. */
export function priceFromFeed(h: { SalePrice?: any; Price?: any; Msrp?: any; MSRP?: any }): PriceInfo {
  const sale = plausible(parseMoney(h.SalePrice)); const p = plausible(parseMoney(h.Price)); const msrp = plausible(parseMoney(h.Msrp ?? h.MSRP));
  const price = sale ?? p;
  return { price, regular: sale && p && p !== sale ? p : null, msrp, source: sale ? "feed_sale" : p ? "feed_price" : msrp ? "msrp_only" : "none" };
}
