import { setSEO } from "@/lib/seo";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import { SlidersHorizontal, X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ListingCard } from "@/components/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Listing } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";

// ─── Constants ────────────────────────────────────────────────────────────────

const BRANDS = [
  "Bintelli",
  "Club Car",
  "Cushman",
  "DACH",
  "Denago EV",
  "E-Z-GO",
  "Epic",
  "Evolution",
  "GEM",
  "ICON",
  "MadJax",
  "Sierra",
  "Sivo",
  "Star EV",
  "Teko EV",
  "Verdi",
  "Yamaha",
  "Other",
];
const STATES = [{ label: "Florida", value: "FL" }, { label: "Georgia", value: "GA" }];
const SELLER_TYPES = [
  { label: "Dealer", value: "dealer" },
  { label: "Private Seller", value: "private" },
  { label: "Retail / Costco", value: "retail" },
];
const SORT_OPTIONS = [
  { label: "Best Match", value: "best_match" },
  { label: "Lowest Price", value: "lowest_cost" },
  { label: "Best Deal", value: "best_deal" },
  { label: "Newest", value: "newest" },
  { label: "Highest Buyer Score", value: "buyer_score" },
  { label: "Warranty Included", value: "warranty" },
];
const RADIUS_OPTIONS = [
  { label: "10 miles", value: "10" },
  { label: "25 miles", value: "25" },
  { label: "50 miles", value: "50" },
  { label: "100 miles", value: "100" },
];

// ─── Zip → lat/lng lookup (FL + GA, common zips) ─────────────────────────────
// Haversine distance in miles
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Zip centroid lookup — covers FL + GA zip codes
// Format: zip -> [lat, lng]
const ZIP_CENTROIDS: Record<string, [number, number]> = {
  // Florida — major postal areas
  "32004": [29.956, -81.524], "32034": [30.669, -81.463], "32080": [29.901, -81.340],
  "32081": [30.118, -81.419], "32082": [30.240, -81.386], "32084": [29.895, -81.315],
  "32092": [30.009, -81.514], "32114": [29.211, -81.023], "32118": [29.216, -81.015],
  "32159": [28.901, -82.010], "32162": [28.925, -82.003], "32163": [28.910, -82.020],
  "32168": [29.025, -80.927], "32202": [30.332, -81.656], "32207": [30.318, -81.653],
  "32210": [30.284, -81.727], "32218": [30.389, -81.666], "32244": [30.261, -81.755],
  "32254": [30.364, -81.699], "32301": [30.452, -84.281], "32308": [30.470, -84.224],
  "32502": [30.421, -87.217], "32561": [30.332, -87.165], "32601": [29.652, -82.325],
  "32608": [29.626, -82.373], "32725": [28.901, -81.264], "32801": [28.538, -81.379],
  "32819": [28.460, -81.472], "32826": [28.517, -81.267], "32836": [28.457, -81.483],
  "33130": [25.762, -80.192], "33316": [26.122, -80.137], "33431": [26.368, -80.129],
  "33444": [26.462, -80.073], "33601": [27.951, -82.457], "33602": [27.960, -82.460],
  "33629": [27.913, -82.515], "33706": [27.724, -82.741], "33755": [27.966, -82.800],
  "33801": [28.040, -81.950], "33813": [27.978, -81.923], "33901": [26.641, -81.872],
  "33912": [26.571, -81.877], "34102": [26.142, -81.795], "34108": [26.217, -81.806],
  "34145": [25.941, -81.718], "34231": [27.298, -82.534], "34236": [27.336, -82.531],
  "34242": [27.268, -82.554], "34470": [29.187, -82.140], "34474": [29.180, -82.157],
  "34609": [28.478, -82.529], "34741": [28.292, -81.408], "34743": [28.270, -81.360],
  "34748": [28.811, -81.878], "34953": [27.294, -80.350], "32960": [27.639, -80.397],
  "33990": [26.563, -81.950], "30161": [34.257, -85.165],
  // Georgia — major postal areas
  "30009": [34.075, -84.294], "30040": [34.207, -84.140], "30060": [33.953, -84.550],
  "30075": [34.023, -84.362], "30144": [34.023, -84.616],
  "30201": [33.750, -84.390], "30263": [33.381, -84.800], "30265": [33.365, -84.773],
  "30269": [33.397, -84.599], "30301": [33.749, -84.388], "30309": [33.788, -84.383],
  "30315": [33.710, -84.400], "30324": [33.810, -84.360], "30458": [32.449, -81.783],
  "30501": [34.298, -83.824], "30507": [34.320, -81.810], "30901": [33.474, -82.011],
  "30904": [33.488, -82.056], "30909": [33.502, -82.024], "31088": [32.613, -83.600],
  "31201": [32.841, -83.632], "31210": [32.870, -83.650], "31313": [31.847, -81.596],
  "31401": [32.084, -81.100], "31405": [32.105, -81.120], "31410": [32.052, -80.974],
  "31520": [31.150, -81.492], "31522": [31.127, -81.366], "31533": [31.509, -82.851],
  "31601": [30.833, -83.279], "31605": [30.860, -83.300], "31792": [30.837, -83.979],
  "31901": [32.461, -84.988], "31907": [32.520, -84.960],
};

function zipToLatLng(zip: string): [number, number] | null {
  return ZIP_CENTROIDS[zip] ?? null;
}

// ─── Sort helper ──────────────────────────────────────────────────────────────
function sortListings(listings: Listing[], sort: string): Listing[] {
  const copy = [...listings];
  switch (sort) {
    case "lowest_cost": return copy.sort((a, b) => (a.totalDeliveredCost ?? a.askingPrice ?? 0) - (b.totalDeliveredCost ?? b.askingPrice ?? 0));
    case "best_deal": return copy.sort((a, b) => (a.dealDelta ?? 0) - (b.dealDelta ?? 0));
    case "newest": return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "buyer_score": return copy.sort((a, b) => (b.buyerScore ?? 0) - (a.buyerScore ?? 0));
    case "warranty": return copy.sort((a) => a.warrantyIncluded === "yes" ? -1 : 1);
    default: return copy.sort((a, b) => (b.buyerScore ?? 0) - (a.buyerScore ?? 0));
  }
}

// ─── Filter label map ─────────────────────────────────────────────────────────
const FILTER_LABELS: Record<string, (v: string) => string> = {
  state: (v) => ({ FL: "Florida", GA: "Georgia" }[v] ?? v),
  sellerType: (v) => ({ dealer: "Dealer", private: "Private Seller", retail: "Retail" }[v] ?? v),
  brands: (v) => `Brand: ${v}`,
  seating: (v) => ({ "2": "2-Seat", "4": "4-Seat", "6": "6-Seat", "8plus": "8+ Seat" }[v] ?? v),
  powerType: (v) => ({ electric: "Electric", gas: "Gas" }[v] ?? v),
  minPrice: (v) => `Min $${Number(v).toLocaleString()}`,
  maxPrice: (v) => `Max $${Number(v).toLocaleString()}`,
  streetLegal: () => "Street Legal",
  lifted: () => "Lifted",
  warrantyIncluded: () => "Warranty",
  zip: (v) => `Near ${v}`,
  radius: (v) => `${v} mi radius`,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClientFilters {
  state?: string;
  sellerType?: string;
  brands?: string;        // comma-separated brand list
  seating?: string;       // "2" | "4" | "6" | "8plus"
  powerType?: string;     // "electric" | "gas"
  minPrice?: string;
  maxPrice?: string;
  streetLegal?: string;
  lifted?: string;
  warrantyIncluded?: string;
  zip?: string;
  radius?: string;
  q?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Search() {
  // SEO
  useEffect(() => {
    const brand = filters.brands ? ` — ${filters.brands.split(",")[0]}` : "";
    const loc = filters.state === "FL" ? " Florida" : filters.state === "GA" ? " Georgia" : " FL & GA";
    setSEO({
      title: `Golf Carts for Sale${brand}${loc}`,
      description: `Browse ${loc.trim()} golf cart listings on CartIQ. Compare prices, deal ratings, and buyer scores from top dealers.`,
      canonical: "https://cartiq-chi.vercel.app/search",
    });
  }, [filters.brands, filters.state]);
  const [filters, setFilters] = useState<ClientFilters>({});
  const [sort, setSort] = useState("best_match");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [zipError, setZipError] = useState("");
  const initializedRef = useRef(false);

  // Parse URL params on first load
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const search = window.location.hash.split("?")[1] || "";
    const params = new URLSearchParams(search);
    const init: ClientFilters = {};
    params.forEach((v, k) => { (init as any)[k] = v; });
    if (init.q) { /* keyword captured in filters */ }
    setFilters(init);
  }, []);

  // Sync filters to URL
  const syncUrl = useCallback((next: ClientFilters) => {
    const params = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => { if (v) params.set(k, v); });
    const qs = params.toString();
    window.history.replaceState(null, "", `#/search${qs ? `?${qs}` : ""}`);
  }, []);

  function setFilter(key: keyof ClientFilters, value: string) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    syncUrl(next);
  }
  function clearFilter(key: keyof ClientFilters) {
    const next = { ...filters };
    delete next[key];
    setFilters(next);
    syncUrl(next);
  }
  function clearAll() {
    setFilters({});
    setZipError("");
    syncUrl({});
  }

  // Brand toggle (comma-separated list in filters.brands)
  const selectedBrands = filters.brands ? filters.brands.split(",").filter(Boolean) : [];
  function toggleBrand(brand: string) {
    const next = selectedBrands.includes(brand)
      ? selectedBrands.filter((b) => b !== brand)
      : [...selectedBrands, brand];
    if (next.length === 0) clearFilter("brands");
    else setFilter("brands", next.join(","));
  }

  // Fetch ALL FL+GA listings — no server-side filters beyond active/public
  const { data: allListings = [], isLoading } = useQuery<Listing[]>({
    queryKey: ["/api/listings/all"],
    queryFn: () => apiRequest("GET", "/api/listings?limit=500").then((r) => r.json()),
    staleTime: 60_000,
  });

  // ── Client-side filtering ─────────────────────────────────────────────────
  const filtered = allListings.filter((l) => {
    // Keyword
    if (filters.q) {
      const kw = filters.q.toLowerCase();
      const text = [l.title, l.brand, l.model, l.city, l.state, l.description].join(" ").toLowerCase();
      if (!text.includes(kw)) return false;
    }
    // State
    if (filters.state && l.state !== filters.state) return false;
    // Seller type
    if (filters.sellerType && l.sellerType !== filters.sellerType) return false;
    // Brands (multi-select)
    if (selectedBrands.length > 0) {
      const namedBrands = [
        "Bintelli", "Club Car", "Cushman", "DACH", "Denago EV", "E-Z-GO",
        "Epic", "Evolution", "GEM", "ICON", "MadJax",
        "Sierra", "Sivo", "Star EV", "Teko EV", "Verdi", "Yamaha",
      ];
      const match = selectedBrands.some((b) =>
        b === "Other"
          ? !namedBrands.includes(l.brand ?? "")
          : l.brand === b
      );
      if (!match) return false;
    }
    // Seating — exact match for 2/4/6, 8+ for 8plus
    if (filters.seating === "2" && l.seating !== 2) return false;
    if (filters.seating === "4" && l.seating !== 4) return false;
    if (filters.seating === "6" && l.seating !== 6) return false;
    if (filters.seating === "8plus" && (l.seating ?? 0) < 8) return false;
    // Power type
    if (filters.powerType && l.powerType !== filters.powerType) return false;
    // Price
    const price = l.askingPrice ?? l.salePrice ?? l.regularPrice ?? 0;
    if (filters.minPrice && price < Number(filters.minPrice)) return false;
    if (filters.maxPrice && price > Number(filters.maxPrice)) return false;
    // Street legal
    if (filters.streetLegal === "true" && !l.streetLegalClaimed) return false;
    // Lifted
    if (filters.lifted === "true" && !l.lifted) return false;
    // Warranty
    if (filters.warrantyIncluded === "yes" && l.warrantyIncluded !== "yes") return false;
    // Miles from zip (haversine)
    if (filters.zip && filters.radius) {
      const userCoords = zipToLatLng(filters.zip);
      if (userCoords) {
        const listingCoords = l.lat != null && l.lng != null
          ? [l.lat, l.lng] as [number, number]
          : l.zip ? zipToLatLng(l.zip) : null;
        if (listingCoords) {
          const dist = haversine(userCoords[0], userCoords[1], listingCoords[0], listingCoords[1]);
          if (dist > Number(filters.radius)) return false;
        }
        // If we can't compute distance, include the listing (don't exclude unknown)
      }
    }
    return true;
  });

  const sorted = sortListings(filtered, sort);

  // Active filter count for badge
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && k !== "q").length;

  // Chip labels for active filters (exclude zip/radius if shown together)
  const chipEntries = Object.entries(filters).filter(([k, v]) => v && k !== "q" && k !== "radius");

  // ── Filter panel ──────────────────────────────────────────────────────────
  const FilterPanel = () => (
    <div className="space-y-5 text-sm">

      {/* Search keyword */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Keyword</label>
        <Input
          placeholder="Brand, model, city…"
          value={filters.q ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v) setFilter("q", v); else clearFilter("q");
          }}
          className="text-sm"
        />
      </div>

      <Separator />

      {/* State */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">State</label>
        {STATES.map((s) => (
          <label key={s.value} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.state === s.value}
              onChange={(e) => e.target.checked ? setFilter("state", s.value) : clearFilter("state")}
              className="rounded"
            />
            <span>{s.label}</span>
          </label>
        ))}
      </div>

      <Separator />

      {/* Miles from Zip */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
          <MapPin className="inline h-3 w-3 mr-1" />Miles from Zip
        </label>
        <div className="flex gap-2 mb-2">
          <Input
            placeholder="Your ZIP code"
            maxLength={5}
            value={filters.zip ?? ""}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 5);
              setZipError("");
              if (!v) { clearFilter("zip"); return; }
              setFilter("zip", v);
              if (v.length === 5 && !zipToLatLng(v)) {
                setZipError("ZIP not found in FL/GA. Enter a valid FL or GA zip.");
              }
            }}
            className="text-sm flex-1"
          />
        </div>
        {zipError && <p className="text-xs text-destructive mb-2">{zipError}</p>}
        <Select
          value={filters.radius ?? ""}
          onValueChange={(v) => v ? setFilter("radius", v) : clearFilter("radius")}
        >
          <SelectTrigger className="text-sm w-full">
            <SelectValue placeholder="Select radius" />
          </SelectTrigger>
          <SelectContent>
            {RADIUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filters.zip && filters.radius && !zipToLatLng(filters.zip ?? "") && (
          <p className="text-xs text-muted-foreground mt-1">Enter a valid FL/GA ZIP to use distance filter.</p>
        )}
      </div>

      <Separator />

      {/* Brand */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Brand</label>
        {BRANDS.map((b) => (
          <label key={b} className="flex items-center gap-2 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedBrands.includes(b)}
              onChange={() => toggleBrand(b)}
              className="rounded"
            />
            <span>{b}</span>
          </label>
        ))}
      </div>

      <Separator />

      {/* Seating */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Seating</label>
        <div className="flex gap-2">
          {[
            { label: "2", value: "2" },
            { label: "4", value: "4" },
            { label: "6", value: "6" },
            { label: "8+", value: "8plus" },
          ].map((o) => (
            <button
              key={o.value}
              onClick={() => filters.seating === o.value ? clearFilter("seating") : setFilter("seating", o.value)}
              className={`flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                filters.seating === o.value
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-foreground border-border hover:bg-secondary"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Power Type */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Power Type</label>
        <div className="flex gap-2">
          {[
            { label: "Electric", value: "electric" },
            { label: "Gas", value: "gas" },
          ].map((o) => (
            <button
              key={o.value}
              onClick={() => filters.powerType === o.value ? clearFilter("powerType") : setFilter("powerType", o.value)}
              className={`flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                filters.powerType === o.value
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-foreground border-border hover:bg-secondary"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Price Range */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Price Range</label>
        <div className="flex gap-2">
          <Input
            placeholder="Min $"
            type="number"
            value={filters.minPrice ?? ""}
            onChange={(e) => e.target.value ? setFilter("minPrice", e.target.value) : clearFilter("minPrice")}
            className="w-1/2 text-sm"
          />
          <Input
            placeholder="Max $"
            type="number"
            value={filters.maxPrice ?? ""}
            onChange={(e) => e.target.value ? setFilter("maxPrice", e.target.value) : clearFilter("maxPrice")}
            className="w-1/2 text-sm"
          />
        </div>
      </div>

      <Separator />

      {/* Seller / Source */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Seller / Source</label>
        {SELLER_TYPES.map((s) => (
          <label key={s.value} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.sellerType === s.value}
              onChange={(e) => e.target.checked ? setFilter("sellerType", s.value) : clearFilter("sellerType")}
              className="rounded"
            />
            <span>{s.label}</span>
          </label>
        ))}
      </div>

      <Separator />

      {/* Additional */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Additional</label>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.streetLegal === "true"}
            onChange={(e) => e.target.checked ? setFilter("streetLegal", "true") : clearFilter("streetLegal")}
            className="rounded"
          />
          <span>Street Legal</span>
        </label>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.lifted === "true"}
            onChange={(e) => e.target.checked ? setFilter("lifted", "true") : clearFilter("lifted")}
            className="rounded"
          />
          <span>Lifted</span>
        </label>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.warrantyIncluded === "yes"}
            onChange={(e) => e.target.checked ? setFilter("warrantyIncluded", "yes") : clearFilter("warrantyIncluded")}
            className="rounded"
          />
          <span>Warranty Included</span>
        </label>
      </div>

      {activeFilterCount > 0 && (
        <Button variant="outline" size="sm" onClick={clearAll} className="w-full">
          Clear All Filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky bar */}
      <div className="sticky top-16 z-40 bg-white border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2 flex-wrap">

          {/* Active filter chips — desktop */}
          <div className="hidden md:flex items-center gap-1.5 flex-wrap flex-1">
            {chipEntries.map(([k, v]) => {
              const label = FILTER_LABELS[k] ? FILTER_LABELS[k](v!) : `${k}: ${v}`;
              // For brands, show each brand as a separate chip
              if (k === "brands") {
                return selectedBrands.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary rounded-full text-xs font-medium">
                    {b}
                    <button onClick={() => toggleBrand(b)}><X className="h-3 w-3" /></button>
                  </span>
                ));
              }
              return (
                <span key={k} className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary rounded-full text-xs font-medium">
                  {label}
                  <button onClick={() => clearFilter(k as keyof ClientFilters)}><X className="h-3 w-3" /></button>
                </span>
              );
            })}
            {filters.zip && filters.radius && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary rounded-full text-xs font-medium">
                <MapPin className="h-3 w-3" />{filters.radius} mi of {filters.zip}
                <button onClick={() => { clearFilter("zip"); clearFilter("radius"); }}><X className="h-3 w-3" /></button>
              </span>
            )}
          </div>

          {/* Mobile filter button */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="md:hidden gap-1.5" data-testid="mobile-filter-btn">
                <SlidersHorizontal className="h-4 w-4" />
                Filters {activeFilterCount > 0 && (
                  <span className="bg-foreground text-background rounded-full w-5 h-5 text-xs flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 overflow-y-auto">
              <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
              <div className="mt-4"><FilterPanel /></div>
            </SheetContent>
          </Sheet>

          <div className="ml-auto flex items-center gap-2">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-40 text-sm" data-testid="sort-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-60 shrink-0">
          <div className="sticky top-32 bg-white border border-border rounded-xl p-4 max-h-[calc(100vh-9rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Filters</h2>
              {activeFilterCount > 0 && (
                <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">
                  Clear all
                </button>
              )}
            </div>
            <FilterPanel />
          </div>
        </aside>

        {/* Results */}
        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Loading…"
                : `${sorted.length.toLocaleString()} listing${sorted.length !== 1 ? "s" : ""} found`}
            </p>
          </div>

          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-48 w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-lg font-medium mb-2">No listings match your filters</p>
              <p className="text-sm mb-4">Try broadening your search or clearing some filters.</p>
              <Button variant="outline" onClick={clearAll}>Clear All Filters</Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {sorted.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
