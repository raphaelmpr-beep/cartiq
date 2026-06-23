import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, ClipboardCheck, TrendingDown, ShieldCheck, Truck, BookOpen, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListingCard } from "@/components/ListingCard";
import { MarketCompareCard } from "@/components/MarketCompareCard";
import type { Listing, SeoArticle } from "@/lib/types";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { setSEO } from "@/lib/seo";
import { PriceDealsCarousel } from "@/components/PriceDealsCarousel";

// Navigate to a hash route with query params encoded INSIDE the hash
// e.g. hashNav("/search", { city: "Nocatee", state: "FL" })
// → sets window.location.hash = "#/search?city=Nocatee&state=FL"
function hashNav(path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  window.location.hash = qs ? `#${path}?${qs}` : `#${path}`;
}

export default function Home() {
  // SEO
  useEffect(() => {
    setSEO({
      title: "Know the Right Cart. Pay the Right Price.",
      description: "CartIQ is Florida & Georgia's golf cart price intelligence platform. Compare dealer prices, check fair value, and find great deals on new and used golf carts.",
      canonical: "https://cartiq-chi.vercel.app/",
    });
  }, []);
  const [dealUrl, setDealUrl] = useState("");
  const [heroSearch, setHeroSearch] = useState("");
  const [, navigate] = useLocation();

  function handleHeroSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = heroSearch.trim() ? { q: heroSearch.trim() } : {};
    hashNav("/search", params);
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
    hashNav("/deal-checker");
  }

  return (
    <div className="min-h-screen">
      {/* ─── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-gray-50 to-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-20">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Copy */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full text-xs font-semibold">
                Florida & Georgia Golf Cart Intelligence
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight text-foreground">
                Know the Right Cart.<br />
                <span className="text-green-600">Pay the Right Price.</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg">
                Compare dealer, private, Facebook-submitted, and retail golf cart deals. Check fair value, battery setup, warranty, and delivery-adjusted pricing before you buy.
              </p>
              {/* Hero search input */}
              <form onSubmit={handleHeroSearch} className="flex gap-2 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Brand, model, city…"
                    value={heroSearch}
                    onChange={(e) => setHeroSearch(e.target.value)}
                    data-testid="hero-search-input"
                  />
                </div>
                <Button type="submit" className="gap-2 shrink-0" data-testid="hero-search-btn">
                  <Search className="h-4 w-4" /> Search
                </Button>
              </form>
              <div className="flex flex-wrap gap-3">
                <Link href="/deal-checker" className="inline-flex">
                  <Button size="lg" variant="outline" className="gap-2" data-testid="hero-deal-checker-btn">
                    <ClipboardCheck className="h-4 w-4" /> Check a Deal
                  </Button>
                </Link>
              </div>

              {/* Quick search module */}
              <div className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-3 max-w-md">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Search</p>
                <div className="flex flex-wrap gap-2">
                  {["Nocatee, FL", "The Villages, FL", "Jacksonville, FL", "Orlando, FL", "Atlanta, GA", "Peachtree City, GA"].map((loc) => {
                    const [city, state] = loc.split(", ");
                    return (
                      <button
                        key={loc}
                        onClick={() => hashNav("/search", { city, state })}
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
                      onClick={() => hashNav("/search", params)}
                      className="text-green-700 hover:underline cursor-pointer"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Market Compare Card */}
            <div className="flex justify-center md:justify-end">
              <MarketCompareCard listing={sampleCompare} />
            </div>
          </div>
        </div>
      </section>

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

      {/* ─── Price Deals Carousel ─────────────────────────────────────────────── */}
      <PriceDealsCarousel />

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

      {/* ─── Bottom CTA ───────────────────────────────────────────────────────── */}
      <section className="bg-foreground text-background">
        <div className="max-w-3xl mx-auto px-4 py-14 text-center space-y-6">
          <h2 className="text-2xl font-bold">Check Any Golf Cart Deal in Seconds</h2>
          <p className="text-sm text-muted opacity-80">
            Find a cart on Facebook, Craigslist, a dealer site, or Costco. Paste the link, enter the details, and get your CartIQ report.
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
