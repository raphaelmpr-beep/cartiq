import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { SlidersHorizontal, X, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ListingCard } from "@/components/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Listing } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";

const BRANDS = ["Club Car", "Yamaha", "E-Z-GO", "ICON", "Star EV", "Advanced EV", "Bintelli", "Other"];
const STATES = [{ label: "Florida", value: "FL" }, { label: "Georgia", value: "GA" }];
const SELLER_TYPES = [
  { label: "Dealer", value: "dealer" },
  { label: "Private Seller", value: "private" },
  { label: "Retail / Costco", value: "retail" },
];
const BATTERY_TYPES = [
  { label: "Lithium", value: "lithium" },
  { label: "Lead-Acid", value: "lead_acid" },
  { label: "Gas", value: "gas" },
];
const DEAL_RATINGS = [
  { label: "Great Deal", value: "great_deal" },
  { label: "Good Deal", value: "good_deal" },
  { label: "Fair Price", value: "fair_price" },
];
const SORT_OPTIONS = [
  { label: "Best Match", value: "best_match" },
  { label: "Lowest Total Cost", value: "lowest_cost" },
  { label: "Best Deal", value: "best_deal" },
  { label: "Newest", value: "newest" },
  { label: "Highest Buyer Score", value: "buyer_score" },
  { label: "Warranty Included", value: "warranty" },
];

function buildQueryString(filters: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  return params.toString();
}

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

export default function Search() {
  const [location] = useLocation();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState("best_match");
  const [keyword, setKeyword] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Parse initial URL params
  useEffect(() => {
    const search = window.location.hash.split("?")[1] || "";
    const params = new URLSearchParams(search);
    const init: Record<string, string> = {};
    params.forEach((v, k) => { init[k] = v; });
    setFilters(init);
  }, []);

  const qs = buildQueryString(filters);
  const { data: listings = [], isLoading } = useQuery<Listing[]>({
    queryKey: ["/api/listings", qs],
    queryFn: () => apiRequest("GET", `/api/listings${qs ? `?${qs}` : ""}`).then(r => r.json()),
  });

  const filtered = keyword
    ? listings.filter((l) => [l.title, l.brand, l.model, l.city].join(" ").toLowerCase().includes(keyword.toLowerCase()))
    : listings;
  const sorted = sortListings(filtered, sort);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  function setFilter(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
  }
  function clearFilter(key: string) {
    setFilters((f) => { const n = { ...f }; delete n[key]; return n; });
  }
  function clearAll() { setFilters({}); }

  const FilterPanel = () => (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">State</label>
        {STATES.map((s) => (
          <label key={s.value} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <input type="checkbox" checked={filters.state === s.value} onChange={(e) => e.target.checked ? setFilter("state", s.value) : clearFilter("state")} className="rounded" />
            <span className="text-sm">{s.label}</span>
          </label>
        ))}
      </div>
      <Separator />
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Seller / Source</label>
        {SELLER_TYPES.map((s) => (
          <label key={s.value} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <input type="checkbox" checked={filters.sellerType === s.value} onChange={(e) => e.target.checked ? setFilter("sellerType", s.value) : clearFilter("sellerType")} className="rounded" />
            <span className="text-sm">{s.label}</span>
          </label>
        ))}
      </div>
      <Separator />
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Battery Type</label>
        {BATTERY_TYPES.map((b) => (
          <label key={b.value} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <input type="checkbox" checked={filters.batteryType === b.value} onChange={(e) => e.target.checked ? setFilter("batteryType", b.value) : clearFilter("batteryType")} className="rounded" />
            <span className="text-sm">{b.label}</span>
          </label>
        ))}
      </div>
      <Separator />
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Deal Rating</label>
        {DEAL_RATINGS.map((d) => (
          <label key={d.value} className="flex items-center gap-2 py-1.5 cursor-pointer">
            <input type="checkbox" checked={filters.dealRating === d.value} onChange={(e) => e.target.checked ? setFilter("dealRating", d.value) : clearFilter("dealRating")} className="rounded" />
            <span className="text-sm">{d.label}</span>
          </label>
        ))}
      </div>
      <Separator />
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Price Range</label>
        <div className="flex gap-2">
          <Input placeholder="Min" type="number" value={filters.minPrice || ""} onChange={(e) => e.target.value ? setFilter("minPrice", e.target.value) : clearFilter("minPrice")} className="w-1/2 text-sm" />
          <Input placeholder="Max" type="number" value={filters.maxPrice || ""} onChange={(e) => e.target.value ? setFilter("maxPrice", e.target.value) : clearFilter("maxPrice")} className="w-1/2 text-sm" />
        </div>
      </div>
      <Separator />
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Additional</label>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input type="checkbox" checked={filters.streetLegal === "true"} onChange={(e) => e.target.checked ? setFilter("streetLegal", "true") : clearFilter("streetLegal")} className="rounded" />
          <span className="text-sm">Street Legal</span>
        </label>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input type="checkbox" checked={filters.lifted === "true"} onChange={(e) => e.target.checked ? setFilter("lifted", "true") : clearFilter("lifted")} className="rounded" />
          <span className="text-sm">Lifted</span>
        </label>
        <label className="flex items-center gap-2 py-1.5 cursor-pointer">
          <input type="checkbox" checked={filters.warrantyIncluded === "yes"} onChange={(e) => e.target.checked ? setFilter("warrantyIncluded", "yes") : clearFilter("warrantyIncluded")} className="rounded" />
          <span className="text-sm">Warranty Included</span>
        </label>
      </div>
      {activeFilterCount > 0 && (
        <Button variant="outline" size="sm" onClick={clearAll} className="w-full">Clear All Filters</Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Search bar */}
      <div className="sticky top-16 z-40 bg-white border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by brand, model, city…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              data-testid="search-keyword-input"
            />
          </div>

          {/* Active filter chips */}
          <div className="hidden md:flex items-center gap-2 flex-wrap">
            {Object.entries(filters).map(([k, v]) => v && (
              <span key={k} className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary rounded-full text-xs font-medium">
                {k}: {v}
                <button onClick={() => clearFilter(k)}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>

          {/* Mobile filter button */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="md:hidden gap-1.5" data-testid="mobile-filter-btn">
                <SlidersHorizontal className="h-4 w-4" />
                Filters {activeFilterCount > 0 && <span className="bg-foreground text-background rounded-full w-5 h-5 text-xs flex items-center justify-center">{activeFilterCount}</span>}
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
        <aside className="hidden md:block w-56 shrink-0">
          <div className="sticky top-32 bg-white border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Filters</h2>
              {activeFilterCount > 0 && (
                <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
              )}
            </div>
            <FilterPanel />
          </div>
        </aside>

        {/* Results */}
        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading…" : `${sorted.length} listing${sorted.length !== 1 ? "s" : ""} found`}
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
              <p className="text-lg font-medium mb-2">No listings found</p>
              <p className="text-sm">Try adjusting your filters or search terms.</p>
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
