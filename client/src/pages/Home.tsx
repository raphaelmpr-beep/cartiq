import { Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, ClipboardCheck, TrendingDown, ShieldCheck, Truck, BookOpen, ChevronRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListingCard } from "@/components/ListingCard";
import { MarketCompareCard } from "@/components/MarketCompareCard";
import type { Listing, SeoArticle } from "@/lib/types";
import { useState, useEffect } from "react";
import { setSEO } from "@/lib/seo";
import { PriceDealsCarousel } from "@/components/PriceDealsCarousel";

export default function Home() {
  // SEO
  useEffect(() => {
    setSEO({
      title: "Know the Right Cart. Pay the Right Price.",
      description: "GolfCartWise helps buyers compare golf carts, prices, dealers, battery types, warranties, delivery options, and deal ratings across Florida and Georgia.",
      canonical: "https://golfcartwise.app/",
    });
  }, []);
  const [dealUrl, setDealUrl] = useState("");
  const [heroSearch, setHeroSearch] = useState("");
  const [, navigate] = useHashLocation();

  // Navigate to a route with query params using wouter's native navigate.
  // wouter puts params in location.search (not inside location.hash), so
  // Search.tsx reads them from location.search.
  function navWithParams(path: string, params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    navigate(qs ? `${path}?${qs}` : path);
  }

  function handleHeroSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = heroSearch.trim() ? { q: heroSearch.trim() } : {};
    navWithParams("/search", params);
  }

  const { data: listings = [] } = useQuery<Listing[]>({
    queryKey: ["/api/listings"],
  });

  const { data: articles = [] } = useQuery<SeoArticle[]>({
    queryKey: ["/api/buyer-guide"],
  });

  const featured = listings.slice(0, 3);
  const guideCards = articles.slice(0, 3);

  const sampleCompare: Partial<Listing> = {
    askingPrice: 12500,
    cartiqEstimatedValue: 10800,
    estimatedDeliveryCost: 299,
    totalDeliveredCost: 12799,
    dealDelta: 1999,
    dealRating: "high_price",
    warrantyIncluded: "yes",
    deliveryIncluded: false,
  };

  function handleDealCheck(e: React.FormEvent) {
    e.preventDefault();
    navigate("/deal-checker");
  }

  return (
    <div className="min-h-screen">
      {/* ─── Hero + Hot Deals (above the fold) ─────────────────────────────── */}
      <section className="bg-gradient-to-br from-gray-50 to-white border-b border-border">
        {/* Top bar: headline + search */}
        <div className="max-w-7xl mx-auto px-4 pt-5 pb-4 md:pt-7 md:pb-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="space-y-2 md:space-y-3">
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full text-xs font-semibold">
                Know before you buy.
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight text-foreground">
                Find the right golf cart{" "}
                <span className="text-green-600">at the right price.</span>
              </h1>
            </div>
            {/* Search bar — right-aligned on desktop, full-width on mobile */}
            <form onSubmit={handleHeroSearch} className="flex gap-2 w-full md:max-w-sm shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Brand, model, city, zip…"
                  value={heroSearch}
                  onChange={(e) => setHeroSearch(e.target.value)}
                  data-testid="hero-search-input"
                />
              </div>
              <Button type="submit" className="gap-2 shrink-0" data-testid="hero-search-btn">
                <Search className="h-4 w-4" /> Search Golf Carts
              </Button>
            </form>
          </div>
        </div>

        {/* ── Hot Deals strip — NO section gap, directly under headline ── */}
        <div className="border-t border-border">
          <PriceDealsCarousel inline />
        </div>
      </section>

      {/* ─── Featured Listings ────────────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="bg-gray-50 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Recent Listings</h2>
              <Link href="/search" className="text-sm text-green-700 hover:underline flex items-center gap-1">
                See all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {featured.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Value Props ──────────────────────────────────────────────────────── */}
      <section className="border-b border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <TrendingDown className="h-6 w-6 text-green-600" />,
                title: "Fair Value",
                desc: "Real market-based comparison. Know if you're looking at a great deal or an overpriced cart — before you buy.",
              },
              {
                icon: <ShieldCheck className="h-6 w-6 text-blue-600" />,
                title: "Buyer Confidence",
                desc: "Battery type, age, charger, street-legal status, warranty, and red flag checks in every report.",
              },
              {
                icon: <Truck className="h-6 w-6 text-amber-600" />,
                title: "Delivery-Adjusted Pricing",
                desc: "Total delivered cost includes delivery — so you're comparing apples to apples, not just sticker prices.",
              },
            ].map((card) => (
              <div key={card.title} className="flex gap-4 p-5 rounded-xl border border-border bg-white hover:shadow-sm transition-shadow">
                <div className="shrink-0 mt-0.5">{card.icon}</div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{card.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Popular Markets + Quick Search ────────────────────────────────── */}
      <section className="border-b border-border bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h2 className="text-sm font-bold">Popular Golf Cart Markets</h2>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "The Villages, FL",     slug: "the-villages-fl" },
                  { label: "Wildwood, FL",          slug: "wildwood-fl" },
                  { label: "Lady Lake, FL",         slug: "lady-lake-fl" },
                  { label: "Nocatee, FL",           slug: "nocatee-fl" },
                  { label: "Panama City Beach, FL", slug: "panama-city-beach-fl" },
                  { label: "Peachtree City, GA",    slug: "peachtree-city-ga" },
                  { label: "Jacksonville, FL",      slug: "jacksonville-fl" },
                  { label: "Clearwater, FL",        slug: "clearwater-fl" },
                ].map(({ label, slug }) => (
                  <Link key={slug} href={`/golf-carts-for-sale/${slug}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-xs hover:bg-secondary hover:border-green-200 transition-colors">
                    <MapPin className="h-3 w-3 text-green-600" />{label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-sm font-bold">Quick Search</h2>
              <div className="flex flex-wrap gap-2">
                {["Nocatee, FL", "The Villages, FL", "Jacksonville, FL", "Orlando, FL", "Atlanta, GA", "Peachtree City, GA"].map((loc) => {
                  const [city, state] = loc.split(", ");
                  return (
                    <button
                      key={loc}
                      onClick={() => navWithParams("/search", { city, state })}
                      className="text-xs px-2.5 py-1.5 rounded-full border border-border hover:bg-secondary transition-colors cursor-pointer"
                    >
                      {loc}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Filter by:</span>
                {([
                  ["Lithium", { batteryType: "lithium" }],
                  ["Dealer", { sellerType: "dealer" }],
                  ["Street Legal", { streetLegal: "true" }],
                  ["With Warranty", { warrantyIncluded: "yes" }],
                ] as [string, Record<string, string>][]).map(([label, params]) => (
                  <button
                    key={label}
                    onClick={() => navWithParams("/search", params)}
                    className="text-green-700 hover:underline cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* ─── Buyer Guide Cards ────────────────────────────────────────────────── */}
      {guideCards.length > 0 && (
        <section className="bg-white border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Learn Before You Buy</h2>
              <Link href="/buyer-guide" className="text-sm text-green-700 hover:underline flex items-center gap-1">
                All guides <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {guideCards.map((article) => (
                <Link
                  key={article.id}
                  href={`/buyer-guide/${article.slug}`}
                  className="block p-5 rounded-xl border border-border bg-gray-50 hover:bg-white hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <BookOpen className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-sm leading-snug mb-1 group-hover:text-green-700 transition-colors">{article.title}</h3>
                      {article.shortAnswer && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{article.shortAnswer}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}


      {/* ─── Popular Buyer Guides ───────────────────────────────────────── */}
      <section className="border-b border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="space-y-3">
            <h2 className="text-sm font-bold">Popular Buyer Guides</h2>
            <ul className="flex flex-wrap gap-x-6 gap-y-1.5">
              {[
                { label: "Lithium vs Lead-Acid Batteries",            href: "/golf-cart-batteries/lithium-vs-lead-acid" },
                { label: "105Ah vs 150Ah — Which Range Do You Need?",  href: "/golf-cart-batteries/105ah-vs-150ah" },
                { label: "Does a Used Golf Cart Include a Charger?",    href: "/golf-cart-batteries/charger-included" },
                { label: "E-Z-GO Golf Carts — Buyer Guide",              href: "/brands/ezgo" },
                { label: "How GolfCartWise Works",                 href: "/how-it-works" },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-green-700 hover:underline flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" />{label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      {/* ─── Bottom CTA ───────────────────────────────────────────────────────── */}
      <section className="bg-foreground text-background">
        <div className="max-w-3xl mx-auto px-4 py-14 text-center space-y-6">
          <h2 className="text-2xl font-bold">Check Any Cart's Value in Seconds</h2>
          <p className="text-sm text-muted opacity-80">
            Enter a cart's details and get an instant GolfCartWise Value estimate, Wise Deal Rating, WiseScore, and buyer checklist.
          </p>
          <form onSubmit={handleDealCheck} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <Input
              value={dealUrl}
              onChange={(e) => setDealUrl(e.target.value)}
              placeholder="Paste listing link here"
              className="bg-white text-foreground flex-1"
              data-testid="cta-deal-url-input"
            />
            <Button type="submit" size="lg" variant="secondary" className="shrink-0 gap-2" data-testid="cta-check-deal-btn">
              Check This Deal <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
