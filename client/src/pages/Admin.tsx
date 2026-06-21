import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Upload, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";
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

// The admin token is whatever the user typed — never a compiled constant.
// The server validates it; the client just forwards it.
const CORRECT_HASH = "b3fab09e4bb9d12c"; // sha-256 prefix of "cartiq2024" for UI gating only
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
            <p className="text-sm text-muted-foreground">CartIQ listing and data management</p>
          </div>
          <div className="flex gap-2">
            <ListingFormDialog onSuccess={() => {}} adminToken={adminToken} />
          </div>
        </div>

        <Tabs defaultValue="listings">
          <TabsList className="mb-6">
            <TabsTrigger value="listings" data-testid="tab-listings">Listings ({listings.length})</TabsTrigger>
            <TabsTrigger value="csv" data-testid="tab-csv">CSV Import</TabsTrigger>
            <TabsTrigger value="dealers" data-testid="tab-dealers">Dealers ({dealers.length})</TabsTrigger>
            <TabsTrigger value="sources" data-testid="tab-sources">Inventory Sources</TabsTrigger>
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
                      {["ID", "Title", "City/State", "Price", "CartIQ Value", "Deal", "Battery", "Seller", "Status", "Actions"].map(h => (
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
        </Tabs>
      </div>
    </div>
  );
}
