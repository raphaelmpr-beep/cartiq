/**
 * PriceDealsCarousel — hot deals strip with daily freshness indicators.
 * inline={true} = no outer <section> wrapper (used inside hero).
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Tag, MapPin, Users, Zap, RefreshCw, TrendingDown } from "lucide-react";
import { useRef, useState, useCallback, useEffect } from "react";
import { DealBadge } from "./Badges";
import { formatPrice } from "@/lib/utils";
import type { Listing } from "@/lib/types";

// ── Freshness helpers ─────────────────────────────────────────────────────────
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

function FreshnessLabel({ updatedAt }: { updatedAt?: string }) {
  const days = daysSince(updatedAt);
  if (days === null) return null;
  if (days === 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
      <RefreshCw className="h-2.5 w-2.5" /> Updated today
    </span>
  );
  if (days <= 3) return (
    <span className="text-[10px] text-muted-foreground">{days}d ago</span>
  );
  return (
    <span className="text-[10px] text-muted-foreground">{days}d ago</span>
  );
}

function LastRefreshedLabel({ lastUpdated }: { lastUpdated?: string | null }) {
  const days = daysSince(lastUpdated);
  if (days === null) return <span className="text-xs text-muted-foreground">Prices verified daily</span>;
  if (days === 0) return (
    <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
      <RefreshCw className="h-3 w-3" /> Prices refreshed today
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <RefreshCw className="h-3 w-3" /> Last refreshed {days === 1 ? "yesterday" : `${days} days ago`}
    </span>
  );
}

// ── Deal Card ─────────────────────────────────────────────────────────────────
function DealCard({ listing }: { listing: Listing }) {
  const price = listing.salePrice ?? listing.askingPrice ?? listing.regularPrice;
  const marketVal = listing.cartiqEstimatedValue;
  const savings = marketVal && price ? marketVal - price : null;
  const days = daysSince(listing.updatedAt);
  const isPriceDrop = days !== null && days <= 1 && savings && savings > 0;

  return (
    <Link
      href={`/listing/${listing.slug || listing.id}`}
      className="block shrink-0 w-56 sm:w-64 rounded-xl border border-border bg-white overflow-hidden hover:shadow-md transition-shadow group"
      data-testid={`carousel-card-${listing.id}`}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            decoding="async"
            width={400}
            height={300}
            onError={(e) => {
              const t = e.currentTarget;
              t.onerror = null;
              t.style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
            <Zap className="h-8 w-8 opacity-20" />
          </div>
        )}
        {/* Deal badge top-left */}
        <div className="absolute top-2 left-2">
          <DealBadge rating={listing.dealRating} />
        </div>
        {/* Price drop pill top-right */}
        {isPriceDrop && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-green-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            <TrendingDown className="h-2.5 w-2.5" /> Price drop
          </div>
        )}
        {/* Savings bottom-right */}
        {savings && savings > 0 && !isPriceDrop && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Save {formatPrice(savings)}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-1.5">
        <p className="text-xs font-semibold leading-snug line-clamp-2 text-foreground group-hover:text-green-700 transition-colors">
          {listing.title}
        </p>
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            {listing.city && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" />{listing.city}, {listing.state}
              </span>
            )}
            {listing.seating && (
              <span className="flex items-center gap-0.5">
                <Users className="h-2.5 w-2.5" />{listing.seating}p
              </span>
            )}
          </div>
          <FreshnessLabel updatedAt={listing.updatedAt} />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-base font-bold text-foreground">
            {price ? formatPrice(price) : "Call"}
          </span>
          {marketVal && price && marketVal > price && (
            <span className="text-[10px] text-muted-foreground line-through">
              {formatPrice(marketVal)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Main Carousel ─────────────────────────────────────────────────────────────
export function PriceDealsCarousel({ inline = false }: { inline?: boolean }) {
  const { data: deals = [], isLoading: dealsLoading } = useQuery<Listing[]>({
    queryKey: ["/api/listings/hot-deals"],
  });

  const { data: meta } = useQuery<{ lastUpdated: string | null }>({
    queryKey: ["/api/listings/hot-deals-meta"],
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const SCROLL_AMT = 280;
  const AUTO_INTERVAL_MS = 5000;

  const scroll = useCallback((dir: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -SCROLL_AMT : SCROLL_AMT, behavior: "smooth" });
  }, []);

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  // Auto-advance every 5 seconds; wraps back to start when at the end
  useEffect(() => {
    if (isPaused || !deals.length) return;
    const id = setInterval(() => {
      const el = trackRef.current;
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: SCROLL_AMT, behavior: "smooth" });
      }
    }, AUTO_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPaused, deals.length]);

  const padClass = inline ? "px-4 py-4" : "px-4 py-8";

  if (dealsLoading) {
    const skeleton = (
      <div className={`max-w-7xl mx-auto ${padClass}`}>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shrink-0 w-56 sm:w-64 h-56 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
    return inline ? skeleton : (
      <section className="border-b border-border bg-white">{skeleton}</section>
    );
  }

  if (!deals.length) return null;

  const inner = (
    <div className={`max-w-7xl mx-auto ${padClass}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-green-600 shrink-0" />
            <h2 className="text-base font-bold">Price Adjustments &amp; Hot Deals</h2>
          </div>
          <LastRefreshedLabel lastUpdated={meta?.lastUpdated} />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { scroll("left"); setIsPaused(true); setTimeout(() => setIsPaused(false), AUTO_INTERVAL_MS); }}
            disabled={!canLeft}
            className="p-1.5 rounded-full border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Scroll left"
            data-testid="carousel-scroll-left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => { scroll("right"); setIsPaused(true); setTimeout(() => setIsPaused(false), AUTO_INTERVAL_MS); }}
            disabled={!canRight}
            className="p-1.5 rounded-full border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Scroll right"
            data-testid="carousel-scroll-right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable track */}
      <div
        ref={trackRef}
        onScroll={onScroll}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        className="flex gap-3 overflow-x-auto pb-2 scroll-smooth"
        style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {deals.map((listing) => (
          <div key={listing.id} style={{ scrollSnapAlign: "start" }}>
            <DealCard listing={listing} />
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-[10px] text-muted-foreground mt-2">
        Prices verified daily via dealer sites. Subject to dealer confirmation.{" "}
        <Link href="/search?dealRating=great_deal" className="text-green-700 hover:underline">
          See all great deals
        </Link>
      </p>
    </div>
  );

  return inline ? inner : (
    <section className="border-b border-border bg-white" data-testid="price-deals-carousel-section">
      {inner}
    </section>
  );
}
