import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, HelpCircle, ArrowRight, ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DealBadge, BuyerScoreBadge, DeliveryCostBadge, DealDeltaBadge } from "@/components/Badges";
import { formatPrice, dealRatingLabel, parseJsonField } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import type { DealCheck } from "@/lib/types";
import { Link } from "wouter";

const SOURCE_PLATFORMS = [
  { value: "facebook_marketplace", label: "Facebook Marketplace" },
  { value: "craigslist", label: "Craigslist" },
  { value: "offerup", label: "OfferUp" },
  { value: "dealer_website", label: "Dealer Website" },
  { value: "costco_retailer", label: "Costco / Retailer" },
  { value: "other", label: "Other" },
];

const YNU = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Unknown" },
];

interface FormData {
  sourcePlatform: string;
  sourceUrl: string;
  askingPrice: string;
  year: string;
  brand: string;
  model: string;
  city: string;
  state: string;
  sellerType: string;
  retailerName: string;
  powerType: string;
  batteryType: string;
  batteryAh: string;
  batteryAgeMonths: string;
  seating: string;
  lifted: string;
  streetLegalClaimed: string;
  chargerIncluded: string;
  warrantyIncluded: string;
  warrantyProvider: string;
  warrantyMonths: string;
  batteryWarrantyIncluded: string;
  warrantyNotes: string;
  deliveryAvailable: string;
  deliveryCost: string;
  lastVerifiedAt: string;
  userConfirmedDisclosure: boolean;
}

const defaultForm: FormData = {
  sourcePlatform: "", sourceUrl: "", askingPrice: "", year: "", brand: "", model: "",
  city: "", state: "FL", sellerType: "private", retailerName: "",
  powerType: "electric", batteryType: "unknown", batteryAh: "", batteryAgeMonths: "",
  seating: "4", lifted: "unknown", streetLegalClaimed: "unknown",
  chargerIncluded: "unknown", warrantyIncluded: "unknown", warrantyProvider: "unknown",
  warrantyMonths: "", batteryWarrantyIncluded: "unknown", warrantyNotes: "",
  deliveryAvailable: "unknown", deliveryCost: "", lastVerifiedAt: "",
  userConfirmedDisclosure: false,
};

export default function DealChecker() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [result, setResult] = useState<DealCheck | null>(null);

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("POST", "/api/deal-checks", data).then((r) => r.json()),
    onSuccess: (data: DealCheck) => {
      setResult(data);
      setStep(3);
    },
  });

  function set(key: keyof FormData, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.userConfirmedDisclosure) return;
    mutation.mutate({
      sourcePlatform: form.sourcePlatform || "other",
      sourceUrl: form.sourceUrl || null,
      askingPrice: form.askingPrice ? parseFloat(form.askingPrice) : null,
      year: form.year ? parseInt(form.year) : null,
      brand: form.brand || null,
      model: form.model || null,
      city: form.city || null,
      state: form.state || null,
      sellerType: form.sellerType || "private",
      retailerName: form.retailerName || null,
      powerType: form.powerType || "unknown",
      batteryType: form.batteryType || "unknown",
      batteryAh: form.batteryAh ? parseInt(form.batteryAh) : null,
      batteryAgeMonths: form.batteryAgeMonths ? parseInt(form.batteryAgeMonths) : null,
      seating: form.seating ? parseInt(form.seating) : 4,
      lifted: form.lifted,
      streetLegalClaimed: form.streetLegalClaimed,
      chargerIncluded: form.chargerIncluded,
      warrantyIncluded: form.warrantyIncluded,
      warrantyProvider: form.warrantyProvider,
      warrantyMonths: form.warrantyMonths ? parseInt(form.warrantyMonths) : null,
      batteryWarrantyIncluded: form.batteryWarrantyIncluded,
      warrantyNotes: form.warrantyNotes || null,
      deliveryAvailable: form.deliveryAvailable,
      deliveryCost: form.deliveryCost ? parseFloat(form.deliveryCost) : null,
      lastVerifiedAt: form.lastVerifiedAt || null,
      userConfirmedDisclosure: form.userConfirmedDisclosure,
    });
  }

  const isFacebook = form.sourcePlatform === "facebook_marketplace";
  const isRetail = form.sourcePlatform === "costco_retailer";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Deal Checker</h1>
          <p className="text-sm text-muted-foreground mt-1">Get a private CartIQ analysis on any golf cart listing.</p>
        </div>

        {/* Progress steps */}
        {step < 3 && (
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${s <= step ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>{s}</div>
                <span className={`text-xs ${s <= step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s === 1 ? "Source" : "Details"}</span>
                {s < 2 && <div className="w-8 h-px bg-border" />}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Source */}
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Step 1: Where is this listing from?</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Listing Source</Label>
                <Select value={form.sourcePlatform} onValueChange={(v) => set("sourcePlatform", v)}>
                  <SelectTrigger data-testid="select-source-platform"><SelectValue placeholder="Select source…" /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_PLATFORMS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Listing URL <span className="text-muted-foreground">(optional)</span></Label>
                <Input value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} placeholder="https://…" data-testid="input-source-url" />
              </div>

              {/* Facebook disclosure */}
              {isFacebook && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3 text-sm text-amber-900">
                  <div className="flex gap-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
                    <div>
                      <p className="font-semibold mb-1">Important: Facebook Marketplace Notice</p>
                      <p>CartIQ does not automatically import, scrape, or republish Facebook Marketplace listings. Enter the listing details yourself. CartIQ analyzes the details you provide for your private shopping evaluation. The original listing remains on Facebook and may require Facebook login.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="fb-disclosure"
                      checked={form.userConfirmedDisclosure}
                      onCheckedChange={(v) => set("userConfirmedDisclosure", !!v)}
                      data-testid="checkbox-fb-disclosure"
                    />
                    <Label htmlFor="fb-disclosure" className="text-xs leading-relaxed cursor-pointer">
                      I understand and confirm I am submitting these details for my own shopping evaluation or have permission to share them.
                    </Label>
                  </div>
                </div>
              )}

              {/* Costco/retail disclosure */}
              {isRetail && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-900">
                  <div className="flex gap-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-purple-700" />
                    <p>CartIQ does not guarantee retailer price or availability. Retail prices, availability, shipping, delivery, warranty, and state eligibility may change. Verify all details on the retailer site before purchase.</p>
                  </div>
                </div>
              )}

              {/* Set disclosure to true for non-Facebook sources */}
              {!isFacebook && (
                <input type="hidden" value="true" />
              )}

              <Button
                onClick={() => {
                  if (!isFacebook && !form.userConfirmedDisclosure) set("userConfirmedDisclosure", "true" as any);
                  setStep(2);
                }}
                disabled={!form.sourcePlatform || (isFacebook && !form.userConfirmedDisclosure)}
                className="w-full gap-2"
                data-testid="btn-next-step"
              >
                Next: Enter Details <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              <Card>
                <CardHeader><CardTitle className="text-base">Step 2: Cart Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Asking Price *</Label>
                      <Input type="number" value={form.askingPrice} onChange={(e) => set("askingPrice", e.target.value)} placeholder="$9,500" required data-testid="input-asking-price" />
                    </div>
                    <div>
                      <Label>Year</Label>
                      <Input type="number" value={form.year} onChange={(e) => set("year", e.target.value)} placeholder="2021" data-testid="input-year" />
                    </div>
                    <div>
                      <Label>Brand</Label>
                      <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Club Car" data-testid="input-brand" />
                    </div>
                    <div>
                      <Label>Model</Label>
                      <Input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="Onward" data-testid="input-model" />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Jacksonville" data-testid="input-city" />
                    </div>
                    <div>
                      <Label>State</Label>
                      <Select value={form.state} onValueChange={(v) => set("state", v)}>
                        <SelectTrigger data-testid="select-state"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FL">Florida</SelectItem>
                          <SelectItem value="GA">Georgia</SelectItem>
                          <SelectItem value="other">Other (limited data)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Battery & Power</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Power Type</Label>
                      <Select value={form.powerType} onValueChange={(v) => set("powerType", v)}>
                        <SelectTrigger data-testid="select-power-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="electric">Electric</SelectItem>
                          <SelectItem value="gas">Gas</SelectItem>
                          <SelectItem value="unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Battery Type</Label>
                      <Select value={form.batteryType} onValueChange={(v) => set("batteryType", v)}>
                        <SelectTrigger data-testid="select-battery-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lithium">Lithium</SelectItem>
                          <SelectItem value="lead_acid">Lead-Acid</SelectItem>
                          <SelectItem value="gas">Gas</SelectItem>
                          <SelectItem value="unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Battery Ah</Label>
                      <Input type="number" value={form.batteryAh} onChange={(e) => set("batteryAh", e.target.value)} placeholder="105" data-testid="input-battery-ah" />
                    </div>
                    <div>
                      <Label>Battery Age (months)</Label>
                      <Input type="number" value={form.batteryAgeMonths} onChange={(e) => set("batteryAgeMonths", e.target.value)} placeholder="24" data-testid="input-battery-age" />
                    </div>
                  </div>
                  <div>
                    <Label>Charger Included?</Label>
                    <Select value={form.chargerIncluded} onValueChange={(v) => set("chargerIncluded", v)}>
                      <SelectTrigger data-testid="select-charger-included"><SelectValue /></SelectTrigger>
                      <SelectContent>{YNU.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Cart Setup</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Seating Capacity</Label>
                      <Input type="number" value={form.seating} onChange={(e) => set("seating", e.target.value)} placeholder="4" data-testid="input-seating" />
                    </div>
                    <div>
                      <Label>Lifted?</Label>
                      <Select value={form.lifted} onValueChange={(v) => set("lifted", v)}>
                        <SelectTrigger data-testid="select-lifted"><SelectValue /></SelectTrigger>
                        <SelectContent>{YNU.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Street Legal Claimed?</Label>
                      <Select value={form.streetLegalClaimed} onValueChange={(v) => set("streetLegalClaimed", v)}>
                        <SelectTrigger data-testid="select-street-legal"><SelectValue /></SelectTrigger>
                        <SelectContent>{YNU.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Seller Type</Label>
                      <Select value={form.sellerType} onValueChange={(v) => set("sellerType", v)}>
                        <SelectTrigger data-testid="select-seller-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dealer">Dealer</SelectItem>
                          <SelectItem value="private">Private Seller</SelectItem>
                          <SelectItem value="retail">Retail</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Warranty</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Warranty Included?</Label>
                      <Select value={form.warrantyIncluded} onValueChange={(v) => set("warrantyIncluded", v)}>
                        <SelectTrigger data-testid="select-warranty-included"><SelectValue /></SelectTrigger>
                        <SelectContent>{YNU.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Battery Warranty?</Label>
                      <Select value={form.batteryWarrantyIncluded} onValueChange={(v) => set("batteryWarrantyIncluded", v)}>
                        <SelectTrigger data-testid="select-battery-warranty"><SelectValue /></SelectTrigger>
                        <SelectContent>{YNU.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {form.warrantyIncluded === "yes" && (
                      <div>
                        <Label>Warranty Months</Label>
                        <Input type="number" value={form.warrantyMonths} onChange={(e) => set("warrantyMonths", e.target.value)} placeholder="12" data-testid="input-warranty-months" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Delivery</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Delivery Available?</Label>
                      <Select value={form.deliveryAvailable} onValueChange={(v) => set("deliveryAvailable", v)}>
                        <SelectTrigger data-testid="select-delivery"><SelectValue /></SelectTrigger>
                        <SelectContent>{YNU.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {form.deliveryAvailable === "yes" && (
                      <div>
                        <Label>Delivery Cost ($)</Label>
                        <Input type="number" value={form.deliveryCost} onChange={(e) => set("deliveryCost", e.target.value)} placeholder="299" data-testid="input-delivery-cost" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Ensure disclosure set for non-Facebook */}
              {!isFacebook && !form.userConfirmedDisclosure && (
                <div className="flex items-start gap-3 bg-muted p-3 rounded-lg">
                  <Checkbox id="general-disclosure" checked={true} disabled />
                  <Label htmlFor="general-disclosure" className="text-xs text-muted-foreground">
                    I am submitting these details for my own shopping evaluation.
                  </Label>
                </div>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button type="submit" className="flex-1 gap-2" disabled={mutation.isPending} data-testid="btn-submit-deal-check">
                  {mutation.isPending ? "Analyzing…" : "Get My CartIQ Report"} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              {mutation.isError && (
                <p className="text-sm text-red-600">{(mutation.error as any)?.message || "Something went wrong. Try again."}</p>
              )}
            </div>
          </form>
        )}

        {/* Step 3: Report */}
        {step === 3 && result && (
          <div className="space-y-5" data-testid="deal-check-report">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-5 space-y-2">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Your Private CartIQ Report</p>
                <div className="flex items-center gap-3">
                  <DealBadge rating={result.dealRating} />
                  <BuyerScoreBadge score={result.buyerScore} />
                </div>
              </CardContent>
            </Card>

            {result.pilotWarning && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800 flex gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />{result.pilotWarning}
              </div>
            )}

            <Card>
              <CardHeader><CardTitle className="text-base">Pricing Analysis</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  ["Asking Price", formatPrice(result.askingPrice)],
                  ["CartIQ Estimated Value", formatPrice(result.cartiqEstimatedValue)],
                  ["Total Delivered Cost", result.totalDeliveredCost ? formatPrice(result.totalDeliveredCost) : "Delivery unknown"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
                <div className="border-t pt-2">
                  <DealDeltaBadge delta={result.dealDelta} />
                </div>
                <div className="text-xs text-muted-foreground border-t pt-2">
                  Suggested negotiation range: <strong>{formatPrice(result.negotiationLow)} – {formatPrice(result.negotiationHigh)}</strong>
                </div>
              </CardContent>
            </Card>

            {/* Battery / Charger / Warranty signals */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Battery Risk", value: result.batteryRisk || "unknown", colorKey: result.batteryRisk },
                { label: "Charger", value: result.chargerWarning ? "Warning" : "OK" },
                { label: "Warranty", value: result.warrantySignal === "warranty_included" ? "Included" : result.warrantySignal === "no_warranty" ? "None" : "Unknown" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="text-sm font-semibold capitalize">{value}</p>
                </div>
              ))}
            </div>

            {/* Red flags */}
            {(() => {
              const flags = parseJsonField<string>(result.redFlags);
              return flags.length > 0 ? (
                <Card className="border-red-200">
                  <CardHeader><CardTitle className="text-base text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Red Flags</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {flags.map((f, i) => (
                        <li key={i} className="text-sm text-red-700 bg-red-50 p-2.5 rounded flex gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null;
            })()}

            {/* Questions */}
            {(() => {
              const qs = parseJsonField<string>(result.questionsToAsk);
              return qs.length > 0 ? (
                <Card>
                  <CardHeader><CardTitle className="text-base">Questions to Ask</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {qs.map((q, i) => (
                        <li key={i} className="text-sm bg-blue-50 text-blue-800 p-2.5 rounded flex gap-2">
                          <HelpCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{q}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null;
            })()}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setStep(1); setForm(defaultForm); setResult(null); }} className="flex-1">Check Another Deal</Button>
              <Link href="/search"><a><Button className="flex-1">Search Listings</Button></a></Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
