// Admin "Leads" tab (DRAFT, flag-on only). Uses the existing admin sign-in: the
// x-admin-token header the Admin page already holds. Inline styles only.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface Row {
  id: number; created_at: string; listing_id: number; listing_title: string | null; listing_slug: string | null;
  dealer_id: number | null; dealer_name: string | null; name: string; email: string | null; phone: string | null;
  zip: string; message: string | null; status: string; contacted_at: string | null;
}

export const formatET = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET";

const cell = { padding: "8px 10px", borderTop: "1px solid #e5e7eb", verticalAlign: "top" as const, fontSize: 13 };
const head = { ...cell, borderTop: "none", fontWeight: 600, textAlign: "left" as const, whiteSpace: "nowrap" as const };

export function AdminLeads({ adminToken }: { adminToken: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; pageSize: number; rows: Row[] } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const load = (p: number) => {
    setErr("");
    fetch(`/api/admin/leads?page=${p}`, { headers: { "x-admin-token": adminToken }, cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error(String(r.status)); setData(await r.json()); })
      .catch((e) => setErr(e.message === "404" ? "Lead tracking is off on this server." : "Couldn't load leads."));
  };
  useEffect(() => { load(page); }, [page]);
  const markContacted = async (id: number) => {
    setBusy(id);
    try {
      const r = await fetch(`/api/admin/leads/${id}/contacted`, { method: "POST", headers: { "x-admin-token": adminToken } });
      if (!r.ok) throw new Error();
      load(page);
    } catch { setErr("Couldn't mark the lead contacted."); } finally { setBusy(null); }
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div data-testid="admin-leads">
      <p style={{ fontSize: 13, marginBottom: 8 }}>
        Quote requests, newest first. They go to GolfCartIQ only; nothing is sent to dealers. Mark a lead contacted once you've replied.
      </p>
      {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
      {data && (
        <>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Date (ET)", "Listing", "Dealer", "Name", "Email", "Phone", "ZIP", "Message", "Status", ""].map((h) => <th key={h} style={head}>{h}</th>)}</tr></thead>
              <tbody>
                {data.rows.length === 0 && <tr><td style={cell} colSpan={10}>No leads yet.</td></tr>}
                {data.rows.map((r) => (
                  <tr key={r.id} data-testid={`lead-row-${r.id}`}>
                    <td style={{ ...cell, whiteSpace: "nowrap" }}>{formatET(r.created_at)}</td>
                    <td style={cell}><a href={`/listing/${r.listing_id}`} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>{r.listing_title ?? `Listing ${r.listing_id}`}</a></td>
                    <td style={cell}>{r.dealer_id == null ? "no dealer" : r.dealer_name ?? `Dealer ${r.dealer_id}`}</td>
                    <td style={cell}>{r.name}</td>
                    <td style={cell}>{r.email ? <a href={`mailto:${r.email}`} style={{ color: "#2563eb" }}>{r.email}</a> : "—"}</td>
                    <td style={{ ...cell, whiteSpace: "nowrap" }}>{r.phone ? <a href={`tel:${r.phone}`} style={{ color: "#2563eb" }}>{r.phone}</a> : "—"}</td>
                    <td style={cell}>{r.zip}</td>
                    <td style={{ ...cell, maxWidth: 280, whiteSpace: "pre-wrap" }}>{r.message ?? "—"}</td>
                    <td style={{ ...cell, whiteSpace: "nowrap" }} data-testid={`lead-status-${r.id}`}>
                      {r.status}{r.contacted_at ? <><br /><span style={{ fontSize: 11, color: "#6b7280" }}>contacted {formatET(r.contacted_at)}</span></> : null}
                    </td>
                    <td style={cell}>
                      {!r.contacted_at && (
                        <Button variant="outline" style={{ minHeight: 44 }} disabled={busy === r.id} onClick={() => markContacted(r.id)} data-testid={`lead-contacted-${r.id}`}>
                          Mark contacted
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
            <Button variant="outline" style={{ minHeight: 44 }} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span style={{ fontSize: 13 }}>Page {page} of {pages} · {data.total} leads</span>
            <Button variant="outline" style={{ minHeight: 44 }} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </>
      )}
    </div>
  );
}
