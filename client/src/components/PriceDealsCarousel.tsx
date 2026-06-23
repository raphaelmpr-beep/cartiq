/**
 * PriceDealsCarousel — scrolling strip of hot-deal listings (great_deal + good_deal)
 * Shown on the CartIQ homepage between Value Props and Featured Listings.
 * Uses native CSS scroll-snap for smooth swipe on mobile.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Tag, MapPin, Users, Zap } from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { DealBadge } from "./Badges";
import { formatPrice } from "@/lib/utils";
import type { Listing } from "@/lib/types";

const DEAL_LABEL: Record<string, string> = {
  great_deal: "Great Deal",
  good_deal:  "Good Deal",
};

function DealCard({ listing }: { listing: Listing }) {
  const price = listing.salePrice ?? listing.askingPrice ?? listing.regularPrice;
  const marketVal = listing.cartiqEstimatedValue;
  const savings = marketVal && price ? marketVal - price : null;

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
        {/* Deal badge overlay */}
        <div className="absolute top-2 left-2">
          <DealBadge rating={listing.dealRating} />
        </div>
        {/* Savings pill */}
        {savings && savings > 0 && (
          <div className="absolute bottom-2 right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            Save {formatPrice(savings)}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-1.5">
        <p className="text-xs font-semibold leading-snug line-clamp-2 text-foreground group-hover:text-green-700 transition-colors">
          {listing.title}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
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

        {/* Price */}
        <div className="flex items-baseline justify-between">
          <span className="text-base font-bold text-foreground">
            {price ? formatPrice(price) : "Call"}
          </span>
          {marketVal && (
            <span className="text-[10px] text-muted-foreground line-through">
              {formatPrice(marketVal)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function PriceDealsCarousel() {
  const { data: deals = [], isLoading } = useQuery<Listing[]>({
    queryKey: ["/api/listings/hot-deals"],
  });

  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const SCROLL_AMT = 280;

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

  if (isLoading) {
    return (
      <section className="border-b border-border bg-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shrink-0 w-56 sm:w-64 h-52 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!deals.length) return null;

  return (
    <section className="border-b border-border bg-white" data-testid="price-deals-carousel-section">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-green-600" />
            <h2 className="text-base font-bold">Price Adjustments &amp; Hot Deals</h2>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              — verified great &amp; good deals across FL &amp; GA
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => scroll("left")}
              disabled={!canLeft}
              className="p-1.5 rounded-full border border-border hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Scroll left"
              data-testid="carousel-scroll-left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scroll("right")}
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
          className="flex gap-3 overflow-x-auto pb-2 scroll-smooth"
          style={{
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {deals.map((listing) => (
            <div key={listing.id} style={{ scrollSnapAlign: "start" }}>
              <DealCard listing={listing} />
            </div>
          ))}
        </div>

        {/* Sub-label */}
        <p className="text-[10px] text-muted-foreground mt-2">
          Deal ratings based on CartIQ market comps. Prices subject to dealer confirmation.{" "}
          <Link href="/search?dealRating=great_deal" className="text-green-700 hover:underline">
            See all great deals →
          </Link>
        </p>
      </div>
    </section>
  );
}
