// Lead tracking client (DRAFT). Only reachable when __LEAD_TRACKING_ENABLED__ is
// true; otherwise ListingDetail's references are constant-folded away and this
// module (and the lazily loaded form chunk) is not in the bundle.
import { useEffect, useState, type ComponentType } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LeadEventType } from "@shared/leadTracking";

const SESSION_KEY = "gcq_lt_sid";

/** Coarse anonymous session id: random, per browser tab session, no PII. */
export function leadSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      const b = new Uint8Array(12);
      crypto.getRandomValues(b);
      id = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "nostorage00";
  }
}

/** Fire-and-forget. Never awaited, never throws, never blocks render. */
export function sendLeadEvent(eventType: LeadEventType, listingId: number, dealerId?: number | null) {
  try {
    if (navigator.webdriver) return; // automated browsers
    const body = JSON.stringify({ eventType, listingId, dealerId: dealerId ?? null, sessionId: leadSessionId() });
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon && navigator.sendBeacon("/api/leads/event", blob)) return;
    void fetch("/api/leads/event", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  } catch { /* ignore */ }
}

type L = { id: number; dealerId?: number; sourceUrl?: string } | undefined;

/**
 * Records one listing view after load (idle callback), and outbound clicks on the
 * existing tel:/dealer-site/retailer links via one delegated listener, so no
 * existing element is changed.
 */
export function useLeadTracking(listing: L) {
  const id = listing?.id;
  const dealerId = listing?.dealerId;
  useEffect(() => {
    if (!id) return;
    const fire = () => sendLeadEvent("listing_view", id, dealerId);
    const w = window as any;
    let handle: any;
    const schedule = () => { handle = w.requestIdleCallback ? w.requestIdleCallback(fire, { timeout: 4000 }) : setTimeout(fire, 1500); };
    if (document.readyState === "complete") schedule(); else window.addEventListener("load", schedule, { once: true });
    const onClick = (ev: MouseEvent) => {
      const a = (ev.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("tel:") || (a.target === "_blank" && /^https?:/i.test(href) && !href.includes(location.host))) {
        sendLeadEvent("outbound_click", id, dealerId);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("load", schedule);
      document.removeEventListener("click", onClick, true);
      if (handle != null) { if (w.cancelIdleCallback) w.cancelIdleCallback(handle); clearTimeout(handle); }
    };
  }, [id, dealerId]);
}

/**
 * Replaces the existing no-op "Contact Seller" button (same look, same testid)
 * when the flag is on: fires contact_click and opens the quote form, loaded lazily.
 */
export function LeadContactButton({ listingId, dealerId, title }: { listingId: number; dealerId?: number; title?: string }) {
  const [Form, setForm] = useState<ComponentType<{ listingId: number; title?: string; onClose: () => void }> | null>(null);
  const open = () => {
    sendLeadEvent("contact_click", listingId, dealerId);
    import("./LeadQuoteForm").then((m) => setForm(() => m.default)).catch(() => {});
  };
  return (
    <>
      <Button className="w-full gap-2" data-testid="btn-contact-seller" onClick={open}><Phone className="h-4 w-4" /> Contact Seller</Button>
      {Form && <Form listingId={listingId} title={title} onClose={() => setForm(null)} />}
    </>
  );
}
