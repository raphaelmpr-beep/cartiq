// GCQ lead tracking (DRAFT) — pure, side-effect-free helpers shared by client,
// server and tests. Gated by LEAD_TRACKING_ENABLED (default OFF).

export const LEAD_EVENT_TYPES = ["listing_view", "contact_click", "outbound_click"] as const;
export type LeadEventType = (typeof LEAD_EVENT_TYPES)[number];

export function parseFlag(v: string | undefined | null): boolean {
  return /^(1|true|on|yes)$/i.test(String(v ?? "").trim());
}

// ── Bot / crawler filtering ────────────────────────────────────────────────
const BOT_RE =
  /bot\b|bot\/|crawl|spider|slurp|bingpreview|mediapartners|adsbot|googleother|google-inspectiontool|lighthouse|pagespeed|headless|phantom|puppeteer|playwright|selenium|curl\/|wget|python-requests|python-urllib|httpx|aiohttp|go-http-client|java\/|okhttp|axios\/|node-fetch|undici|libwww|scrapy|facebookexternalhit|embedly|whatsapp|telegrambot|discordbot|slackbot|preview|monitor|uptime|pingdom|statuscake|ahrefs|semrush|mj12|dotbot|petalbot|yandex|baiduspider|duckduckbot|applebot|gptbot|claude|perplexity|ccbot|bytespider|amazonbot/i;

export function isBotUserAgent(ua: string | undefined | null): boolean {
  if (!ua || ua.trim().length < 10) return true; // empty/tiny UA = not a real browser
  return BOT_RE.test(ua);
}

// ── Event payload validation ───────────────────────────────────────────────
export interface LeadEventInput { eventType: LeadEventType; listingId: number; dealerId: number | null; sessionId: string; }

const SESSION_RE = /^[A-Za-z0-9_-]{8,64}$/;
function posInt(v: unknown): number | null {
  const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n > 0 && n < 2_147_483_647 ? n : null;
}

export function validateEvent(body: unknown): { ok: true; value: LeadEventInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!LEAD_EVENT_TYPES.includes(b.eventType as LeadEventType)) return { ok: false, error: "eventType" };
  const listingId = posInt(b.listingId);
  if (!listingId) return { ok: false, error: "listingId" };
  const dealerId = b.dealerId == null ? null : posInt(b.dealerId);
  if (b.dealerId != null && !dealerId) return { ok: false, error: "dealerId" };
  if (typeof b.sessionId !== "string" || !SESSION_RE.test(b.sessionId)) return { ok: false, error: "sessionId" };
  return { ok: true, value: { eventType: b.eventType as LeadEventType, listingId, dealerId, sessionId: b.sessionId } };
}

// ── Dedupe (repeat views by one session within a window) ───────────────────
export class Deduper {
  private seen = new Map<string, number>();
  constructor(private windowMs = 30 * 60_000, private max = 50_000) {}
  /** true = first occurrence in window (record it); false = duplicate (drop). */
  check(key: string, now = Date.now()): boolean {
    const t = this.seen.get(key);
    if (t !== undefined && now - t < this.windowMs) return false;
    if (this.seen.size >= this.max) this.prune(now);
    this.seen.set(key, now);
    return true;
  }
  private prune(now: number) {
    this.seen.forEach((t, k) => { if (now - t >= this.windowMs) this.seen.delete(k); });
    if (this.seen.size >= this.max) this.seen.clear();
  }
}

// ── Fixed-window rate limiter ──────────────────────────────────────────────
export class RateLimiter {
  private hits = new Map<string, { start: number; n: number }>();
  constructor(private limit: number, private windowMs: number) {}
  allow(key: string, now = Date.now()): boolean {
    const h = this.hits.get(key);
    if (!h || now - h.start >= this.windowMs) {
      if (this.hits.size > 50_000) this.hits.clear();
      this.hits.set(key, { start: now, n: 1 });
      return true;
    }
    if (h.n >= this.limit) return false;
    h.n++;
    return true;
  }
}

// ── Lead form validation ───────────────────────────────────────────────────
export const LEAD_MIN_FILL_MS = 3_000;
export const LEAD_MAX_FILL_MS = 2 * 60 * 60_000;
export const LEAD_CONSENT_TEXT =
  "GolfCartIQ will contact you about this cart and may connect you with the dealer.";
export const LEAD_SUCCESS_TEXT =
  "Thanks, GolfCartIQ will reply within 1 business day.";
export const LEAD_FORM_TITLE = "Check availability / Get a quote";
export const LEAD_FORM_FOLLOWUP = "GolfCartIQ will follow up with you about this cart.";

export interface LeadInput {
  listingId: number; name: string; email: string | null; phone: string | null;
  zip: string; message: string | null; consent: true; idempotencyKey: string;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const LEAD_DEDUPE_MS = 10 * 60_000;
/** Same rule as the server, for the form's inline check. */
export const ZIP_MESSAGE = "Enter a 5-digit ZIP code (for example 32801).";

const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|ru|xyz|info|biz|co|us|top|site|online)\b|<|>)/i;
export const EMAIL_RE = /^[^\s@<>()]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
export const ZIP_RE = /^\d{5}(-\d{4})?$/;

export type LeadCheck =
  | { ok: true; value: LeadInput }
  | { ok: false; error: string; silent?: boolean }; // silent = looks like a bot; answer 200 but store nothing

export function validateLead(body: unknown, now = Date.now()): LeadCheck {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (str(b.website) !== "") return { ok: false, error: "honeypot", silent: true };
  const startedAt = typeof b.startedAt === "number" ? b.startedAt : NaN;
  if (!Number.isFinite(startedAt) || now - startedAt < LEAD_MIN_FILL_MS) return { ok: false, error: "too_fast", silent: true };
  if (now - startedAt > LEAD_MAX_FILL_MS) return { ok: false, error: "stale_form" };
  const listingId = posInt(b.listingId);
  if (!listingId) return { ok: false, error: "listingId" };
  const name = str(b.name).replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return { ok: false, error: "name" };
  if (URL_RE.test(name) || /[\u0000-\u001f]/.test(name)) return { ok: false, error: "name" };
  const email = str(b.email) || null;
  const phoneRaw = str(b.phone) || null;
  if (!email && !phoneRaw) return { ok: false, error: "contact_required" };
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) return { ok: false, error: "email" };
  let phone: string | null = null;
  if (phoneRaw) {
    if (phoneRaw.length > 25 || !/^[\d\s().+-]+$/.test(phoneRaw)) return { ok: false, error: "phone" };
    const digits = phoneRaw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
    if (digits.length !== 10) return { ok: false, error: "phone" };
    phone = digits;
  }
  const zip = str(b.zip);
  if (!ZIP_RE.test(zip)) return { ok: false, error: "zip" };
  const message = str(b.message) || null;
  if (message && message.length > 1000) return { ok: false, error: "message" };
  if (message && (message.match(/https?:\/\//gi) ?? []).length > 1) return { ok: false, error: "message" };
  if (b.consent !== true) return { ok: false, error: "consent" };
  const idempotencyKey = str(b.idempotencyKey).toLowerCase();
  if (!UUID_RE.test(idempotencyKey)) return { ok: false, error: "idempotency_key" };
  return { ok: true, value: { listingId, name, email: email ? email.toLowerCase() : null, phone, zip, message, consent: true, idempotencyKey } };
}

// ── Monthly report ─────────────────────────────────────────────────────────
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export interface DealerMonthRow { month: string; dealer_id: number | null; dealer_name: string | null; views: number; outbound_clicks: number; leads: number; }

// ── Retention + volume monitor ─────────────────────────────────────────────
export const LEAD_RETENTION_MONTHS = 12;
export const EVENT_RETENTION_DAYS = 90;

export interface DayCount { day: string; events: number; }
/**
 * Alert when the latest complete day exceeds 3x the trailing baseline (median of
 * the up-to-14 prior days). Median resists one earlier spike. Needs >= 7 days of
 * history and a baseline of at least 50/day to avoid alerting on tiny numbers.
 */
export function volumeAlert(days: DayCount[], factor = 3, minBaseline = 50) {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const latest = sorted[sorted.length - 1];
  const prior = sorted.slice(-15, -1).map((d) => d.events).sort((a, b) => a - b);
  if (!latest || prior.length < 7) return { alert: false, reason: "insufficient_history", latest: latest ?? null, baseline: null as number | null };
  const mid = Math.floor(prior.length / 2);
  const baseline = prior.length % 2 ? prior[mid] : (prior[mid - 1] + prior[mid]) / 2;
  const alert = latest.events > factor * Math.max(baseline, minBaseline);
  return { alert, reason: alert ? `latest ${latest.events} > ${factor}x baseline ${baseline}` : "ok", latest, baseline };
}

// ── Form-side checks (same rules as validateLead, field-specific messages) ──
export type LeadField = "name" | "contact" | "email" | "phone" | "zip" | "message" | "consent";
export function checkLeadForm(f: { name: string; email: string; phone: string; zip: string; message?: string; consent: boolean }): Partial<Record<LeadField, string>> {
  const e: Partial<Record<LeadField, string>> = {};
  const name = f.name.trim();
  if (name.length < 2 || name.length > 80 || URL_RE.test(name)) e.name = "Enter your name (2–80 characters, no links).";
  const email = f.email.trim(), phone = f.phone.trim();
  if (!email && !phone) e.contact = "Add an email or a phone number.";
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) e.email = "Enter a valid email address.";
  if (phone) {
    const d = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
    if (phone.length > 25 || !/^[\d\s().+-]+$/.test(phone) || d.length !== 10) e.phone = "Enter a 10-digit US phone number.";
  }
  if (!ZIP_RE.test(f.zip.trim())) e.zip = ZIP_MESSAGE;
  if ((f.message ?? "").trim().length > 1000) e.message = "Keep the message under 1,000 characters.";
  if (!f.consent) e.consent = "Please agree so we can pass your request on.";
  return e;
}
/** Maps a server 400 error code to the field it belongs to. */
export function serverErrorField(code: string): LeadField | null {
  return (["name", "email", "phone", "zip", "message", "consent"] as const).find((k) => k === code)
    ?? (code === "contact_required" ? "contact" : null);
}
