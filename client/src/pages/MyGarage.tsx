import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Heart, Bell, Trash2, TrendingDown, ArrowRight, RotateCcw } from "lucide-react";
import { getStoredEmail, setStoredEmail, clearStoredEmail, isValidEmail } from "@/lib/userEmail";
import { apiRequest } from "@/lib/queryClient";
import { DealBadge } from "@/components/Badges";

type Tab = "saved" | "alerts";

function formatPrice(n: number | null | undefined) {
  if (n == null) return "—";
  return "$" + n.toLocaleString();
}

function PriceDrop({ pct }: { pct: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
      <TrendingDown size={11} />
      {pct.toFixed(1)}% drop
    </span>
  );
}

export default function MyGarage() {
  const [tab, setTab] = useState<Tab>("saved");
  const [email, setEmail] = useState(getStoredEmail() ?? "");
  const [confirmedEmail, setConfirmedEmail] = useState(getStoredEmail());
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");

  const [saves, setSaves] = useState<any[]>([]);
  const [watches, setWatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (confirmedEmail) fetchAll(confirmedEmail);
  }, [confirmedEmail]);

  async function fetchAll(e: string) {
    setLoading(true);
    try {
      const [s, w] = await Promise.all([
        fetch(`/api/saves?email=${encodeURIComponent(e)}`).then((r) => r.json()),
        fetch(`/api/watches?email=${encodeURIComponent(e)}`).then((r) => r.json()),
      ]);
      setSaves(Array.isArray(s) ? s : []);
      setWatches(Array.isArray(w) ? w : []);
    } catch {}
    setLoading(false);
  }

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(emailInput)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    const trimmed = emailInput.toLowerCase().trim();
    setStoredEmail(trimmed);
    setConfirmedEmail(trimmed);
    setEmailError("");
  }

  async function unsave(listingId: number) {
    if (!confirmedEmail) return;
    await apiRequest("DELETE", "/api/saves", { email: confirmedEmail, listingId });
    setSaves((prev) => prev.filter((s) => s.listingId !== listingId));
  }

  async function unwatch(watchId: number) {
    if (!confirmedEmail) return;
    await apiRequest("DELETE", `/api/watches/${watchId}?email=${encodeURIComponent(confirmedEmail)}`, {});
    setWatches((prev) => prev.filter((w) => w.id !== watchId));
  }

  async function dismissAlert(watchId: number) {
    await apiRequest("POST", `/api/watches/${watchId}/dismiss`, {});
    // Re-fetch to reflect cleared alertedAt
    if (confirmedEmail) fetchAll(confirmedEmail);
  }

  function handleSwitchEmail() {
    clearStoredEmail();
    setConfirmedEmail(null);
    setEmail("");
    setEmailInput("");
    setSaves([]);
    setWatches([]);
  }

  const alertWatches = watches.filter((w) => w.alertedAt);
  const activeWatches = watches.filter((w) => !w.alertedAt);

  // ── Email gate ────────────────────────────────────────────────────────────
  if (!confirmedEmail) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto px-4 py-16">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-50 border border-green-200 mb-4">
              <Heart size={26} className="text-green-700" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">My Garage</h1>
            <p className="text-sm text-muted-foreground">
              Enter your email to view your saved carts and price drop alerts.
            </p>
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <input
              type="email"
              autoFocus
              value={emailInput}
              onChange={(e) => { setEmailInput(e.target.value); setEmailError(""); }}
              placeholder="you@email.com"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            {emailError && <p className="text-xs text-red-500">{emailError}</p>}
            <button
              type="submit"
              className="w-full bg-green-700 hover:bg-green-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              View My Garage
            </button>
          </form>

          <p className="text-[11px] text-muted-foreground mt-5 text-center">
            No account required. Your email is only used to retrieve your saved carts and alerts.
          </p>
        </div>
      </div>
    );
  }

  // ── Main garage view ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Garage</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{confirmedEmail}</p>
          </div>
          <button
            onClick={handleSwitchEmail}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
          >
            <RotateCcw size={11} /> Switch email
          </button>
        </div>

        {/* Alert banner — price drops */}
        {alertWatches.length > 0 && (
          <div
            className="mb-5 rounded-xl border border-green-300 bg-green-50 px-4 py-3 flex items-center gap-3 cursor-pointer"
            onClick={() => setTab("alerts")}
          >
            <TrendingDown size={18} className="text-green-700 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">
                {alertWatches.length} price drop{alertWatches.length > 1 ? "s" : ""} on your watched carts
              </p>
              <p className="text-xs text-green-700">Tap to view</p>
            </div>
            <ArrowRight size={14} className="text-green-700 shrink-0" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border mb-6">
          {(["saved", "alerts"] as Tab[]).map((t) => {
            const label = t === "saved"
              ? `Saved Carts${saves.length ? ` (${saves.length})` : ""}`
              : `Price Alerts${watches.length ? ` (${watches.length})` : ""}`;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t
                    ? "border-green-700 text-green-800"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "saved" ? <Heart size={13} className="inline mr-1.5" /> : <Bell size={13} className="inline mr-1.5" />}
                {label}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
        )}

        {/* ── Saved Carts Tab ── */}
        {!loading && tab === "saved" && (
          <>
            {saves.length === 0 ? (
              <div className="text-center py-12">
                <Heart size={32} className="mx-auto text-muted-foreground mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground">No saved carts yet.</p>
                <Link href="/search" className="mt-3 inline-block text-sm text-green-700 hover:underline">Browse listings →</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {saves.map((s) => {
                  const l = s.listing;
                  if (!l) return null;
                  const price = l.askingPrice ?? l.salePrice ?? l.regularPrice;
                  return (
                    <div key={s.id} className="flex items-center gap-4 bg-white border border-border rounded-xl p-4 group">
                      {l.imageUrl && (
                        <img
                          src={l.imageUrl}
                          alt={l.title}
                          className="w-20 h-14 object-cover rounded-lg shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <Link href={`/listing/${l.id}`} className="text-sm font-semibold text-foreground hover:text-green-700 line-clamp-1">{l.title}</Link>
                        <p className="text-xs text-muted-foreground mt-0.5">{l.city}, {l.state} · {l.year} {l.brand}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {price && <span className="text-sm font-bold">{formatPrice(price)}</span>}
                          <DealBadge rating={l.dealRating} />
                        </div>
                      </div>
                      <button
                        onClick={() => unsave(l.id)}
                        className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors p-1.5"
                        title="Remove from saved"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Price Alerts Tab ── */}
        {!loading && tab === "alerts" && (
          <>
            {watches.length === 0 ? (
              <div className="text-center py-12">
                <Bell size={32} className="mx-auto text-muted-foreground mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground">No watched listings yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click the <Bell size={11} className="inline" /> icon on any listing to watch for price drops.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active price-drop alerts */}
                {alertWatches.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Price Drops</p>
                    <div className="space-y-3">
                      {alertWatches.map((w) => {
                        const l = w.listing;
                        if (!l) return null;
                        return (
                          <div key={w.id} className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                              {l.imageUrl && (
                                <img src={l.imageUrl} alt={l.title} className="w-16 h-12 object-cover rounded-lg shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <Link href={`/listing/${l.id}`} className="text-sm font-semibold text-foreground hover:text-green-700 line-clamp-1">{l.title}</Link>
                                <p className="text-xs text-muted-foreground mt-0.5">{l.city}, {l.state}</p>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-xs text-muted-foreground line-through">{formatPrice(w.priceAtWatch)}</span>
                                  <ArrowRight size={12} className="text-muted-foreground" />
                                  <span className="text-sm font-bold text-green-800">{formatPrice(w.alertPrice)}</span>
                                  {w.alertPct && <PriceDrop pct={w.alertPct} />}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Link href={`/listing/${l.id}`} className="text-xs bg-green-700 text-white px-3 py-1.5 rounded-lg hover:bg-green-800 transition-colors">
                                View Listing
                              </Link>
                              <button
                                onClick={() => dismissAlert(w.id)}
                                className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border bg-white"
                              >
                                Dismiss
                              </button>
                              <button
                                onClick={() => unwatch(w.id)}
                                className="text-xs text-muted-foreground hover:text-red-500 px-3 py-1.5 rounded-lg border border-border bg-white ml-auto"
                              >
                                Remove watch
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Active watches (no alert yet) */}
                {activeWatches.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-5">Watching</p>
                    <div className="space-y-3">
                      {activeWatches.map((w) => {
                        const l = w.listing;
                        if (!l) return null;
                        const price = l.askingPrice ?? l.salePrice ?? l.regularPrice;
                        return (
                          <div key={w.id} className="flex items-center gap-4 bg-white border border-border rounded-xl p-4">
                            {l.imageUrl && (
                              <img src={l.imageUrl} alt={l.title} className="w-16 h-12 object-cover rounded-lg shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <Link href={`/listing/${l.id}`} className="text-sm font-semibold text-foreground hover:text-green-700 line-clamp-1">{l.title}</Link>
                              <p className="text-xs text-muted-foreground mt-0.5">{l.city}, {l.state}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs text-muted-foreground">
                                  Watching at <span className="font-medium text-foreground">{formatPrice(w.priceAtWatch)}</span>
                                </span>
                                {price && price !== w.priceAtWatch && (
                                  <span className="text-xs text-muted-foreground">· now {formatPrice(price)}</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => unwatch(w.id)}
                              className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors p-1.5"
                              title="Remove watch"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer note about email alerts */}
        <div className="mt-10 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-800 font-medium mb-0.5">Email alerts — coming soon</p>
          <p className="text-xs text-amber-700">
            Right now, price drop alerts are only visible here. Email delivery is on the roadmap — check back soon.
          </p>
        </div>
      </div>
    </div>
  );
}
