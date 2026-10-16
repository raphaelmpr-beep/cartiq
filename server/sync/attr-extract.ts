// Battery + warranty attribute extraction from a listing page. Returns ONLY facts the page
// itself states about this unit; ambiguous or conflicting mentions return null.
// Site chrome (nav/header/footer/aside/forms) and related/similar-listing blocks are removed
// first so menu items like "Lithium Carts" don't produce false hits.

export type Chemistry = "lithium" | "lead_acid" | "agm";
export interface BatteryInfo { chemistry: Chemistry | null; voltage: number | null; ah: number | null; kwh: number | null; brand: string | null }
export interface UnitWarranty { included: "yes" | "no" | null; months: number | null; quote: string | null }

const BRANDS = ["RoyPow", "Eco Battery", "EcoBattery", "Allied Lithium", "Trojan", "Dragonfly", "Navitas", "Relion", "Epoch", "Elite Power", "US Battery", "Crown Battery", "Lithionics", "Fusion"];
const RELATED = /(related|similar|recommended|recently viewed|you may also like|more (?:inventory|from|like this)|other (?:carts|listings|units))/i;

export function decode(s: string): string {
  return s.replace(/&nbsp;|&#160;/g, " ").replace(/&amp;|&#038;/g, "&").replace(/&#8217;|&rsquo;|&#039;/g, "'")
    .replace(/&quot;|&#8220;|&#8221;/g, '"').replace(/&#8211;|&#8212;/g, "-");
}
export function htmlToText(h: string): string {
  return decode(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|p|div|li|h\d|tr)[^>]*>/gi, ". ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").replace(/(\.\s*){2,}/g, ". ").trim();
}

/** Main listing block: strip chrome, prefer <main>/<article>/product container, cut at related-listing headings. */
export function mainBlock(html: string): string {
  let h = html.replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
  h = h.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ");
  h = h.replace(/<[^>]+(?:class|id)=["'][^"']*(?:menu|navbar|nav-|breadcrumb|footer|header|sidebar|related|similar|upsell|cross-sell|recent)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|ul|section)>/gi, " ");
  const m = h.match(/<main\b[\s\S]*?<\/main>/i) || h.match(/<article\b[\s\S]*?<\/article>/i);
  if (m) h = m[0];
  const hm = h.match(new RegExp(`<h[1-6][^>]*>[^<]{0,40}${RELATED.source}[\\s\\S]*$`, "i"));
  if (hm && hm.index != null && hm.index > 40) h = h.slice(0, hm.index);
  return htmlToText(h);
}

/** Text the dealer published about this unit: title + JSON-LD Product description + main block. */
export function unitText(html: string): string {
  const parts: string[] = [];
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]; if (t) parts.push(decode(t).split(/\s[|\u2013\u2014]\s/)[0]); // drop "| Site Name" suffix
  for (const m of Array.from(html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi))) {
    try {
      const walk = (x: any): void => { if (Array.isArray(x)) return x.forEach(walk); if (!x || typeof x !== "object") return;
        const ty = [].concat(x["@type"] ?? []).join(" "); if (/Product|Vehicle|Car/i.test(ty)) { if (x.name) parts.push(String(x.name)); if (x.description) parts.push(htmlToText(String(x.description))); }
        if (x["@graph"]) walk(x["@graph"]); };
      walk(JSON.parse(m[1]));
    } catch { /* bad JSON-LD */ }
  }
  parts.push(mainBlock(html));
  return parts.join(" . ");
}

const uniq = <T>(xs: T[]) => Array.from(new Set(xs));
const one = <T>(xs: T[]): T | null => { const u = uniq(xs); return u.length === 1 ? u[0] : null; };

export function extractBattery(t: string): BatteryInfo {
  const chem: Chemistry[] = [];
  if (/\b(lithium|li-?ion|lifepo4|lfp)\b/i.test(t)) chem.push("lithium");
  if (/\bagm\b/i.test(t)) chem.push("agm");
  if (/\blead[- ]?acid\b|\bflooded\b|\b6\s?x\s?8\s?v\b|\b(?:six|6)\s+8[- ]?v(?:olt)?\b/i.test(t)) chem.push("lead_acid");
  // "convert lead-acid to lithium" style copy names both: ambiguous -> null.
  const chemistry = chem.length === 1 ? chem[0] : null;
  const voltage = one(Array.from(t.matchAll(/\b(36|48|51\.2|60|72)\s?-?\s?v(?:olts?)?\b/gi)).map(m => Number(m[1])));
  const ah = one(Array.from(t.matchAll(/\b(\d{2,3})\s?-?\s?ah\b/gi)).map(m => Number(m[1])).filter(n => n >= 30 && n <= 400));
  const kwh = one(Array.from(t.matchAll(/\b(\d{1,2}(?:\.\d{1,2})?)\s?kwh\b/gi)).map(m => Number(m[1])).filter(n => n >= 1 && n <= 40));
  const brands = BRANDS.filter(b => new RegExp(`\\b${b.replace(/ /g, "\\s?")}\\b`, "i").test(t)).map(b => b.replace(/^EcoBattery$/, "Eco Battery"));
  return { chemistry, voltage, ah, kwh, brand: one(brands) };
}

export function warrantyQuotes(t: string, max = 3): string[] {
  const out: string[] = [];
  for (const s of t.split(/(?<=[.!?])\s+/)) {
    const x = s.trim();
    if (/\bwarrant(?:y|ies)\b/i.test(x) && x.length >= 20 && x.length <= 300 && !out.includes(x)) out.push(x);
    if (out.length >= max) break;
  }
  return out;
}

/** Unit-level warranty from the listing's own text. Only clear statements count. */
export function unitWarranty(t: string): UnitWarranty {
  const qs = warrantyQuotes(t, 6);
  const neg = qs.find(q => /\b(no warranty|without (?:a |any )?warranty|sold as[- ]is|as[- ]is,? no warranty|warranty:?\s*(?:none|n\/a))\b/i.test(q));
  const termRe = /\b(\d{1,2})[- ](year|yr|month|mo)s?\b[^.]{0,60}?\bwarrant/i;
  const termRe2 = /\bwarrant(?:y|ies)\b[^.]{0,40}?\b(\d{1,2})[- ](year|yr|month|mo)s?\b/i;
  const pos = qs.filter(q => termRe.test(q) || termRe2.test(q) || /\b(warranty included|includes? (?:a |an )?[^.]{0,30}warranty|comes with (?:a |an )?[^.]{0,30}warranty|under (?:factory )?warranty)\b/i.test(q));
  if (neg && pos.length) return { included: null, months: null, quote: null }; // conflicting
  if (neg) return { included: "no", months: null, quote: neg };
  if (!pos.length) return { included: null, months: null, quote: null };
  const terms = uniq(pos.map(q => { const m = q.match(termRe) || q.match(termRe2); return m ? (/^(year|yr)/i.test(m[2]) ? Number(m[1]) * 12 : Number(m[1])) : null; }).filter((n): n is number => n != null));
  return { included: "yes", months: terms.length ? Math.max(...terms) : null, quote: pos.join(" ").slice(0, 500) };
}

/** Back-compat helper used by the audit. */
export function warrantyTerm(t: string): { years: number | null; scope: "battery" | "drivetrain" | "limited" | null } {
  const m = t.match(/\b(\d{1,2})[- ](?:year|yr)s?\b([^.]{0,40})\bwarrant/i) || t.match(/warrant[^.]{0,40}\b(\d{1,2})[- ](?:year|yr)s?\b/i);
  const ctx = (m?.[0] ?? "").toLowerCase();
  const scope = /batter|lithium/.test(ctx) ? "battery" : /drivetrain|powertrain/.test(ctx) ? "drivetrain" : /limited/.test(ctx) ? "limited" : null;
  return { years: m ? Number(m[1]) : null, scope };
}

export interface ListingAttrs { battery: BatteryInfo; warranty: UnitWarranty }
export function extractListingAttrs(html: string): ListingAttrs {
  const t = unitText(html);
  return { battery: extractBattery(t), warranty: unitWarranty(t) };
}
