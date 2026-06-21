export type DealRating = "great_deal" | "good_deal" | "fair_price" | "high_price" | "over_market" | "unknown";
export type BatteryType = "lithium" | "lead_acid" | "gas" | "unknown";
export type SellerType = "dealer" | "private" | "retail";
export type WarrantyStatus = "yes" | "no" | "unknown";
export type YesNoUnknown = "yes" | "no" | "unknown";

export interface Listing {
  id: number;
  title: string;
  slug: string;
  description?: string;
  sourceType: string;
  sourceUrl?: string;
  publicListing: boolean;
  sellerType: string;
  status: string;
  dealerId?: number;
  retailSourceId?: number;
  retailerName?: string;
  retailerSku?: string;
  retailerProductUrl?: string;
  retailEventName?: string;
  availabilityStatus?: string;
  shipToStates?: string;
  lastVerifiedAt?: string;
  askingPrice?: number;
  regularPrice?: number;
  salePrice?: number;
  cartiqEstimatedValue?: number;
  estimatedDeliveryCost?: number;
  totalDeliveredCost?: number;
  dealDelta?: number;
  dealRating?: DealRating;
  buyerScore?: number;
  year?: number;
  brand?: string;
  model?: string;
  condition?: string;
  powerType?: string;
  batteryType?: BatteryType;
  batteryAh?: number;
  batteryAgeMonths?: number;
  seating?: number;
  lifted?: boolean;
  streetLegalClaimed?: boolean;
  streetLegalConfidence?: string;
  chargerIncluded?: YesNoUnknown;
  warrantyIncluded?: WarrantyStatus;
  warrantyProvider?: string;
  warrantyMonths?: number;
  batteryWarrantyIncluded?: YesNoUnknown;
  warrantyNotes?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number | null;
  lng?: number | null;
  deliveryAvailable?: boolean;
  deliveryIncluded?: boolean;
  deliveryNotes?: string;
  imageUrl?: string;
  imageUrls?: string;  // JSON array string
  sellerName?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DealCheck {
  id: number;
  sourcePlatform: string;
  sourceUrl?: string;
  askingPrice?: number;
  year?: number;
  brand?: string;
  model?: string;
  city?: string;
  state?: string;
  cartiqEstimatedValue?: number;
  totalDeliveredCost?: number;
  dealDelta?: number;
  dealRating?: DealRating;
  buyerScore?: number;
  batteryRisk?: string;
  chargerWarning?: string;
  warrantySignal?: string;
  streetLegalConfidence?: string;
  redFlags?: string; // JSON
  questionsToAsk?: string; // JSON
  negotiationLow?: number;
  negotiationHigh?: number;
  pilotWarning?: string;
  createdAt: string;
}

export interface SeoArticle {
  id: number;
  title: string;
  slug: string;
  metaDescription?: string;
  canonicalPath?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string; // JSON
  h1?: string;
  shortAnswer?: string;
  body?: string;
  faqJson?: string; // JSON
  published: boolean;
  updatedAt: string;
}

export interface Dealer {
  id: number;
  name: string;
  slug: string;
  websiteUrl?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  deliveryAvailable?: boolean;
  deliveryBaseFee?: number;
  defaultWarrantyIncluded?: boolean;
  defaultWarrantyMonths?: number;
}

export interface InventorySource {
  id: number;
  name: string;
  sourceType: string;
  status: string;
  allowedUseNotes?: string;
}
