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
import { Switch } from "@/components/ui/switch";
import { DealBadge } from "@/components/Badges";
import { formatPrice } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import type { Listing, Dealer, InventorySource } from "@/lib/types";
import InventoryCoverage from "@/pages/InventoryCoverage";

// The admin token is whatever the user typed — never a compiled constant.
// The server validates it; the client just forwards it.
const CORRECT_HASH = "0dcb739de87d7278"; // sha-256 prefix of "cartiq2024" for UI gating only
async function hashToken(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

// Simple admin auth gate
function useAdminAuth() {
  const [authed, setAuthed] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function login() {
    const h = await hashToken(password);
    if (h === CORRECT_HASH) {
      setAdminToken(password);
      setAuthed(true);
      setError("");
    } else {
      setError("Incorrect password.");
    }
  }

  return { authed, adminToken, password, setPassword, login, error };
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


// ── Blocked Sources Tab ──────────────────────────────────────────────────────

type BlockLogRow = {
  id: number;
  dealer_slug: string;
  dealer_name: string;
  dealer_name_live?: string;
  dealer_website_url?: string | null;
  inventory_url: string | null;
  block_reason: string;
  http_status: number | null;
  error_message: string | null;
  robots_txt_disallows: boolean;
  attempted_at: string | null;
  resolved: boolean;
  outreach_status: string | null;
  outreach_notes: string | null;
  updated_at: string | null;
};

const OUTREACH_OPTIONS = [
  { value: 'not_started',       label: 'Not Started' },
  { value: 'email_sent',        label: 'Email Sent' },
  { value: 'awaiting_response', label: 'Awaiting Response' },
  { value: 'in_progress',       label: 'In Progress' },
  { value: 'resolved',          label: 'Resolved' },
  { value: 'no_response',       label: 'No Response' },
];

const BLOCK_REASON_META: Record<string, { label: string; color: string }> = {
  http_403:         { label: '403 Forbidden',    color: 'bg-red-100 text-red-700 border-red-200'       },
  http_402:         { label: '402 Payment',      color: 'bg-orange-100 text-orange-700 border-orange-200' },
  http_401:         { label: '401 Auth',         color: 'bg-orange-100 text-orange-700 border-orange-200' },
  captcha_detected: { label: 'Captcha/Bot',      color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  robots_txt:       { label: 'robots.txt',       color: 'bg-blue-100 text-blue-700 border-blue-200'    },
  ssl_error:        { label: 'SSL Error',        color: 'bg-gray-100 text-gray-600 border-gray-200'    },
  dns_failure:      { label: 'DNS Dead',         color: 'bg-gray-100 text-gray-600 border-gray-200'    },
  timeout:          { label: 'Timeout',          color: 'bg-gray-100 text-gray-600 border-gray-200'    },
  empty_content:    { label: 'Empty Content',    color: 'bg-gray-100 text-gray-600 border-gray-200'    },
};

function BlockReasonBadge({ reason }: { reason: string }) {
  const meta = BLOCK_REASON_META[reason] || { label: reason, color: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function BlockedSources({ adminToken }: { adminToken: string }) {
  const ADMIN_HEADERS = { 'x-admin-token': adminToken };
  const queryClient = useQueryClient();
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery<BlockLogRow[]>({
    queryKey: ['blocked-sources'],
    queryFn: async () => {
      const r = await fetch('/api/admin/blocked-sources', { headers: ADMIN_HEADERS });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const patchRow = useMutation({
    mutationFn: async ({ slug, patch }: { slug: string; patch: Partial<BlockLogRow> }) => {
      const r = await fetch(`/api/admin/blocked-sources/${slug}`, {
        method: 'PATCH',
        headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blocked-sources'] }),
  });

  async function handleSeed() {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const r = await fetch('/api/admin/blocked-sources/seed', {
        method: 'POST',
        headers: ADMIN_HEADERS,
      });
      const json = await r.json();
      setSeedMsg(r.ok ? `Seeded ${json.seeded} dealers.` : `Error: ${json.error}`);
      refetch();
    } catch (e: any) {
      setSeedMsg(`Error: ${e.message}`);
    } finally {
      setSeeding(false);
    }
  }

  const activeCount  = rows.filter(r => !r.resolved).length;
  const resolvedCount = rows.filter(r => r.resolved).length;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-6 text-center">Loading blocked sources...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-red-600">{activeCount} active</span>
          {resolvedCount > 0 && <span className="ml-2 text-green-600">{resolvedCount} resolved</span>}
          <span className="ml-2">blocked dealer source{activeCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          {seedMsg && <span className="text-xs text-muted-foreground">{seedMsg}</span>}
          <Button
            size="sm"
            variant="outline"
            onClick={handleSeed}
            disabled={seeding}
            className="text-xs"
          >
            {seeding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Seed Known Blocked
          </Button>
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="text-xs">
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          No blocked sources logged yet. Click <strong>Seed Known Blocked</strong> to import the 11 known-blocked dealers.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const displayName = row.dealer_name_live || row.dealer_name || row.dealer_slug;
            const outreachMeta = OUTREACH_OPTIONS.find(o => o.value === (row.outreach_status || 'not_started'));
            const isEditing = editingSlug === row.dealer_slug;
            return (
              <div
                key={row.dealer_slug}
                className={`border rounded-lg p-4 space-y-3 ${row.resolved ? 'opacity-60 bg-gray-50' : 'bg-white'}`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{displayName}</span>
                      <BlockReasonBadge reason={row.block_reason} />
                      {row.http_status ? (
                        <span className="text-xs text-muted-foreground">HTTP {row.http_status}</span>
                      ) : null}
                      {row.resolved && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-green-100 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3" /> Resolved
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {row.inventory_url && (
                        <div>
                          <span className="font-medium">Inventory URL: </span>
                          <a href={row.inventory_url} target="_blank" rel="noreferrer"
                             className="text-blue-600 underline underline-offset-2 hover:text-blue-800">
                            {row.inventory_url}
                          </a>
                        </div>
                      )}
                      {row.dealer_website_url && (
                        <div>
                          <span className="font-medium">Dealer site: </span>
                          <a href={row.dealer_website_url} target="_blank" rel="noreferrer"
                             className="text-blue-600 underline underline-offset-2 hover:text-blue-800">
                            {row.dealer_website_url}
                          </a>
                        </div>
                      )}
                      {row.robots_txt_disallows && (
                        <div className="text-orange-600">⚠ robots.txt disallows crawling this path</div>
                      )}
                      {row.error_message && (
                        <div className="text-red-600 truncate max-w-lg" title={row.error_message}>
                          {row.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right shrink-0">
                    <div>Last attempt</div>
                    <div>{row.attempted_at ? new Date(row.attempted_at).toLocaleDateString() : '—'}</div>
                  </div>
                </div>

                {/* Outreach + notes row */}
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Outreach status dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Outreach:</span>
                    <Select
                      value={row.outreach_status || 'not_started'}
                      onValueChange={(val) =>
                        patchRow.mutate({ slug: row.dealer_slug, patch: { outreach_status: val } })
                      }
                    >
                      <SelectTrigger className="h-7 text-xs w-40">
                        <SelectValue>{outreachMeta?.label || 'Not Started'}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {OUTREACH_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Resolved toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Resolved:</span>
                    <Switch
                      checked={row.resolved}
                      onCheckedChange={(val) =>
                        patchRow.mutate({ slug: row.dealer_slug, patch: { resolved: val } })
                      }
                      className="scale-75 origin-left"
                    />
                  </div>

                  {/* Notes toggle */}
                  <button
                    className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800 ml-auto"
                    onClick={() => {
                      if (isEditing) {
                        setEditingSlug(null);
                      } else {
                        setEditingSlug(row.dealer_slug);
                        setNotesDraft(d => ({ ...d, [row.dealer_slug]: row.outreach_notes || '' }));
                      }
                    }}
                  >
                    {isEditing ? 'Cancel' : (row.outreach_notes ? 'Edit notes' : 'Add notes')}
                  </button>
                </div>

                {/* Notes editor */}
                {isEditing && (
                  <div className="space-y-2">
                    <Textarea
                      value={notesDraft[row.dealer_slug] ?? ''}
                      onChange={(e) => setNotesDraft(d => ({ ...d, [row.dealer_slug]: e.target.value }))}
                      placeholder="Outreach notes, contact info, follow-up status..."
                      className="text-xs min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          patchRow.mutate({
                            slug: row.dealer_slug,
                            patch: { outreach_notes: notesDraft[row.dealer_slug] ?? '' },
                          });
                          setEditingSlug(null);
                        }}
                      >
                        Save Notes
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7"
                        onClick={() => setEditingSlug(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                    {/* Saved notes preview */}
                    {row.outreach_notes && !isEditing && (
                      <p className="text-xs text-muted-foreground italic">{row.outreach_notes}</p>
                    )}
                  </div>
                )}

                {/* Existing notes (read view) */}
                {!isEditing && row.outreach_notes && (
                  <p className="text-xs text-muted-foreground italic border-t pt-2">{row.outreach_notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recommended fallback callout */}
      <div className="border border-blue-200 rounded-lg p-3 bg-blue-50 text-xs text-blue-800 space-y-1">
        <p className="font-medium">Recommended fallback actions for blocked dealers:</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700">
          <li><strong>403/Captcha:</strong> Contact dealer directly to request an inventory feed (CSV, XML, or API).</li>
          <li><strong>robots.txt:</strong> Respect the disallow — outreach only or skip permanently.</li>
          <li><strong>SSL/DNS:</strong> Verify dealer is still operating; may be out of business.</li>
          <li><strong>Once resolved:</strong> Toggle "Resolved" on — pipeline will resume normal fetch on next sync.</li>
        </ul>
      </div>
    </div>
  );
}

// ── Coverage Audit Tab ──────────────────────────────────────────────────────────

type CoverageRow = {
  dealer_slug: string;
  dealer_name?: string | null;
  city?: string | null;
  state?: string | null;
  sync_enabled?: boolean;
  browser_required?: boolean;
  last_discovery_status?: string | null;
  last_discovery_message?: string | null;
  last_discovery_at?: string | null;
  block_reason?: string | null;
  block_http_status?: number | null;
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
  blocked_public_crawl:     { label: "Blocked",               color: "bg-red-100 text-red-700 border-red-200"            },
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
  const blockedCount  = rows.filter(r => r.coverage_status === "blocked_public_crawl").length;
  const noScanCount   = rows.filter(r => !r.scanned_at && r.public_listings_count === 0).length;

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading coverage data…</p>;
  if (error)     return <p className="text-sm text-red-600 py-4">Failed to load coverage data.</p>;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: "Total Dealers",        value: rows.length,   color: "text-foreground" },
          { label: "w/ Live Listings",     value: activeCount,   color: "text-green-700" },
          { label: "Total Live Listings",  value: rows.reduce((s, r) => s + r.public_listings_count, 0), color: "text-foreground" },
          { label: "Blocked",              value: blockedCount,  color: blockedCount > 0 ? "text-red-600" : "text-muted-foreground" },
          { label: "Valuation Review",     value: flaggedCount,  color: flaggedCount > 0 ? "text-orange-600" : "text-muted-foreground" },
          { label: "Not Yet Scanned",      value: noScanCount,   color: noScanCount > 0 ? "text-gray-500" : "text-muted-foreground" },
        ].map(item => (
          <div key={item.label} className="bg-muted rounded-lg p-3">
            <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
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
                <td className="p-2 border border-border min-w-[160px]">
                  <p className="font-medium text-xs">{row.dealer_name || row.dealer_slug}</p>
                  {(row.city || row.state) && (
                    <p className="text-xs text-muted-foreground">{[row.city, row.state].filter(Boolean).join(", ")}</p>
                  )}
                  <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono">{row.dealer_slug}</p>
                  {row.last_discovery_status && row.last_discovery_status !== "ok" && row.last_discovery_status !== "no_new" && (
                    <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-xs font-medium border ${
                      row.last_discovery_status === "blocked_public_crawl" ? "bg-red-100 text-red-700 border-red-200" :
                      row.last_discovery_status === "error" ? "bg-red-100 text-red-700 border-red-200" :
                      row.last_discovery_status === "needs_browser" ? "bg-purple-100 text-purple-700 border-purple-200" :
                      "bg-gray-100 text-gray-600 border-gray-200"
                    }`}>
                      {row.last_discovery_status}
                    </span>
                  )}
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
  const { authed, adminToken, password, setPassword, login, error: authError } = useAdminAuth();
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
            <Button onClick={login} className="w-full" data-testid="btn-admin-login">Sign In</Button>
            
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
            <TabsTrigger value="blocked" data-testid="tab-blocked">Blocked Sources</TabsTrigger>
            <TabsTrigger value="coverage" data-testid="tab-coverage">Coverage Audit</TabsTrigger>
            <TabsTrigger value="inventory" data-testid="tab-inventory">Inventory Gap</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">Pending Imports</TabsTrigger>
            <TabsTrigger value="algorithm" data-testid="tab-algorithm">Algorithm</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
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

          {/* Blocked Sources Tab */}
          <TabsContent value="blocked">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Blocked Dealer Sources</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Dealers where the public inventory page returned 403, a captcha wall, robots.txt denial, or a dead domain.
                  Track outreach status and mark resolved when an alternate feed is arranged.
                </p>
              </CardHeader>
              <CardContent>
                <BlockedSources adminToken={adminToken} />
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
          {/* Algorithm Tweaker Tab */}
          <TabsContent value="algorithm">
            <AlgorithmTweaker adminToken={adminToken} />
          </TabsContent>
          {/* Settings Tab */}
          <TabsContent value="settings">
            <SettingsPanel adminToken={adminToken} dealers={dealers} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Settings Panel ────────────────────────────────────────────────────────────
interface SiteSettingsData {
  defaultRadius: number;
  featuredDealers: Array<{
    dealerId: number;
    dealerName: string;
    cities: string[];
    priority: number;
  }>;
}

function SettingsPanel({ adminToken, dealers }: { adminToken: string; dealers: Dealer[] }) {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery<SiteSettingsData>({
    queryKey: ["/api/admin/site-settings"],
    queryFn: () =>
      fetch("/api/admin/site-settings", {
        headers: { "x-admin-token": adminToken },
      }).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<SiteSettingsData>) =>
      fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify(patch),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/site-settings"] }),
  });

  const [newFeaturedDealerId, setNewFeaturedDealerId] = useState<string>("");
  const [newFeaturedCities, setNewFeaturedCities] = useState<string>("all");
  const [newFeaturedPriority, setNewFeaturedPriority] = useState<string>("1");

  if (isLoading || !settings) return <p className="text-sm text-muted-foreground">Loading settings…</p>;

  function addFeaturedDealer() {
    const dealerId = parseInt(newFeaturedDealerId);
    if (!dealerId) return;
    const dealer = dealers.find(d => d.id === dealerId);
    if (!dealer) return;
    const cities = newFeaturedCities
      .split(",")
      .map(c => c.trim())
      .filter(Boolean);
    const updated = [
      ...(settings.featuredDealers ?? []).filter(fd => fd.dealerId !== dealerId),
      { dealerId, dealerName: dealer.name, cities, priority: parseInt(newFeaturedPriority) || 1 },
    ].sort((a, b) => a.priority - b.priority);
    saveMutation.mutate({ featuredDealers: updated });
    setNewFeaturedDealerId("");
    setNewFeaturedCities("all");
    setNewFeaturedPriority("1");
  }

  function removeFeaturedDealer(dealerId: number) {
    const updated = (settings.featuredDealers ?? []).filter(fd => fd.dealerId !== dealerId);
    saveMutation.mutate({ featuredDealers: updated });
  }

  return (
    <div className="space-y-6">
      {/* Default Radius */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search Defaults</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Controls default behavior for the distance filter on the search page.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Default radius: 25 miles</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                When enabled, the distance filter pre-fills to 25 mi when a user's saved location is detected.
                Disable to show "Any distance" by default.
              </p>
            </div>
            <Switch
              checked={settings.defaultRadius === 25}
              onCheckedChange={(checked) =>
                saveMutation.mutate({ defaultRadius: checked ? 25 : 0 })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Featured Dealers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Featured Dealers</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Dealers pinned to the top of the Hot Deals section on the homepage. Priority 1 = first.
            City can be "all" or comma-separated city names (e.g. "Jacksonville, Ocala").
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current featured dealers */}
          {(settings.featuredDealers ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No featured dealers configured.</p>
          ) : (
            <div className="space-y-2">
              {(settings.featuredDealers ?? []).map(fd => (
                <div key={fd.dealerId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <span className="text-sm font-medium">{fd.dealerName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      Priority {fd.priority} · Cities: {fd.cities.join(", ")}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive h-7 px-2 text-xs"
                    onClick={() => removeFeaturedDealer(fd.dealerId)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new featured dealer */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-medium mb-3">Add featured dealer</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs mb-1 block">Dealer</Label>
                <Select value={newFeaturedDealerId} onValueChange={setNewFeaturedDealerId}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select dealer" />
                  </SelectTrigger>
                  <SelectContent>
                    {dealers
                      .filter(d => !d.slug?.startsWith("__"))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(d => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name} — {d.city}, {d.state}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Cities (comma-sep, or "all")</Label>
                <Input
                  className="text-sm"
                  value={newFeaturedCities}
                  onChange={e => setNewFeaturedCities(e.target.value)}
                  placeholder="all"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Priority</Label>
                <div className="flex gap-2">
                  <Select value={newFeaturedPriority} onValueChange={setNewFeaturedPriority}>
                    <SelectTrigger className="text-sm flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1st</SelectItem>
                      <SelectItem value="2">2nd</SelectItem>
                      <SelectItem value="3">3rd</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={addFeaturedDealer}
                    disabled={!newFeaturedDealerId || saveMutation.isPending}
                    className="whitespace-nowrap"
                  >
                    {saveMutation.isPending ? "Saving…" : "Add"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Algorithm Tweaker ─────────────────────────────────────────────────────────
// Live editor for all pricing engine parameters. Changes are persisted to
// the pricing_config Supabase table and picked up on next reprice run.

const DEAL_RATING_DEFAULTS = {
  great_deal: -0.15,
  good_deal:  -0.05,
  fair_price:  0.05,
  high_price:  0.15,
};

const BRAND_BASE_DEFAULTS: Record<string, number> = {
  "Star EV": 26000, "Yamaha": 20500, "Atlas": 16500, "Epic": 16000,
  "Venom EV": 17000, "E-Z-GO": 14500, "Club Car": 14000, "Sivo": 15000,
  "Madjax": 14500, "DACH": 14500, "Bintelli": 14000, "ICON": 13400,
  "Cushman": 12600, "Advanced EV": 11000, "Evolution": 11000,
  "Teko": 11500, "Denago": 11000, "Verdi": 10000, "Honor": 10000,
  "GEM": 10000, "Bad Boy": 9500, "__budget__": 7500, "__unknown__": 8000,
};

const DEPRECIATION_DEFAULTS: Record<string, number> = {
  "2027": 1.05, "2026": 1.00, "2025": 0.90, "2024": 0.82, "2023": 0.75,
  "2022": 0.68, "2021": 0.62, "2020": 0.56, "2019": 0.50, "2018": 0.44,
  "pre_2018": 0.38, "unknown": 0.70,
};

const FEATURE_DEFAULTS = {
  lithium_bonus: 1200, electric_bonus: 400, seating_6plus: 1500,
  seating_2: -500, lifted_bonus: 600, charger_bonus: 200,
  warranty_bonus: 300, dealer_new_premium: 1.03,
};

const GEO_DEFAULTS = {
  tier1_multiplier: 1.28, tier2_multiplier: 1.00, tier3_multiplier: 0.92,
  tier1_enabled: true, tier2_enabled: true, tier3_enabled: true,
};

const SCORE_DEFAULTS = {
  great_deal: 50, good_deal: 40, fair_price: 30,
  high_price: 15, over_market: 5, unknown: 22,
};

type ConfigSection = "thresholds" | "brand_bases" | "depreciation" | "feature_adjustments" | "geo_tiers" | "buyer_score_weights";

function AlgorithmTweaker({ adminToken }: { adminToken: string }) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<ConfigSection>("thresholds");
  const [previewPrice, setPreviewPrice] = useState("14000");
  const [previewIMV, setPreviewIMV]     = useState("14000");
  const [reScoreStatus, setReScoreStatus] = useState<string | null>(null);
  const [reScoreProgress, setReScoreProgress] = useState<{ processed: number; updated: number; total: number } | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<ConfigSection, string | null>>({
    thresholds: null, brand_bases: null, depreciation: null,
    feature_adjustments: null, geo_tiers: null, buyer_score_weights: null,
  });

  const { data: configData, isLoading } = useQuery<Record<string, { value: any; updated_at: string }>>({
    queryKey: ["/api/admin/pricing-config"],
    queryFn: () => fetch("/api/admin/pricing-config", { headers: { "x-admin-token": adminToken } }).then(r => r.json()),
  });

  // Local editable state — initialised from server, falls back to defaults
  const [thresholds, setThresholds] = useState({ ...DEAL_RATING_DEFAULTS });
  const [brandBases, setBrandBases]  = useState({ ...BRAND_BASE_DEFAULTS });
  const [depreciation, setDepreciation] = useState({ ...DEPRECIATION_DEFAULTS });
  const [features, setFeatures]     = useState({ ...FEATURE_DEFAULTS });
  const [geoTiers, setGeoTiers]     = useState({ ...GEO_DEFAULTS });
  const [scoreWeights, setScoreWeights] = useState({ ...SCORE_DEFAULTS });
  const [hydrated, setHydrated]     = useState(false);

  // Hydrate from server once
  if (configData && !hydrated) {
    if (configData.thresholds?.value)          setThresholds({ ...DEAL_RATING_DEFAULTS, ...configData.thresholds.value });
    if (configData.brand_bases?.value)         setBrandBases({ ...BRAND_BASE_DEFAULTS, ...configData.brand_bases.value });
    if (configData.depreciation?.value)        setDepreciation({ ...DEPRECIATION_DEFAULTS, ...configData.depreciation.value });
    if (configData.feature_adjustments?.value) setFeatures({ ...FEATURE_DEFAULTS, ...configData.feature_adjustments.value });
    if (configData.geo_tiers?.value)           setGeoTiers({ ...GEO_DEFAULTS, ...configData.geo_tiers.value });
    if (configData.buyer_score_weights?.value) setScoreWeights({ ...SCORE_DEFAULTS, ...configData.buyer_score_weights.value });
    setHydrated(true);
  }

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: any }) =>
      fetch("/api/admin/pricing-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ key, value }),
      }).then(r => r.json()),
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing-config"] });
      setSaveStatus(s => ({ ...s, [key]: "Saved" }));
      setTimeout(() => setSaveStatus(s => ({ ...s, [key]: null })), 2000);
    },
    onError: (_, { key }) => {
      setSaveStatus(s => ({ ...s, [key]: "Error saving" }));
    },
  });

  function saveSection(key: ConfigSection, value: any) {
    setSaveStatus(s => ({ ...s, [key]: "Saving…" }));
    saveMutation.mutate({ key, value });
  }

  // Live preview: compute deal rating from thresholds
  function previewRating(): { rating: string; delta: number; pct: number } {
    const price = parseFloat(previewPrice) || 0;
    const imv   = parseFloat(previewIMV)   || 0;
    if (!price || !imv) return { rating: "—", delta: 0, pct: 0 };
    const delta = price - imv;
    const pct   = delta / imv;
    let rating = "over_market";
    if (pct <= thresholds.great_deal) rating = "great_deal";
    else if (pct <= thresholds.good_deal)  rating = "good_deal";
    else if (pct <= thresholds.fair_price) rating = "fair_price";
    else if (pct <= thresholds.high_price) rating = "high_price";
    return { rating, delta, pct };
  }

  const preview = previewRating();

  const ratingColor: Record<string, string> = {
    great_deal:  "bg-emerald-100 text-emerald-800 border-emerald-200",
    good_deal:   "bg-green-100 text-green-800 border-green-200",
    fair_price:  "bg-blue-100 text-blue-800 border-blue-200",
    high_price:  "bg-amber-100 text-amber-800 border-amber-200",
    over_market: "bg-red-100 text-red-800 border-red-200",
    "—":         "bg-gray-100 text-gray-500 border-gray-200",
  };

  async function runReScore() {
    setReScoreStatus("Running…");
    setReScoreProgress(null);
    const CHUNK = 150;
    let offset = 0;
    let total = 0;
    let totalUpdated = 0;
    let totalProcessed = 0;
    try {
      while (true) {
        const res = await fetch("/api/admin/reprice-all", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
          body: JSON.stringify({ offset, limit: CHUNK }),
        });
        const data = await res.json();
        if (!res.ok || data.error) { setReScoreStatus(`Error: ${data.error || "unknown"}`); return; }
        total = data.total || total;
        totalUpdated   += data.updated   || 0;
        totalProcessed += data.processed || 0;
        offset += CHUNK;
        setReScoreProgress({ processed: totalProcessed, updated: totalUpdated, total });
        if (!data.hasMore) break;
      }
      setReScoreStatus(`Done — ${totalUpdated} of ${total} listings re-scored`);
    } catch (e: any) {
      setReScoreStatus(`Error: ${e.message}`);
    }
  }

  const SECTIONS: { key: ConfigSection; label: string; description: string }[] = [
    { key: "thresholds",          label: "Deal Rating Thresholds",  description: "% above/below IMV that triggers each rating badge" },
    { key: "geo_tiers",           label: "Geographic Tier Multipliers", description: "Price adjustment by market tier (Tier 1 = premium, Tier 3 = rural)" },
    { key: "feature_adjustments", label: "Feature Adjustments",    description: "Dollar premiums/discounts for battery, seating, warranty, etc." },
    { key: "depreciation",        label: "Year Depreciation",      description: "Multiplier per model year relative to new (2026 = 1.00)" },
    { key: "brand_bases",         label: "Brand Base Prices",      description: "Formula fallback baseline price per brand (used when no comps exist)" },
    { key: "buyer_score_weights", label: "Buyer Score Weights",    description: "Points contributed by each deal rating to the 0–100 Buyer Score" },
  ];

  if (isLoading) return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading pricing config…
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">Pricing Algorithm Tweaker</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Adjust deal rating thresholds, brand bases, depreciation curves, and geographic multipliers.
                Save each section individually, then run Re-Score to apply to all live listings.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={runReScore}
                disabled={reScoreStatus === "Running…"}
                className="whitespace-nowrap"
              >
                {reScoreStatus === "Running…"
                  ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Re-scoring…</>
                  : <><RefreshCw className="h-3 w-3 mr-1" /> Apply & Re-score All</>
                }
              </Button>
              {reScoreProgress && (
                <p className="text-xs text-muted-foreground">
                  {reScoreProgress.processed} / {reScoreProgress.total} processed · {reScoreProgress.updated} updated
                </p>
              )}
              {reScoreStatus && reScoreStatus !== "Running…" && (
                <p className={`text-xs font-medium ${reScoreStatus.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
                  {reScoreStatus}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Live Preview */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Live Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-xs">Asking Price ($)</Label>
              <Input value={previewPrice} onChange={e => setPreviewPrice(e.target.value)}
                className="w-32 mt-1 h-8 text-sm" placeholder="14000" />
            </div>
            <div>
              <Label className="text-xs">CartIQ IMV ($)</Label>
              <Input value={previewIMV} onChange={e => setPreviewIMV(e.target.value)}
                className="w-32 mt-1 h-8 text-sm" placeholder="14000" />
            </div>
            <div className="flex items-end gap-2">
              <div>
                <Label className="text-xs">Deal Rating</Label>
                <div className={`mt-1 px-3 py-1.5 rounded-full text-xs font-semibold border ${ratingColor[preview.rating]}`}>
                  {preview.rating.replace(/_/g, " ")}
                </div>
              </div>
              <div>
                <Label className="text-xs">Delta</Label>
                <div className="mt-1 text-sm font-mono font-medium text-muted-foreground">
                  {preview.pct !== 0 ? `${(preview.pct * 100).toFixed(1)}%` : "—"}
                  {preview.delta !== 0 && <span className="ml-1 text-xs">({preview.delta > 0 ? "+" : ""}{formatPrice(preview.delta)})</span>}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section Nav */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              activeSection === s.key
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:border-foreground/40"
            }`}
          >
            {s.label}
            {configData?.[s.key]?.updated_at && (
              <span className="ml-1.5 opacity-50">
                {new Date(configData[s.key].updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Section Editors */}
      {activeSection === "thresholds" && (
        <TweakerCard
          title="Deal Rating Thresholds"
          description="Each threshold is a decimal fraction — e.g. -0.15 means 15% below IMV triggers Great Deal. Boundaries are exclusive upper limits (great_deal < good_deal < fair_price < high_price)."
          onSave={() => saveSection("thresholds", thresholds)}
          saveStatus={saveStatus.thresholds}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.entries(thresholds) as [string, number][]).map(([key, val]) => (
              <TweakerRow key={key}
                label={key.replace(/_/g, " ")}
                sublabel={`≤ ${(val * 100).toFixed(0)}% vs IMV`}
                accent={key === "great_deal" ? "emerald" : key === "good_deal" ? "green" : key === "fair_price" ? "blue" : "amber"}
              >
                <input type="number" step="0.01" min="-0.5" max="0.5"
                  value={val}
                  onChange={e => setThresholds(t => ({ ...t, [key]: parseFloat(e.target.value) || 0 }))}
                  className="w-24 text-right text-sm font-mono border rounded px-2 py-1 bg-background"
                />
                <span className="text-xs text-muted-foreground ml-1">{(val * 100).toFixed(0)}%</span>
              </TweakerRow>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 border-t pt-3">
            Thresholds must be in ascending order: great_deal &lt; good_deal &lt; fair_price &lt; high_price. Anything above high_price = over_market.
          </p>
        </TweakerCard>
      )}

      {activeSection === "geo_tiers" && (
        <TweakerCard
          title="Geographic Tier Multipliers"
          description="Applied to the formula-based IMV when no comps exist. Tier 1 = premium markets (The Villages, Nocatee, Naples), Tier 2 = standard suburban/coastal, Tier 3 = rural/inland. Toggle off to bypass a tier and use 1.00× instead."
          onSave={() => saveSection("geo_tiers", geoTiers)}
          saveStatus={saveStatus.geo_tiers}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {([
              { key: "tier1_multiplier", enabledKey: "tier1_enabled", label: "Tier 1 — Premium", sublabel: "The Villages, Nocatee, Naples, Miami, Tampa", accent: "emerald" },
              { key: "tier2_multiplier", enabledKey: "tier2_enabled", label: "Tier 2 — Suburban/Coastal", sublabel: "Jacksonville, Orlando, Fort Myers, Daytona", accent: "blue" },
              { key: "tier3_multiplier", enabledKey: "tier3_enabled", label: "Tier 3 — Rural/Inland", sublabel: "Ocala, Palatka, Arcadia, Panhandle", accent: "amber" },
            ] as const).map(({ key, enabledKey, label, sublabel, accent }) => {
              const isEnabled = (geoTiers as any)[enabledKey] !== false;
              return (
                <TweakerRow key={key} label={label} sublabel={sublabel} accent={isEnabled ? (accent as any) : "gray"}>
                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => setGeoTiers(t => ({ ...t, [enabledKey]: !isEnabled }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                      isEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                    }`}
                    aria-label={isEnabled ? "Disable tier" : "Enable tier"}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                      isEnabled ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </button>
                  {/* Multiplier input */}
                  <input type="number" step="0.01" min="0.5" max="2.0"
                    value={(geoTiers as any)[key]}
                    disabled={!isEnabled}
                    onChange={e => setGeoTiers(t => ({ ...t, [key]: parseFloat(e.target.value) || 1 }))}
                    className={`w-20 text-right text-sm font-mono border rounded px-2 py-1 bg-background transition-opacity ${
                      isEnabled ? "opacity-100" : "opacity-40 cursor-not-allowed"
                    }`}
                  />
                  <span className={`text-xs ml-1 transition-opacity ${isEnabled ? "text-muted-foreground" : "text-muted-foreground/40"}`}>×</span>
                  {!isEnabled && (
                    <span className="text-xs text-muted-foreground/60 font-mono">(1.00)</span>
                  )}
                </TweakerRow>
              );
            })}
          </div>
          <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
            <strong>Current live data ratios:</strong> Tier 1 / Tier 2 = 1.28× (model updated to match) · Tier 3 / Tier 2 = 0.92×.
            Toggle a tier off to flatten it to 1.00× without losing the saved multiplier value.
          </div>
        </TweakerCard>
      )}

      {activeSection === "feature_adjustments" && (
        <TweakerCard
          title="Feature Adjustments"
          description="Dollar adjustments added to the formula base price. Applied after brand × year × condition multiplication. Only used in formula fallback — comps already reflect features."
          onSave={() => saveSection("feature_adjustments", features)}
          saveStatus={saveStatus.feature_adjustments}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: "lithium_bonus",       label: "Lithium battery bonus",      sublabel: "Added when power=electric + battery=lithium", prefix: "$" },
              { key: "electric_bonus",      label: "Electric (non-lithium)",     sublabel: "Added when electric but no lithium spec", prefix: "$" },
              { key: "seating_6plus",       label: "6+ seating bonus",           sublabel: "Added for 6-seat and larger models", prefix: "$" },
              { key: "seating_2",           label: "2-seat discount",            sublabel: "Applied for 2-seat models (negative)", prefix: "$" },
              { key: "lifted_bonus",        label: "Lifted bonus",               sublabel: "Added when lifted=yes", prefix: "$" },
              { key: "charger_bonus",       label: "Charger included bonus",     sublabel: "Added when charger_included=yes", prefix: "$" },
              { key: "warranty_bonus",      label: "Warranty included bonus",    sublabel: "Added when warranty_included=yes", prefix: "$" },
              { key: "dealer_new_premium",  label: "Dealer new-cart premium",    sublabel: "Multiplier for new carts from dealers (e.g. 1.03 = +3%)", prefix: "×" },
            ].map(({ key, label, sublabel, prefix }) => (
              <TweakerRow key={key} label={label} sublabel={sublabel} accent="gray">
                <span className="text-xs text-muted-foreground mr-1">{prefix}</span>
                <input type="number"
                  step={key === "dealer_new_premium" ? "0.01" : "50"}
                  value={(features as any)[key]}
                  onChange={e => setFeatures(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
                  className="w-24 text-right text-sm font-mono border rounded px-2 py-1 bg-background"
                />
              </TweakerRow>
            ))}
          </div>
        </TweakerCard>
      )}

      {activeSection === "depreciation" && (
        <TweakerCard
          title="Year Depreciation Multipliers"
          description="Applied to brand base price per model year. 2026 = 1.00 (baseline). These only affect formula fallback pricing — comp-based IMV uses actual market prices."
          onSave={() => saveSection("depreciation", depreciation)}
          saveStatus={saveStatus.depreciation}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Object.entries(depreciation).sort((a, b) => b[0].localeCompare(a[0])).map(([year, mult]) => (
              <div key={year} className="flex flex-col gap-1 p-3 border rounded-lg bg-background">
                <span className="text-xs font-medium text-muted-foreground">{year === "pre_2018" ? "Pre-2018" : year === "unknown" ? "Unknown" : year}</span>
                <div className="flex items-center gap-1">
                  <input type="number" step="0.01" min="0.1" max="1.5"
                    value={mult}
                    onChange={e => setDepreciation(d => ({ ...d, [year]: parseFloat(e.target.value) || 0.5 }))}
                    className="w-full text-right text-sm font-mono border rounded px-2 py-1 bg-background"
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1 mt-1">
                  <div className="bg-foreground rounded-full h-1 transition-all" style={{ width: `${Math.min(100, mult * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </TweakerCard>
      )}

      {activeSection === "brand_bases" && (
        <TweakerCard
          title="Brand Base Prices"
          description="Formula fallback baseline (new cart, 2026, no features). Used only when zero comps exist. __budget__ applies to unrecognized brands; __unknown__ to null brand listings."
          onSave={() => saveSection("brand_bases", brandBases)}
          saveStatus={saveStatus.brand_bases}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Object.entries(brandBases).sort((a, b) => b[1] - a[1]).map(([brand, base]) => (
              <div key={brand} className="flex flex-col gap-1 p-3 border rounded-lg bg-background">
                <span className="text-xs font-medium truncate" title={brand}>
                  {brand.startsWith("__") ? <em className="text-muted-foreground">{brand}</em> : brand}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">$</span>
                  <input type="number" step="500" min="1000" max="50000"
                    value={base}
                    onChange={e => setBrandBases(b => ({ ...b, [brand]: parseInt(e.target.value) || 0 }))}
                    className="w-full text-right text-sm font-mono border rounded px-2 py-1 bg-background"
                  />
                </div>
                <div className="w-full bg-muted rounded-full h-1 mt-1">
                  <div className="bg-foreground rounded-full h-1 transition-all" style={{ width: `${Math.min(100, (base / 28000) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </TweakerCard>
      )}

      {activeSection === "buyer_score_weights" && (
        <TweakerCard
          title="Buyer Score Weights"
          description="Points awarded for the deal-rating component of the 0–100 Buyer Score. Battery (20 pts), warranty (15 pts), charger (10 pts), and delivery (5 pts) components are fixed."
          onSave={() => saveSection("buyer_score_weights", scoreWeights)}
          saveStatus={saveStatus.buyer_score_weights}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.entries(scoreWeights) as [string, number][]).map(([rating, pts]) => (
              <TweakerRow key={rating} label={rating.replace(/_/g, " ")} sublabel={`${pts} pts of max 50`} accent="gray">
                <input type="number" step="1" min="0" max="50"
                  value={pts}
                  onChange={e => setScoreWeights(s => ({ ...s, [rating]: parseInt(e.target.value) || 0 }))}
                  className="w-20 text-right text-sm font-mono border rounded px-2 py-1 bg-background"
                />
                <span className="text-xs text-muted-foreground ml-1">pts</span>
              </TweakerRow>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-3 border-t pt-3">
            Deal rating contributes up to 50 pts. Remaining 50 pts come from battery (20), warranty (15), charger (10), delivery (5).
          </div>
        </TweakerCard>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TweakerCard({
  title, description, children, onSave, saveStatus
}: {
  title: string; description: string; children: React.ReactNode;
  onSave: () => void; saveStatus: string | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">{description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saveStatus && (
              <span className={`text-xs font-medium ${saveStatus === "Saved" ? "text-emerald-600" : saveStatus.startsWith("Error") ? "text-red-600" : "text-muted-foreground"}`}>
                {saveStatus}
              </span>
            )}
            <Button size="sm" onClick={onSave} disabled={saveStatus === "Saving…"}>
              {saveStatus === "Saving…" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Save Section
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function TweakerRow({
  label, sublabel, accent = "gray", children
}: {
  label: string; sublabel?: string; accent?: "emerald" | "green" | "blue" | "amber" | "gray";
  children: React.ReactNode;
}) {
  const accentBar: Record<string, string> = {
    emerald: "bg-emerald-400", green: "bg-green-400",
    blue: "bg-blue-400", amber: "bg-amber-400", gray: "bg-muted-foreground",
  };
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-background gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-1 h-8 rounded-full shrink-0 ${accentBar[accent]}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium capitalize">{label}</p>
          {sublabel && <p className="text-xs text-muted-foreground truncate">{sublabel}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">{children}</div>
    </div>
  );
}
