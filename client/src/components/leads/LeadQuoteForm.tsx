// "Check availability / Get a quote" form (DRAFT, lazy chunk, flag-on only).
// Stores a lead via the server; nothing is sent to any dealer automatically.
// Accessibility: visible associated labels, aria-invalid + aria-describedby on errors,
// contact error tied to a fieldset, 44px tap targets (inline styles: no new Tailwind classes).
import { useId, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LEAD_CONSENT_TEXT, LEAD_SUCCESS_TEXT, LEAD_FORM_TITLE, LEAD_FORM_FOLLOWUP, checkLeadForm, serverErrorField, type LeadField } from "@shared/leadTracking";

const TAP = { minHeight: 44 } as const;
const LABEL = { display: "block", fontSize: 14, fontWeight: 500, marginBottom: 4 } as const;

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export default function LeadQuoteForm({ listingId, title, onClose }: { listingId: number; title?: string; onClose: () => void }) {
  const startedAt = useRef(Date.now());
  const idemKey = useRef(newIdempotencyKey()); // one per form open; reused on any manual retry
  const inFlight = useRef(false);
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const [f, setF] = useState({ name: "", email: "", phone: "", zip: "", message: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const [fe, setFe] = useState<Partial<Record<LeadField, string>>>({});
  const [blocked, setBlocked] = useState<string | null>(null); // set only by the fixture server
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return; // no double submit while a request is open
    const errs = checkLeadForm({ ...f, consent });
    setFe(errs);
    if (Object.keys(errs).length) { setErr(""); return; }
    inFlight.current = true;
    setState("sending"); setErr("");
    try {
      const r = await fetch("/api/leads/quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, listingId, consent, startedAt: startedAt.current, idempotencyKey: idemKey.current }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setBlocked(typeof j.fixtureBlocked === "string" ? j.fixtureBlocked : null); setState("done"); return; }
      const field = r.status === 400 ? serverErrorField(String(j.error ?? "")) : null;
      if (field) setFe({ [field]: field === "zip" ? checkLeadForm({ ...f, zip: "", consent }).zip : "Please check this field." });
      setErr(j.error === "rate_limited" ? "Too many requests. Please try again later."
        : j.error === "temporarily_unavailable" ? "Requests are paused right now. Please try again later."
        : r.status >= 500 ? "We couldn't save your request. Please try again in a few minutes."
        : "Please check your details and try again.");
      setState("error");
    } catch { setErr("Network error. Please try again."); setState("error"); }
    finally { inFlight.current = false; } // re-enabled only after a final response; never auto-resent
  }

  const a11y = (k: LeadField, extra?: string) => ({
    "aria-invalid": fe[k] || (extra && fe[extra as LeadField]) ? true : undefined,
    "aria-describedby": [fe[k] ? id(`${k}-err`) : "", extra && fe[extra as LeadField] ? id(`${extra}-err`) : ""].filter(Boolean).join(" ") || undefined,
  });
  const ErrText = ({ k }: { k: LeadField }) => fe[k] ? <p id={id(`${k}-err`)} className="text-sm text-red-600" style={{ marginTop: 4 }}>{fe[k]}</p> : null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent data-nosnippet data-lead-dialog="">
        {/* 44x44 hit area for the shared dialog's Close button (icon stays 16px). Scoped
            style element, not Tailwind, so main's CSS and the shared component are untouched. */}
        <style>{`[data-lead-dialog] > button.absolute{min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;top:6px;right:6px}`}</style>
        <DialogHeader>
          <DialogTitle>{LEAD_FORM_TITLE}</DialogTitle>
          <DialogDescription data-testid="lead-followup">{LEAD_FORM_FOLLOWUP}{title ? <><br />{title}</> : null}</DialogDescription>
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
            <div>
              <label htmlFor={id("name")} style={LABEL}>Name</label>
              <Input id={id("name")} value={f.name} onChange={set("name")} required maxLength={80} autoComplete="name" style={TAP} {...a11y("name")} />
              <ErrText k="name" />
            </div>
            <fieldset aria-describedby={fe.contact ? id("contact-err") : id("contact-hint")} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={LABEL}>How should we reach you?</legend>
              <p id={id("contact-hint")} className="text-sm" style={{ marginBottom: 4 }}>Email, phone, or both.</p>
              <label htmlFor={id("email")} style={LABEL}>Email</label>
              <Input id={id("email")} type="email" value={f.email} onChange={set("email")} maxLength={254} autoComplete="email" style={TAP} {...a11y("email", "contact")} />
              <ErrText k="email" />
              <label htmlFor={id("phone")} style={{ ...LABEL, marginTop: 8 }}>Phone</label>
              <Input id={id("phone")} type="tel" value={f.phone} onChange={set("phone")} maxLength={25} autoComplete="tel" style={TAP} {...a11y("phone", "contact")} />
              <ErrText k="phone" />
              <ErrText k="contact" />
            </fieldset>
            <div>
              <label htmlFor={id("zip")} style={LABEL}>ZIP code</label>
              <Input id={id("zip")} value={f.zip} onChange={set("zip")} required maxLength={10} inputMode="numeric" autoComplete="postal-code" style={TAP} {...a11y("zip")} />
              <ErrText k="zip" />
            </div>
            <div>
              <label htmlFor={id("message")} style={LABEL}>Message (optional)</label>
              <Textarea id={id("message")} value={f.message} onChange={set("message")} maxLength={1000} style={{ minHeight: 88 }} {...a11y("message")} />
              <ErrText k="message" />
            </div>
            {/* Honeypot: hidden from people, filled by bots. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
              <label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} name="website" /></label>
            </div>
            <div>
              <label htmlFor={id("consent")} className="text-sm" style={{ display: "flex", alignItems: "flex-start", gap: 8, minHeight: 44, cursor: "pointer" }}>
                <input id={id("consent")} type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required
                  style={{ width: 24, height: 24, marginTop: 2, flexShrink: 0 }} {...a11y("consent")} />
                <span data-testid="lead-consent">{LEAD_CONSENT_TEXT}</span>
              </label>
              <ErrText k="consent" />
            </div>
            {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
            <Button type="submit" className="w-full" style={TAP} disabled={state === "sending"} aria-busy={state === "sending" || undefined}>
              {state === "sending" ? "Sending…" : "Send request"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
