import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { setSEO } from "@/lib/seo";
import { BRAND_CONFIGS, type BrandConfig } from "@/lib/seo-config";
import { ListingCard } from "@/components/ListingCard";
import { ChevronRight, Zap, ShieldCheck, CheckCircle, AlertTriangle } from "lucide-react";
import type { Listing } from "@/lib/types";

const SUPA = "https://aagwrcdvhuuzwrglamrt.supabase.co";
const KEY  = "sb_publishable_AMYcEYmVFC7zSGT_c1GTaw_IlWrtbyU";

// Map slug → exact DB brand string
const BRAND_NAME_MAP: Record<string, string> = {
  "ezgo": "E-Z-GO",
  "club-car": "Club Car",
  "yamaha": "Yamaha",
  "icon": "ICON",
  "evolution": "Evolution",
  "venom-ev": "Venom EV",
  "bintelli": "Bintelli",
  "epic": "Epic",
  "denago": "Denago EV",
};

async function fetchBrandListings(brandName: string): Promise<Listing[]> {
  const params = new URLSearchParams({
    brand: `eq.${brandName}`,
    status: "eq.active",
    public_listing: "eq.true",
    select: "id,title,slug,brand,model,year,condition,asking_price,deal_rating,buyer_score,image_url,city,state,battery_type,seating,source_listing_url",
    order: "buyer_score.desc.nullslast",
    limit: "24",
  });
  const res = await fetch(`${SUPA}/rest/v1/listings?${params}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  return res.json();
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

export default function BrandPage() {
  const [, params] = useRoute("/brands/:slug");
  const [, navigate] = useHashLocation();
  const slug = params?.slug ?? "";
  const cfg = BRAND_CONFIGS.find(b => b.slug === slug);

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cfg) return;
    setSEO({ title: cfg.title, description: cfg.metaDescription, canonical: `https://golfcartwise.app/brands/${cfg.slug}` });
    const brandName = BRAND_NAME_MAP[cfg.slug] ?? cfg.name;
    setLoading(true);
    fetchBrandListings(brandName).then(data => {
      setListings(data);
      setLoading(false);
    });
  }, [slug]);

  if (!cfg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="font-semibold">Brand not found</p>
          <Link href="/search" className="text-sm text-green-700 hover:underline">Browse all listings →</Link>
        </div>
      </div>
    );
  }

  const searchHref = `/#/search?brand=${encodeURIComponent(BRAND_NAME_MAP[cfg.slug] ?? cfg.name)}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">GolfCartWise</Link>
          <ChevronRight className="h-3 w-3" />
          <span>Brands</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{cfg.name}</span>
        </nav>

        {/* Header */}
        <div className="space-y-3 max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight">{cfg.h1}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{cfg.shortAnswer}</p>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground">
              Origin: {cfg.origin}
            </span>
            {cfg.powerTypes.map(p => (
              <span key={p} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-xs text-green-800">
                <Zap className="h-3 w-3" />{p}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground">
              {cfg.priceRange}
            </span>
          </div>
        </div>

        {/* Common models */}
        {cfg.commonModels.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Common Models</h2>
            <div className="flex flex-wrap gap-2">
              {cfg.commonModels.map(m => (
                <button key={m}
                  onClick={() => navigate(`/search?brand=${encodeURIComponent(BRAND_NAME_MAP[cfg.slug] ?? cfg.name)}&model=${encodeURIComponent(m)}`)}
                  className="px-3 py-1.5 rounded-full border border-border text-xs hover:bg-secondary transition-colors cursor-pointer">
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Listings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base">
              {loading ? "Loading listings…" : `${listings.length} ${cfg.name} Listings in FL & GA`}
            </h2>
            <a href={searchHref} className="text-xs text-green-700 hover:underline flex items-center gap-1">
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
              <p className="font-semibold text-sm">No verified {cfg.name} listings found right now.</p>
              <p className="text-xs text-muted-foreground">GolfCartWise is building coverage for this brand. Check back soon or browse all listings.</p>
              <a href="/#/search" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">
                Browse All Listings <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {listings.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </div>

        {/* Buyer tips */}
        <div className="space-y-3 max-w-3xl">
          <h2 className="font-bold text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-600" /> Buyer Tips for {cfg.name}
          </h2>
          <ul className="space-y-2">
            {cfg.buyerTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* FAQ */}
        <div className="space-y-4 max-w-3xl">
          <h2 className="font-bold text-base">{cfg.name} — Frequently Asked Questions</h2>
          <FAQ faqs={cfg.faqs} />
        </div>

        {/* Deal Checker CTA */}
        <div className="rounded-2xl border border-border bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-sm">Evaluating a {cfg.name} listing?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Paste any listing URL to get an instant market price comparison.</p>
          </div>
          <a href="/#/deal-checker"
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
            Check a Deal <ChevronRight className="h-4 w-4" />
          </a>
        </div>

        {/* Other brands */}
        <div className="space-y-3">
          <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Other Brands on GolfCartWise</h2>
          <div className="flex flex-wrap gap-2">
            {BRAND_CONFIGS.filter(b => b.slug !== cfg.slug).map(b => (
              <Link key={b.slug} href={`/brands/${b.slug}`}
                className="px-3 py-1.5 rounded-full border border-border text-xs hover:bg-secondary transition-colors">
                {b.name}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
