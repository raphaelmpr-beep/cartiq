/**
 * Listing lifecycle + catalog guards (P0 accuracy, 2026-10-16). Pure helpers, no DB.
 *
 * 1. Hide only on POSITIVE evidence (Director condition 1): the listing is missing from the
 *    latest SUCCESSFUL dealer feed, or the dealer page itself shows sold / 404 / 410.
 *    "Unseen for N days" or "stale" is never a reason to hide.
 * 2. Gone-page behavior is configurable; Raphael owns the SEO choice. The DEFAULT "legacy_noindex"
 *    is byte-for-byte today's behavior: client <meta robots noindex> on any non-active/non-public
 *    listing, server `Link: <fallback>; rel="canonical"` header, no banner. "sold_page"
 *    (keep live + indexable + sold banner), "gone_410" and "redirect" are opt-in only.
 * 3. Non-golf-cart items (e-bikes, scooters...) are excluded from public lists, hot deals and deal
 *    ratings. Sitemap exclusion is a separate opt-in (LISTING_SITEMAP_EXCLUDE_NON_CART=true).
 */

export type GoneMode = "legacy_noindex" | "sold_page" | "gone_410" | "redirect";
export const GONE_MODES: readonly GoneMode[] = ["legacy_noindex", "sold_page", "gone_410", "redirect"];
/** Default = today's behavior exactly (zero SEO-visible change). */
export const DEFAULT_GONE_MODE: GoneMode = "legacy_noindex";

/** Parse LISTING_GONE_MODE (server) / VITE_LISTING_GONE_MODE (client). Unknown or unset -> default. */
export function resolveGoneMode(raw: string | null | undefined): GoneMode {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "noindex" || v === "legacy") return "legacy_noindex";
  return (GONE_MODES as readonly string[]).includes(v) ? (v as GoneMode) : DEFAULT_GONE_MODE;
}

type LifecycleLike = { status?: string | null; publicListing?: boolean | null };
/** Client: is this listing active+public (same test the page used before the P0 change)? */
export function isActivePublic(l: LifecycleLike): boolean {
  return String(l.status ?? "active") === "active" && l.publicListing !== false;
}
/** Client meta robots: legacy = noindex for every non-active/non-public listing (pre-P0 rule). */
export function clientNoindex(l: LifecycleLike, mode: GoneMode): boolean {
  if (isActivePublic(l)) return false;
  return mode !== "sold_page";
}
/** Client: show the sold banner + similar carts only in the opt-in sold_page mode. */
export function showSoldBanner(l: LifecycleLike, mode: GoneMode): boolean {
  return !isActivePublic(l) && mode === "sold_page";
}

export type GoneResponse =
  | { action: "next"; headers: Record<string, string> }
  | { action: "redirect"; location: string; headers: Record<string, string> }
  | { action: "gone_410"; fallback: string | null; headers: Record<string, string> };
/** Server response plan for a non-active/non-public listing page. legacy_noindex == pre-P0 headers. */
export function goneResponse(status: string | null | undefined, fallback: string | null, mode: GoneMode): GoneResponse {
  const headers: Record<string, string> = {};
  if (mode === "legacy_noindex" && fallback) headers["Link"] = `<${fallback}>; rel="canonical"`;
  headers["X-Listing-Lifecycle"] = String(status ?? "inactive");
  if (mode === "redirect" && fallback) return { action: "redirect", location: fallback, headers };
  if (mode === "gone_410") return { action: "gone_410", fallback, headers };
  return { action: "next", headers };
}

/** LISTING_SITEMAP_EXCLUDE_NON_CART: opt-in; default off so sitemap output is unchanged. */
export function sitemapExcludesNonCart(raw: string | null | undefined): boolean {
  return String(raw ?? "").trim().toLowerCase() === "true";
}

export type HideEvidence =
  | { kind: "dealer_page"; status: "sold" | "http_404" | "http_410" | "redirect_to_index"; confirmations: number }
  | { kind: "feed"; feedRunSucceeded: boolean; presentInFeed: boolean; feedComplete: boolean }
  | { kind: "unseen"; days: number }
  | { kind: "stale"; days: number };

/** Confirmations of a dealer-page dead signal needed before hiding (matches recheck DEAD_CONFIRMATIONS). */
export const DEALER_PAGE_CONFIRMATIONS = 2;

/** True only on positive evidence. Unseen/stale never hides; a partial or failed feed never hides. */
export function shouldHide(e: HideEvidence): boolean {
  switch (e.kind) {
    case "dealer_page": return e.confirmations >= DEALER_PAGE_CONFIRMATIONS;
    case "feed": return e.feedRunSucceeded && e.feedComplete && !e.presentInFeed;
    default: return false;
  }
}

const NON_CART_RE = /\b(e-?bikes?|bicycles?|bikes?|scooters?|step[\s-]?thru|step[\s-]?through|fat[\s-]?tire\s+\d?\s*(step|bike)|mopeds?|unicycles?|skateboards?|kids?\s+(atv|quad)|dirt\s*bikes?)\b/i;
/** Brand+model lines known to be bicycles (no "bike" in the title), e.g. Denago EV Commute/Cruiser. */
const NON_CART_MODEL_RE = /^denago\s*ev?\s*$/i;
const NON_CART_DENAGO_MODELS = /\b(commute|cruiser|city|fat\s*tire)\b/i;

/** False for e-bikes and other non-golf-cart items that must not appear as listings or get deal ratings. */
export function isGolfCartListing(l: { title?: string | null; brand?: string | null; model?: string | null }): boolean {
  const text = [l.title, l.model].filter(Boolean).join(" ");
  if (NON_CART_RE.test(text)) return false;
  if (l.brand && NON_CART_MODEL_RE.test(l.brand.trim()) && NON_CART_DENAGO_MODELS.test(String(l.model ?? l.title ?? ""))) return false;
  return true;
}

// ─── Gone-listing UI guards (Inspector AC, PR #49). User-visible only; apply in EVERY gone mode. ───
type LiveLike = LifecycleLike & { public_listing?: boolean | null; id?: number | string | null; title?: string | null; brand?: string | null; model?: string | null; seats?: number | null; state?: string | null; city?: string | null };
/** Active+public, accepting camelCase (client) or snake_case (server rows). */
export function isLiveListing(l: LiveLike): boolean {
  const pub = l.publicListing ?? l.public_listing;
  return String(l.status ?? "active") === "active" && pub !== false;
}
/** Deal badge, "Great/Good Deal", "$X Below Market", GolfCartIQ Value: live listings only, any mode. */
export function showDealClaims(l: LiveLike): boolean { return isLiveListing(l); }
/** Contact/Call/Quote/email/unit-page lead actions: live listings only, any mode. */
export function showLeadActions(l: LiveLike): boolean { return isLiveListing(l); }
/** Public lists (search, hot deals, similar): live golf carts only. */
export function filterLivePublic<T extends LiveLike>(rows: T[]): T[] {
  return rows.filter(r => isLiveListing(r) && isGolfCartListing(r));
}
/** Similar carts for a listing: live, non-self, golf carts; same brand/seats and same state ranked first. */
export function similarCarts<T extends LiveLike>(current: LiveLike, pool: T[], max = 6): T[] {
  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
  const score = (r: T) =>
    (norm(r.brand) && norm(r.brand) === norm(current.brand) ? 2 : 0) +
    (r.seats != null && r.seats === current.seats ? 1 : 0) +
    (norm(r.state) && norm(r.state) === norm(current.state) ? 2 : 0);
  return filterLivePublic(pool)
    .filter(r => r.id == null || String(r.id) !== String(current.id))
    .map((r, i) => ({ r, i, s: score(r) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, max)
    .map(x => x.r);
}
/** AC4: fewer than 3 matches -> show a city/brand link instead of the block. */
export const SIMILAR_MIN = 3;
