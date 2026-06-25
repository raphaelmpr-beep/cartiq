import { formatPrice, dealRatingLabel, dealRatingClass, dealDeltaColor, dealDeltaText } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/types";

export function MarketCompareCard({ listing }: { listing: Partial<Listing> }) {
  const effectivePrice = listing.salePrice ?? listing.askingPrice ?? listing.regularPrice;

  return (
    <div className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-3 max-w-sm w-full" data-testid="market-compare-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">GolfCartWise Market Compare</span>
        {listing.dealRating && (
          <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", dealRatingClass(listing.dealRating))}>
            {dealRatingLabel(listing.dealRating)}
          </span>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Asking Price</span>
          <span className="font-medium">{formatPrice(effectivePrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">GolfCartWise Value</span>
          <span className="font-semibold">{formatPrice(listing.cartiqEstimatedValue)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Delivery</span>
          <span className={listing.deliveryIncluded ? "text-green-600 font-medium" : "text-muted-foreground"}>
            {listing.deliveryIncluded ? "Included" : listing.estimatedDeliveryCost ? formatPrice(listing.estimatedDeliveryCost) : "Quote Needed"}
          </span>
        </div>
        <div className="flex justify-between border-t pt-2">
          <span className="text-muted-foreground">Total Delivered</span>
          <span className="font-bold">{listing.totalDeliveredCost ? formatPrice(listing.totalDeliveredCost) : "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Warranty</span>
          <span className={listing.warrantyIncluded === "yes" ? "text-green-700 font-medium" : "text-muted-foreground"}>
            {listing.warrantyIncluded === "yes" ? "Included" : listing.warrantyIncluded === "no" ? "No Warranty Listed" : "Unknown"}
          </span>
        </div>
      </div>

      <div className={cn("text-center font-bold text-base pt-1 border-t", dealDeltaColor(listing.dealDelta))}>
        {dealDeltaText(listing.dealDelta)}
      </div>
    </div>
  );
}
