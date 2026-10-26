import type { Listing } from "@shared/schema";

const UUID_RE = /-?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MULTI_TOKEN_BRANDS = ["E-Z-GO", "Club-Car", "Star-EV", "Alset-EV", "Venom-EV", "Denago-EV", "Advanced-EV"];

/** True when a title looks like a scraper ID / URL slug rather than human text. */
export function isScraperSlugTitle(title: string): boolean {
  const t = String(title ?? "").trim();
  return t.length > 0 && !/\s/.test(t) && t.includes("-") && (UUID_RE.test(t) || t.split("-").length >= 4);
}

/** Parse "Golf-Carts-E-Z-GO-RXV-2019-Douglas-GA-<uuid>" → { year, brandModel }. */
export function parseScraperSlugTitle(title: string, city?: string | null, state?: string | null): { year?: string; brandModel: string } | null {
  if (!isScraperSlugTitle(title)) return null;
  let t = String(title).trim().replace(UUID_RE, "").replace(/^golf-carts?-/i, "");
  if (city && state) {
    const tail = `-${String(city).trim().replace(/\s+/g, "-")}-${state}`;
    if (t.toLowerCase().endsWith(tail.toLowerCase())) t = t.slice(0, -tail.length);
  }
  let year: string | undefined;
  t = t.replace(/(^|-)((?:19|20)\d{2})(?=-|$)/, (_m, pre) => { year = _m.replace(/^-/, ""); return pre ? "" : ""; });
  t = t.replace(/^-+|-+$/g, "").replace(/--+/g, "-");
  const keep: string[] = [];
  for (const b of MULTI_TOKEN_BRANDS) {
    if (t.toLowerCase().startsWith(b.toLowerCase())) { keep.push(b.replace(/-(?!Z-|GO)/g, " ")); t = t.slice(b.length).replace(/^-/, ""); break; }
  }
  const brandModel = [...keep, ...t.split("-").filter(Boolean)].join(" ").trim();
  if (!brandModel && !year) return null;
  return { year, brandModel: brandModel || "Golf Cart" };
}

/** Human headline core: year/brand/model, else cleaned scraper title, else title, else "Golf Cart". */
export function listingHeadlineCore(l: Pick<Listing, "year" | "brand" | "model" | "title" | "city" | "state">): string {
  const ybm = [l.year, l.brand, l.model].filter(Boolean).join(" ").trim();
  if (ybm) return ybm;
  const raw = String(l.title ?? "").trim();
  const parsed = parseScraperSlugTitle(raw, l.city as any, l.state as any);
  if (parsed) return [parsed.year, parsed.brandModel].filter(Boolean).join(" ");
  return raw || "Golf Cart";
}
