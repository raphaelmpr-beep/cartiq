import { cn, dealRatingLabel, dealRatingClass, batteryTypeLabel, batteryRiskClass, sourceBadgeClass, sellerTypeLabel, scoreColorClass, yesNoUnknownLabel, dealDeltaText, dealDeltaColor } from "@/lib/utils";
import { Shield, Zap, Truck, Star, AlertTriangle, CheckCircle, XCircle, HelpCircle } from "lucide-react";

// ── DealBadge ─────────────────────────────────────────────────────────────────
export function DealBadge({ rating, className }: { rating?: string | null; className?: string }) {
  if (!rating || rating === "unknown") return null;
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold", dealRatingClass(rating), className)}>
      {dealRatingLabel(rating)}
    </span>
  );
}

// ── DealDeltaBadge ────────────────────────────────────────────────────────────
export function DealDeltaBadge({ delta, className }: { delta?: number | null; className?: string }) {
  if (delta == null) return null;
  return (
    <span className={cn("text-sm font-semibold", dealDeltaColor(delta), className)}>
      {dealDeltaText(delta)}
    </span>
  );
}

// ── BuyerScoreBadge ───────────────────────────────────────────────────────────
export function BuyerScoreBadge({ score, className }: { score?: number | null; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Star className="h-3.5 w-3.5" />
      <span className={cn("text-sm font-bold", scoreColorClass(score))}>
        {score ?? "—"}<span className="text-xs font-normal text-muted-foreground">/100</span>
      </span>
    </div>
  );
}

// ── BatteryRiskBadge ──────────────────────────────────────────────────────────
export function BatteryRiskBadge({ risk, batteryType, batteryAh, className }: {
  risk?: string | null;
  batteryType?: string | null;
  batteryAh?: number | null;
  className?: string;
}) {
  if ((!batteryType || batteryType === "unknown") && !batteryAh) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium", batteryRiskClass(risk), className)}>
      <Zap className="h-3 w-3" />
      {batteryTypeLabel(batteryType)}{batteryAh ? ` ${batteryAh}Ah` : ""}
    </span>
  );
}

// ── SourceBadge ───────────────────────────────────────────────────────────────
export function SourceBadge({ sellerType, sourceType, retailerName, className }: {
  sellerType?: string | null;
  sourceType?: string | null;
  retailerName?: string | null;
  className?: string;
}) {
  let label = sellerTypeLabel(sellerType);
  if (sellerType === "retail" && retailerName) label = retailerName;
  else if (sourceType === "buyer_submitted") label = "Buyer-Submitted";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", sourceBadgeClass(sellerType), className)}>
      {label}
    </span>
  );
}

// ── WarrantyBadge ─────────────────────────────────────────────────────────────
export function WarrantyBadge({ warrantyIncluded, warrantyMonths, className }: {
  warrantyIncluded?: string | null;
  warrantyMonths?: number | null;
  className?: string;
}) {
  // Only render when we have a definitive yes/no — hide when unknown/null
  if (!warrantyIncluded || warrantyIncluded === "unknown") return null;

  const icon = warrantyIncluded === "yes"
    ? <CheckCircle className="h-3 w-3" />
    : <XCircle className="h-3 w-3" />;

  const cls = warrantyIncluded === "yes"
    ? "bg-green-50 text-green-700 border border-green-200"
    : "bg-gray-50 text-gray-500 border border-gray-200";

  const label = warrantyIncluded === "yes"
    ? `Warranty${warrantyMonths ? ` (${warrantyMonths}mo)` : ""}`
    : "No Warranty";

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium", cls, className)}>
      {icon} {label}
    </span>
  );
}

// ── StreetLegalBadge ──────────────────────────────────────────────────────────
export function StreetLegalBadge({ streetLegalClaimed, streetLegalConfidence, className }: {
  streetLegalClaimed?: boolean | null;
  streetLegalConfidence?: string | null;
  className?: string;
}) {
  if (!streetLegalClaimed) return null;
  const cls = streetLegalConfidence === "high"
    ? "bg-blue-50 text-blue-700 border border-blue-200"
    : "bg-amber-50 text-amber-700 border border-amber-200";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium", cls, className)}>
      <Shield className="h-3 w-3" /> Street Legal{streetLegalConfidence !== "high" ? " (Unverified)" : ""}
    </span>
  );
}

// ── DeliveryCostBadge ─────────────────────────────────────────────────────────
export function DeliveryCostBadge({ deliveryIncluded, deliveryCost, deliveryAvailable, className }: {
  deliveryIncluded?: boolean | null;
  deliveryCost?: number | null;
  deliveryAvailable?: boolean | null;
  className?: string;
}) {
  if (deliveryIncluded) {
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200", className)}>
        <Truck className="h-3 w-3" /> Delivery Included
      </span>
    );
  }
  if (deliveryCost != null && deliveryCost > 0) {
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200", className)}>
        <Truck className="h-3 w-3" /> +${deliveryCost.toLocaleString()} Delivery
      </span>
    );
  }
  if (deliveryAvailable) {
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200", className)}>
        <Truck className="h-3 w-3" /> Delivery Quote Needed
      </span>
    );
  }
  // No delivery info — render nothing
  return null;
}

// ── RetailSourceBadge ─────────────────────────────────────────────────────────
export function RetailSourceBadge({ retailerName, lastVerifiedAt, availabilityStatus, className }: {
  retailerName?: string | null;
  lastVerifiedAt?: string | null;
  availabilityStatus?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("rounded border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-800 space-y-1", className)}>
      <div className="font-semibold">{retailerName || "Retail Source"}</div>
      {availabilityStatus && <div>Availability: {availabilityStatus}</div>}
      {lastVerifiedAt
        ? <div className="text-purple-600">Price/availability last verified: {lastVerifiedAt}</div>
        : <div className="text-purple-500">Availability may vary by location. Verify on retailer site.</div>
      }
    </div>
  );
}
