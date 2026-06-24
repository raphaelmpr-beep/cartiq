import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  RefreshCw, ExternalLink, TriangleAlert, AlertCircle,
  Database, Loader2, Info, CheckCircle2, Play, Settings, Zap, ChevronDown, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

// ── Types ──────────────────────────────────────────────────────────────────────

type ReconciliationTotals = {
  // Listing counts
  totalAdminListings: number;
  activeListingsTotal: number;
  activePublicAll: number;
  activePublicFlGa: number;
  activePublicNullState: number;
  activePrivate: number;
  inactiveListings: number;
  pendingReviewListings: number;
  priceConfirmed: number;
  priceUnavailable: number;
  // Pending import counts
  totalPendingImportRecords: number;
  pendingAwaitingReview: number;
  importedFromPending: number;
  rejectedFromPending: number;
  duplicateFromPending: number;
  // Dealer/source counts
  mappedDealerProfiles: number;
  totalAuditSources: number;
  sourcesWithPublicListings: number;
  sourcesNeverSynced: number;
  sourcesWithAdapterErrors: number;
  sourcesPartialCoverage: number;
  sourcesWithPendingImports: number;
  // Gap summary
  gapSummary: {
    searchPageListings: number;
    apiListingsCount: number;
    activePublicNullStateGap: number;
    inactiveHidden: number;
    pendingReviewHidden: number;
    importedNullState: number;
    pendingImportAwaitingReview: number;
    rejectedImports: number;
    notSyncedSources: number;
    partialSources: number;
  };
};

type DealerRow = {
  dealerSlug: string;
  dealerName: string;
  state?: string;
  city?: string;
  websiteUrl?: string | null;
  adapterKey?: string | null;
  platformType?: string | null;
  discoveryStrategy?: string | null;
  inventorySourceUrl?: string | null;
  browserRequired?: boolean;
  lastDiscoveryStatus?: string | null;
  lastDiscoveryMessage?: string | null;
  inventoryUrl?: string;
  publicActiveCount: number;
  publicActiveNullState: number;
  publicInactiveCount: number;
  pendingReviewListingCount: number;
  unavailableCount: number;
  totalImportRecords: number;
  pendingReviewCount: number;
  importedCount: number;
  rejectedPendingCount: number;
  duplicatePendingCount: number;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastDiscoveredCount?: number;
  lastInsertedPendingCount?: number;
  coverageStatus: string;
  actionNeeded: string;
  valuationReviewNeeded: boolean;
  notes?: string;
};

// ── Status + action meta ───────────────────────────────────────────────────────

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
  valuation_review:         { label: "Valuation Review",      color: "text-orange-700" },
  none:                     { label: "—",                     color: "text-muted-foreground" },
};

// ── 3-state discovery button ─────────────────────────────────────────────────
// State 1: adapter_key set           → Run Discovery (blue)
// State 2: website_url but no adapter → Detect Source (neutral/gray)
// State 3: no website_url + no inv_url → Needs Setup (muted, disabled)

type DiscoveryBtnState = "idle" | "running" | "done" | "error";

function DiscoveryButton({ row, btnState, onRun, onDetect }: {
  row: DealerRow;
  btnState: DiscoveryBtnState;
  onRun: (slug: string) => void;
  onDetect: (slug: string) => void;
}) {
  const running = btnState === "running";

  if (row.adapterKey) {
    // State 1: adapter configured — Run Discovery (calls /api/admin/sync)
    return (
      <Button
        size="sm" variant="outline"
        className="text-xs h-6 px-2 gap-1 text-blue-700 border-blue-300 hover:bg-blue-50"
        disabled={running}
        onClick={() => onRun(row.dealerSlug)}
      >
        {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
        {running ? "Running…" : btnState === "done" ? "✓ Done" : "Run Discovery"}
      </Button>
    );
  }

  if (row.websiteUrl || row.inventorySourceUrl) {
    // State 2: has URL but no adapter — Detect Source (calls /api/admin/detect-source)
    return (
      <Button
        size="sm" variant="outline"
        className="text-xs h-6 px-2 gap-1 text-gray-700 border-gray-300 hover:bg-gray-50"
        disabled={running}
        onClick={() => onDetect(row.dealerSlug)}
      >
        {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
        {running ? "Detecting…" : btnState === "done" ? "✓ Queued" : "Detect Source"}
      </Button>
    );
  }

  // State 3: no URL at all — Needs Setup (disabled)
  return (
    <Button
      size="sm" variant="outline"
      className="text-xs h-6 px-2 gap-1 text-gray-400 border-gray-200 cursor-not-allowed"
      disabled
    >
      <Settings className="h-3 w-3" />
      Needs Setup
    </Button>
  );
}

// ── Diagnostic panel (per dealer) ─────────────────────────────────────────────

function DiagnosticPanel({ row }: { row: DealerRow }) {
  const fields: { label: string; value: string | null | undefined; mono?: boolean }[] = [
    { label: "dealer_slug",           value: row.dealerSlug,            mono: true  },
    { label: "adapter_key",           value: row.adapterKey || "—",     mono: true  },
    { label: "platform_type",         value: row.platformType || "—",   mono: true  },
    { label: "discovery_strategy",    value: row.discoveryStrategy || "—", mono: true },
    { label: "website_url",           value: row.websiteUrl || "—",     mono: false },
    { label: "inventory_source_url",  value: row.inventorySourceUrl || row.inventoryUrl || "—", mono: false },
    { label: "browser_required",      value: row.browserRequired ? "true" : "false", mono: true },
    { label: "last_discovery_status", value: row.lastDiscoveryStatus || "—", mono: true },
    { label: "last_discovery_message",value: row.lastDiscoveryMessage || "—", mono: false },
  ];
  return (
    <div className="mt-1 bg-gray-50 border border-gray-200 rounded p-2 text-xs space-y-0.5">
      <p className="font-semibold text-gray-500 uppercase tracking-wide text-xs mb-1">Adapter Diagnostic</p>
      {fields.map(f => (
        <div key={f.label} className="flex gap-2">
          <span className="text-gray-400 shrink-0 w-40">{f.label}</span>
          <span className={`text-gray-700 truncate ${f.mono ? "font-mono" : ""}`} title={f.value ?? undefined}>{f.value}</span>
        </div>
      ))}
    </div>
  );
}

function CoverageBadge({ status }: { status: string }) {
  const m = COVERAGE_META[status] || COVERAGE_META["needs_manual_review"];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${m.color}`}>
      {m.label}
    </span>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "text-foreground", warn = false, tip }: {
  label: string; value: number | string; sub?: string; color?: string; warn?: boolean; tip?: string;
}) {
  return (
    <div className={`bg-white border rounded-lg p-3 ${warn && Number(value) > 0 ? "border-amber-300 bg-amber-50" : "border-border"}`}
         title={tip}>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs font-medium text-foreground mt-0.5 leading-tight">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Count reconciliation explainer ───────────────────────────────────────────

function ReconciliationExplainer({ totals }: { totals: ReconciliationTotals }) {
  const g = totals.gapSummary;
  const searchMatchesApi = g.searchPageListings === g.apiListingsCount;

  return (
    <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Database className="h-4 w-4" /> Count Reconciliation — Why Numbers Differ
      </h3>

      {/* The 3 headline counts explained */}
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2 p-2 bg-white rounded border border-border">
          <span className="font-bold text-green-700 tabular-nums w-8 shrink-0">{g.searchPageListings}</span>
          <div>
            <p className="font-medium">Public search listings (FL + GA only)</p>
            <p className="text-xs text-muted-foreground">status=active, public_listing=true, state IN (FL, GA). What users see on /search.</p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-2 bg-white rounded border border-border">
          <span className="font-bold text-blue-700 tabular-nums w-8 shrink-0">{g.apiListingsCount}</span>
          <div>
            <p className="font-medium">All active public listings (all states)</p>
            <p className="text-xs text-muted-foreground">status=active, public_listing=true, no state filter. What Listings tab and /api/listings returns.</p>
            {g.activePublicNullStateGap > 0 && (
              <p className="text-xs text-amber-700 mt-0.5 font-medium">
                ↳ {g.activePublicNullStateGap} listing{g.activePublicNullStateGap !== 1 ? "s" : ""} have state=NULL — visible in Listings tab but hidden from Search page.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2 p-2 bg-white rounded border border-border">
          <span className="font-bold text-foreground tabular-nums w-8 shrink-0">{totals.totalAdminListings}</span>
          <div>
            <p className="font-medium">Admin listing records (all statuses)</p>
            <p className="text-xs text-muted-foreground">
              {totals.activeListingsTotal} active + {totals.inactiveListings} inactive + {totals.pendingReviewListings} pending_review = {totals.totalAdminListings} total rows in listings table.
            </p>
          </div>
        </div>
      </div>

      {/* Hidden listings breakdown */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hidden from public search</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "state=NULL (no location)", value: g.activePublicNullStateGap, color: "text-amber-700" },
            { label: "Inactive listings", value: g.inactiveHidden, color: "text-gray-600" },
            { label: "Pending review listings", value: g.pendingReviewHidden, color: "text-amber-600" },
            { label: "Import records rejected", value: g.rejectedImports, color: "text-gray-500" },
          ].map(item => (
            <div key={item.label} className="bg-white border border-border rounded p-2">
              <p className={`text-base font-bold tabular-nums ${item.color}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mismatch warning */}
      {!searchMatchesApi && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-2">
          <TriangleAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            <strong>Count mismatch:</strong> Search page shows {g.searchPageListings} but /api/listings returns {g.apiListingsCount}.
            Gap of {g.apiListingsCount - g.searchPageListings}: {g.activePublicNullStateGap} listings have state=NULL and are excluded by the Search page state filter.
            Fix: set state="FL" or "GA" on these {g.activePublicNullStateGap} jax listings.
          </p>
        </div>
      )}
      {searchMatchesApi && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded p-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-xs text-green-800">Search page count matches /api/listings — no hidden filter mismatch.</p>
        </div>
      )}
    </div>
  );
}

// ── Mobile dealer card ─────────────────────────────────────────────────────────

function DealerCard({ row, onSetBaseline, baselineState }: {
  row: DealerRow;
  onSetBaseline?: (slug: string) => void;
  baselineState?: Record<string, string>;
}) {
  const action = ACTION_META[row.actionNeeded] || ACTION_META["none"];
  const isNeverSynced = row.coverageStatus === "not_synced";
  const bs = baselineState?.[row.dealerSlug] || "idle";
  return (
    <div className={`border border-border rounded-lg p-3 bg-white space-y-2 ${isNeverSynced ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{row.dealerName}</p>
          <p className="text-xs text-muted-foreground">{row.dealerSlug}</p>
          <p className="text-xs text-muted-foreground">{[row.city, row.state].filter(Boolean).join(", ") || "—"}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <CoverageBadge status={row.coverageStatus} />
          {row.actionNeeded !== "none" && (
            <span className={`text-xs font-medium ${action.color}`}>→ {action.label}</span>
          )}
          {row.coverageStatus === "needs_manual_review" && onSetBaseline && (
            <Button
              size="sm" variant="outline"
              className="text-xs h-6 px-2 text-gray-600 border-gray-300 hover:bg-gray-50"
              disabled={bs === "running" || bs === "done"}
              onClick={() => onSetBaseline(row.dealerSlug)}
            >
              {bs === "done" ? "✓ Done" : bs === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set Baseline"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 text-xs">
        <div className="bg-muted rounded p-1.5 text-center">
          <p className={`font-bold ${row.publicActiveCount > 0 ? "text-green-700" : "text-muted-foreground"}`}>{row.publicActiveCount}</p>
          <p className="text-muted-foreground leading-tight">Live</p>
        </div>
        <div className="bg-muted rounded p-1.5 text-center">
          <p className={`font-bold ${row.pendingReviewCount > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{row.pendingReviewCount}</p>
          <p className="text-muted-foreground leading-tight">Pending</p>
        </div>
        <div className="bg-muted rounded p-1.5 text-center">
          <p className="font-bold text-muted-foreground">{row.rejectedPendingCount}</p>
          <p className="text-muted-foreground leading-tight">Rejected</p>
        </div>
        <div className="bg-muted rounded p-1.5 text-center">
          <p className="font-bold text-muted-foreground">{row.importedCount}</p>
          <p className="text-muted-foreground leading-tight">Imported</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {row.lastSyncAt
            ? `Last sync: ${new Date(row.lastSyncAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : "Never synced"}
        </span>
        {row.inventoryUrl && (
          <a href={row.inventoryUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:underline">
            <ExternalLink className="h-3 w-3" /> Inventory
          </a>
        )}
      </div>
      {row.publicActiveNullState > 0 && (
        <p className="text-xs text-amber-700 font-medium">
          ⚠ {row.publicActiveNullState} listing{row.publicActiveNullState !== 1 ? "s" : ""} have state=NULL (hidden from Search)
        </p>
      )}
      {row.notes && (
        <p className="text-xs text-muted-foreground truncate" title={row.notes}>{row.notes}</p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InventoryCoverage({ adminToken }: { adminToken: string }) {
  const ADMIN_HEADERS = { "x-admin-token": adminToken };
  const qc = useQueryClient();

  // Per-dealer run-discovery state: slug -> "idle" | "running" | "done" | "error"
  const [discoverState, setDiscoverState] = useState<Record<string, DiscoveryBtnState>>({});
  const [discoverResult, setDiscoverResult] = useState<Record<string, string>>({});

  // Per-dealer baseline state
  const [baselineState, setBaselineState] = useState<Record<string, "idle" | "running" | "done" | "error">>({});

  // Per-dealer diagnostic panel expanded state
  const [diagExpanded, setDiagExpanded] = useState<Record<string, boolean>>({});
  const toggleDiag = (slug: string) => setDiagExpanded(s => ({ ...s, [slug]: !s[slug] }));

  async function handleSetBaseline(dealerSlug: string) {
    setBaselineState(s => ({ ...s, [dealerSlug]: "running" }));
    try {
      const resp = await apiRequest("POST", "/api/admin/coverage-baseline",
        { dealer_slug: dealerSlug }, ADMIN_HEADERS);
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Baseline failed");
      setBaselineState(s => ({ ...s, [dealerSlug]: "done" }));
      setTimeout(() => refetch(), 800);
    } catch {
      setBaselineState(s => ({ ...s, [dealerSlug]: "error" }));
    }
  }

  async function handleRunDiscovery(dealerSlug: string) {
    setDiscoverState(s => ({ ...s, [dealerSlug]: "running" }));
    setDiscoverResult(s => ({ ...s, [dealerSlug]: "" }));
    try {
      const resp = await apiRequest("POST", "/api/admin/sync", {
        mode: "discover_sitemap",
        dealer: dealerSlug,
        limit: 100,
        dry_run: false,
      }, ADMIN_HEADERS);
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Sync failed");
      const queued = result.new_queued ?? 0;
      const summaryArr: string[] = Array.isArray(result.summary) ? result.summary : [];
      const noAdapter = summaryArr.some(s => s.includes("no sitemap") || s.includes("No GCR sitemap") || s.includes("No website URL") || s.includes("custom adapter"));
      const autoDetected = summaryArr.some(s => s.includes("Auto-detected"));
      let msg = queued > 0
        ? `✓ ${queued} new listing${queued !== 1 ? "s" : ""} queued`
        : noAdapter
          ? `No adapter — ${summaryArr[0]?.split(" — ")[1] ?? "site needs custom adapter"}`
          : autoDetected
            ? `Auto-detected — ${queued} new (already up to date)`
            : `Up to date (${result.already_known ?? 0} known)`;
      setDiscoverState(s => ({ ...s, [dealerSlug]: noAdapter ? "error" : "done" }));
      setDiscoverResult(s => ({ ...s, [dealerSlug]: msg }));
      // Refresh the table after a short delay
      if (!noAdapter) setTimeout(() => refetch(), 1500);
    } catch (e: any) {
      setDiscoverState(s => ({ ...s, [dealerSlug]: "error" }));
      setDiscoverResult(s => ({ ...s, [dealerSlug]: e.message || "Unknown error" }));
    }
  }

  // Detect Source: queues a platform-detection job via /api/admin/detect-source
  // Used when dealer has a website_url but no adapter_key yet
  async function handleDetectSource(dealerSlug: string) {
    setDiscoverState(s => ({ ...s, [dealerSlug]: "running" }));
    setDiscoverResult(s => ({ ...s, [dealerSlug]: "" }));
    try {
      const resp = await apiRequest("POST", "/api/admin/detect-source",
        { dealer_slug: dealerSlug }, ADMIN_HEADERS);
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Detect source failed");
      setDiscoverState(s => ({ ...s, [dealerSlug]: "done" }));
      setDiscoverResult(s => ({ ...s, [dealerSlug]: `✓ Job queued (${result.job_id?.slice(0,8) ?? "?"}...) — detection running in background` }));
    } catch (e: any) {
      setDiscoverState(s => ({ ...s, [dealerSlug]: "error" }));
      setDiscoverResult(s => ({ ...s, [dealerSlug]: e.message || "Unknown error" }));
    }
  }

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
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    );
  }

  const neverSynced = byDealer.filter(r => r.coverageStatus === "not_synced");
  const hasSynced = byDealer.filter(r => r.coverageStatus !== "not_synced");

  return (
    <div className="space-y-6">

      {/* ── Section 1: Listing counts ─────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Listing Records</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <StatCard label="Admin listing records" value={totals.totalAdminListings}
            sub="all statuses" color="text-foreground"
            tip="Total rows in listings table regardless of status or public flag" />
          <StatCard label="All active listings" value={totals.activePublicAll}
            sub="active + public" color="text-blue-700"
            tip="status=active, public_listing=true. What /api/listings returns." />
          <StatCard label="Public search listings" value={totals.activePublicFlGa}
            sub="FL + GA only" color="text-green-700"
            tip="status=active, public_listing=true, state IN (FL,GA). What users see." />
          <StatCard label="Missing state (no location)" value={totals.activePublicNullState}
            sub="active but state=NULL" color={totals.activePublicNullState > 0 ? "text-amber-700" : "text-muted-foreground"}
            warn={totals.activePublicNullState > 0}
            tip="Active+public but state is NULL. In /api/listings but NOT in Search page." />
          <StatCard label="Inactive listings" value={totals.inactiveListings}
            sub="status=inactive" color="text-gray-500"
            tip="Removed from public view. Includes 3guys parts/accessories." />
          <StatCard label="Pending review listings" value={totals.pendingReviewListings}
            sub="status=pending_review" color={totals.pendingReviewListings > 0 ? "text-amber-600" : "text-muted-foreground"}
            warn={totals.pendingReviewListings > 0}
            tip="Manually entered but not yet approved for public search." />
        </div>
      </div>

      {/* ── Section 2: Price confidence ───────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Price Confidence (active + public)</p>
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
          <StatCard label="Price confirmed" value={totals.priceConfirmed}
            sub="asking_price present" color="text-green-700"
            tip="Active+public listings where price was scraped and confirmed." />
          <StatCard label="Price unavailable" value={totals.priceUnavailable}
            sub="no price found" color={totals.priceUnavailable > 0 ? "text-amber-600" : "text-muted-foreground"}
            warn={totals.priceUnavailable > 0}
            tip="Active+public listings where price could not be found (e.g. jax listings)." />
        </div>
      </div>

      {/* ── Section 3: Import records ─────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Import Pipeline Records (pending_imports table)</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <StatCard label="Total import records" value={totals.totalPendingImportRecords}
            sub="all statuses" color="text-foreground"
            tip="All rows ever written to pending_imports table." />
          <StatCard label="Awaiting review" value={totals.pendingAwaitingReview}
            sub="status=pending" color={totals.pendingAwaitingReview > 0 ? "text-amber-600" : "text-green-700"}
            warn={totals.pendingAwaitingReview > 0}
            tip="Discovered but not yet approved or rejected." />
          <StatCard label="Imported (approved)" value={totals.importedFromPending}
            sub="status=imported" color="text-green-700"
            tip="Approved and promoted to active listings." />
          <StatCard label="Rejected" value={totals.rejectedFromPending}
            sub="status=rejected" color="text-gray-500"
            tip="Rejected by adapter dedup logic or admin action. Not published." />
          <StatCard label="Duplicates" value={totals.duplicateFromPending}
            sub="status=duplicate" color="text-gray-400"
            tip="Found but already existed in listings table." />
        </div>
      </div>

      {/* ── Section 4: Dealer / source counts ────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Dealer & Source Coverage</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="Dealer profiles (FL+GA)" value={totals.mappedDealerProfiles}
            sub="rows in dealers table" color="text-foreground"
            tip="Dealer records in the dealers table for FL and GA." />
          <StatCard label="Total audit sources" value={totals.totalAuditSources}
            sub="dealer profiles + sync slugs" color="text-foreground"
            tip="Union of dealer profiles + sync_source slugs that have any import/listing activity. Some sync_source slugs don't have a matching dealer profile row." />
          <StatCard label="Sources with live listings" value={totals.sourcesWithPublicListings}
            sub="have active+public listings" color="text-green-700" />
          <StatCard label="Never synced" value={totals.sourcesNeverSynced}
            sub="no adapter run yet" color={totals.sourcesNeverSynced > 0 ? "text-red-600" : "text-muted-foreground"}
            warn={totals.sourcesNeverSynced > 0}
            tip="Dealer profiles in the dealers table with no listing or import activity." />
        </div>
      </div>

      {/* ── Count reconciliation explainer ────────────────────────────────── */}
      <ReconciliationExplainer totals={totals} />

      {/* ── Active sources dealer table ───────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">
            Active Sources ({hasSynced.length})
            <span className="text-xs font-normal text-muted-foreground ml-2">— have listings or import activity</span>
          </h3>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden space-y-3">
          {hasSynced.map(row => (
            <DealerCard
              key={row.dealerSlug}
              row={row}
              onSetBaseline={handleSetBaseline}
              baselineState={baselineState}
            />
          ))}
          {hasSynced.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">No active sources.</p>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs border-collapse" style={{ minWidth: 1000 }}>
            <thead>
              <tr className="bg-muted text-left">
                {["Source / Dealer", "State", "Live", "No State", "Inactive", "Pending Review", "Imported", "Rejected", "Discovered", "Last Sync", "Coverage", "Action Needed"].map(h => (
                  <th key={h} className="p-2 border border-border font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hasSynced.map(row => {
                const action = ACTION_META[row.actionNeeded] || ACTION_META["none"];
                return (
                  <tr key={row.dealerSlug} className="odd:bg-white even:bg-gray-50 hover:bg-muted/40 transition-colors">
                    <td className="p-2 border border-border">
                      <p className="font-medium whitespace-nowrap">{row.dealerName}</p>
                      <p className="text-muted-foreground">{row.dealerSlug}</p>
                      {row.inventoryUrl && (
                        <a href={row.inventoryUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-0.5 text-blue-600 hover:underline mt-0.5">
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[120px] block">{row.inventoryUrl.replace(/^https?:\/\//, "")}</span>
                        </a>
                      )}
                    </td>
                    <td className="p-2 border border-border whitespace-nowrap text-muted-foreground">
                      {[row.city, row.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="p-2 border border-border text-center">
                      <span className={row.publicActiveCount > 0 ? "font-semibold text-green-700" : "text-muted-foreground"}>
                        {row.publicActiveCount || "—"}
                      </span>
                    </td>
                    <td className="p-2 border border-border text-center">
                      <span className={row.publicActiveNullState > 0 ? "font-semibold text-amber-700" : "text-muted-foreground"}>
                        {row.publicActiveNullState || "—"}
                      </span>
                    </td>
                    <td className="p-2 border border-border text-center text-muted-foreground">
                      {row.publicInactiveCount || "—"}
                    </td>
                    <td className="p-2 border border-border text-center">
                      <span className={row.pendingReviewListingCount > 0 ? "font-semibold text-amber-600" : "text-muted-foreground"}>
                        {row.pendingReviewListingCount || "—"}
                      </span>
                    </td>
                    <td className="p-2 border border-border text-center text-green-700 font-medium">
                      {row.importedCount || "—"}
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
                      {row.valuationReviewNeeded && (
                        <span className="block mt-0.5 text-orange-600 font-medium text-xs">⚠ valuation</span>
                      )}
                    </td>
                    <td className="p-2 border border-border">
                      <span className={`font-medium ${action.color}`}>{action.label}</span>
                      {row.coverageStatus === "needs_manual_review" && (
                        <Button
                          size="sm" variant="outline"
                          className="mt-1 text-xs h-6 px-2 gap-1 text-gray-600 border-gray-300 hover:bg-gray-50 block"
                          disabled={baselineState[row.dealerSlug] === "running" || baselineState[row.dealerSlug] === "done"}
                          onClick={() => handleSetBaseline(row.dealerSlug)}
                        >
                          {baselineState[row.dealerSlug] === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          {baselineState[row.dealerSlug] === "done" ? "✓ Baseline set" :
                           baselineState[row.dealerSlug] === "running" ? "Setting…" :
                           "Set Baseline"}
                        </Button>
                      )}
                      {row.notes && (
                        <p className="text-muted-foreground mt-0.5 max-w-[160px] truncate" title={row.notes}>{row.notes}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hasSynced.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No active sources found.</p>
          )}
        </div>
      </div>

      {/* ── Never-synced dealers ──────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold mb-2">
          Never Synced Dealers ({neverSynced.length})
          <span className="text-xs font-normal text-muted-foreground ml-2">— in dealers table but no adapter run</span>
        </h3>

        {/* Mobile: card list */}
        <div className="sm:hidden space-y-2">
          {neverSynced.map(row => {
            const ds = discoverState[row.dealerSlug] || "idle";
            const dr = discoverResult[row.dealerSlug] || "";
            const diagOpen = diagExpanded[row.dealerSlug] || false;
            return (
              <div key={row.dealerSlug} className="border border-border rounded p-2 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{row.dealerName}</p>
                    <p className="text-xs text-muted-foreground">{[row.city, row.state].filter(Boolean).join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <DiscoveryButton row={row} btnState={ds} onRun={handleRunDiscovery} onDetect={handleDetectSource} />
                    <button
                      onClick={() => toggleDiag(row.dealerSlug)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Adapter diagnostic"
                    >
                      {diagOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
                {dr && (
                  <p className={`text-xs mt-1 ${ds === "error" ? "text-red-600" : "text-green-700"}`}>{dr}</p>
                )}
                {diagOpen && <DiagnosticPanel row={row} />}
              </div>
            );
          })}
        </div>

        {/* Desktop: compact table */}
        <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs border-collapse" style={{ minWidth: 700 }}>
            <thead>
              <tr className="bg-muted text-left">
                {["Dealer", "Slug", "State", "City", "Adapter Key", "Action", "Result"].map(h => (
                  <th key={h} className="p-2 border border-border font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {neverSynced.map((row, i) => {
                const ds = discoverState[row.dealerSlug] || "idle";
                const dr = discoverResult[row.dealerSlug] || "";
                const diagOpen = diagExpanded[row.dealerSlug] || false;
                return (
                  <React.Fragment key={row.dealerSlug}>
                    <tr className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-2 border border-border font-medium">{row.dealerName}</td>
                      <td className="p-2 border border-border text-muted-foreground">{row.dealerSlug}</td>
                      <td className="p-2 border border-border">{row.state || "—"}</td>
                      <td className="p-2 border border-border">{row.city || "—"}</td>
                      <td className="p-2 border border-border">
                        {row.adapterKey
                          ? <span className="font-mono text-blue-700 bg-blue-50 px-1 rounded">{row.adapterKey}</span>
                          : <span className="text-gray-400 italic">not set</span>}
                      </td>
                      <td className="p-2 border border-border">
                        <div className="flex items-center gap-1">
                          <DiscoveryButton row={row} btnState={ds} onRun={handleRunDiscovery} onDetect={handleDetectSource} />
                          <button
                            onClick={() => toggleDiag(row.dealerSlug)}
                            className="p-0.5 text-gray-400 hover:text-gray-600"
                            title="Adapter diagnostic"
                          >
                            {diagOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </button>
                        </div>
                      </td>
                      <td className={`p-2 border border-border text-xs max-w-[200px] ${
                        ds === "error" ? "text-red-600" :
                        ds === "done" ? "text-green-700" :
                        "text-muted-foreground"
                      }`} title={dr}>
                        {dr ? (dr.length > 60 ? dr.slice(0, 58) + "…" : dr) : "—"}
                      </td>
                    </tr>
                    {diagOpen && (
                      <tr key={`${row.dealerSlug}-diag`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td colSpan={7} className="p-0 border border-border">
                          <DiagnosticPanel row={row} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {neverSynced.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">All dealers have been synced.</p>
          )}
        </div>
      </div>

    </div>
  );
}
