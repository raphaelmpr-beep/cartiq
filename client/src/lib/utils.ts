import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DealRating } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price?: number | null): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

export function dealRatingLabel(rating?: DealRating | string | null): string {
  switch (rating) {
    case "great_deal": return "Great Deal";
    case "good_deal": return "Good Deal";
    case "fair_price": return "Fair Price";
    case "high_price": return "High Price";
    case "over_market": return "Over Market";
    default: return "Unknown";
  }
}

export function dealRatingClass(rating?: string | null): string {
  switch (rating) {
    case "great_deal": return "deal-great";
    case "good_deal": return "deal-good";
    case "fair_price": return "deal-fair";
    case "high_price": return "deal-high";
    case "over_market": return "deal-over";
    default: return "deal-unknown";
  }
}

export function dealDeltaText(delta?: number | null): string {
  if (delta == null) return "";
  const abs = Math.abs(delta);
  if (delta < 0) return `${formatPrice(abs)} Below Market`;
  if (delta > 0) return `${formatPrice(abs)} Above Market`;
  return "At Market Value";
}

export function dealDeltaColor(delta?: number | null): string {
  if (delta == null) return "text-gray-500";
  if (delta < 0) return "text-green-700";
  if (delta > 100) return "text-red-600";
  return "text-amber-600";
}

export function batteryTypeLabel(bt?: string | null): string {
  switch (bt) {
    case "lithium": return "Lithium";
    case "lead_acid": return "Lead-Acid";
    case "gas": return "Gas";
    default: return "";
  }
}

export function batteryRiskClass(risk?: string | null): string {
  switch (risk) {
    case "high": return "risk-high";
    case "medium": return "risk-medium";
    case "low": return "risk-low";
    default: return "bg-gray-50 text-gray-500";
  }
}

export function sellerTypeLabel(st?: string | null): string {
  switch (st) {
    case "dealer": return "Dealer";
    case "private": return "Private Seller";
    case "retail": return "Retail";
    default: return st || "Unknown";
  }
}

export function sourceBadgeClass(sellerType?: string | null): string {
  switch (sellerType) {
    case "dealer": return "source-dealer";
    case "retail": return "source-retail";
    case "buyer_submitted": return "source-buyer-submitted";
    default: return "source-private";
  }
}

export function yesNoUnknownLabel(val?: string | null): string {
  switch (val) {
    case "yes": return "Yes";
    case "no": return "No";
    default: return "Unknown";
  }
}

export function warrantyProviderLabel(val?: string | null): string {
  switch (val) {
    case "dealer": return "Dealer";
    case "manufacturer": return "Manufacturer";
    case "third_party": return "Third Party";
    case "retailer": return "Retailer";
    case "none": return "None";
    default: return "Unknown";
  }
}

export function scoreColorClass(score?: number | null): string {
  if (score == null) return "text-gray-500";
  if (score >= 75) return "score-high";
  if (score >= 55) return "score-mid";
  return "score-low";
}

export function parseJsonField<T>(json?: string | null, fallback: T[] = []): T[] {
  if (!json) return fallback;
  try { return JSON.parse(json) as T[]; } catch { return fallback; }
}

// Admin token is NOT stored here — the Admin page captures it from the user's
// password input at runtime and passes it directly as the x-admin-token header.
// This prevents the token from being compiled into the client bundle.
