import { useEffect, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { setSEO } from "@/lib/seo";
import { BRAND_WIKI, getBrandWiki, type BrandWiki } from "@/lib/brand-wiki-data";
import { ListingCard } from "@/components/ListingCard";
import {
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Info,
  ShieldAlert,
  ShieldX,
  Building2,
} from "lucide-react";
import type { Listing } from "@/lib/types";

const SUPA = "https://aagwrcdvhuuzwrglamrt.supabase.co";
const KEY  = "sb_publishable_AMYcEYmVFC7zSGT_c1GTaw_IlWrtbyU";

async function fetchBrandListings(dbBrand: string): Promise<Listing[]> {
  const params = new URLSearchParams({
    brand:          `eq.${dbBrand}`,
    status:         `eq.active`,
    public_listing: `eq.true`,
    select:         "id,title,slug,brand,model,year,condition,asking_price,deal_rating,buyer_score,image_url,city,state,battery_type,seating,source_listing_url",
    order:          "buyer_score.desc.nullslast",
    limit:          "12",
  });
  const res = await fetch(`${SUPA}/rest/v1/listings?${params}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) return [];
  return res.json();
}

// Badge color map
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

// Verification level display
function VerificationBadge({ level, notes }: { level: BrandWiki["manufacturerVerification"]["level"]; notes: string }) {
  const configs = {
    verified:         { icon: ShieldCheck,  color: "text-green-700 bg-green-50 border-green-200", label: "Verified" },
    dealer_dependent: { icon: ShieldAlert,  color: "text-amber-700 bg-amber-50 border-amber-200", label: "Dealer-Dependent" },
    limited_public:   { icon: Info,         color: "text-gray-700 bg-gray-50 border-gray-200",    label: "Limited Public Info" },
    not_verified:     { icon: ShieldX,      color: "text-red-700 bg-red-50 border-red-200",       label: "Not Verified" },
  };
  const cfg = configs[level];
  const Icon = cfg.icon;
  return (
    <div className={`rounded-lg border p-4 ${cfg.color} space-y-2`}>
      <div className="flex items-center gap-2 font-semibold text-sm">
        <Icon className="h-4 w-4 shrink-0" />
        <span>Manufacturer Verification: {cfg.label}</span>
      </div>
      <p className="text-xs leading-relaxed opacity-90">{notes}</p>
    </div>
  );
}

// Slug aliases for backward compatibility
const SLUG_ALIASES: Record<string, string> = {
  "ezgo":   "e-z-go",
  "denago": "denago-ev",
};

export default function BrandPage() {
  const [, params] = useRoute("/brands/:slug");
  const [, navigate] = useLocation();
  const rawSlug = params?.slug ?? "";
  const slug = SLUG_ALIASES[rawSlug] ?? rawSlug;

  // Redirect legacy slugs
  useEffect(() => {
    if (SLUG_ALIASES[rawSlug]) navigate(`/brands/${SLUG_ALIASES[rawSlug]}`, { replace: true });
  }, [rawSlug]);

  const brand = getBrandWiki(slug);

  const [listings, setListings]   = useState<Listing[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!brand) return;
    setSEO({
      title:       `${brand.name} Golf Carts | Brand Wiki | GolfCartWise`,
      description: brand.summary.slice(0, 160),
      canonical:   `https://www.golfcartwise.com/brands/${brand.slug}`,
    });
    setLoading(true);
    fetchBrandListings(brand.dbBrand).then(data => {
      setListings(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, [slug]);

  if (!brand) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="font-semibold">Brand not found</p>
          <Link href="/search" className="text-sm text-green-700 hover:underline">
            Browse all listings →
          </Link>
        </div>
      </div>
    );
  }

  const searchHref = `/#/search?brand=${encodeURIComponent(brand.dbBrand)}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground">GolfCartWise</Link>
          <ChevronRight className="h-3 w-3" />
          <span>Brands</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{brand.name}</span>
        </nav>

        {/* Page header */}
        <div className="mb-8 space-y-3 max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {brand.name} Golf Carts — Brand Wiki
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">{brand.tagline}</p>
          {/* Badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            {brand.badges.map(b => (
              <span key={b} className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${badgeStyle(b)}`}>
                {b}
              </span>
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── MAIN CONTENT (left) ── */}
          <div className="flex-1 min-w-0 space-y-10">

            {/* Section 1 — Quick Summary */}
            <section>
              <h2 className="text-lg font-bold mb-3">Quick Summary</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{brand.summary}</p>
            </section>

            {/* Section 2 — Common Models */}
            {brand.commonModels.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-3">Common Models</h2>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        {["Model", "Type", "Top Speed", "Range", "MSRP", "Notes"].map(h => (
                          <th key={h} className="text-left px-3 py-2.5 font-semibold text-xs whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-white">
                      {brand.commonModels.map((m, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5 font-medium whitespace-nowrap">{m.name}</td>
                          <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{m.type}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{m.topSpeed}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{m.range}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">{m.msrp}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{m.notes ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Section 3 — What Makes It Different */}
            <section>
              <h2 className="text-lg font-bold mb-3">What Makes {brand.name} Different</h2>
              <ul className="space-y-2">
                {brand.whatMakesDifferent.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section 4 — Buyer Confidence Notes */}
            <section>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                Buyer Confidence Notes
              </h2>
              <ul className="space-y-2">
                {brand.buyerConfidenceNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section 5 — What to Verify Before Buying */}
            <section>
              <h2 className="text-lg font-bold mb-3">What to Verify Before Buying</h2>
              <div className="rounded-xl border border-border bg-white p-4 space-y-2">
                {brand.buyerChecklist.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <span className="shrink-0 w-5 h-5 rounded border border-border flex items-center justify-center text-xs text-muted-foreground mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 6 — Manufacturer Verification */}
            <section>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-gray-500" />
                Manufacturer, Assembly &amp; Parts
              </h2>
              <VerificationBadge
                level={brand.manufacturerVerification.level}
                notes={brand.manufacturerVerification.notes}
              />
            </section>

            {/* Section 7 — Active Listings */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">
                  {loading
                    ? "Loading listings…"
                    : `${listings.length > 0 ? listings.length + "+" : "No"} ${brand.name} Listings on GolfCartWise`}
                </h2>
                {!loading && listings.length > 0 && (
                  <a href={searchHref} className="text-xs text-green-700 hover:underline flex items-center gap-1">
                    See all <ChevronRight className="h-3 w-3" />
                  </a>
                )}
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-56 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
              ) : listings.length === 0 ? (
                <div className="rounded-xl border border-border bg-white p-8 text-center space-y-3">
                  <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
                  <p className="font-semibold text-sm">No verified {brand.name} listings right now.</p>
                  <p className="text-xs text-muted-foreground">
                    GolfCartWise is expanding {brand.name} coverage. Check back soon or browse all listings.
                  </p>
                  <a href="/#/search" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">
                    Browse All Listings <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {listings.map(l => <ListingCard key={l.id} listing={l} />)}
                </div>
              )}
            </section>

            {/* Section 8 — Similar Brands */}
            {brand.similarBrands.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-3">Similar Brands</h2>
                <div className="flex flex-wrap gap-2">
                  {brand.similarBrands.map(s => {
                    const sim = BRAND_WIKI.find(b => b.slug === s);
                    if (!sim) return null;
                    return (
                      <Link key={s} href={`/brands/${s}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:bg-secondary transition-colors">
                        {sim.name} <ChevronRight className="h-3 w-3" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

          </div>{/* end main */}

          {/* ── SIDEBAR (right) ── */}
          <aside className="w-full lg:w-72 shrink-0 space-y-6">

            {/* Brand Snapshot infobox */}
            <div className="rounded-xl border border-border bg-gray-50 overflow-hidden">
              <div className="bg-gray-100 border-b border-border px-4 py-3">
                <h3 className="font-bold text-sm">{brand.name} — Brand Snapshot</h3>
              </div>
              <div className="divide-y divide-border text-xs">
                {[
                  ["Founded",         brand.snapshot.founded],
                  ["Headquarters",    brand.snapshot.headquarters],
                  ["Parent Company",  brand.snapshot.parentCompany],
                  ["Assembly",        brand.snapshot.assemblyLocation],
                  ["Market",          brand.snapshot.primaryMarket],
                  ["Price Range",     brand.snapshot.priceRange],
                  ["Power",           brand.snapshot.powerTypes?.join(", ")],
                  ["Warranty",        brand.snapshot.warrantyHighlight],
                ].filter(([, v]) => !!v).map(([label, value]) => (
                  <div key={label as string} className="px-4 py-2.5 flex flex-col gap-0.5">
                    <span className="text-muted-foreground font-medium">{label}</span>
                    <span className="text-foreground leading-snug">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sources */}
            {brand.sources.length > 0 && (
              <div className="rounded-xl border border-border bg-white p-4 space-y-2">
                <h3 className="font-bold text-sm">Sources &amp; References</h3>
                <ul className="space-y-1.5">
                  {brand.sources.map((src, i) => (
                    <li key={i}>
                      <a href={src.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-green-700 hover:underline">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {src.label}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground pt-1 border-t border-border mt-2">
                  Last verified: {brand.lastVerified}
                </p>
              </div>
            )}

            {/* Deal Checker CTA */}
            <div className="rounded-xl border border-border bg-white p-4 space-y-3">
              <p className="font-bold text-sm">Evaluating a {brand.name} listing?</p>
              <p className="text-xs text-muted-foreground">
                Paste any listing URL to get an instant market price comparison.
              </p>
              <a href="/#/deal-checker"
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
                Check a Deal <ChevronRight className="h-4 w-4" />
              </a>
            </div>

            {/* All Brands */}
            <div className="rounded-xl border border-border bg-white p-4 space-y-3">
              <h3 className="font-bold text-sm">All Brands on GolfCartWise</h3>
              <div className="flex flex-wrap gap-1.5">
                {BRAND_WIKI.filter(b => b.slug !== brand.slug).map(b => (
                  <Link key={b.slug} href={`/brands/${b.slug}`}
                    className="px-2.5 py-1 rounded-full border border-border text-xs hover:bg-secondary transition-colors">
                    {b.name}
                  </Link>
                ))}
              </div>
            </div>

          </aside>
        </div>{/* end two-col */}
      </div>
    </div>
  );
}
