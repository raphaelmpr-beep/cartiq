/**
 * GolfCartIQ — shared polite fetch (the ONLY way sync/re-check code should hit dealer sites).
 *
 * Compliance rules (not configurable):
 *   - One honest, stable User-Agent with a contact URL. No browser impersonation, no UA rotation,
 *     no forged Referer, no stealth/fingerprint plugins, no proxies, no CAPTCHA/JS-challenge solving.
 *   - robots.txt is checked per origin (Disallow honored; Crawl-delay honored).
 *   - Per-host spacing = max(robots Crawl-delay, MIN_HOST_INTERVAL_MS).
 *   - 429/503 + Retry-After pauses the host for that long (min 1h); 401/402/403 or a challenge page
 *     marks the host blocked. Callers must stop hitting a blocked host and log it (dealer_block_log).
 *   - Circuit breaker: CIRCUIT_ERRORS consecutive network/5xx errors open the host for the process.
 */

export const BOT_UA = "GolfCartIQ-Bot/1.0 (+https://golfcartiq.com/bot)";
export const MIN_HOST_INTERVAL_MS = 10_000;
/** Hosts whose Crawl-delay is above this are "policy-limited": page-level checks are skipped. */
export const MAX_PAGE_CRAWL_DELAY_S = 60;
export const CIRCUIT_ERRORS = 3;

export type BlockKind = "http_401" | "http_402" | "http_403" | "http_429" | "http_503" | "challenge" | "robots_disallow" | "policy_crawl_delay" | "circuit_open";

export interface RobotsPolicy { disallow: string[]; allow: string[]; crawlDelaySec: number | null; fetched: boolean; unreachable?: boolean }

/** Honest request headers. `kind` only changes Accept. */
export function botHeaders(kind: "html" | "xml" | "json" | "any" = "html", extra?: Record<string, string>): Record<string, string> {
  const accept = kind === "xml" ? "application/xml,text/xml;q=0.9,*/*;q=0.5"
    : kind === "json" ? "application/json,*/*;q=0.5"
    : kind === "html" ? "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8" : "*/*";
  return { "User-Agent": BOT_UA, Accept: accept, ...(extra || {}) };
}

/** Parse robots.txt for our bot (own group, else "*"): Disallow, Allow, Crawl-delay. */
export function parseRobotsPolicy(txt: string, agent = "golfcartiq-bot"): RobotsPolicy {
  type G = { agents: string[]; dis: string[]; allow: string[]; delay: number | null };
  const groups: G[] = []; let cur: G | null = null; let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], dis: [], allow: [], delay: null }; groups.push(cur); }
      cur.agents.push(val.toLowerCase()); lastWasAgent = true;
    } else {
      lastWasAgent = false; if (!cur) continue;
      if (key === "disallow" && val) cur.dis.push(val);
      if (key === "allow" && val) cur.allow.push(val);
      if (key === "crawl-delay") { const n = parseFloat(val); if (isFinite(n) && n >= 0) cur.delay = n; }
    }
  }
  const mine = groups.find(g => g.agents.some(a => a !== "*" && agent.includes(a)));
  const star = groups.find(g => g.agents.includes("*"));
  const g = mine ?? star;
  return { disallow: g?.dis ?? [], allow: g?.allow ?? [], crawlDelaySec: g?.delay ?? null, fetched: true };
}

function ruleRe(d: string) { return new RegExp("^" + d.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")); }
/** Longest-match wins between Allow and Disallow (Google semantics). */
export function robotsPolicyAllows(p: RobotsPolicy, path: string): boolean {
  let best = -1, allowed = true;
  for (const d of p.disallow) if (ruleRe(d).test(path) && d.length > best) { best = d.length; allowed = false; }
  for (const a of p.allow) if (ruleRe(a).test(path) && a.length >= best) { best = a.length; allowed = true; }
  return allowed;
}

/** Host spacing in ms for a policy. */
export function hostIntervalMs(p: RobotsPolicy | null | undefined): number {
  return Math.max(MIN_HOST_INTERVAL_MS, Math.round((p?.crawlDelaySec ?? 0) * 1000));
}

/** Retry-After header → ms (seconds or HTTP date). Minimum 1h when absent/garbage. */
export function retryAfterMs(h: string | null | undefined, now = Date.now()): number {
  const MIN = 3_600_000;
  if (!h) return MIN;
  const s = Number(h); if (isFinite(s)) return Math.max(MIN, s * 1000);
  const t = Date.parse(h); return isFinite(t) ? Math.max(MIN, t - now) : MIN;
}

const CHALLENGE_RE = /sgcaptcha|cf-chl-|challenge-platform\/h\/|<title>\s*(Just a moment|Attention Required)|cf_chl_opt|px-captcha|datadome|_Incapsula_Resource/i;
/** Classify a response as a block (or null). Body is optional (first ~50KB is plenty). */
export function detectBlock(status: number, body = ""): BlockKind | null {
  if (status === 401) return "http_401";
  if (status === 402) return "http_402";
  if (status === 429) return "http_429";
  if (status === 403) return CHALLENGE_RE.test(body) ? "challenge" : "http_403";
  if (status === 503 && CHALLENGE_RE.test(body)) return "challenge";
  if (status === 503) return "http_503";
  if (status === 202 && CHALLENGE_RE.test(body)) return "challenge";
  if (status === 200 && /sgcaptcha|<title>\s*Just a moment/i.test(body.slice(0, 20000))) return "challenge";
  return null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface PoliteResult {
  ok: boolean; status: number; finalUrl: string; body: string;
  headers?: Headers; block?: BlockKind; retryAfterMs?: number; error?: string; notModified?: boolean;
}

interface HostState { policy?: Promise<RobotsPolicy>; nextAt: number; errors: number; blocked?: BlockKind; pausedUntil?: number }

/**
 * Per-process polite fetcher. Create one per run; reuse across URLs.
 * `fetchImpl` / `sleepImpl` / `now` are injectable for tests.
 */
export class PoliteFetcher {
  private hosts = new Map<string, HostState>();
  constructor(private opts: { fetchImpl?: typeof fetch; sleepImpl?: (ms: number) => Promise<void>; now?: () => number; minIntervalMs?: number } = {}) {}
  private get f() { return this.opts.fetchImpl ?? fetch; }
  private now() { return (this.opts.now ?? Date.now)(); }
  private st(host: string): HostState { let s = this.hosts.get(host); if (!s) { s = { nextAt: 0, errors: 0 }; this.hosts.set(host, s); } return s; }

  async robots(origin: string): Promise<RobotsPolicy> {
    const s = this.st(new URL(origin).host);
    if (!s.policy) s.policy = (async () => {
      try {
        const r = await this.f(origin + "/robots.txt", { headers: botHeaders("any"), redirect: "follow", signal: AbortSignal.timeout(8000) });
        if (r.status === 404 || r.status === 410) return { disallow: [], allow: [], crawlDelaySec: null, fetched: false };
        const txt = await r.text();
        const blk = detectBlock(r.status, txt.slice(0, 50000));
        if (blk) { s.blocked = blk; return { disallow: ["/"], allow: [], crawlDelaySec: null, fetched: false, unreachable: true }; }
        if (!r.ok) return { disallow: ["/"], allow: [], crawlDelaySec: null, fetched: false, unreachable: true };
        return parseRobotsPolicy(txt.slice(0, 500_000));
      } catch { return { disallow: ["/"], allow: [], crawlDelaySec: null, fetched: false, unreachable: true }; }
    })();
    return s.policy;
  }

  /** Earliest time the next request to `host` may start. */
  nextAllowedAt(host: string): number { return this.hosts.get(host)?.nextAt ?? 0; }

  hostBlock(host: string): BlockKind | null {
    const s = this.hosts.get(host); if (!s) return null;
    if (s.blocked) return s.blocked;
    if (s.pausedUntil && s.pausedUntil > this.now()) return "http_429";
    if (s.errors >= CIRCUIT_ERRORS) return "circuit_open";
    return null;
  }

  /** Fetch one URL politely. Never throws. */
  async get(url: string, o: { kind?: "html" | "xml" | "json" | "any"; timeoutMs?: number; maxBytes?: number; etag?: string; lastModified?: string; allowSlowPolicy?: boolean } = {}): Promise<PoliteResult> {
    let u: URL; try { u = new URL(url); } catch { return { ok: false, status: 0, finalUrl: url, body: "", error: "invalid_url" }; }
    const s = this.st(u.host);
    const pre = this.hostBlock(u.host);
    if (pre) return { ok: false, status: 0, finalUrl: url, body: "", block: pre };
    const policy = await this.robots(u.origin);
    if (s.blocked) return { ok: false, status: 0, finalUrl: url, body: "", block: s.blocked };
    if (policy.unreachable) { s.errors++; return { ok: false, status: 0, finalUrl: url, body: "", error: "robots_unreachable" }; }
    if (!robotsPolicyAllows(policy, u.pathname + u.search)) return { ok: false, status: 0, finalUrl: url, body: "", block: "robots_disallow" };
    if (!o.allowSlowPolicy && (policy.crawlDelaySec ?? 0) > MAX_PAGE_CRAWL_DELAY_S) return { ok: false, status: 0, finalUrl: url, body: "", block: "policy_crawl_delay" };

    const gap = Math.max(this.opts.minIntervalMs ?? MIN_HOST_INTERVAL_MS, Math.round((policy.crawlDelaySec ?? 0) * 1000));
    const wait = s.nextAt - this.now(); if (wait > 0) await (this.opts.sleepImpl ?? sleep)(wait);
    s.nextAt = this.now() + gap;

    const extra: Record<string, string> = {};
    if (o.etag) extra["If-None-Match"] = o.etag;
    if (o.lastModified) extra["If-Modified-Since"] = o.lastModified;
    try {
      const r = await this.f(url, { headers: botHeaders(o.kind ?? "html", extra), redirect: "follow", signal: AbortSignal.timeout(o.timeoutMs ?? 15000) });
      if (r.status === 304) { s.errors = 0; return { ok: true, status: 304, finalUrl: r.url || url, body: "", headers: r.headers, notModified: true }; }
      const body = (await r.text()).slice(0, o.maxBytes ?? 1_500_000);
      const blk = detectBlock(r.status, body.slice(0, 50000));
      if (blk === "http_429" || blk === "http_503") {
        const ra = retryAfterMs(r.headers?.get?.("retry-after"), this.now());
        s.pausedUntil = this.now() + ra;
        return { ok: false, status: r.status, finalUrl: r.url || url, body: "", headers: r.headers, block: blk, retryAfterMs: ra };
      }
      if (blk) { s.blocked = blk; return { ok: false, status: r.status, finalUrl: r.url || url, body: "", headers: r.headers, block: blk }; }
      if (r.status >= 500) s.errors++; else s.errors = 0;
      return { ok: r.ok, status: r.status, finalUrl: r.url || url, body: r.ok ? body : "", headers: r.headers };
    } catch (e: any) {
      s.errors++;
      return { ok: false, status: 0, finalUrl: url, body: "", error: `fetch_error:${String(e?.name || e).slice(0, 40)}` };
    }
  }
}

/** Convenience one-shot (shared default fetcher per process). */
let _default: PoliteFetcher | null = null;
export function politeFetch(url: string, o?: Parameters<PoliteFetcher["get"]>[1]): Promise<PoliteResult> {
  if (!_default) _default = new PoliteFetcher();
  return _default.get(url, o);
}
