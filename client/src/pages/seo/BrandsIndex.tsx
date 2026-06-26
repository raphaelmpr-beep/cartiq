import { useEffect } from "react";
import { Link } from "wouter";
import { setSEO } from "@/lib/seo";
import { BRAND_WIKI } from "@/lib/brand-wiki-data";
import { ChevronRight } from "lucide-react";

function badgeStyle(badge: string): string {
  const map: Record<string, string> = {
    "Legacy Brand":                       "bg-blue-50 border-blue-200 text-blue-800",
    "Modern EV Brand":                    "bg-green-50 border-green-200 text-green-800",
    "LSV Focused":                        "bg-amber-50 border-amber-200 text-amber-800",
    "Emerging Brand":                     "bg-amber-50 border-amber-200 text-amber-800",
    "Strong Parts Support":               "bg-green-50 border-green-200 text-green-800",
    "Dealer-Dependent Support":           "bg-amber-50 border-amber-200 text-amber-800",
    "Manufacturing Not Clearly Verified": "bg-gray-100 border-gray-300 text-gray-700",
    "Warranty Details Needed":            "bg-amber-50 border-amber-200 text-amber-800",
  };
  return map[badge] ?? "bg-gray-100 border-gray-200 text-gray-700";
}

// Group brands for display
const LEGACY  = BRAND_WIKI.filter(b => b.badges.includes("Legacy Brand"));
const MODERN  = BRAND_WIKI.filter(b => b.badges.includes("Modern EV Brand") && !b.badges.includes("Emerging Brand"));
const EMERGING = BRAND_WIKI.filter(b => b.badges.includes("Emerging Brand"));

function BrandCard({ brand }: { brand: typeof BRAND_WIKI[number] }) {
  return (
    <Link href={`/brands/${brand.slug}`}>
      <a className="group block rounded-xl border border-border bg-white p-5 hover:shadow-md hover:border-green-200 transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <h3 className="font-bold text-base group-hover:text-green-700 transition-colors">{brand.name}</h3>
            <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{brand.tagline}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:text-green-600 transition-colors" />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {brand.badges.slice(0, 2).map(b => (
            <span key={b} className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${badgeStyle(b)}`}>
              {b}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">{brand.snapshot.priceRange}</p>
      </a>
    </Link>
  );
}

export default function BrandsIndex() {
  useEffect(() => {
    setSEO({
      title:       "Golf Cart Brands | Compare Club Car, ICON, E-Z-GO & More | GolfCartWise",
      description: "Compare all 12 golf cart brands tracked on GolfCartWise — Club Car, E-Z-GO, Yamaha, ICON, Evolution, Bintelli, Venom EV, Teko EV, and more. Specs, warranties, and verified listings in FL & GA.",
      canonical:   "https://www.golfcartwise.com/brands",
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">

        {/* Header */}
        <div className="max-w-2xl space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Golf Cart Brands</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            GolfCartWise tracks {BRAND_WIKI.length} brands across Florida and Georgia — from legacy manufacturers to modern EV startups.
            Each brand page includes specs, warranty details, manufacturer verification, and live listings.
          </p>
        </div>

        {/* Legacy Brands */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-base">Legacy Brands</h2>
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{LEGACY.length} brands</span>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Established manufacturers with 40+ years of production, national parts networks, and the highest resale liquidity.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {LEGACY.map(b => <BrandCard key={b.slug} brand={b} />)}
          </div>
        </section>

        {/* Modern EV Brands */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-base">Modern EV Brands</h2>
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{MODERN.length} brands</span>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Lithium-first brands with modern features, often at lower prices than legacy alternatives.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODERN.map(b => <BrandCard key={b.slug} brand={b} />)}
          </div>
        </section>

        {/* Emerging Brands */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-base">Emerging Brands</h2>
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{EMERGING.length} brands</span>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Newer entrants with growing dealer presence in FL and GA. Verify warranty and service coverage carefully before purchasing.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {EMERGING.map(b => <BrandCard key={b.slug} brand={b} />)}
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-border bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-sm">Ready to find your next cart?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Browse verified listings across all brands in FL and GA.</p>
          </div>
          <Link href="/search">
            <a className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
              Search All Listings <ChevronRight className="h-4 w-4" />
            </a>
          </Link>
        </div>

      </div>
    </div>
  );
}
