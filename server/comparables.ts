import type { CompInput, ComparableCart } from "../shared/growth";

const normalize = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function sourceIdentity(value: unknown): string | null {
  try {
    const u = new URL(String(value));
    if (!["https:", "http:"].includes(u.protocol) || /\/(blog|articles?|parts|service|accessories)(\/|$)/i.test(u.pathname)) return null;
    if (u.pathname === "/") return null;
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "") + u.search;
  } catch { return null; }
}

// Verification is an explicit review record, never inferred from last_seen,
// price_confidence, an ingestion timestamp, or a generic dealer warranty.
export function selectComparables(input: CompInput, candidates: any[], now = Date.now()): ComparableCart[] {
  if (input.condition === "Poor") return [];
  const seen = new Set<string>();
  return candidates.filter(row => {
    const l = row.listing, v = row;
    const checked = Date.parse(v.checked_at);
    return l && l.status === "active" && l.public_listing === true &&
      l.dealer_id === v.dealer_id && l.dealer_id && l.dealer &&
      (!l.sync_source || l.sync_source === l.dealer.slug) &&
      v.valid_vehicle === true && v.branch_verified === true && v.in_stock === true &&
      Number.isFinite(checked) && checked <= now && now - checked <= 7 * 86400000 &&
      sourceIdentity(v.source_url) && sourceIdentity(v.source_url) === sourceIdentity(l.source_listing_url || l.source_url) &&
      Number(v.source_price) === Number(l.asking_price) && Number(l.asking_price) >= 500 && Number(l.asking_price) <= 100000 &&
      /^https?:\/\//.test(l.image_url || "") && l.slug &&
      !/sold|order|unavailable|reserved/i.test(l.availability_status || "") &&
      normalize(l.brand) === normalize(input.brand) &&
      normalize(l.model) === normalize(input.model) &&
      Number.isInteger(l.year) && Math.abs(l.year - input.year) <= 2 &&
      normalize(l.power_type) === normalize(input.power) &&
      Number(l.seating) === input.seating &&
      (!input.state || l.state === input.state) &&
      ["FL", "GA"].includes(l.state) &&
      ["used", "refurbished"].includes(normalize(l.condition)) &&
      (input.power !== "Electric" || (!!input.batteryType && normalize(l.battery_type) === normalize(input.batteryType)));
  }).sort((a,b) => Math.abs(a.listing.year-input.year)-Math.abs(b.listing.year-input.year) ||
    Date.parse(b.checked_at)-Date.parse(a.checked_at) || a.listing.id-b.listing.id)
    .filter(row => {
      const key = sourceIdentity(row.source_url)!;
      const stock = row.listing.vin ? `vin:${normalize(row.listing.vin)}` : key;
      if (seen.has(key) || seen.has(stock)) return false;
      seen.add(key); seen.add(stock); return true;
    }).slice(0,6).map(row => ({
      id: row.listing.id, slug: row.listing.slug, title: row.listing.title,
      askingPrice: Number(row.source_price), imageUrl: row.listing.image_url,
      dealer: row.listing.dealer.name, city: row.listing.city, state: row.listing.state,
      year: row.listing.year, condition: row.listing.condition,
      checkedAt: row.checked_at, sourceUrl: row.source_url,
      reasons: ["Same brand and model", `${input.seating} seats · ${input.power}`,
        row.listing.year === input.year ? "Same model year" : `${Math.abs(row.listing.year-input.year)} model years apart`,
        "Used/refurbished; cosmetic condition not matched"],
    }));
}
