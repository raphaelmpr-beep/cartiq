// Fire-and-forget site_events tracking (server validates, enriches, rate-limits and filters bots).
function sessionId(): string {
  try {
    let id = sessionStorage.getItem("gciq_sid");
    if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem("gciq_sid", id); }
    return id;
  } catch { return ""; }
}
export type SiteEvent =
  | { eventType: "listing_view"; listingId: number }
  | { eventType: "lead_click"; listingId?: number; dealerId?: number; leadType: "phone" | "email" | "website" | "directions" }
  | { eventType: "dealer_profile_view"; dealerId: number }
  | { eventType: "search"; brand?: string; state?: string; city?: string; query?: string };
export function trackSiteEvent(e: SiteEvent) {
  try {
    const body = JSON.stringify({ ...e, sessionId: sessionId() });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track/site-event", new Blob([body], { type: "application/json" }));
    else fetch("/api/track/site-event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* never break the page */ }
}
