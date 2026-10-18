// Lead tracking store (DRAFT). Supabase implementation uses the server-side
// service_role client; a memory store is used by tests. Nothing here runs
// unless LEAD_TRACKING_ENABLED is on.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadEventType, LeadInput, DealerMonthRow, DayCount } from "@shared/leadTracking";
import { RateLimiter } from "@shared/leadTracking";

export type LeadRow = LeadInput & {
  dealerId: number | null; consentText: string; ipHash: string | null; contactHash: string; dedupeBucket: number;
};

/** Memory lead table with the same uniqueness rules as the draft SQL (fixture + tests). */
export function memoryLeads(rows: (LeadRow & { created_at: string })[] = [], nowFn = Date.now) {
  return {
    rows,
    async findDuplicateLead(q: { listingId: number; idempotencyKey: string; contactHash: string; since: string }) {
      return rows.some((r) => r.idempotencyKey === q.idempotencyKey ||
        (r.listingId === q.listingId && r.contactHash === q.contactHash && r.created_at >= q.since));
    },
    async insertLead(l: LeadRow) {
      if (rows.some((r) => r.idempotencyKey === l.idempotencyKey ||
        (r.listingId === l.listingId && r.contactHash === l.contactHash && r.dedupeBucket === l.dedupeBucket))) return { duplicate: true };
      rows.push({ ...l, created_at: new Date(nowFn()).toISOString() });
      return { duplicate: false };
    },
  };
}

export interface ListingRef { listingId: number; dealerId: number | null; }
export interface LeadsStore {
  /** Returns the listing's dealer if the listing exists, is active and public; else null. */
  getPublicListing(listingId: number): Promise<ListingRef | null>;
  insertEvent(e: { eventType: LeadEventType; listingId: number; dealerId: number | null; sessionId: string }): Promise<void>;
  /** Existing lead with this idempotency key, or same listing + contact hash since `since`. */
  findDuplicateLead(q: { listingId: number; idempotencyKey: string; contactHash: string; since: string }): Promise<boolean>;
  /** Inserts; returns {duplicate:true} when a unique constraint (key or listing+contact+bucket) already holds it. */
  insertLead(l: LeadRow): Promise<{ duplicate: boolean }>;
  monthlyReport(month: string): Promise<DealerMonthRow[]>;
  /** Atomic counter in lead_rate_limits. true = allowed. */
  hitRateLimit(scope: string, key: string, windowMs: number, limit: number, now: number): Promise<boolean>;
  /** Retention: leads 12 months, events 90 days, expired rate-limit rows. */
  cleanup(): Promise<{ leads: number; events: number; rate_limits: number }>;
  /** Last `days` complete UTC days of listing_events counts (oldest first). */
  dailyEventCounts(days: number, now: number): Promise<DayCount[]>;
  /** lead_tracking_paused row. Throws if it can't be read (caller fails closed). */
  getPaused(): Promise<{ paused: boolean; reason: string | null }>;
  setPaused(reason: string): Promise<void>;
  clearPaused(): Promise<void>;
}

/** In-memory pause switch (fixture mode + tests only). */
export function memoryPaused() {
  const k = { paused: false, reason: null as string | null, failRead: false };
  return {
    state: k,
    getPaused: async () => { if (k.failRead) throw new Error("read failed"); return { paused: k.paused, reason: k.reason }; },
    setPaused: async (reason: string) => { k.paused = true; k.reason = reason; },
    clearPaused: async () => { k.paused = false; k.reason = null; },
  };
}

export const windowStart = (now: number, windowMs: number) => new Date(Math.floor(now / windowMs) * windowMs).toISOString();

/** In-memory limiter with the same interface (fixture mode + tests only). */
export function memoryRateLimits() {
  const limiters = new Map<string, RateLimiter>();
  return (scope: string, key: string, windowMs: number, limit: number, now: number) => {
    const id = `${scope}|${windowMs}|${limit}`;
    let l = limiters.get(id);
    if (!l) { l = new RateLimiter(limit, windowMs); limiters.set(id, l); }
    return Promise.resolve(l.allow(key, now));
  };
}

export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Same aggregation as db/drafts/20261018_dealer_monthly_report.sql, in JS. */
export function aggregateMonthly(
  month: string,
  events: { event_type: string; dealer_id: number | null }[],
  leads: { dealer_id: number | null; status?: string | null }[],
  dealerNames: Map<number, string>,
): DealerMonthRow[] {
  const rows = new Map<string, DealerMonthRow>();
  const row = (d: number | null) => {
    const k = String(d);
    let r = rows.get(k);
    if (!r) { r = { month, dealer_id: d, dealer_name: d == null ? null : dealerNames.get(d) ?? null, views: 0, outbound_clicks: 0, leads: 0 }; rows.set(k, r); }
    return r;
  };
  for (const e of events) {
    if (e.event_type === "listing_view") row(e.dealer_id).views++;
    else if (e.event_type === "contact_click" || e.event_type === "outbound_click") row(e.dealer_id).outbound_clicks++;
  }
  for (const l of leads) if (l.status !== "spam") row(l.dealer_id).leads++;
  return Array.from(rows.values()).sort((a, b) =>
    b.leads - a.leads || b.outbound_clicks - a.outbound_clicks || b.views - a.views ||
    (a.dealer_id ?? Infinity) - (b.dealer_id ?? Infinity));
}

export function supabaseLeadsStore(sb: SupabaseClient): LeadsStore {
  const cache = new Map<number, { ref: ListingRef | null; at: number }>();
  async function fetchAll<T>(table: string, cols: string, start: string, end: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(table).select(cols).gte("created_at", start).lt("created_at", end).range(from, from + 999);
      if (error) throw new Error(error.message);
      out.push(...((data ?? []) as T[]));
      if (!data || data.length < 1000) return out;
    }
  }
  return {
    async getPublicListing(listingId) {
      const c = cache.get(listingId);
      if (c && Date.now() - c.at < 10 * 60_000) return c.ref;
      const { data, error } = await sb.from("listings").select("id, dealer_id, status, public_listing").eq("id", listingId).maybeSingle();
      if (error) throw new Error(error.message);
      const ref = data && data.public_listing === true && (data.status ?? "active") === "active"
        ? { listingId, dealerId: (data.dealer_id as number | null) ?? null } : null;
      if (cache.size > 20_000) cache.clear();
      cache.set(listingId, { ref, at: Date.now() });
      return ref;
    },
    async insertEvent(e) {
      const { error } = await sb.from("listing_events").insert({ event_type: e.eventType, listing_id: e.listingId, dealer_id: e.dealerId, session_id: e.sessionId });
      if (error) throw new Error(error.message);
    },
    async findDuplicateLead(q) {
      const byKey = await sb.from("listing_leads").select("id").eq("idempotency_key", q.idempotencyKey).limit(1);
      if (byKey.error) throw new Error(byKey.error.message);
      if (byKey.data?.length) return true;
      const byContact = await sb.from("listing_leads").select("id")
        .eq("listing_id", q.listingId).eq("contact_hash", q.contactHash).gte("created_at", q.since).limit(1);
      if (byContact.error) throw new Error(byContact.error.message);
      return !!byContact.data?.length;
    },
    async insertLead(l) {
      const { error } = await sb.from("listing_leads").insert({
        listing_id: l.listingId, dealer_id: l.dealerId, name: l.name, email: l.email, phone: l.phone,
        zip: l.zip, message: l.message, consent_text: l.consentText, ip_hash: l.ipHash,
        idempotency_key: l.idempotencyKey, contact_hash: l.contactHash, dedupe_bucket: l.dedupeBucket,
      });
      if (error && (error as any).code === "23505") return { duplicate: true }; // lost the race: already stored
      if (error) throw new Error(error.message);
      return { duplicate: false };
    },
    async monthlyReport(month) {
      const { start, end } = monthBounds(month);
      const [events, leads] = await Promise.all([
        fetchAll<{ event_type: string; dealer_id: number | null }>("listing_events", "event_type, dealer_id", start, end),
        fetchAll<{ dealer_id: number | null; status: string }>("listing_leads", "dealer_id, status", start, end),
      ]);
      const ids = Array.from(new Set([...events, ...leads].map((r) => r.dealer_id).filter((d): d is number => d != null)));
      const names = new Map<number, string>();
      if (ids.length) {
        const { data } = await sb.from("dealers").select("id, name").in("id", ids);
        for (const d of data ?? []) names.set(d.id as number, d.name as string);
      }
      return aggregateMonthly(month, events, leads, names);
    },
    async hitRateLimit(scope, key, windowMs, limit, now) {
      const { data, error } = await sb.rpc("lead_rate_limit_hit", {
        p_scope: scope, p_key: key, p_window_start: windowStart(now, windowMs), p_limit: limit,
      });
      if (error) throw new Error(error.message);
      return data === true;
    },
    async cleanup() {
      const { data, error } = await sb.rpc("lead_tracking_cleanup");
      if (error) throw new Error(error.message);
      const r = (Array.isArray(data) ? data[0] : data) ?? {};
      return { leads: Number(r.leads_deleted ?? 0), events: Number(r.events_deleted ?? 0), rate_limits: Number(r.rate_limits_deleted ?? 0) };
    },
    async dailyEventCounts(days, now) {
      const { data, error } = await sb.rpc("listing_events_daily_counts", { p_days: days, p_until: new Date(now).toISOString() });
      if (error) throw new Error(error.message);
      return ((data ?? []) as any[]).map((r) => ({ day: String(r.day), events: Number(r.events) }));
    },
    async getPaused() {
      const { data, error } = await sb.from("lead_tracking_paused").select("paused, reason").eq("id", 1).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("lead_tracking_paused row missing");
      return { paused: data.paused === true, reason: (data.reason as string | null) ?? null };
    },
    async setPaused(reason) {
      const at = new Date().toISOString();
      const { error } = await sb.from("lead_tracking_paused").upsert({ id: 1, paused: true, reason: reason.slice(0, 500), set_at: at, updated_at: at });
      if (error) throw new Error(error.message);
    },
    async clearPaused() {
      const at = new Date().toISOString();
      const { error } = await sb.from("lead_tracking_paused").upsert({ id: 1, paused: false, reason: null, cleared_at: at, updated_at: at });
      if (error) throw new Error(error.message);
    },
  };
}
