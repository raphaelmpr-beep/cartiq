// "Check availability / Get a quote" form (DRAFT, lazy chunk, flag-on only).
// Opened from the existing Contact Seller button. Stores a lead via the server;
// nothing is sent to any dealer automatically.
import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LEAD_CONSENT_TEXT, LEAD_SUCCESS_TEXT } from "@shared/leadTracking";

export default function LeadQuoteForm({ listingId, title, onClose }: { listingId: number; title?: string; onClose: () => void }) {
  const startedAt = useRef(Date.now());
  const [f, setF] = useState({ name: "", email: "", phone: "", zip: "", message: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const [blocked, setBlocked] = useState<string | null>(null); // set only by the fixture server
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.email.trim() && !f.phone.trim()) { setErr("Add an email or a phone number."); return; }
    setState("sending"); setErr("");
    try {
      const r = await fetch("/api/leads/quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, listingId, consent, startedAt: startedAt.current }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setBlocked(typeof j.fixtureBlocked === "string" ? j.fixtureBlocked : null); setState("done"); return; }
      setErr(j.error === "rate_limited" ? "Too many requests. Please try again later."
        : j.error === "contact_unavailable" ? "Contact isn't available for this listing."
        : r.status >= 500 ? "We couldn't save your request. Please try again in a few minutes."
        : "Please check your details and try again.");
      setState("error");
    } catch { setErr("Network error. Please try again."); setState("error"); }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent data-nosnippet>
        <DialogHeader>
          <DialogTitle>Check availability / Get a quote</DialogTitle>
          {title && <DialogDescription>{title}</DialogDescription>}
        </DialogHeader>
        {state === "done" ? (
          <>
            {blocked && (
              <p style={{ background: "#fde047", color: "#713f12", padding: "4px 8px", borderRadius: 4, fontFamily: "monospace", fontSize: 12 }} data-testid="lead-fixture-blocked">
                DEV FIXTURE: blocked ({blocked}) — nothing stored
              </p>
            )}
            <p className="text-sm" role="status" data-testid="lead-success">{LEAD_SUCCESS_TEXT}</p>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <Input placeholder="Name" value={f.name} onChange={set("name")} required maxLength={80} autoComplete="name" />
            <Input placeholder="Email" type="email" value={f.email} onChange={set("email")} maxLength={254} autoComplete="email" />
            <Input placeholder="Phone" type="tel" value={f.phone} onChange={set("phone")} maxLength={25} autoComplete="tel" />
            <Input placeholder="ZIP code" value={f.zip} onChange={set("zip")} required maxLength={10} inputMode="numeric" autoComplete="postal-code" />
            <Textarea placeholder="Message (optional)" value={f.message} onChange={set("message")} maxLength={1000} />
            {/* Honeypot: hidden from people, filled by bots. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
              <label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} name="website" /></label>
            </div>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required className="mt-0.5" />
              <span data-testid="lead-consent">{LEAD_CONSENT_TEXT}</span>
            </label>
            {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
            <Button type="submit" className="w-full" disabled={state === "sending" || !consent}>
              {state === "sending" ? "Sending…" : "Send request"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
