/**
 * Auto-publish gate for new listings found by the ingest cron. DRAFT.
 * OFF by default: unless INGEST_AUTOPUBLISH_ENABLED === 'true' every new listing queues in
 * pending_imports exactly as today. When ON, a listing publishes only if ALL four checks pass:
 *   (a) url_is_listing  – the final dealer URL (after redirects, incl. 200 redirects) is the listing
 *                         itself, not the dealer homepage / a category page;
 *   (b) not_sold        – no sold / removed / no-longer-available marker on the page;
 *   (c) sale_price      – our stored price equals the SALE price on the page. Botero-style pages show an
 *                         "Original Price" too; that one is never used for the comparison;
 *   (d) ymm             – year, make and model match.
 * Any failure → queue in pending_imports with the failure reasons logged. Reviewer: Raphael (owner.ts).
 * Pure functions: no network, no DB.
 */
export type Candidate = { url: string; price: number | null; year: number | null; make: string | null; model: string | null };
export type PageFacts = {
  requestedUrl: string;
  finalUrl: string;           // URL after all redirects
  status: number;
  sold: boolean;
  salePrice: number | null;   // SALE price only
  year: number | null; make: string | null; model: string | null;
};
export type CheckId = "url_is_listing" | "not_sold" | "sale_price" | "ymm";
export type GateResult = { pass: boolean; failures: { check: CheckId; reason: string }[] };
export type AutopublishDecision = { action: "publish" | "queue"; reasons: string[] };

export const autopublishEnabled = (env: NodeJS.ProcessEnv) => env.INGEST_AUTOPUBLISH_ENABLED === "true";

const SOLD_RE = /\b(sold(?:\s+out)?|no\s+longer\s+available|listing\s+(?:has\s+been\s+)?removed|pending\s+sale|unavailable)\b/i;
const num = (s: string) => { const n = Number(s.replace(/[$,\s]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const path = (u: string) => { try { return new URL(u).pathname.replace(/\/+$/, "") || "/"; } catch { return ""; } };
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

/** (a) helper: does finalUrl still point at the requested listing (not the homepage / a category)? */
export function urlIsListing(requestedUrl: string, finalUrl: string): { ok: boolean; reason?: string } {
  const fp = path(finalUrl);
  if (host(finalUrl) !== host(requestedUrl)) return { ok: false, reason: `redirected off-site to ${host(finalUrl) || "invalid URL"}` };
  if (fp === "/" || fp === "") return { ok: false, reason: "resolves to dealer homepage" };
  if (fp !== path(requestedUrl)) return { ok: false, reason: `redirected to ${fp}, not the listing` };
  return { ok: true };
}

/**
 * Extract the SALE price from listing HTML/text. Prefers an explicit "Sale Price" (or "Now"/"Our Price")
 * label; ignores amounts labelled Original/Regular/MSRP/Was. Returns null when ambiguous.
 */
export function extractSalePrice(text: string): number | null {
  const t = text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const labelled = t.match(/\b(?:sale\s*price|our\s*price|now)\s*:?\s*\$\s?([\d,]+(?:\.\d{2})?)/i);
  if (labelled) return num(labelled[1]);
  // No sale label: accept a single unlabelled price only if no Original/MSRP/Was label is present.
  if (/\b(original\s*price|regular\s*price|msrp|was)\b\s*:?\s*\$/i.test(t)) return null;
  const all = [...t.matchAll(/\$\s?([\d,]+(?:\.\d{2})?)/g)].map((m) => num(m[1])).filter((n): n is number => n !== null);
  const uniq = [...new Set(all)];
  return uniq.length === 1 ? uniq[0] : null;
}

export const pageShowsSold = (text: string) => SOLD_RE.test(text.replace(/<[^>]+>/g, " "));

export function checkListing(c: Candidate, p: PageFacts): GateResult {
  const failures: GateResult["failures"] = [];
  const u = p.status >= 200 && p.status < 300 ? urlIsListing(p.requestedUrl, p.finalUrl) : { ok: false, reason: `HTTP ${p.status}` };
  if (!u.ok) failures.push({ check: "url_is_listing", reason: u.reason! });
  if (p.sold) failures.push({ check: "not_sold", reason: "page shows sold/removed marker" });
  if (p.salePrice === null) failures.push({ check: "sale_price", reason: "no unambiguous sale price on page" });
  else if (c.price === null || Math.round(c.price * 100) !== Math.round(p.salePrice * 100))
    failures.push({ check: "sale_price", reason: `stored price ${c.price ?? "null"} != page sale price ${p.salePrice}` });
  const ymm: string[] = [];
  if (c.year === null || p.year === null || c.year !== p.year) ymm.push(`year ${c.year ?? "?"}/${p.year ?? "?"}`);
  if (!norm(c.make) || norm(c.make) !== norm(p.make)) ymm.push(`make ${c.make ?? "?"}/${p.make ?? "?"}`);
  if (!norm(c.model) || norm(c.model) !== norm(p.model)) ymm.push(`model ${c.model ?? "?"}/${p.model ?? "?"}`);
  if (ymm.length) failures.push({ check: "ymm", reason: `mismatch: ${ymm.join(", ")}` });
  return { pass: failures.length === 0, failures };
}

export function decideAutopublish(env: NodeJS.ProcessEnv, c: Candidate, p: PageFacts | null): AutopublishDecision {
  if (!autopublishEnabled(env)) return { action: "queue", reasons: ["autopublish disabled (INGEST_AUTOPUBLISH_ENABLED != true)"] };
  if (!p) return { action: "queue", reasons: ["dealer page could not be fetched"] };
  const g = checkListing(c, p);
  return g.pass ? { action: "publish", reasons: [] } : { action: "queue", reasons: g.failures.map((f) => `${f.check}: ${f.reason}`) };
}
