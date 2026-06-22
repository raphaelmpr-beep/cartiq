import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw, ExternalLink, TriangleAlert, CheckCircle2,
  AlertCircle, CircleDashed, Activity, Database, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

// ── Types ──────────────────────────────────────────────────────────────────────

type ReconciliationTotals = {
  mappedDealers: number;
  dealersWithPublicListings: number;
  dealersNeverSynced: number;
  publicActiveListings: number;
  publicActiveFlGa: number;
  pendingImports: number;
  pendingReview: number;
  importedFromPending: number;
  rejectedFromPending: number;
  inactiveListings: number;
  pendingReviewListings: number;
  unavailableListings: number;
  staleListings: number;
  adapterErrors: number;
  partialCoverageDealers: number;
  gapSummary: {
    publicSearch: number;
    pendingNotPublished: number;
    rejectedImports: number;
    inactiveHidden: number;
    pendingReviewHidden: number;
    notSyncedDealers: number;
    partialDealers: number;
  };
};

type DealerRow = {
  dealerSlug: string;
  dealerName: string;
  state?: string;
  city?: string;
  inventoryUrl?: string;
  publicActiveCount: number;
  publicInactiveCount: number;
  pendingImportCount: number;
  pendingReviewCount: number;
  rejectedPendingCount: number;
  duplicatePendingCount: number;
  importedCount: number;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastDiscoveredCount?: number;
  lastInsertedPendingCount?: number;
  coverageStatus: string;
  actionNeeded: string;
  notes?: string;
};

// ── Status meta ───────────────────────────────────────────────────────────────

const COVERAGE_META: Record<string, { label: string; color: string }> = {
  verified_full_inventory:  { label: "Verified Full",         color: "bg-green-100 text-green-800 border-green-200"   },
  partial_inventory:        { label: "Partial",               color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  featured_only:            { label: "Featured Only",         color: "bg-orange-100 text-orange-800 border-orange-200" },
  pagination_incomplete:    { label: "Pagination Incomplete", color: "bg-orange-100 text-orange-800 border-orange-200" },
  location_filter_needed:   { label: "Filter Needed",         color: "bg-blue-100 text-blue-800 border-blue-200"       },
  browser_required:         { label: "Browser Required",      color: "bg-purple-100 text-purple-800 border-purple-200" },
  adapter_error:            { label: "Adapter Error",         color: "bg-red-100 text-red-800 border-red-200"          },
  blocked:                  { label: "Blocked",               color: "bg-red-100 text-red-800 border-red-200"          },
  not_synced:               { label: "Never Synced",          color: "bg-gray-100 text-gray-500 border-gray-200"       },
  needs_manual_review:      { label: "Needs Review",          color: "bg-gray-100 text-gray-600 border-gray-200"       },
};

const ACTION_META: Record<string, { label: string; color: string }> = {
  run_discovery:            { label: "Run Discovery",         color: "text-blue-700"   },
  review_pending_imports:   { label: "Review Pending",        color: "text-amber-700"  },
  fix_adapter:              { label: "Fix Adapter",           color: "text-red-700"    },
  handle_pagination:        { label: "Handle Pagination",     color: "text-purple-700" },
  handle_load_more:         { label: "Handle Load-More",      color: "text-purple-700" },
  split_location_inventory: { label: "Split Locations",       color: "text-blue-700"   },
  verify_public_listings:   { label: "Verify Listings",       color: "text-amber-700"  },
  mark_inactive:            { label: "Mark Inactive",         color: "text-gray-600"   },
  request_dealer_feed:      { label: "Request Feed",          color: "text-gray-600"   },
  none:                     { label: "—",                     color: "text-muted-foreground" },
};

function CoverageBadge({ status }: { status: string }) {
  const m = COVERAGE_META[status] || COVERAGE_META["needs_manual_review"];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${m.color}`}>
      {m.label}
    </span>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color = "text-foreground", warn = false }: {
  label: string; value: number | string; sub?: string; color?: string; warn?: boolean;
}) {
  return (
    <div className={`bg-white border rounded-lg p-4 ${warn && Number(value) > 0 ? "border-amber-300 bg-amber-50" : "border-border"}`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Gap analysis panel ────────────────────────────────────────────────────────

function GapPanel({ gap }: { gap: ReconciliationTotals["gapSummary"] }) {
  const items = [
    { label: "In public search",          value: gap.publicSearch,         color: "text-green-700",  note: "active + public" },
    { label: "Pending (not yet published)", value: gap.pendingNotPublished, color: "text-amber-600",  note: "awaiting review" },
    { label: "Rejected imports",           value: gap.rejectedImports,     color: "text-gray-500",   note: "skipped by admin" },
    { label: "Inactive (hidden)",          value: gap.inactiveHidden,      color: "text-gray-500",   note: "status=inactive" },
    { label: "Pending review listings",    value: gap.pendingReviewHidden, color: "text-amber-600",  note: "status=pending_review" },
    { label: "Dealers never synced",       value: gap.notSyncedDealers,    color: "text-red-600",    note: "no adapter run yet" },
    { label: "Partial coverage dealers",   value: gap.partialDealers,      color: "text-orange-600", note: "browser_required / partial" },
  ];

  return (
    <div className="bg-muted/40 border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Database className="h-4 w-4" /> Inventory Gap Analysis
      </h3>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <div className="flex items-center gap-2">
              <span className={`font-bold ${item.color}`}>{item.value}</span>
              <span className="text-xs text-muted-foreground">({item.note})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InventoryCoverage({ adminToken }: { adminToken: string }) {
  const ADMIN_HEADERS = { "x-admin-token": adminToken };
  const qc = useQueryClient();

  const { data, isLoading, error, refetch, isFetching } = useQuery<{ totals: ReconciliationTotals; byDealer: DealerRow[] }>({
    queryKey: ["/api/admin/inventory-reconciliation"],
    queryFn: () => apiRequest("GET", "/api/admin/inventory-reconciliation", undefined, ADMIN_HEADERS).then(r => r.json()),
  });

  const totals = data?.totals;
  const byDealer = data?.byDealer || [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading reconciliation data…
      </div>
    );
  }

  if (error || !totals) {
    return (
      <div className="py-8">
        <p className="text-sm text-red-600 mb-2">Failed to load reconciliation data.</p>
        <p className="text-xs text-muted-foreground">
          If this is the first time running, the <code>adapter_run_log</code> table may not exist yet.
          Run the DDL migration first.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Top summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Mapped Dealers"         value={totals.mappedDealers}             color="text-foreground" />
        <SummaryCard label="Public Active"          value={totals.publicActiveFlGa}          color="text-green-700" />
        <SummaryCard label="Pending Imports"        value={totals.pendingReview}             color={totals.pendingReview > 0 ? "text-amber-600" : "text-muted-foreground"} warn={totals.pendingReview > 0} sub="awaiting review" />
        <SummaryCard label="Never Synced"           value={totals.dealersNeverSynced}        color={totals.dealersNeverSynced > 0 ? "text-red-600" : "text-muted-foreground"} warn={totals.dealersNeverSynced > 0} />
        <SummaryCard label="Partial Coverage"       value={totals.partialCoverageDealers}    color={totals.partialCoverageDealers > 0 ? "text-orange-600" : "text-muted-foreground"} warn />
        <SummaryCard label="Adapter Errors"         value={totals.adapterErrors}             color={totals.adapterErrors > 0 ? "text-red-600" : "text-muted-foreground"} warn={totals.adapterErrors > 0} />
      </div>

      {/* Pending imports banner */}
      {totals.pendingReview > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <TriangleAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>{totals.pendingReview} pending imports</strong> are waiting for admin review.
            They are <strong>not published</strong> to public search. Go to the Pending Imports tab to approve or reject them.
          </p>
        </div>
      )}

      {/* Gap analysis */}
      <GapPanel gap={totals.gapSummary} />

      {/* Secondary counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {[
          { label: "Inactive listings",         value: totals.inactiveListings,       note: "status=inactive" },
          { label: "Pending review listings",   value: totals.pendingReviewListings,  note: "status=pending_review" },
          { label: "Total pending imports",     value: totals.pendingImports,         note: "all statuses" },
          { label: "Rejected imports (total)",  value: totals.rejectedFromPending,    note: "skipped" },
        ].map(item => (
          <div key={item.label} className="bg-muted rounded p-3">
            <p className="text-lg font-bold">{item.value}</p>
            <p className="text-xs font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.note}</p>
          </div>
        ))}
      </div>

      {/* Dealer audit table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Dealer Audit ({byDealer.length} sources)</h3>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>

        {/* Mobile: card view */}
        <div className="sm:hidden space-y-3">
          {byDealer.map(row => (
            <Card key={row.dealerSlug} className={`${row.coverageStatus === "not_synced" ? "opacity-60" : ""}`}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{row.dealerName}</p>
                    <p className="text-xs text-muted-foreground">{[row.city, row.state].filter(Boolean).join(", ")}</p>
                  </div>
                  <CoverageBadge status={row.coverageStatus} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Live</span><br /><strong className="text-green-700">{row.publicActiveCount}</strong></div>
                  <div><span className="text-muted-foreground">Pending</span><br /><strong className={row.pendingReviewCount > 0 ? "text-amber-600" : ""}>{row.pendingReviewCount}</strong></div>
                  <div><span className="text-muted-foreground">Discovered</span><br /><strong>{row.lastDiscoveredCount ?? "—"}</strong></div>
                </div>
                {row.actionNeeded !== "none" && (
                  <p className={`text-xs font-medium ${ACTION_META[row.actionNeeded]?.color || ""}`}>
                    → {ACTION_META[row.actionNeeded]?.label || row.actionNeeded}
                  </p>
                )}
                {row.inventoryUrl && (
                  <a href={row.inventoryUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <ExternalLink className="h-3 w-3" /> Inventory
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop: table view */}
        <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-muted text-left text-xs">
                {["Dealer", "State/City", "Inventory URL", "Live", "Inactive", "Pending", "Rejected",
                  "Last Discovered", "Last Sync", "Coverage Status", "Action Needed"].map(h => (
                  <th key={h} className="p-2 border border-border font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byDealer.map(row => {
                const isNeverSynced = row.coverageStatus === "not_synced";
                return (
                  <tr key={row.dealerSlug}
                    className={`odd:bg-white even:bg-gray-50 hover:bg-muted/40 transition-colors text-xs ${isNeverSynced ? "opacity-50" : ""}`}>

                    <td className="p-2 border border-border">
                      <p className="font-medium whitespace-nowrap">{row.dealerName}</p>
                      <p className="text-muted-foreground">{row.dealerSlug}</p>
                    </td>

                    <td className="p-2 border border-border whitespace-nowrap">
                      {[row.city, row.state].filter(Boolean).join(", ") || "—"}
                    </td>

                    <td className="p-2 border border-border max-w-[160px]">
                      {row.inventoryUrl ? (
                        <a href={row.inventoryUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline">
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[130px] block">{row.inventoryUrl.replace(/^https?:\/\//, "")}</span>
                        </a>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>

                    <td className="p-2 border border-border text-center">
                      <span className={row.publicActiveCount > 0 ? "font-semibold text-green-700" : "text-muted-foreground"}>
                        {row.publicActiveCount || "—"}
                      </span>
                    </td>

                    <td className="p-2 border border-border text-center text-muted-foreground">
                      {row.publicInactiveCount || "—"}
                    </td>

                    <td className="p-2 border border-border text-center">
                      <span className={row.pendingReviewCount > 0 ? "font-semibold text-amber-600" : "text-muted-foreground"}>
                        {row.pendingReviewCount || "—"}
                      </span>
                    </td>

                    <td className="p-2 border border-border text-center text-muted-foreground">
                      {row.rejectedPendingCount || "—"}
                    </td>

                    <td className="p-2 border border-border text-center">
                      {row.lastDiscoveredCount != null ? row.lastDiscoveredCount : <span className="text-muted-foreground">—</span>}
                    </td>

                    <td className="p-2 border border-border whitespace-nowrap">
                      {row.lastSyncAt ? (
                        <div>
                          <p>{new Date(row.lastSyncAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                          {row.lastSyncStatus && (
                            <Badge variant={row.lastSyncStatus === "ok" ? "default" : "destructive"}
                              className="text-xs mt-0.5">{row.lastSyncStatus}</Badge>
                          )}
                        </div>
                      ) : <span className="text-muted-foreground italic">never</span>}
                    </td>

                    <td className="p-2 border border-border">
                      <CoverageBadge status={row.coverageStatus} />
                    </td>

                    <td className="p-2 border border-border">
                      <span className={`font-medium ${ACTION_META[row.actionNeeded]?.color || ""}`}>
                        {ACTION_META[row.actionNeeded]?.label || row.actionNeeded}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {byDealer.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No data yet. Run the DDL migration and ensure dealer records exist.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
