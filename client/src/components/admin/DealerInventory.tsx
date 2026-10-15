import { Fragment, useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Health = "Fresh" | "Stale" | "Failing" | "Paused";
interface DealerRow {
  slug: string; name: string; state: string | null; city: string | null; adapter: string | null; sync_enabled: boolean; status: string | null;
  active: number; stale_7d: number; stale_30d: number; dead_pending: number; missing_price: number; outliers: number; duplicates: number;
  pct_stale: number; last_successful_sync: string | null; error: string | null; health: Health;
  paused: { reason: string; http_status: number | null; since: string; until: string | null; host: string | null; failures: number } | null;
  last_job: { id: number; status: string; processed: number; total: number; archived: number; dead_pending: number; errors: number; finished_at: string | null; dry_run: boolean } | null;
}
interface Job { id: number; scope: string; dealer_slugs: string[]; status: string; processed: number; total: number; alive: number;
  dead_pending: number; archived: number; errors: number; created_at: string; finished_at: string | null; last_error: string | null; dry_run: boolean }
interface ListingRow { id: number; title: string; price: number | null; condition: string | null; age_days: number | null; source_url: string | null; flags: string[] }

const HEALTH_CLASS: Record<Health, string> = {
  Fresh: "bg-green-100 text-green-800 border-green-200",
  Stale: "bg-amber-100 text-amber-800 border-amber-200",
  Failing: "bg-red-100 text-red-800 border-red-200",
  Paused: "bg-slate-200 text-slate-800 border-slate-300",
};
const PAUSE_LABEL: Record<string, string> = {
  http_401: "401 auth required", http_402: "402 site suspended", http_403: "403 forbidden", http_429: "429 rate limited",
  http_503: "503 unavailable", challenge: "bot challenge (CAPTCHA/JS)", policy_crawl_delay: "robots crawl-delay too long for page checks",
  circuit_open: "repeated errors",
};
const FLAG_LABEL: Record<string, string> = {
  never_checked: "Never checked", stale_30d: "Stale 30d+", stale_7d: "Stale 7d+", dead_pending: "Possibly gone",
  missing_price: "No price", price_outlier: "Price outlier", duplicate_url: "Duplicate URL",
};
type SortKey = "name" | "active" | "pct_stale" | "dead_pending" | "missing_price" | "last_successful_sync" | "health";
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const money = (n: number | null) => n == null ? "—" : `$${n.toLocaleString("en-US")}`;

export function DealerInventory({ adminToken }: { adminToken: string }) {
  const H = useMemo(() => ({ "x-admin-token": adminToken, "Content-Type": "application/json" }), [adminToken]);
  const [rows, setRows] = useState<DealerRow[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsAvailable, setJobsAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState(""); const [fState, setFState] = useState("all"); const [fAdapter, setFAdapter] = useState("all"); const [fHealth, setFHealth] = useState("all");
  const [sort, setSort] = useState<SortKey>("health"); const [dir, setDir] = useState<1 | -1>(-1);
  const [open, setOpen] = useState<string | null>(null); const [detail, setDetail] = useState<ListingRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [h, j] = await Promise.all([
        fetch("/api/admin/dealer-health", { headers: H }).then(r => r.json()),
        fetch("/api/admin/recheck/jobs", { headers: H }).then(r => r.json()).catch(() => ({ jobs: [] })),
      ]);
      if (h.error) throw new Error(h.error);
      setRows(h.dealers); setTotals(h.totals); setJobsAvailable(h.jobs_available !== false); setJobs(j.jobs ?? []);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [H]);
  useEffect(() => { load(); }, [load]);

  const running = jobs.some(j => j.status === "queued" || j.status === "running");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      // Push the oldest job forward one batch, then refresh status.
      await fetch("/api/admin/recheck/advance", { method: "POST", headers: H }).catch(() => {});
      load();
    }, 15000);
    return () => clearInterval(t);
  }, [running, H, load]);

  async function queue(body: any, key: string) {
    setBusy(key);
    try {
      const r = await fetch("/api/admin/recheck/jobs", { method: "POST", headers: H, body: JSON.stringify(body) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  }
  async function resume(slug: string) {
    if (!window.confirm("Resume automated checks for this dealer? Only do this if the site now allows our bot (or the dealer gave permission/a feed).")) return;
    setBusy(slug);
    try {
      const r = await fetch(`/api/admin/dealer-health/${encodeURIComponent(slug)}/resume`, { method: "POST", headers: H, body: JSON.stringify({ notes: "resumed from admin" }) });
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  }
  async function openDealer(slug: string) {
    if (open === slug) { setOpen(null); return; }
    setOpen(slug); setDetail(null);
    const d = await fetch(`/api/admin/dealer-health/${encodeURIComponent(slug)}/listings`, { headers: H }).then(r => r.json());
    setDetail(d.items ?? []);
  }

  const states = Array.from(new Set(rows.map(r => r.state).filter(Boolean))).sort() as string[];
  const adapters = Array.from(new Set(rows.map(r => r.adapter).filter(Boolean))).sort() as string[];
  const order: Record<Health, number> = { Paused: 3, Failing: 2, Stale: 1, Fresh: 0 };
  const view = rows
    .filter(r => !q || `${r.name} ${r.slug} ${r.city ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .filter(r => fState === "all" || r.state === fState)
    .filter(r => fAdapter === "all" || r.adapter === fAdapter)
    .filter(r => fHealth === "all" || r.health === fHealth)
    .sort((a, b) => {
      const av: any = sort === "health" ? order[a.health] : (a as any)[sort]; const bv: any = sort === "health" ? order[b.health] : (b as any)[sort];
      return (av ?? "") > (bv ?? "") ? dir : (av ?? "") < (bv ?? "") ? -dir : 0;
    });
  const th = (k: SortKey, label: string) => (
    <th className="p-2 text-left font-semibold whitespace-nowrap cursor-pointer select-none" onClick={() => { setDir(sort === k ? (dir === 1 ? -1 : 1) : -1); setSort(k); }}>
      {label}{sort === k ? (dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );
  const sel = "h-9 rounded-md border border-border bg-background px-2 text-sm";

  return (
    <div className="space-y-4" data-testid="dealer-inventory">
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[["Active listings", totals.active], ["Not checked 7d+", totals.stale_7d], ["Not checked 30d+", totals.stale_30d],
            ["Possibly gone", totals.dead_pending], ["No price", totals.missing_price], ["Price outliers", totals.outliers]].map(([l, v]) => (
            <div key={l as string} className="rounded-lg border border-border p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="text-lg font-bold">{v as number}</div></div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search dealers…" value={q} onChange={e => setQ(e.target.value)} className="w-full sm:w-64" data-testid="dealer-search" />
        <select className={sel} value={fState} onChange={e => setFState(e.target.value)} aria-label="State"><option value="all">All states</option>{states.map(s => <option key={s}>{s}</option>)}</select>
        <select className={sel} value={fAdapter} onChange={e => setFAdapter(e.target.value)} aria-label="Adapter"><option value="all">All adapters</option>{adapters.map(s => <option key={s}>{s}</option>)}</select>
        <select className={sel} value={fHealth} onChange={e => setFHealth(e.target.value)} aria-label="Status"><option value="all">All statuses</option><option>Fresh</option><option>Stale</option><option>Failing</option><option>Paused</option></select>
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>{loading ? "Loading…" : "Reload"}</Button>
          <Button size="sm" onClick={() => queue({ scope: "stale_dealers" }, "all")} disabled={!!busy || !jobsAvailable} data-testid="refresh-all-stale">
            {busy === "all" ? "Queuing…" : "Refresh all stale dealers"}
          </Button>
        </div>
      </div>
      {!jobsAvailable && <p className="text-xs text-amber-700">Background refresh is unavailable until migration 20261015_listing_recheck.sql is applied.</p>}
      {err && <p className="text-sm text-red-700">{err}</p>}

      {jobs.length > 0 && (
        <div className="rounded-lg border border-border p-3 text-sm space-y-1">
          <div className="font-semibold">Refresh jobs</div>
          {jobs.slice(0, 5).map(j => (
            <div key={j.id} className="flex flex-wrap gap-x-3 text-xs">
              <span>#{j.id} {j.scope === "stale_dealers" ? `${j.dealer_slugs.length} stale dealers` : j.dealer_slugs.join(", ")}{j.dry_run ? " (dry run)" : ""}</span>
              <span className="font-medium">{j.status}{j.total ? ` · ${j.processed}/${j.total}` : ""}</span>
              <span>{j.archived} archived · {j.dead_pending} possibly gone · {j.errors} errors</span>
              <span className="text-muted-foreground">{fmtDate(j.finished_at ?? j.created_at)}</span>
              {j.last_error && <span className="text-red-700">{j.last_error}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr>
            {th("name", "Dealer")}{th("health", "Health")}{th("active", "Active")}{th("last_successful_sync", "Last successful sync")}
            {th("pct_stale", "% stale")}{th("dead_pending", "Possibly gone")}{th("missing_price", "No price")}
            <th className="p-2 text-left">Errors</th><th className="p-2 text-left">Actions</th>
          </tr></thead>
          <tbody>
            {view.map(r => (
              <Fragment key={r.slug}>
                <tr className="border-t border-border align-top">
                  <td className="p-2 min-w-[180px]">
                    <button className="text-left font-medium hover:underline" onClick={() => openDealer(r.slug)} aria-expanded={open === r.slug}>{r.name}</button>
                    <div className="text-xs text-muted-foreground">{[r.city, r.state].filter(Boolean).join(", ")} · {r.adapter ?? "no adapter"}{r.sync_enabled ? "" : " · sync off"}</div>
                  </td>
                  <td className="p-2"><Badge variant="outline" className={HEALTH_CLASS[r.health]} data-testid={`health-${r.slug}`}>{r.health}</Badge>
                    {r.paused && <div className="text-[11px] text-muted-foreground mt-1 max-w-[160px]">{PAUSE_LABEL[r.paused.reason] ?? r.paused.reason} · since {fmtDate(r.paused.since)}{r.paused.until ? ` · until ${fmtDate(r.paused.until)}` : " · manual review"}</div>}</td>
                  <td className="p-2 tabular-nums">{r.active}</td>
                  <td className="p-2 whitespace-nowrap">{fmtDate(r.last_successful_sync)}</td>
                  <td className="p-2 tabular-nums">{r.pct_stale}%</td>
                  <td className="p-2 tabular-nums">{r.dead_pending}</td>
                  <td className="p-2 tabular-nums">{r.missing_price}</td>
                  <td className="p-2 text-xs text-red-700 max-w-[200px] break-words">{r.error ?? ""}</td>
                  <td className="p-2 whitespace-nowrap">
                    <Button size="sm" variant="outline" disabled={!!busy || !jobsAvailable || r.active === 0} onClick={() => queue({ dealer_slugs: [r.slug] }, r.slug)}>
                      {busy === r.slug ? "Queuing…" : "Refresh now"}
                    </Button>
                    {r.paused && <Button size="sm" variant="ghost" className="ml-1" disabled={!!busy} onClick={() => resume(r.slug)} data-testid={`resume-${r.slug}`}>Resume</Button>}
                    {r.last_job && <div className="text-[11px] text-muted-foreground mt-1">Last run: {r.last_job.status}{r.last_job.total ? ` ${r.last_job.processed}/${r.last_job.total}` : ""} · {r.last_job.archived} archived</div>}
                  </td>
                </tr>
                {open === r.slug && (
                  <tr className="bg-muted/30"><td colSpan={9} className="p-2">
                    {!detail ? <span className="text-xs">Loading listings…</span> : (
                      <div className="max-h-96 overflow-auto">
                        <table className="w-full text-xs">
                          <thead><tr><th className="p-1 text-left">Listing</th><th className="p-1 text-left">Price</th><th className="p-1 text-left">Last checked</th><th className="p-1 text-left">Issues</th></tr></thead>
                          <tbody>{detail.map(l => (
                            <tr key={l.id} className="border-t border-border">
                              <td className="p-1"><a className="hover:underline" href={`/listing/${l.id}`} target="_blank" rel="noreferrer">#{l.id} {l.title}</a>
                                {l.source_url && <a className="ml-1 text-blue-700 hover:underline" href={l.source_url} target="_blank" rel="noreferrer">source</a>}</td>
                              <td className="p-1 tabular-nums">{money(l.price)}</td>
                              <td className="p-1">{l.age_days == null ? "never" : `${l.age_days}d ago`}</td>
                              <td className="p-1">{l.flags.length ? l.flags.map(f => <Badge key={f} variant="outline" className="mr-1 mb-1 text-[10px]">{FLAG_LABEL[f] ?? f}</Badge>) : "—"}</td>
                            </tr>))}
                          </tbody>
                        </table>
                      </div>)}
                  </td></tr>
                )}
              </Fragment>
            ))}
            {!view.length && !loading && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">No dealers match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
