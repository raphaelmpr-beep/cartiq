import { useEffect, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { setSEO } from "@/lib/seo";
import { CITY_CONFIGS, type CityConfig } from "@/lib/seo-config";
import { ListingCard } from "@/components/ListingCard";
import { MapPin, Search, ChevronRight, Info, AlertTriangle } from "lucide-react";
import type { Listing } from "@/lib/types";

const SUPA = "https://aagwrcdvhuuzwrglamrt.supabase.co";
const KEY  = "sb_publishable_AMYcEYmVFC7zSGT_c1GTaw_IlWrtbyU";

async function fetchCityListings(cfg: CityConfig): Promise<Listing[]> {
  // city+state match (lat/lng not yet geocoded for all listings)
  const params = new URLSearchParams({
    city: `ilike.${cfg.city}`,
    state: `eq.${cfg.state}`,
    status: "eq.active",
    public_listing: "eq.true",
    select: "id,title,slug,brand,model,year,condition,asking_price,deal_rating,buyer_score,image_url,city,state,battery_type,seating,source_listing_url",
    order: "buyer_score.desc.nullslast",
    limit: "24",
  });
  const url = `${SUPA}/rest/v1/listings?${params}`;
  const res = await fetch(url, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const data: Listing[] = await res.json();
  // Fallback: state-only if fewer than 5
  if (data.length < 5) {
    const p2 = new URLSearchParams({
      state: `eq.${cfg.state}`,
      status: "eq.active",
      public_listing: "eq.true",
      select: "id,title,slug,brand,model,year,condition,asking_price,deal_rating,buyer_score,image_url,city,state,battery_type,seating,source_listing_url",
      order: "buyer_score.desc.nullslast",
      limit: "12",
    });
    const r2 = await fetch(`${SUPA}/rest/v1/listings?${p2}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    return r2.json();
  }
  return data;
}

function NearbyLink({ slug }: { slug: string }) {
  const cfg = CITY_CONFIGS.find(c => c.slug === slug);
  if (!cfg) return null;
  return (
    <Link href={`/golf-carts-for-sale/${slug}`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs hover:bg-secondary transition-colors">
      <MapPin className="h-3 w-3 text-green-600" />
      {cfg.city}, {cfg.state}
    </Link>
  );
}

function FAQ({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <div className="space-y-4">
      {faqs.map((f, i) => (
        <div key={i} className="border border-border rounded-xl p-4 bg-white">
          <p className="font-semibold text-sm text-foreground mb-1">{f.q}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
        </div>
      ))}
    </div>
  );
}

export default function CityPage() {
  const [, params] = useRoute("/golf-carts-for-sale/:slug");
  const [, navigate] = useLocation();
  const slug = params?.slug ?? "";
  const cfg = CITY_CONFIGS.find(c => c.slug === slug);

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!cfg) return;
    setSEO({ title: cfg.title, description: cfg.metaDescription, canonical: `https://golfcartiq.com/golf-carts-for-sale/${cfg.slug}` });
    setLoading(true);
    fetchCityListings(cfg).then(data => {
      setListings(data);
      setFallback(data.length < 5 && data.length > 0);
      setLoading(false);
    });
  }, [slug]);

  if (!cfg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="font-semibold">City not found</p>
          <Link href="/search" className="text-sm text-green-700 hover:underline">Browse all listings →</Link>
        </div>
      </div>
    );
  }

  const qs = new URLSearchParams({ city: cfg.city, state: cfg.state, radius: String(cfg.radiusMiles) }).toString();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">GolfCartIQ</Link>
          <ChevronRight className="h-3 w-3" />
          <span>Golf Carts For Sale</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{cfg.city}, {cfg.state}</span>
        </nav>

        {/* Header */}
        <div className="space-y-3 max-w-3xl">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-green-600" />
            <span>{cfg.city}, {cfg.state} · {cfg.radiusMiles}-mile radius · {cfg.marketType}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{cfg.h1}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{cfg.shortAnswer}</p>
        </div>

        {/* Quick filters */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Lithium Battery", params: { city: cfg.city, state: cfg.state, batteryType: "lithium" } },
            { label: "With Warranty", params: { city: cfg.city, state: cfg.state, warrantyIncluded: "yes" } },
            { label: "Street Legal", params: { city: cfg.city, state: cfg.state, streetLegal: "true" } },
            { label: "6-Passenger", params: { city: cfg.city, state: cfg.state, seating: "6" } },
          ].map(({ label, params: p }) => (
            <button key={label}
              onClick={() => navigate(`/search?${new URLSearchParams(p)}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs hover:bg-secondary transition-colors cursor-pointer">
              <Search className="h-3 w-3" /> {label}
            </button>
          ))}
        </div>

        {/* Listings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base">
              {loading ? "Loading listings…" : `${listings.length} Listings Near ${cfg.city}`}
            </h2>
            <a href={`/search?${qs}`}
              className="text-xs text-green-700 hover:underline flex items-center gap-1">
              See all <ChevronRight className="h-3 w-3" />
            </a>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-56 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="rounded-xl border border-border bg-white p-8 text-center space-y-3">
              <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
              <p className="font-semibold text-sm">GolfCartIQ is still building verified inventory coverage in this area.</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Expand your search or use Deal Checker to evaluate any outside listing.
              </p>
              <a href="/deal-checker"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">
                Open Deal Checker <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          ) : (
            <>
              {fallback && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Fewer than 5 verified listings found in {cfg.city} — showing nearest available {cfg.state} inventory.</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {listings.map(l => <ListingCard key={l.id} listing={l} />)}
              </div>
            </>
          )}
        </div>

        {/* Nearby cities */}
        {cfg.nearbySlugs.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Nearby Markets</h2>
            <div className="flex flex-wrap gap-2">
              {cfg.nearbySlugs.map(s => <NearbyLink key={s} slug={s} />)}
            </div>
          </div>
        )}

        {/* FAQ */}
        <div className="space-y-4 max-w-3xl">
          <h2 className="font-bold text-base">Frequently Asked Questions</h2>
          <FAQ faqs={cfg.faqs} />
        </div>

        {/* Deal Checker CTA */}
        <div className="rounded-2xl border border-border bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-sm">Found a listing outside GolfCartIQ?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Paste any URL — Facebook, Craigslist, or dealer site — and get an instant market comparison.</p>
          </div>
          <a href="/deal-checker"
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
            Check a Deal <ChevronRight className="h-4 w-4" />
          </a>
        </div>

      </div>
    </div>
  );
}
