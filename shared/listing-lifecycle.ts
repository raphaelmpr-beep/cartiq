/**
 * Listing lifecycle + catalog guards (P0 accuracy, 2026-10-16). Pure helpers, no DB.
 *
 * 1. Hide only on POSITIVE evidence (Director condition 1): the listing is missing from the
 *    latest SUCCESSFUL dealer feed, or the dealer page itself shows sold / 404 / 410.
 *    "Unseen for N days" or "stale" is never a reason to hide.
 * 2. Gone-page behavior is configurable (Director condition 2; SRE/Raphael own the choice):
 *    default "sold_page" keeps the URL live (HTTP 200, indexable, marked sold/unavailable, similar
 *    carts listed). "noindex", "gone_410" and "redirect" are opt-in only.
 * 3. Non-golf-cart items (e-bikes, scooters...) are excluded from public listings and deal ratings.
 */

export type GoneMode = "sold_page" | "noindex" | "gone_410" | "redirect";
export const GONE_MODES: readonly GoneMode[] = ["sold_page", "noindex", "gone_410", "redirect"];
export const DEFAULT_GONE_MODE: GoneMode = "sold_page";

/** Parse LISTING_GONE_MODE (server) / VITE_LISTING_GONE_MODE (client). Unknown or unset -> default. */
export function resolveGoneMode(raw: string | null | undefined): GoneMode {
  const v = String(raw ?? "").trim().toLowerCase();
  return (GONE_MODES as readonly string[]).includes(v) ? (v as GoneMode) : DEFAULT_GONE_MODE;
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
