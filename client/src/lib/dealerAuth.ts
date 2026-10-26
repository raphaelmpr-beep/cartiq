// Dealer session (Supabase Auth tokens issued via /api/dealer-auth/*). No secrets here.
export interface DealerSession { access_token: string; refresh_token: string; expires_at?: number }
const KEY = "gciq_dealer_session";

export function getSession(): DealerSession | null {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}
export function setSession(s: DealerSession | null) {
  if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY);
}

/** Magic-link / email-confirm redirects land on /portal#access_token=...&refresh_token=... */
export function consumeAuthHash(): boolean {
  if (!window.location.hash.includes("access_token=")) return false;
  const p = new URLSearchParams(window.location.hash.slice(1));
  const access_token = p.get("access_token"), refresh_token = p.get("refresh_token");
  if (access_token && refresh_token) setSession({ access_token, refresh_token, expires_at: Number(p.get("expires_at")) || undefined });
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return Boolean(access_token);
}

async function refresh(): Promise<DealerSession | null> {
  const s = getSession();
  if (!s?.refresh_token) return null;
  const r = await fetch("/api/dealer-auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
  if (!r.ok) { setSession(null); return null; }
  const { session } = await r.json(); setSession(session); return session;
}

export async function dealerFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let s = getSession();
  if (s?.expires_at && s.expires_at * 1000 < Date.now() + 30_000) s = await refresh();
  const go = (tok?: string) => fetch(url, { ...init, headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}), ...(tok ? { Authorization: `Bearer ${tok}` } : {}) } });
  let r = await go(s?.access_token);
  if (r.status === 401 && s) { const n = await refresh(); if (n) r = await go(n.access_token); }
  return r;
}
