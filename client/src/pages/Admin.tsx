import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Upload, CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink, TriangleAlert, ShieldCheck, CircleDashed, CircleAlert, Activity, CheckCheck, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DealBadge } from "@/components/Badges";
import { formatPrice } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import type { Listing, Dealer, InventorySource } from "@/lib/types";
import InventoryCoverage from "@/pages/InventoryCoverage";

// The admin token is whatever the user types — never a compiled constant.
// The server is the source of truth: we probe /api/admin/verify with the
// entered password and unlock the UI only on a 200 response. No hash of the
// production password is embedded in the client bundle.
function useAdminAuth() {
  const [authed, setAuthed] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    if (!password) {
      setError("Enter the admin password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/verify", {
        method: "GET",
        headers: { "x-admin-token": password },
      });
      if (res.ok) {
        setAdminToken(password);
        setAuthed(true);
      } else {
        setError("Incorrect password.");
      }
    } catch (e) {
      setError("Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return { authed, adminToken, password, setPassword, login, error, loading };
}

// ── Listing Form ──────────────────────────────────────────────────────────────
function ListingFormDialog({ listing, onSuccess, adminToken }: { listing?: Listing; onSuccess: () => void; adminToken: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    title: listing?.title || "",
    brand: listing?.brand || "",
    model: listing?.model || "",
    year: listing?.year?.toString() || "",
    city: listing?.city || "",
    state: listing?.state || "FL",
    askingPrice: listing?.askingPrice?.toString() || "",
    regularPrice: listing?.regularPrice?.toString() || "",
    salePrice: listing?.salePrice?.toString() || "",
    batteryType: listing?.batteryType || "unknown",
    batteryAh: listing?.batteryAh?.toString() || "",
    batteryAgeMonths: listing?.batteryAgeMonths?.toString() || "",
    seating: listing?.seating?.toString() || "4",
    sellerType: listing?.sellerType || "private",
    sourceType: listing?.sourceType || "admin_manual",
    status: listing?.status || "active",
    chargerIncluded: listing?.chargerIncluded || "unknown",
    warrantyIncluded: listing?.warrantyIncluded || "unknown",
    warrantyMonths: listing?.warrantyMonths?.toString() || "",
    batteryWarrantyIncluded: listing?.batteryWarrantyIncluded || "unknown",
    warrantyProvider: listing?.warrantyProvider || "unknown",
    deliveryAvailable: listing?.deliveryAvailable ? "true" : "false",
    deliveryIncluded: listing?.deliveryIncluded ? "true" : "false",
    estimatedDeliveryCost: listing?.estimatedDeliveryCost?.toString() || "",
    lifted: listing?.lifted ? "true" : "false",
    streetLegalClaimed: listing?.streetLegalClaimed ? "true" : "false",
    imageUrl: listing?.imageUrl || "",
    description: listing?.description || "",
    retailerName: listing?.retailerName || "",
    lastVerifiedAt: listing?.lastVerifiedAt || "",
    availabilityStatus: listing?.availabilityStatus || "",
  });

  const qc = useQueryClient();
  const adminHeaders = { "x-admin-token": adminToken };
  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => listing
      ? apiRequest("PATCH", `/api/listings/${listing.id}`, data, adminHeaders).then(r => r.json())
      : apiRequest("POST", "/api/listings", data, adminHeaders).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/listings"] }); setOpen(false); onSuccess(); },
  });

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      ...form,
      year: form.year ? parseInt(form.year) : undefined,
      askingPrice: form.askingPrice ? parseFloat(form.askingPrice) : undefined,
      regularPrice: form.regularPrice ? parseFloat(form.regularPrice) : undefined,
      salePrice: form.salePrice ? parseFloat(form.salePrice) : undefined,
      batteryAh: form.batteryAh ? parseInt(form.batteryAh) : undefined,
      batteryAgeMonths: form.batteryAgeMonths ? parseInt(form.batteryAgeMonths) : undefined,
      seating: form.seating ? parseInt(form.seating) : undefined,
      warrantyMonths: form.warrantyMonths ? parseInt(form.warrantyMonths) : undefined,
      estimatedDeliveryCost: form.estimatedDeliveryCost ? parseFloat(form.estimatedDeliveryCost) : undefined,
      lifted: form.lifted === "true",
      streetLegalClaimed: form.streetLegalClaimed === "true",
      deliveryAvailable: form.deliveryAvailable === "true",
      deliveryIncluded: form.deliveryIncluded === "true",
    };
    mutation.mutate(payload);
  }

  const YNU = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unknown", label: "Unknown" }];
  const TF = [{ value: "true", label: "Yes" }, { value: "false", label: "No" }];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {listing
          ? <Button variant="outline" size="sm" className="gap-1.5" data-testid={`btn-edit-${listing.id}`}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          : <Button size="sm" className="gap-1.5" data-testid="btn-add-listing"><Plus className="h-3.5 w-3.5" /> Add Listing</Button>
        }
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{listing ? "Edit Listing" : "Add Listing"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Title *</Label>
              <Input required value={form.title} onChange={e => set("title", e.target.value)} placeholder="2022 Club Car Onward Lithium" data-testid="input-listing-title" />
            </div>
            <div><Label>Brand</Label><Input value={form.brand} onChange={e => set("brand", e.target.value)} data-testid="input-listing-brand" /></div>
            <div><Label>Model</Label><Input value={form.model} onChange={e => set("model", e.target.value)} data-testid="input-listing-model" /></div>
            <div><Label>Year</Label><Input type="number" value={form.year} onChange={e => set("year", e.target.value)} /></div>
            <div><Label>City</Label><Input value={form.city} onChange={e => set("city", e.target.value)} /></div>
            <div>
              <Label>State</Label>
              <Select value={form.state} onValueChange={v => set("state", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FL">Florida</SelectItem>
                  <SelectItem value="GA">Georgia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Asking Price</Label><Input type="number" value={form.askingPrice} onChange={e => set("askingPrice", e.target.value)} data-testid="input-listing-price" /></div>
            <div><Label>Regular Price</Label><Input type="number" value={form.regularPrice} onChange={e => set("regularPrice", e.target.value)} /></div>
            <div><Label>Sale Price</Label><Input type="number" value={form.salePrice} onChange={e => set("salePrice", e.target.value)} /></div>
            <div>
              <Label>Seller Type</Label>
              <Select value={form.sellerType} onValueChange={v => set("sellerType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dealer">Dealer</SelectItem>
                  <SelectItem value="private">Private Seller</SelectItem>
                  <SelectItem value="retail">Retail / Costco</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source Type</Label>
              <Select value={form.sourceType} onValueChange={v => set("sourceType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_manual">Admin Manual</SelectItem>
                  <SelectItem value="dealer_direct">Dealer Direct</SelectItem>
                  <SelectItem value="private_direct">Private Direct</SelectItem>
                  <SelectItem value="dealer_csv">Dealer CSV</SelectItem>
                  <SelectItem value="retail_manual">Retail Manual</SelectItem>
                  <SelectItem value="retail_csv">Retail CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Battery Type</Label>
              <Select value={form.batteryType} onValueChange={v => set("batteryType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lithium">Lithium</SelectItem>
                  <SelectItem value="lead_acid">Lead-Acid</SelectItem>
                  <SelectItem value="gas">Gas</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Battery Ah</Label><Input type="number" value={form.batteryAh} onChange={e => set("batteryAh", e.target.value)} /></div>
            <div><Label>Battery Age (months)</Label><Input type="number" value={form.batteryAgeMonths} onChange={e => set("batteryAgeMonths", e.target.value)} /></div>
            <div><Label>Seating</Label><Input type="number" value={form.seating} onChange={e => set("seating", e.target.value)} /></div>
            <div>
              <Label>Lifted</Label>
              <Select value={form.lifted} onValueChange={v => set("lifted", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TF.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Street Legal Claimed</Label>
              <Select value={form.streetLegalClaimed} onValueChange={v => set("streetLegalClaimed", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TF.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Charger Included</Label>
              <Select value={form.chargerIncluded} onValueChange={v => set("chargerIncluded", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{YNU.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Warranty Included</Label>
              <Select value={form.warrantyIncluded} onValueChange={v => set("warrantyIncluded", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{YNU.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Warranty Provider</Label>
              <Select value={form.warrantyProvider} onValueChange={v => set("warrantyProvider", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dealer">Dealer</SelectItem>
                  <SelectItem value="manufacturer">Manufacturer</SelectItem>
                  <SelectItem value="third_party">Third Party</SelectItem>
                  <SelectItem value="retailer">Retailer</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Warranty Months</Label><Input type="number" value={form.warrantyMonths} onChange={e => set("warrantyMonths", e.target.value)} /></div>
            <div>
              <Label>Battery Warranty</Label>
              <Select value={form.batteryWarrantyIncluded} onValueChange={v => set("batteryWarrantyIncluded", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{YNU.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Delivery Available</Label>
              <Select value={form.deliveryAvailable} onValueChange={v => set("deliveryAvailable", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TF.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Delivery Included</Label>
              <Select value={form.deliveryIncluded} onValueChange={v => set("deliveryIncluded", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TF.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Delivery Cost ($)</Label><Input type="number" value={form.estimatedDeliveryCost} onChange={e => set("estimatedDeliveryCost", e.target.value)} /></div>
            {form.sellerType === "retail" && <>
              <div><Label>Retailer Name</Label><Input value={form.retailerName} onChange={e => set("retailerName", e.target.value)} /></div>
              <div><Label>Last Verified Date</Label><Input type="date" value={form.lastVerifiedAt} onChange={e => set("lastVerifiedAt", e.target.value)} /></div>
              <div><Label>Availability Status</Label><Input value={form.availabilityStatus} onChange={e => set("availabilityStatus", e.target.value)} /></div>
            </>}
            <div className="col-span-2"><Label>Image URL</Label><Input value={form.imageUrl} onChange={e => set("imageUrl", e.target.value)} placeholder="https://…" /></div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="btn-save-listing">
              {mutation.isPending ? "Saving…" : "Save Listing"}
            </Button>
          </DialogFooter>
          {mutation.isError && <p className="text-sm text-red-600">{(mutation.error as any)?.message}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── CSV Import ────────────────────────────────────────────────────────────────
function CsvImport({ adminToken }: { adminToken: string }) {
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<{ imported: number; errors: any[] } | null>(null);
  const qc = useQueryClient();

  const adminHeaders = { "x-admin-token": adminToken };
  const mutation = useMutation({
    mutationFn: (csvText: string) =>
      apiRequest("POST", "/api/admin/csv-import", { csvText }, adminHeaders).then(r => r.json()),
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["/api/admin/listings"] });
    },
  });

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string);
    reader.readAsText(file);
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Upload CSV File</Label>
        <Input type="file" accept=".csv" onChange={handleFileUpload} className="mt-1" data-testid="input-csv-file" />
      </div>
      <div>
        <Label>Or Paste CSV Content</Label>
        <Textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={8} placeholder="title,price,brand,model,city,state,battery_type,seating,warranty_included,delivery_available..." className="font-mono text-xs mt-1" data-testid="input-csv-text" />
      </div>
      <Button onClick={() => mutation.mutate(csvText)} disabled={!csvText || mutation.isPending} className="gap-2" data-testid="btn-import-csv">
        <Upload className="h-4 w-4" /> {mutation.isPending ? "Importing…" : "Import CSV"}
      </Button>

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-700">{result.imported} listing{result.imported !== 1 ? "s" : ""} imported successfully.</span>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3 space-y-1">
              <p className="text-xs font-semibold text-red-700">{result.errors.length} row{result.errors.length !== 1 ? "s" : ""} with errors:</p>
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-600">Row {err.row}: {err.field} — {err.message}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-muted rounded p-3">
        <p className="text-xs font-semibold mb-2">Required CSV columns:</p>
        <p className="text-xs text-muted-foreground font-mono">title, price, brand, model, city, state, battery_type, seating, seller_type, source_type</p>
        <p className="text-xs text-muted-foreground mt-1">Optional: regular_price, sale_price, year, battery_ah, battery_age_months, warranty_included, warranty_months, charger_included, delivery_available, delivery_cost, image_url, source_url, description, last_verified_at</p>
      </div>
    </div>
  );
}

// ── Coverage Audit Tab ──────────────────────────────────────────────────────────

type CoverageRow = {
  dealer_slug: string;
  inventory_url: string | null;
  discovered_count: number;
  pending_imports_count: number;
  public_listings_count: number;
  duplicate_count: number;
  skipped_count: number;
  pagination_detected: boolean;
  pages_visited: number;
  load_more_detected: boolean;
  scroll_required: boolean;
  detail_pages_visited: number;
  source_page_type: string | null;
  coverage_status: string;
  valuation_review_needed: boolean;
  adapter_notes: string | null;
  scanned_at: string | null;
  // Google validation
  google_place_id?: string | null;
  google_verified_name?: string | null;
  google_address?: string | null;
  google_phone?: string | null;
  google_rating?: number | null;
  google_review_count?: number | null;
  google_verified_at?: string | null;
  google_match_score?: string | null;
  // Site platform
  site_platform?: string | null;
  site_platform_notes?: string | null;
  is_duplicate_of?: string | null;
};

const COVERAGE_STATUS_META: Record<string, { label: string; color: string }> = {
  verified_full_inventory:  { label: "Verified Full",         color: "bg-green-100 text-green-800 border-green-200"   },
  partial_inventory:        { label: "Partial",               color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  featured_only:            { label: "Featured Only",         color: "bg-orange-100 text-orange-800 border-orange-200" },
  pagination_incomplete:    { label: "Pagination Incomplete", color: "bg-orange-100 text-orange-800 border-orange-200" },
  location_filter_needed:   { label: "Filter Needed",         color: "bg-blue-100 text-blue-800 border-blue-200"       },
  browser_required:         { label: "Browser Required",      color: "bg-purple-100 text-purple-800 border-purple-200" },
  adapter_error:            { label: "Adapter Error",         color: "bg-red-100 text-red-800 border-red-200"          },
  needs_manual_review:      { label: "Needs Review",          color: "bg-gray-100 text-gray-600 border-gray-200"       },
};

function CoverageStatusBadge({ status }: { status: string }) {
  const meta = COVERAGE_STATUS_META[status] || COVERAGE_STATUS_META["needs_manual_review"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function CoverageAudit({ adminToken }: { adminToken: string }) {
  const ADMIN_HEADERS = { "x-admin-token": adminToken };
  const { data: rows = [], isLoading, error, refetch, isFetching } = useQuery<CoverageRow[]>({
    queryKey: ["/api/admin/coverage-audit"],
    queryFn: () => apiRequest("GET", "/api/admin/coverage-audit", undefined, ADMIN_HEADERS).then(r => r.json()),
  });

  const [isValidatingAll, setIsValidatingAll] = useState(false);
  const [validatingSlug, setValidatingSlug] = useState<string | null>(null);

  const handleValidateAll = async () => {
    setIsValidatingAll(true);
    try {
      await apiRequest("POST", "/api/admin/dealers/bulk-google-validate", {}, ADMIN_HEADERS);
      await refetch();
    } catch (e) {
      console.error("Bulk validate failed", e);
    } finally {
      setIsValidatingAll(false);
    }
  };

  const handleValidateDealer = async (slug: string) => {
    setValidatingSlug(slug);
    try {
      await apiRequest("POST", `/api/admin/dealers/${slug}/google-validate`, {}, ADMIN_HEADERS);
      await refetch();
    } catch (e) {
      console.error("Validate failed for", slug, e);
    } finally {
      setValidatingSlug(null);
    }
  };

  const flaggedCount  = rows.filter(r => r.valuation_review_needed).length;
  const activeCount   = rows.filter(r => r.public_listings_count > 0).length;
  const reviewCount   = rows.filter(r => r.coverage_status === "needs_manual_review" || r.coverage_status === "adapter_error").length;

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading coverage data…</p>;
  if (error)     return <p className="text-sm text-red-600 py-4">Failed to load coverage data.</p>;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Sources w/ Listings",  value: activeCount,   color: "text-green-700" },
          { label: "Total Live Listings",  value: rows.reduce((s, r) => s + r.public_listings_count, 0), color: "text-foreground" },
          { label: "Valuation Review",     value: flaggedCount,  color: flaggedCount > 0 ? "text-orange-600" : "text-muted-foreground" },
          { label: "Needs Review",          value: reviewCount,   color: reviewCount > 0 ? "text-red-600" : "text-muted-foreground" },
        ].map(item => (
          <div key={item.label} className="bg-muted rounded-lg p-3">
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Valuation review banner */}
      {flaggedCount > 0 && (
        <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
          <TriangleAlert className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">
              Valuation review required on {flaggedCount} source{flaggedCount !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-orange-700 mt-0.5">
              All imported listings from these sources are rated <strong>great_deal</strong> — this may indicate a
              calibration issue. Reset deal_rating to <code>unknown</code> before publishing.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm border-collapse min-w-[960px]">
          <thead>
            <tr className="bg-muted text-left">
              {["Dealer", "Inventory URL", "Discovered", "Pending", "Live", "Dups",
                "Coverage Status", "Page Type", "Pagination", "Valuation Flag",
                "Last Scanned", "Adapter Notes",
                "Google Match", "Address", "Phone", "Site Platform", "Duplicate", "Actions"].map(h => (
                <th key={h} className="p-2 border border-border font-semibold text-xs whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.dealer_slug}
                className={`odd:bg-white even:bg-gray-50 hover:bg-muted/50 transition-colors ${
                  row.valuation_review_needed ? "bg-orange-50 hover:bg-orange-100" : ""
                }`}
              >
                <td className="p-2 border border-border">
                  <p className="font-medium text-xs whitespace-nowrap">{row.dealer_slug}</p>
                </td>

                <td className="p-2 border border-border text-xs max-w-[180px]">
                  {row.inventory_url ? (
                    <a
                      href={row.inventory_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:underline"
                      title={row.inventory_url}
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[140px] block">{row.inventory_url.replace(/^https?:\/\//, "")}</span>
                    </a>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>

                <td className="p-2 border border-border text-xs text-center">{row.discovered_count || "—"}</td>
                <td className="p-2 border border-border text-xs text-center">
                  <span className={row.pending_imports_count > 0 ? "font-semibold text-blue-700" : ""}>
                    {row.pending_imports_count || "—"}
                  </span>
                </td>
                <td className="p-2 border border-border text-xs text-center">
                  <span className={row.public_listings_count > 0 ? "font-semibold text-green-700" : "text-muted-foreground"}>
                    {row.public_listings_count || "—"}
                  </span>
                </td>
                <td className="p-2 border border-border text-xs text-center text-muted-foreground">
                  {row.duplicate_count || "—"}
                </td>

                <td className="p-2 border border-border">
                  <CoverageStatusBadge status={row.coverage_status} />
                </td>

                <td className="p-2 border border-border text-xs text-muted-foreground">
                  {row.source_page_type ? row.source_page_type.replace(/_/g, " ") : "—"}
                </td>

                <td className="p-2 border border-border">
                  <div className="flex flex-col gap-0.5 text-xs">
                    {row.pagination_detected && (
                      <span className="text-purple-700 font-medium">paginated ({row.pages_visited}p)</span>
                    )}
                    {row.load_more_detected && <span className="text-blue-700">load-more</span>}
                    {row.scroll_required && <span className="text-orange-700">scroll</span>}
                    {!row.pagination_detected && !row.load_more_detected && !row.scroll_required && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </td>

                <td className="p-2 border border-border text-center">
                  {row.valuation_review_needed ? (
                    <span title="All listings = great_deal — review needed">
                      <TriangleAlert className="h-4 w-4 text-orange-500 inline" />
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">ok</span>
                  )}
                </td>

                <td className="p-2 border border-border text-xs text-muted-foreground whitespace-nowrap">
                  {row.scanned_at
                    ? new Date(row.scanned_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
                    : <span className="italic">not yet</span>
                  }
                </td>

                <td className="p-2 border border-border text-xs text-muted-foreground max-w-[200px]">
                  <span title={row.adapter_notes || ""}>{row.adapter_notes || "—"}</span>
                </td>

                {/* Google Match */}
                <td className="p-2 border border-border">
                  {(() => {
                    const score = row.google_match_score;
                    const colors: Record<string, string> = {
                      exact:              "bg-green-100 text-green-800 border-green-200",
                      likely:             "bg-teal-100 text-teal-800 border-teal-200",
                      partial:            "bg-yellow-100 text-yellow-800 border-yellow-200",
                      no_match:           "bg-red-100 text-red-800 border-red-200",
                      duplicate_place_id: "bg-orange-100 text-orange-800 border-orange-200",
                      no_api_key:         "bg-gray-100 text-gray-500 border-gray-200",
                    };
                    if (!score) return <span className="text-muted-foreground text-xs">—</span>;
                    return (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${colors[score] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
                        {score === "duplicate_place_id" ? "⚠ Dup" : score}
                      </span>
                    );
                  })()}
                </td>

                {/* Address */}
                <td className="p-2 border border-border text-xs text-muted-foreground max-w-[180px]">
                  <span title={row.google_address ?? ""}>{row.google_address ?? "—"}</span>
                </td>

                {/* Phone */}
                <td className="p-2 border border-border text-xs text-muted-foreground whitespace-nowrap">
                  {row.google_phone ?? "—"}
                </td>

                {/* Site Platform */}
                <td className="p-2 border border-border">
                  {(() => {
                    const p = row.site_platform;
                    const labels: Record<string, string> = {
                      dealer_spike:   "DealerSpike",
                      dealer_socket:  "DealerSocket",
                      lightspeed:     "Lightspeed",
                      cdk:            "CDK",
                      motility:       "Motility",
                      shopify:        "Shopify",
                      wix:            "Wix",
                      squarespace:    "Squarespace",
                      wordpress:      "WordPress",
                      webflow:        "Webflow",
                      custom:         "Custom",
                      unreachable:    "Unreachable",
                      unknown:        "Unknown",
                    };
                    const managed = ["dealer_spike","dealer_socket","lightspeed","cdk","motility"];
                    const builder = ["shopify","wix","squarespace","wordpress","webflow"];
                    let color = "bg-gray-100 text-gray-500 border-gray-200";
                    if (p && managed.includes(p)) color = "bg-blue-100 text-blue-800 border-blue-200";
                    else if (p && builder.includes(p)) color = "bg-purple-100 text-purple-800 border-purple-200";
                    else if (p === "custom") color = "bg-green-100 text-green-800 border-green-200";
                    else if (p === "unreachable") color = "bg-red-100 text-red-800 border-red-200";
                    if (!p || p === "unknown") return <span className="text-muted-foreground text-xs">—</span>;
                    return (
                      <span
                        title={row.site_platform_notes ?? ""}
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${color}`}
                      >
                        {labels[p] ?? p}
                      </span>
                    );
                  })()}
                </td>

                {/* Duplicate flag */}
                <td className="p-2 border border-border text-xs">
                  {row.is_duplicate_of ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border bg-orange-100 text-orange-800 border-orange-200">
                      ⚠ {row.is_duplicate_of}
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>

                {/* Per-row Validate */}
                <td className="p-2 border border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => handleValidateDealer(row.dealer_slug)}
                    disabled={validatingSlug === row.dealer_slug || isValidatingAll}
                  >
                    {validatingSlug === row.dealer_slug
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : "Validate"
                    }
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No coverage data yet. Run the DDL migration, then backfill dealer_coverage_log.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleValidateAll}
          disabled={isValidatingAll || isFetching}
          className="gap-1.5"
        >
          {isValidatingAll
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Validating…</>
            : <><CheckCircle className="h-3.5 w-3.5" /> Validate All</>
          }
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1.5"
        >
          {isFetching
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Refreshing…</>
            : <><RefreshCw className="h-3.5 w-3.5" /> Refresh</>
          }
        </Button>
      </div>
    </div>
  );
}

// ── Pending Imports Tab ───────────────────────────────────────────────────────

type PendingImport = {
  id: number;
  dealer_slug: string;
  title: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  asking_price: number | null;
  city: string | null;
  state: string | null;
  condition: string | null;
  image_url: string | null;
  source_url: string | null;
  status: string;
  found_at: string | null;
  notes: string | null;
};

function formatPendingPrice(p: number | null) {
  if (!p) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(p);
}

function PendingImports({ adminToken }: { adminToken: string }) {
  const ADMIN_HEADERS = { "x-admin-token": adminToken };
  const qc = useQueryClient();
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ approved: number; failed: number; total: number } | null>(null);
  const [filterDealer, setFilterDealer] = useState<string>("all");
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const { data: rows = [], isLoading, error, refetch, isFetching } = useQuery<PendingImport[]>({
    queryKey: ["/api/admin/pending-imports"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/admin/pending-imports?status=pending&limit=1000", undefined, ADMIN_HEADERS);
      const total = r.headers.get("x-total-count");
      if (total) setTotalCount(parseInt(total));
      return r.json();
    },
  });

  const dealers = Array.from(new Set(rows.map(r => r.dealer_slug))).sort();
  // Count per dealer from rows (may be partial if totalCount > 1000)
  const dealerCounts = dealers.reduce((acc, d) => {
    acc[d] = rows.filter(r => r.dealer_slug === d).length;
    return acc;
  }, {} as Record<string, number>);
  const filtered = filterDealer === "all" ? rows : rows.filter(r => r.dealer_slug === filterDealer);
  const displayTotal = totalCount ?? rows.length;

  async function handleAction(id: number, action: "approve" | "reject") {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      await apiRequest("PATCH", `/api/admin/pending-imports/${id}`, { action }, ADMIN_HEADERS);
      qc.invalidateQueries({ queryKey: ["/api/admin/pending-imports"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/inventory-reconciliation"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/listings"] });
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  // Calls bulk-approve-all — server-side paginates, no ID list needed
  async function handleBulkApprove() {
    setBulkRunning(true);
    setBulkResult(null);
    try {
      const payload = filterDealer === "all" ? {} : { dealer_slug: filterDealer };
      const res = await apiRequest(
        "POST", "/api/admin/pending-imports/bulk-approve-all",
        payload, ADMIN_HEADERS
      );
      const result = await res.json();
      setBulkResult(result);
      setTotalCount(null);
      qc.invalidateQueries({ queryKey: ["/api/admin/pending-imports"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/inventory-reconciliation"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/listings"] });
    } finally {
      setBulkRunning(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading pending imports…
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600 py-4">Failed to load pending imports.</p>;
  }

  return (
    <div className="space-y-4">

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {displayTotal === 0
              ? "No pending imports."
              : <><strong>{displayTotal}</strong> listing{displayTotal !== 1 ? "s" : ""} awaiting review</>}
          </p>
          {dealers.length > 1 && (
            <select
              value={filterDealer}
              onChange={e => setFilterDealer(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-background"
            >
              <option value="all">All dealers ({displayTotal})</option>
              {dealers.map(d => (
                <option key={d} value={d}>{d} ({dealerCounts[d]})</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
          {displayTotal > 0 && (
            <Button
              size="sm"
              onClick={handleBulkApprove}
              disabled={bulkRunning}
              className="gap-1.5 bg-green-700 hover:bg-green-800 text-white"
              data-testid="btn-bulk-approve"
            >
              {bulkRunning
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Approving…</>
                : <><CheckCheck className="h-3.5 w-3.5" /> Approve {filterDealer === "all" ? `All ${displayTotal}` : `${dealerCounts[filterDealer] ?? 0} (${filterDealer})`}</>
              }
            </Button>
          )}
        </div>
      </div>

      {/* Bulk result banner */}
      {bulkResult && (
        <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
          bulkResult.failed === 0
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-amber-50 border-amber-200 text-amber-800"
        }`}>
          {bulkResult.failed === 0
            ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
            : <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />}
          <p>
            <strong>{bulkResult.approved}</strong> approved
            {bulkResult.failed > 0 && <>, <strong>{bulkResult.failed}</strong> failed — check server logs</>}.
          </p>
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm">
          <CheckCircle className="h-8 w-8 mb-2 text-green-500" />
          <p>No pending imports. All caught up.</p>
        </div>
      )}

      {/* Mobile: card view */}
      {filtered.length > 0 && (
        <>
          <div className="sm:hidden space-y-3">
            {filtered.map(row => {
              const busy = processingIds.has(row.id);
              return (
                <div key={row.id} className="border border-border rounded-lg p-3 bg-white space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{row.title}</p>
                      <p className="text-xs text-muted-foreground">{row.dealer_slug} · {[row.city, row.state].filter(Boolean).join(", ") || "—"}</p>
                    </div>
                    {row.image_url && (
                      <img src={row.image_url} alt="" className="h-12 w-16 object-cover rounded shrink-0" onError={e => (e.currentTarget.style.display = "none")} />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatPendingPrice(row.asking_price)}</span>
                    {row.year && <span>{row.year}</span>}
                    {row.condition && <span className="capitalize">{row.condition}</span>}
                    {row.source_url && (
                      <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5">
                        <Eye className="h-3 w-3" /> View
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy} onClick={() => handleAction(row.id, "approve")}
                      className="flex-1 gap-1 bg-green-700 hover:bg-green-800 text-white">
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} Approve
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => handleAction(row.id, "reject")}
                      className="flex-1 gap-1 text-red-600 border-red-200 hover:bg-red-50">
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table view */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-muted text-left text-xs">
                  {["Image", "Title", "Dealer", "Location", "Year", "Condition", "Price", "Found", "Source", "Actions"].map(h => (
                    <th key={h} className="p-2 border border-border font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const busy = processingIds.has(row.id);
                  return (
                    <tr key={row.id} className="odd:bg-white even:bg-gray-50 hover:bg-muted/40 transition-colors">
                      <td className="p-2 border border-border">
                        {row.image_url
                          ? <img src={row.image_url} alt="" className="h-10 w-14 object-cover rounded"
                              onError={e => (e.currentTarget.style.display = "none")} />
                          : <div className="h-10 w-14 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">—</div>
                        }
                      </td>
                      <td className="p-2 border border-border max-w-[200px]">
                        <p className="font-medium truncate text-xs">{row.title}</p>
                        {row.notes && <p className="text-xs text-muted-foreground truncate">{row.notes}</p>}
                      </td>
                      <td className="p-2 border border-border text-xs font-medium whitespace-nowrap">{row.dealer_slug}</td>
                      <td className="p-2 border border-border text-xs whitespace-nowrap">
                        {[row.city, row.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="p-2 border border-border text-xs text-center">{row.year || "—"}</td>
                      <td className="p-2 border border-border text-xs capitalize">{row.condition || "—"}</td>
                      <td className="p-2 border border-border text-xs font-medium whitespace-nowrap">{formatPendingPrice(row.asking_price)}</td>
                      <td className="p-2 border border-border text-xs text-muted-foreground whitespace-nowrap">
                        {row.found_at ? new Date(row.found_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </td>
                      <td className="p-2 border border-border text-xs">
                        {row.source_url
                          ? <a href={row.source_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:underline">
                              <ExternalLink className="h-3 w-3" /> View
                            </a>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="p-2 border border-border">
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" disabled={busy} onClick={() => handleAction(row.id, "approve")}
                            className="gap-1 bg-green-700 hover:bg-green-800 text-white text-xs h-7 px-2"
                            data-testid={`btn-approve-${row.id}`}>
                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => handleAction(row.id, "reject")}
                            className="gap-1 text-red-600 border-red-200 hover:bg-red-50 text-xs h-7 px-2"
                            data-testid={`btn-reject-${row.id}`}>
                            <XCircle className="h-3 w-3" /> Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Admin Page ────────────────────────────────────────────────────────────
export default function Admin() {
  const { authed, adminToken, password, setPassword, login, error: authError, loading: authLoading } = useAdminAuth();
  const ADMIN_HEADERS = { "x-admin-token": adminToken };
  const qc = useQueryClient();

  const { data: listings = [], isLoading: listingsLoading } = useQuery<Listing[]>({
    queryKey: ["/api/admin/listings"],
    queryFn: () => apiRequest("GET", "/api/admin/listings", undefined, ADMIN_HEADERS).then(r => r.json()),
    enabled: authed,
  });

  const { data: dealers = [] } = useQuery<Dealer[]>({
    queryKey: ["/api/dealers"],
    enabled: authed,
  });

  const { data: inventorySources = [] } = useQuery<InventorySource[]>({
    queryKey: ["/api/inventory-sources"],
    queryFn: () => apiRequest("GET", "/api/inventory-sources", undefined, ADMIN_HEADERS).then(r => r.json()),
    enabled: authed,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/listings/${id}`, undefined, ADMIN_HEADERS).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/listings"] }),
  });

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader><CardTitle>Admin Portal</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Label>Admin Password</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              placeholder="Enter admin password"
              data-testid="input-admin-password"
            />
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            <Button onClick={login} disabled={authLoading} className="w-full" data-testid="btn-admin-login">{authLoading ? "Signing in…" : "Sign In"}</Button>
            
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Admin Portal</h1>
            <p className="text-sm text-muted-foreground">GolfCartIQ listing and data management</p>
          </div>
          <div className="flex gap-2">
            <ListingFormDialog onSuccess={() => {}} adminToken={adminToken} />
          </div>
        </div>

        <Tabs defaultValue="listings">
          <TabsList className="mb-6 flex overflow-x-auto whitespace-nowrap w-full">
            <TabsTrigger value="listings" data-testid="tab-listings">All Listings ({listings.length})</TabsTrigger>
            <TabsTrigger value="csv" data-testid="tab-csv">CSV Import</TabsTrigger>
            <TabsTrigger value="dealers" data-testid="tab-dealers">Dealers ({dealers.length})</TabsTrigger>
            <TabsTrigger value="sources" data-testid="tab-sources">Inventory Sources</TabsTrigger>
            <TabsTrigger value="coverage" data-testid="tab-coverage">Coverage Audit</TabsTrigger>
            <TabsTrigger value="inventory" data-testid="tab-inventory">Inventory Gap</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">Pending Imports</TabsTrigger>
          </TabsList>

          {/* Listings Tab */}
          <TabsContent value="listings">
            {listingsLoading ? (
              <p className="text-sm text-muted-foreground">Loading listings…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted text-left">
                      {["ID", "Title", "City/State", "Price", "GolfCartIQ Value", "Deal", "Battery", "Seller", "Status", "Actions"].map(h => (
                        <th key={h} className="p-2 border border-border font-semibold text-xs whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((l) => (
                      <tr key={l.id} className="odd:bg-white even:bg-gray-50 hover:bg-muted/50 transition-colors" data-testid={`row-listing-${l.id}`}>
                        <td className="p-2 border border-border text-xs text-muted-foreground">{l.id}</td>
                        <td className="p-2 border border-border max-w-xs">
                          <p className="font-medium truncate">{l.title}</p>
                        </td>
                        <td className="p-2 border border-border text-xs">{l.city}, {l.state}</td>
                        <td className="p-2 border border-border text-xs">{formatPrice(l.askingPrice ?? l.salePrice)}</td>
                        <td className="p-2 border border-border text-xs">{formatPrice(l.cartiqEstimatedValue)}</td>
                        <td className="p-2 border border-border"><DealBadge rating={l.dealRating} /></td>
                        <td className="p-2 border border-border text-xs capitalize">{l.batteryType}</td>
                        <td className="p-2 border border-border text-xs capitalize">{l.sellerType}</td>
                        <td className="p-2 border border-border">
                          <Badge variant={l.status === "active" ? "default" : "secondary"} className="text-xs">{l.status}</Badge>
                        </td>
                        <td className="p-2 border border-border">
                          <div className="flex items-center gap-1">
                            <ListingFormDialog listing={l} onSuccess={() => {}} adminToken={adminToken} />
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => { if (confirm("Delete this listing?")) deleteMutation.mutate(l.id); }}
                              disabled={deleteMutation.isPending}
                              data-testid={`btn-delete-${l.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {listings.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-10">No listings yet. Add one above.</p>
                )}
              </div>
            )}
          </TabsContent>

          {/* CSV Tab */}
          <TabsContent value="csv">
            <Card>
              <CardHeader><CardTitle className="text-base">CSV Import</CardTitle></CardHeader>
              <CardContent><CsvImport adminToken={adminToken} /></CardContent>
            </Card>
          </TabsContent>

          {/* Dealers Tab */}
          <TabsContent value="dealers">
            <Card>
              <CardHeader><CardTitle className="text-base">Dealers</CardTitle></CardHeader>
              <CardContent>
                {dealers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No dealers configured.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted">
                          {["Name", "City/State", "Delivery", "Warranty"].map(h => (
                            <th key={h} className="p-2 border border-border text-left font-semibold text-xs">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dealers.map((d) => (
                          <tr key={d.id} className="odd:bg-white even:bg-gray-50" data-testid={`row-dealer-${d.id}`}>
                            <td className="p-2 border border-border font-medium">{d.name}</td>
                            <td className="p-2 border border-border text-xs">{d.city}, {d.state}</td>
                            <td className="p-2 border border-border text-xs">{d.deliveryAvailable ? `Yes (from $${d.deliveryBaseFee})` : "No"}</td>
                            <td className="p-2 border border-border text-xs">{d.defaultWarrantyIncluded ? `${d.defaultWarrantyMonths} months` : "No default"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Sources Tab */}
          <TabsContent value="sources">
            <Card>
              <CardHeader><CardTitle className="text-base">Inventory Sources & Connectors</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {inventorySources.map((src) => (
                    <div key={src.id} className="flex items-center justify-between p-3 border border-border rounded-lg" data-testid={`source-${src.id}`}>
                      <div>
                        <p className="font-medium text-sm">{src.name}</p>
                        <p className="text-xs text-muted-foreground">{src.sourceType}</p>
                        {src.allowedUseNotes && <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">{src.allowedUseNotes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {src.status === "active" && <Badge className="bg-green-100 text-green-800 border border-green-200">Active</Badge>}
                        {src.status === "not_configured" && <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Not Configured</Badge>}
                        {src.status === "disabled" && <Badge variant="secondary">Disabled</Badge>}
                      </div>
                    </div>
                  ))}
                  {inventorySources.length === 0 && <p className="text-sm text-muted-foreground">No sources configured.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coverage Audit Tab */}
          <TabsContent value="coverage">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dealer Coverage Audit</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Per-source inventory coverage status. Run DDL migration + backfill to populate log data.
                  Live listing/pending counts are always current from the DB.
                </p>
              </CardHeader>
              <CardContent>
                <CoverageAudit adminToken={adminToken} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Coverage Tab */}
          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inventory Gap Audit</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Full reconciliation: mapped dealers vs synced vs pending vs public search.
                  Requires adapter_run_log DDL migration to be applied.
                </p>
              </CardHeader>
              <CardContent>
                <InventoryCoverage adminToken={adminToken} />
              </CardContent>
            </Card>
          </TabsContent>
          {/* Pending Imports Tab */}
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pending Imports</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Review listings discovered by sync adapters. Approve to publish to public search, or reject to discard.
                </p>
              </CardHeader>
              <CardContent>
                <PendingImports adminToken={adminToken} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
