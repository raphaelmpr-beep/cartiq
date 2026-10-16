// Battery + warranty attribute extraction from listing-page text (not yet wired; see
// supabase/migrations/20261016c_listing_battery_warranty_fields.sql). Returns only what
// the page states — never infers. Quotes are verbatim sentences for provenance.
export interface BatteryInfo { type: "lithium" | "lead_acid" | "agm" | "gas" | null; voltage: number | null; ah: number | null; kwh: number | null; brand: string | null }
const BRANDS = ["RoyPow", "Eco Battery", "Allied", "Trojan", "Dragonfly", "Navitas", "Relion", "Epoch", "Elite Power", "Samsung", "CATL", "EVE", "US Battery", "Crown", "Lithionics", "Fusion"];
export function htmlToText(h: string): string {
  return h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
export function extractBattery(t: string): BatteryInfo {
  const type = /\b(lithium|li-?ion|lifepo4)\b/i.test(t) ? "lithium" : /\bagm\b/i.test(t) ? "agm"
    : /lead[- ]?acid|flooded|\b6\s?x\s?8\s?v\b/i.test(t) ? "lead_acid" : /\b(gasoline|gas powered|efi)\b/i.test(t) ? "gas" : null;
  const v = t.match(/\b(36|48|51\.2|60|72)\s?-?\s?v(?:olt)?s?\b/i)?.[1];
  const ah = t.match(/\b(\d{2,3})\s?-?\s?ah\b/i)?.[1];
  const kwh = t.match(/\b(\d{1,2}(?:\.\d{1,2})?)\s?kwh\b/i)?.[1];
  const brand = BRANDS.find(b => new RegExp(`\\b${b.replace(/ /g, "\\s?")}\\b`, "i").test(t)) ?? null;
  const ahN = ah ? Number(ah) : null;
  return { type, voltage: v ? Number(v) : null, ah: ahN && ahN >= 30 && ahN <= 400 ? ahN : null, kwh: kwh ? Number(kwh) : null, brand };
}
export function warrantyQuotes(t: string, max = 3): string[] {
  const out: string[] = [];
  for (const m of t.matchAll(/[^.!?]{0,220}\bwarrant(?:y|ies)\b[^.!?]{0,220}[.!?]/gi)) {
    const s = m[0].trim(); if (s.length > 25 && !out.includes(s)) out.push(s); if (out.length >= max) break;
  }
  return out;
}
export function warrantyTerm(t: string): { years: number | null; scope: "battery" | "drivetrain" | "limited" | null } {
  const m = t.match(/\b(\d{1,2})[- ](?:year|yr)s?\b([^.]{0,40})\bwarrant/i) || t.match(/warrant[^.]{0,40}\b(\d{1,2})[- ](?:year|yr)s?\b/i);
  const ctx = (m?.[0] ?? "").toLowerCase();
  const scope = /batter|lithium/.test(ctx) ? "battery" : /drivetrain|powertrain/.test(ctx) ? "drivetrain" : /limited/.test(ctx) ? "limited" : null;
  return { years: m ? Number(m[1]) : null, scope };
}
