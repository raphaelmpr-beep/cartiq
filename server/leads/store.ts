// Lead tracking store (DRAFT). Supabase implementation uses the server-side
// service_role client; a memory store is used by tests. Nothing here runs
// unless LEAD_TRACKING_ENABLED is on.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadEventType, LeadInput, DealerMonthRow } from "@shared/leadTracking";

export interface ListingRef { listingId: number; dealerId: number | null; }
export interface LeadsStore {
  /** Returns the listing's dealer if the listing exists, is active and public; else null. */
  getPublicListing(listingId: number): Promise<ListingRef | null>;
  insertEvent(e: { eventType: LeadEventType; listingId: number; dealerId: number | null; sessionId: string }): Promise<void>;
  insertLead(l: LeadInput & { dealerId: number | null; consentText: string; ipHash: string | null }): Promise<void>;
  monthlyReport(month: string): Promise<DealerMonthRow[]>;
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
    async insertLead(l) {
      const { error } = await sb.from("listing_leads").insert({
        listing_id: l.listingId, dealer_id: l.dealerId, name: l.name, email: l.email, phone: l.phone,
        zip: l.zip, message: l.message, consent_text: l.consentText, ip_hash: l.ipHash,
      });
      if (error) throw new Error(error.message);
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
  };
}
