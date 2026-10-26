import React from "react"; // explicit for tsx-based unit tests
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setSEO } from "@/lib/seo";
import { dealerFetch, getSession, setSession, consumeAuthHash } from "@/lib/dealerAuth";

type Metric = { status: "ok"; value: number; tracking_since: string } | { status: "insufficient"; tracking_since: string | null };

export function MetricValue({ m, label }: { m?: Metric | null; label: string }) {
  if (!m || m.status !== "ok") {
    const since = m?.tracking_since ? new Date(m.tracking_since).toLocaleDateString() : null;
    return (
      <div className="rounded-lg border p-4 bg-white" data-testid="metric-insufficient">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm mt-1">{since ? `Not enough data yet — tracking since ${since}` : "Not enough data yet — tracking has just started"}</div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border p-4 bg-white">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{m.value.toLocaleString()}</div>
    </div>
  );
}

function AuthForm({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"signup" | "login" | "magic">("signup");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    const url = mode === "signup" ? "/api/dealer-auth/signup" : "/api/dealer-auth/login";
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: mode === "magic" ? "" : password }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return setMsg(j.error || "Something went wrong");
    if (j.magicLinkSent || j.needsEmailConfirm) return setMsg("Check your email for a sign-in link.");
    if (j.session) { setSession(j.session); onAuthed(); }
  }
  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      <h2 className="text-xl font-semibold">{mode === "signup" ? "Create your dealer account" : "Sign in"}</h2>
      <Input type="email" required placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} />
      {mode !== "magic" && <Input type="password" required minLength={8} placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} />}
      <Button type="submit" disabled={busy} className="w-full">{mode === "signup" ? "Sign up" : mode === "magic" ? "Email me a link" : "Sign in"}</Button>
      {msg && <p className="text-sm text-amber-700">{msg}</p>}
      <div className="text-xs text-muted-foreground flex gap-3">
        {mode !== "signup" && <button type="button" onClick={() => setMode("signup")} className="underline">Create account</button>}
        {mode !== "login" && <button type="button" onClick={() => setMode("login")} className="underline">Sign in with password</button>}
        {mode !== "magic" && <button type="button" onClick={() => setMode("magic")} className="underline">Email me a magic link</button>}
      </div>
      <p className="text-xs text-muted-foreground">Tip: use an email at your dealership's domain so we can verify your claim faster.</p>
    </form>
  );
}

function ClaimStep({ onDone }: { onDone: () => void }) {
  const [q, setQ] = useState(""); const [results, setResults] = useState<any[]>([]);
  const [newDealer, setNewDealer] = useState({ name: "", city: "", state: "", website_url: "", phone: "" });
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => fetch(`/api/dealer-search?q=${encodeURIComponent(q)}`).then((r) => r.json()).then(setResults).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);
  async function claim(body: any) {
    const r = await dealerFetch("/api/dealer-claims", { method: "POST", body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(j.error || "Could not submit claim");
    onDone();
  }
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-xl font-semibold mb-2">Find your dealership</h2>
        <Input placeholder="Search by dealership name or city" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-2 divide-y border rounded bg-white">
          {results.map((d) => (
            <li key={d.id} className="flex items-center justify-between p-2 text-sm">
              <span>{d.name} <span className="text-muted-foreground">· {d.city}, {d.state}</span></span>
              <Button size="sm" variant="outline" onClick={() => claim({ dealer_id: d.id })}>Claim</Button>
            </li>
          ))}
        </ul>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer">Not listed? Submit your dealership</summary>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {(["name", "city", "state", "website_url", "phone"] as const).map((k) => (
            <Input key={k} placeholder={k.replace("_url", "").replace(/^./, (c) => c.toUpperCase())} value={newDealer[k]} onChange={(e) => setNewDealer({ ...newDealer, [k]: e.target.value })} />
          ))}
          <Button onClick={() => claim({ submitted_dealer: newDealer })}>Submit</Button>
        </div>
      </details>
      {msg && <p className="text-sm text-red-700">{msg}</p>}
    </div>
  );
}

const PROFILE_FIELDS: [string, string][] = [["name", "Dealership name"], ["street_address", "Street address"], ["city", "City"], ["state", "State"], ["zip", "ZIP"], ["phone", "Phone"], ["email", "Email"], ["website_url", "Website"], ["hours_text", "Hours"]];

function ProfileEditor({ dealer, onSaved }: { dealer: any; onSaved: () => void }) {
  const [form, setForm] = useState<any>({ ...dealer, brands_carried: (dealer.brands_carried || []).join(", ") });
  const [msg, setMsg] = useState("");
  async function save() {
    const body: any = {};
    for (const [k] of PROFILE_FIELDS) body[k] = form[k] ?? "";
    body.profile_description = form.profile_description ?? "";
    body.brands_carried = String(form.brands_carried || "").split(",").map((s: string) => s.trim()).filter(Boolean);
    const r = await dealerFetch("/api/portal/profile", { method: "PATCH", body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? "Saved" : j.error || "Could not save"); if (r.ok) onSaved();
  }
  async function uploadLogo(f: File) {
    const dataUrl = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(f); });
    const r = await dealerFetch("/api/portal/logo", { method: "POST", body: JSON.stringify({ dataUrl }) });
    const j = await r.json().catch(() => ({})); setMsg(r.ok ? "Logo updated" : j.error || "Upload failed"); if (r.ok) onSaved();
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {dealer.logo_url ? <img src={dealer.logo_url} alt="Logo" className="h-14 w-14 object-contain border rounded" /> : <div className="h-14 w-14 border rounded text-xs flex items-center justify-center text-muted-foreground">No logo</div>}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {PROFILE_FIELDS.map(([k, label]) => (
          <label key={k} className="text-xs">{label}<Input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>
        ))}
        <label className="text-xs sm:col-span-2">Brands carried (comma separated)<Input value={form.brands_carried} onChange={(e) => setForm({ ...form, brands_carried: e.target.value })} /></label>
        <label className="text-xs sm:col-span-2">Description<textarea className="w-full border rounded p-2 text-sm" rows={4} maxLength={2000} value={form.profile_description ?? ""} onChange={(e) => setForm({ ...form, profile_description: e.target.value })} /></label>
      </div>
      <Button onClick={save}>Save profile</Button> {msg && <span className="text-sm ml-2">{msg}</span>}
    </div>
  );
}

function Dashboard() {
  const [days, setDays] = useState<7 | 30>(30);
  const [data, setData] = useState<any>(null); const [err, setErr] = useState("");
  useEffect(() => {
    setData(null);
    dealerFetch(`/api/portal/metrics?days=${days}`).then(async (r) => { const j = await r.json(); if (r.ok) setData(j); else setErr(j.error); });
  }, [days]);
  if (err) return <p className="text-sm text-muted-foreground">{err}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const own = data.own, area = data.area, home = data.homepage;
  return (
    <div className="space-y-4">
      <div className="flex gap-2">{([7, 30] as const).map((d) => <Button key={d} size="sm" variant={d === days ? "default" : "outline"} onClick={() => setDays(d)}>Last {d} days</Button>)}</div>
      <div className="grid sm:grid-cols-3 gap-3">
        <MetricValue m={own.profile_views} label="Profile views" />
        <MetricValue m={own.listing_views} label="Listing views" />
        {own.plan === "insights" && <MetricValue m={own.lead_clicks} label="Lead clicks (phone, email, website, directions)" />}
      </div>
      {own.plan === "featured" && <p className="text-sm text-muted-foreground">Upgrade to Dealer Insights for lead clicks, area demand and your share of area views.</p>}
      {area && (
        <div className="space-y-3">
          <h3 className="font-semibold">Your area ({area.area.state}, statewide for now)</h3>
          {area.share_of_area_listing_views.status === "ok"
            ? <div className="rounded-lg border p-4 bg-white"><div className="text-xs text-muted-foreground">Your share of area listing views</div><div className="text-2xl font-bold">{(area.share_of_area_listing_views.share * 100).toFixed(1)}%</div><div className="text-xs text-muted-foreground">{area.share_of_area_listing_views.mine} of {area.share_of_area_listing_views.area_total}</div></div>
            : <MetricValue m={area.share_of_area_listing_views} label="Your share of area listing views" />}
          <BrandTable title="Listing views by brand in your area" block={area.listing_views_by_brand} valueKey="views" />
          <BrandTable title="Searches by brand in your area" block={area.searches_by_brand} valueKey="searches" />
          <p className="text-xs text-muted-foreground">To protect other dealers, brands with fewer than 3 dealers or fewer than 20 events in your area are not shown.</p>
        </div>
      )}
      {home && (
        <div>
          <h3 className="font-semibold">Homepage only</h3>
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            <MetricValue m={home.impressions} label="Homepage impressions (homepage only)" />
            <MetricValue m={home.clicks} label="Homepage clicks (homepage only)" />
          </div>
        </div>
      )}
    </div>
  );
}

function BrandTable({ title, block, valueKey }: { title: string; block: any; valueKey: string }) {
  if (block.status !== "ok") return <MetricValue m={block} label={title} />;
  if (!block.buckets.length) return <div className="rounded-lg border p-4 bg-white text-sm"><div className="text-xs text-muted-foreground">{title}</div>Not enough data yet — tracking since {new Date(block.tracking_since).toLocaleDateString()}</div>;
  return (
    <div className="rounded-lg border p-4 bg-white text-sm">
      <div className="text-xs text-muted-foreground mb-2">{title}</div>
      <table className="w-full"><tbody>{block.buckets.map((b: any) => (
        <tr key={b.brand}><td className="capitalize">{b.brand}</td><td className="text-right">{b[valueKey].toLocaleString()}</td><td className="text-right text-xs">{b.you_stock ? "You stock this" : "You don't list this"}</td></tr>
      ))}</tbody></table>
    </div>
  );
}

export default function Portal() {
  const [me, setMe] = useState<any>(null); const [authed, setAuthed] = useState(false); const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const wantedPlan = params.get("plan");
  useEffect(() => { setSEO({ title: "Dealer Portal", noindex: true }); consumeAuthHash(); setAuthed(Boolean(getSession())); }, []);
  const load = useCallback(async () => {
    if (!getSession()) { setLoading(false); return; }
    setLoading(true);
    const r = await dealerFetch("/api/portal/me");
    if (r.status === 401) { setSession(null); setAuthed(false); setLoading(false); return; }
    setMe(await r.json()); setLoading(false);
  }, []);
  useEffect(() => { if (authed) load(); else setLoading(false); }, [authed, load]);

  async function go(url: string, body?: any) {
    setMsg("");
    const r = await dealerFetch(url, { method: "POST", body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.url) window.location.href = j.url; else setMsg(j.error || "Something went wrong");
  }

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-sm">Loading…</div>;
  if (!authed) return <div className="max-w-4xl mx-auto p-6"><AuthForm onAuthed={() => setAuthed(true)} /></div>;
  if (!me?.claim) return <div className="max-w-4xl mx-auto p-6"><ClaimStep onDone={load} /></div>;

  const { claim, dealer, subscription: sub, listings } = me;
  const subActive = sub && ["active", "trialing"].includes(sub.status);
  const approved = claim.status === "approved";
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{dealer?.name || claim.submitted_dealer?.name || "Your dealership"}</h1>
          <p className="text-sm text-muted-foreground">Claim status: <b>{claim.status}</b>{!approved && claim.status === "pending" && " — we verify claims by email domain or a call to your listed phone. Nothing shows publicly until approved."}</p>
        </div>
        <button className="text-xs underline" onClick={() => { setSession(null); setAuthed(false); setMe(null); }}>Sign out</button>
      </div>

      {params.get("checkout") === "success" && !sub && <p className="text-sm text-green-700">Payment received. Your plan will appear here within a few seconds; refresh if it doesn't.</p>}
      {sub?.status === "past_due" && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800" data-testid="billing-warning">Your last payment failed. Update your card in Manage billing to keep your plan active.</div>}

      <section className="rounded-xl border p-5 bg-white space-y-2">
        <h2 className="font-semibold">Plan & billing</h2>
        {sub ? (
          <>
            <p className="text-sm">Plan: <b className="capitalize">{sub.plan === "insights" ? "Dealer Insights" : sub.plan === "featured" ? "Featured Dealer" : sub.plan}</b> · Status: <b>{sub.status}</b></p>
            {sub.current_period_end && <p className="text-sm">{sub.cancel_at_period_end ? "Cancels on" : "Renews on"} {new Date(sub.current_period_end).toLocaleDateString()}</p>}
            {(sub.status === "canceled" || sub.status === "incomplete_expired") && <PlanButtons go={go} />}
            <Button variant="outline" onClick={() => go("/api/billing-portal")}>Manage billing</Button>
          </>
        ) : claim.dealer_id ? <PlanButtons go={go} highlight={wantedPlan} /> : <p className="text-sm">You can choose a plan once we've added your dealership.</p>}
        {msg && <p className="text-sm text-red-700">{msg}</p>}
      </section>

      {approved && dealer && (
        <section className="rounded-xl border p-5 bg-white space-y-3">
          <h2 className="font-semibold">Profile</h2>
          <ProfileEditor dealer={dealer} onSaved={load} />
        </section>
      )}

      {approved && (
        <section className="rounded-xl border p-5 bg-white">
          <h2 className="font-semibold mb-2">Your listings ({listings.length})</h2>
          <p className="text-xs text-muted-foreground mb-2">Listings sync automatically from your website and are read-only here.</p>
          <div className="max-h-80 overflow-auto text-sm"><table className="w-full"><tbody>{listings.map((l: any) => (
            <tr key={l.id} className="border-t"><td className="py-1"><a className="underline" href={`/listing/${l.id}`}>{l.title || `${l.year ?? ""} ${l.brand ?? ""} ${l.model ?? ""}`}</a></td><td>{l.status}</td><td className="text-right">{(l.sale_price || l.asking_price) ? `$${Number(l.sale_price || l.asking_price).toLocaleString()}` : ""}</td></tr>
          ))}</tbody></table></div>
        </section>
      )}

      {approved && subActive && (
        <section className="space-y-3">
          <h2 className="font-semibold">Metrics</h2>
          <Dashboard />
        </section>
      )}
    </div>
  );
}

function PlanButtons({ go, highlight }: { go: (u: string, b?: any) => void; highlight?: string | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={highlight === "featured" ? "default" : "outline"} onClick={() => go("/api/checkout", { plan: "featured" })}>Featured Dealer — $199/mo</Button>
      <Button variant={highlight === "insights" || !highlight ? "default" : "outline"} onClick={() => go("/api/checkout", { plan: "insights" })}>Dealer Insights — $499/mo</Button>
    </div>
  );
}
