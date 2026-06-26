import { Link } from "wouter";
import { useState, useCallback } from "react";
import { MapPin, Users, Phone, Store, ExternalLink, Car } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DealBadge, SourceBadge, WiseScoreBadge, WarrantyBadge, DeliveryCostBadge, BatteryRiskBadge, DealDeltaBadge, StreetLegalBadge, RetailSourceBadge } from "./Badges";
import { formatPrice, batteryTypeLabel } from "@/lib/utils";
import SaveButton from "./SaveButton";
import WatchButton from "./WatchButton";
import type { Listing } from "@/lib/types";

interface ListingCardProps {
  listing: Listing;
  compact?: boolean;
  priority?: boolean; // true for above-the-fold cards (LCP)
}

function weservUrl(url: string) {
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=400&h=300&output=webp&fit=inside`;
}

function triggerCacheImage(id: number, imageUrl: string) {
  // Fire-and-forget: cache image to Supabase Storage
  fetch("/api/admin/cache-image", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-token": "cartiq2024" },
    body: JSON.stringify({ id, imageUrl }),
  }).catch(() => {/* silent */});
}

export function ListingCard({ listing, compact, priority = false }: ListingCardProps) {
  const effectivePrice = listing.salePrice ?? listing.askingPrice ?? listing.regularPrice;

  // Image fallback chain: original → weserv.nl proxy → placeholder
  type ImgStage = "original" | "weserv" | "failed";
  const [imgStage, setImgStage] = useState<ImgStage>(listing.imageUrl ? "original" : "failed");
  const [imgSrc, setImgSrc] = useState<string | null>(listing.imageUrl ?? null);

  const handleImgError = useCallback(() => {
    if (imgStage === "original" && listing.imageUrl) {
      // Try weserv.nl proxy
      setImgSrc(weservUrl(listing.imageUrl));
      setImgStage("weserv");
    } else {
      // Both failed — show placeholder
      setImgStage("failed");
    }
  }, [imgStage, listing.imageUrl]);

  const handleImgLoad = useCallback(() => {
    if (imgStage === "weserv" && listing.imageUrl) {
      // weserv succeeded — cache to Supabase Storage in background
      triggerCacheImage(listing.id, listing.imageUrl);
    }
  }, [imgStage, listing.id, listing.imageUrl]);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow bg-card" data-testid={`card-listing-${listing.id}`}>
      {/* Image */}
      <div className="relative aspect-[16/9] bg-muted overflow-hidden">
        {imgStage !== "failed" && imgSrc ? (
          <img
            src={imgSrc}
            alt={listing.title}
            className="w-full h-full object-cover"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding={priority ? "sync" : "async"}
            width={400}
            height={225}
            onError={handleImgError}
            onLoad={handleImgLoad}
          />
        ) : null}
        {imgStage === "failed" && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-muted text-muted-foreground gap-2">
            <Car className="h-10 w-10 opacity-25" />
            <span className="text-xs opacity-40 font-medium">{listing.brand ?? "Golf Cart"}</span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <DealBadge rating={listing.dealRating} />
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <SaveButton listingId={listing.id} size="sm" />
          <WatchButton listingId={listing.id} size="sm" />
        </div>
        <div className="absolute bottom-2 right-2">
          <SourceBadge sellerType={listing.sellerType} sourceType={listing.sourceType} retailerName={listing.retailerName} />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-sm leading-tight line-clamp-2" data-testid={`text-title-${listing.id}`}>{listing.title}</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <MapPin className="h-3 w-3" />
            {listing.city}{listing.city && listing.state ? ", " : ""}{listing.state}
          </div>
        </div>

        {/* Specs row */}
        <div className="flex flex-wrap gap-1.5">
          <BatteryRiskBadge batteryType={listing.batteryType} batteryAh={listing.batteryAh} />
          {listing.seating && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">
              <Users className="h-3 w-3" />{listing.seating}-Seat
            </span>
          )}
          {listing.lifted && (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-xs text-muted-foreground">Lifted</span>
          )}
          <WarrantyBadge warrantyIncluded={listing.warrantyIncluded} warrantyMonths={listing.warrantyMonths} />
          <StreetLegalBadge streetLegalClaimed={listing.streetLegalClaimed} streetLegalConfidence={listing.streetLegalConfidence} />
        </div>

        {/* Pricing */}
        <div className="space-y-1">
          {listing.sellerType === "retail" && listing.regularPrice && listing.salePrice && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground line-through">{formatPrice(listing.regularPrice)}</span>
              <span className="font-semibold text-green-700">{formatPrice(listing.salePrice)}</span>
              <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Sale</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-foreground" data-testid={`text-price-${listing.id}`}>{formatPrice(effectivePrice)}</div>
              {listing.cartiqEstimatedValue && (
                <div className="text-xs text-muted-foreground">GolfCartIQ Value: {formatPrice(listing.cartiqEstimatedValue)}</div>
              )}
            </div>
            <WiseScoreBadge score={listing.buyerScore} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <DeliveryCostBadge
              deliveryIncluded={listing.deliveryIncluded}
              deliveryCost={listing.estimatedDeliveryCost}
              deliveryAvailable={listing.deliveryAvailable}
            />
            {listing.totalDeliveredCost && (
              <span className="text-muted-foreground">Total: <strong>{formatPrice(listing.totalDeliveredCost)}</strong></span>
            )}
          </div>
          <DealDeltaBadge delta={listing.dealDelta} />
        </div>

        {/* Seller / dealer name + phone */}
        {(listing.sellerName || listing.sellerPhone) && (
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
            <div className="flex items-center gap-1 min-w-0">
              <Store size={11} className="shrink-0" />
              <span className="truncate font-medium">{listing.sellerName ?? "Seller"}</span>
            </div>
            {listing.sellerPhone && (
              <a
                href={`tel:${listing.sellerPhone.replace(/\D/g, "")}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-green-700 hover:text-green-900 shrink-0 ml-2"
              >
                <Phone size={11} />
                {listing.sellerPhone}
              </a>
            )}
          </div>
        )}

        {/* Retail source notice */}
        {listing.sellerType === "retail" && (
          <RetailSourceBadge
            retailerName={listing.retailerName}
            lastVerifiedAt={listing.lastVerifiedAt}
            availabilityStatus={listing.availabilityStatus}
          />
        )}

        <div className="flex gap-2 mt-1">
          <Link href={`/listing/${listing.slug || listing.id}`} className="flex-1">
            <Button className="w-full" size="sm" data-testid={`btn-view-deal-${listing.id}`}>
              {listing.sellerType === "retail" ? "View Retailer" : "View Deal"}
            </Button>
          </Link>
          {listing.sourceUrl && (
            <a
              href={listing.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="View on dealer site"
              data-testid={`btn-source-link-${listing.id}`}
            >
              <Button variant="outline" size="sm" className="px-2.5">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
