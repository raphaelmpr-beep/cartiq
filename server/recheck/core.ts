/**
 * Listing re-check: pure helpers (no DB). Used by the cron runner and tests.
 */

export const RECHECK_UA = "GolfCartIQ-Bot/1.0 (+https://golfcartiq.com/bot)";
/** Consecutive "dead" results required before a listing is archived. */
export const DEAD_CONFIRMATIONS = 2;
/** Minimum delay between two requests to the same host. */
export const PER_HOST_INTERVAL_MS = 3000;
/**
 * Dealers that must NEVER be auto-archived by the re-check. Their liveness is still checked and
 * logged, but dead results are recorded as "needs_review" for a human to decide.
 * Botero (all locations): their old listing URLs redirect to the homepage; needs manual review.
 */
export const NO_AUTO_ARCHIVE_SLUG_PREFIXES = ["botero"];
export const NO_AUTO_ARCHIVE_HOSTS = [/(^|\.)boterocarts\.com$/i];
export function isAutoArchiveExcluded(slug: string | null | undefined, url?: string | null): boolean {
  const s = String(slug ?? "").toLowerCase();
  if (NO_AUTO_ARCHIVE_SLUG_PREFIXES.some(p => s === p || s.startsWith(p + "-"))) return true;
  if (url) { try { const h = new URL(url).host; if (NO_AUTO_ARCHIVE_HOSTS.some(r => r.test(h))) return true; } catch {} }
  return false;
}

export type CheckStatus = "alive" | "dead" | "error" | "blocked_robots" | "skipped";
export interface CheckResult {
  status: CheckStatus;
  reason: string;
  httpStatus?: number;
  finalUrl?: string;
  price?: number | null;
}

// ── robots.txt ────────────────────────────────────────────────────────────────
/** Returns disallowed path prefixes that apply to our bot (its own group, else "*"). */
export function parseRobots(txt: string, agent = "golfcartiq-bot"): string[] {
  const groups: { agents: string[]; dis: string[]; allow: string[] }[] = [];
  let cur: { agents: string[]; dis: string[]; allow: string[] } | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], dis: [], allow: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!cur) continue;
      if (key === "disallow" && val) cur.dis.push(val);
      if (key === "allow" && val) cur.allow.push(val);
    }
  }
  const mine = groups.find(g => g.agents.some(a => a !== "*" && agent.includes(a)));
  const star = groups.find(g => g.agents.includes("*"));
  return (mine ?? star)?.dis ?? [];
}

export function robotsAllows(disallow: string[], path: string): boolean {
  return !disallow.some(d => {
    if (d === "/") return true;
    const re = new RegExp("^" + d.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    return re.test(path);
  });
}

// ── Dead detection ────────────────────────────────────────────────────────────
/** True when a listing URL redirected to the dealer's homepage or an inventory index. */
export function isRootOrIndexRedirect(originalUrl: string, finalUrl: string): boolean {
  let o: URL, f: URL;
  try { o = new URL(originalUrl); f = new URL(finalUrl); } catch { return false; }
  const norm = (p: string) => p.replace(/\/+$/, "") || "/";
  if (norm(o.pathname) === norm(f.pathname) && o.host.replace(/^www\./, "") === f.host.replace(/^www\./, "")) return false;
  const fp = norm(f.pathname).toLowerCase();
  if (fp === "/") return true;
  // Inventory index pages: short paths that look like a listing index, not a unit.
  const segs = fp.split("/").filter(Boolean);
  const indexy = /^(inventory|golf-carts?|carts|listings?|shop|new-inventory|used-inventory|pre-owned|showroom|golf-carts-for-sale.*)$/;
  return segs.length <= 2 && segs.some(s => indexy.test(s)) && !/\d{3,}/.test(fp);
}

const SOLD_PATTERNS = [
  /\bthis (unit|cart|vehicle|item|listing) (has been|is|was) sold\b/i,
  /\bthis (listing|unit|item|vehicle) is no longer available\b/i,
  /\bsale pending\b/i,
  /<[^>]+class="[^"]*\b(sold-badge|status-sold|listing-sold|badge-sold)\b/i,
  /"availability"\s*:\s*"(https?:\/\/schema\.org\/)?(SoldOut|Discontinued)"/i,
];
/** Strong "sold"/"unavailable" markers only — a bare word "sold" is ignored (nav menus, "Sold Units" pages). */
export function soldMarker(html: string): string | null {
  const head = html.slice(0, 400_000);
  for (const re of SOLD_PATTERNS) { const m = head.match(re); if (m) return m[0].slice(0, 80); }
  return null;
}

export function classifyResponse(originalUrl: string, httpStatus: number, finalUrl: string, html: string): CheckResult {
  if (httpStatus === 404 || httpStatus === 410) return { status: "dead", reason: `http_${httpStatus}`, httpStatus, finalUrl };
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 429) return { status: "error", reason: `blocked_http_${httpStatus}`, httpStatus, finalUrl };
  if (httpStatus >= 500 || httpStatus === 0) return { status: "error", reason: `http_${httpStatus}`, httpStatus, finalUrl };
  if (httpStatus >= 400) return { status: "error", reason: `http_${httpStatus}`, httpStatus, finalUrl };
  if (isRootOrIndexRedirect(originalUrl, finalUrl)) return { status: "dead", reason: "redirect_to_index", httpStatus, finalUrl };
  const sold = soldMarker(html);
  if (sold) return { status: "dead", reason: `sold_marker:${sold}`, httpStatus, finalUrl };
  return { status: "alive", reason: "ok", httpStatus, finalUrl };
}

/** Decide the DB transition for one listing given its current fail count. */
export function nextState(prevFails: number, r: CheckResult): { failCount: number; archive: boolean; touchLastChecked: boolean } {
  if (r.status === "alive") return { failCount: 0, archive: false, touchLastChecked: true };
  if (r.status === "dead") {
    const n = prevFails + 1;
    return { failCount: n, archive: n >= DEAD_CONFIRMATIONS, touchLastChecked: false };
  }
  // error / robots / skipped: neither confirms nor clears. Not re-verified, so last_checked_at stays.
  return { failCount: prevFails, archive: false, touchLastChecked: false };
}

// ── Data-quality metrics (pure) ───────────────────────────────────────────────
export interface DQListing {
  id: number; sync_source: string | null; status: string; public_listing: boolean;
  asking_price: number | null; sale_price: number | null; regular_price: number | null;
  brand: string | null; model: string | null; year: number | null; condition: string | null; seating: number | null;
  last_checked_at: string | null; source_listing_url: string | null; recheck_fail_count?: number | null;
  price_confidence?: string | null; cartiq_estimated_value?: number | null; valuation_confidence?: string | null;
}
export const listingPrice = (l: DQListing) => l.sale_price ?? l.asking_price ?? l.regular_price ?? null;

function median(a: number[]) { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

/** Outlier ids: price < 40% or > 250% of the comparable-group median (groups n>=5). */
export function outlierIds(rows: DQListing[]): Set<number> {
  const g = new Map<string, DQListing[]>();
  for (const l of rows) {
    const p = listingPrice(l); if (!p) continue;
    const seat = l.seating == null ? "?" : l.seating <= 2 ? "2" : l.seating <= 4 ? "4" : "6";
    const k = [(l.brand || "").toLowerCase(), (l.model || "").toLowerCase(), l.condition || "?", seat,
      l.year ? Math.floor(l.year / 2) : "?"].join("|");
    (g.get(k) ?? g.set(k, []).get(k)!).push(l);
  }
  const out = new Set<number>();
  for (const v of Array.from(g.values())) {
    if (v.length < 5) continue;
    const m = median(v.map(x => listingPrice(x)!));
    for (const x of v as DQListing[]) { const r = listingPrice(x)! / m; if (r < 0.4 || r > 2.5) out.add(x.id); }
  }
  return out;
}

export interface DQCounts { active: number; stale_7d: number; stale_30d: number; never_checked: number; dead_pending: number;
  missing_price: number; outliers: number; duplicates: number; }

export function computeQuality(rows: DQListing[], now = Date.now()) {
  const active = rows.filter(l => l.status === "active" && l.public_listing);
  const outs = outlierIds(active);
  const urlCount = new Map<string, number>();
  for (const l of active) if (l.source_listing_url) urlCount.set(l.source_listing_url, (urlCount.get(l.source_listing_url) ?? 0) + 1);
  const empty = (): DQCounts => ({ active: 0, stale_7d: 0, stale_30d: 0, never_checked: 0, dead_pending: 0, missing_price: 0, outliers: 0, duplicates: 0 });
  const totals = empty(); const by = new Map<string, DQCounts>();
  for (const l of active) {
    const d = by.get(l.sync_source ?? "(none)") ?? by.set(l.sync_source ?? "(none)", empty()).get(l.sync_source ?? "(none)")!;
    const age = l.last_checked_at ? (now - Date.parse(l.last_checked_at)) / 86400000 : Infinity;
    const inc = (k: keyof DQCounts) => { totals[k]++; d[k]++; };
    inc("active");
    if (age > 7) inc("stale_7d");
    if (age > 30) inc("stale_30d");
    if (!l.last_checked_at) inc("never_checked");
    if ((l.recheck_fail_count ?? 0) > 0) inc("dead_pending");
    if (!listingPrice(l)) inc("missing_price");
    if (outs.has(l.id)) inc("outliers");
    if (l.source_listing_url && (urlCount.get(l.source_listing_url) ?? 0) > 1) inc("duplicates");
  }
  return { totals, by_dealer: Array.from(by.entries()).map(([dealer, c]) => ({ dealer, ...c })) };
}

export type Health = "Fresh" | "Stale" | "Failing";
export function dealerHealth(c: { active: number; stale_7d: number; dead_pending: number }, lastError?: string | null): Health {
  if (lastError || (c.active > 0 && c.dead_pending / c.active > 0.10)) return "Failing";
  if (c.active > 0 && c.stale_7d / c.active > 0.20) return "Stale";
  return "Fresh";
}
