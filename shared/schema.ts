// CartIQ shared schema — Supabase/Postgres types
// No Drizzle ORM — Supabase client handles queries directly.

// ─── Users ────────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  email: string;
  name: string | null;
  role: string; // buyer | admin | dealer
  created_at: string;
  updated_at: string;
}
export type InsertUser = Omit<User, 'id' | 'created_at' | 'updated_at'>;

// ─── Dealers ──────────────────────────────────────────────────────────────────
export interface Dealer {
  id: number;
  name: string;
  slug: string;
  website_url: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  service_area_miles: number | null;
  delivery_available: boolean;
  delivery_included: boolean;
  delivery_base_fee: number | null;
  delivery_per_mile_fee: number | null;
  delivery_free_radius_miles: number | null;
  default_warranty_included: boolean;
  default_warranty_months: number | null;
  default_warranty_notes: string | null;
  notes: string | null;
  // ── Google Business Validation ──────────────────────────────────────────
  google_place_id: string | null;
  google_verified_name: string | null;
  google_address: string | null;
  google_phone: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  google_verified_at: string | null;
  /** 'exact' | 'likely' | 'partial' | 'no_match' | 'duplicate_place_id' | 'no_api_key' */
  google_match_score: string | null;
  // ── Site Platform Detection ──────────────────────────────────────────────
  /** 'dealer_spike' | 'dealer_socket' | 'lightspeed' | 'cdk' | 'motility' | 'shopify' | 'wix' | 'squarespace' | 'wordpress' | 'webflow' | 'custom' | 'unreachable' | 'unknown' */
  site_platform: string | null;
  site_platform_notes: string | null;
  /** slug of the canonical dealer if this record is a duplicate */
  is_duplicate_of: string | null;
  created_at: string;
  updated_at: string;
}
export type InsertDealer = Omit<Dealer, 'id' | 'created_at' | 'updated_at'>;

// ─── RetailSources ────────────────────────────────────────────────────────────
export interface RetailSource {
  id: number;
  name: string;
  slug: string;
  website_url: string | null;
  source_type: string;
  authorized_mode: string;
  allowed_use_notes: string | null;
  created_at: string;
  updated_at: string;
}
export type InsertRetailSource = Omit<RetailSource, 'id' | 'created_at' | 'updated_at'>;

// ─── Listings ─────────────────────────────────────────────────────────────────
export interface Listing {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  source_type: string;
  source_url: string | null;
  public_listing: boolean;
  seller_type: string; // dealer | private | retail
  status: string; // active | pending | sold | inactive | unavailable
  dealer_id: number | null;
  retail_source_id: number | null;
  retailer_name: string | null;
  retailer_sku: string | null;
  retailer_product_url: string | null;
  retail_event_name: string | null;
  retail_event_dates: string | null;
  availability_status: string | null;
  ship_to_states: string | null;
  last_verified_at: string | null;
  asking_price: number | null;
  regular_price: number | null;
  sale_price: number | null;
  cartiq_estimated_value: number | null;
  estimated_delivery_cost: number | null;
  total_delivered_cost: number | null;
  deal_delta: number | null;
  deal_rating: string;
  buyer_score: number;
  year: number | null;
  brand: string | null;
  model: string | null;
  condition: string | null;
  power_type: string;
  battery_type: string;
  battery_ah: number | null;
  battery_age_months: number | null;
  seating: number | null;
  lifted: boolean;
  street_legal_claimed: boolean;
  street_legal_confidence: string;
  charger_included: string;
  warranty_included: string;
  warranty_provider: string;
  warranty_months: number | null;
  battery_warranty_included: string;
  warranty_notes: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  delivery_available: boolean;
  delivery_included: boolean;
  delivery_notes: string | null;
  image_url: string | null;
  image_urls: string | null;
  seller_name: string | null;
  seller_phone: string | null;
  seller_email: string | null;
  created_at: string;
  updated_at: string;
}
export type InsertListing = Omit<Listing, 'id' | 'created_at' | 'updated_at'>;

// ─── DealChecks ───────────────────────────────────────────────────────────────
export interface DealCheck {
  id: number;
  user_id: number | null;
  source_platform: string;
  source_url: string | null;
  extraction_method: string;
  user_confirmed_disclosure: boolean;
  asking_price: number | null;
  regular_price: number | null;
  sale_price: number | null;
  year: number | null;
  brand: string | null;
  model: string | null;
  city: string | null;
  state: string | null;
  seller_type: string | null;
  retailer_name: string | null;
  power_type: string;
  battery_type: string;
  battery_ah: number | null;
  battery_age_months: number | null;
  seating: number | null;
  lifted: string;
  street_legal_claimed: string;
  charger_included: string;
  warranty_included: string;
  warranty_provider: string;
  warranty_months: number | null;
  battery_warranty_included: string;
  warranty_notes: string | null;
  delivery_available: string;
  delivery_cost: number | null;
  last_verified_at: string | null;
  cartiq_estimated_value: number | null;
  total_delivered_cost: number | null;
  deal_delta: number | null;
  deal_rating: string;
  buyer_score: number;
  battery_risk: string;
  charger_warning: string | null;
  warranty_signal: string | null;
  street_legal_confidence: string;
  red_flags: string;
  questions_to_ask: string;
  negotiation_low: number | null;
  negotiation_high: number | null;
  created_at: string;
}
export type InsertDealCheck = Omit<DealCheck, 'id' | 'created_at'>;

// ─── MarketComps ──────────────────────────────────────────────────────────────
export interface MarketComp {
  id: number;
  listing_id: number | null;
  brand: string | null;
  model: string | null;
  year_min: number | null;
  year_max: number | null;
  state: string | null;
  city: string | null;
  radius_miles: number | null;
  sample_size: number | null;
  median_price: number | null;
  adjusted_value: number | null;
  created_at: string;
}
export type InsertMarketComp = Omit<MarketComp, 'id' | 'created_at'>;

// ─── InventorySources ─────────────────────────────────────────────────────────
export interface InventorySource {
  id: number;
  name: string;
  source_type: string;
  status: string;
  base_url: string | null;
  api_provider: string | null;
  allowed_use_notes: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}
export type InsertInventorySource = Omit<InventorySource, 'id' | 'created_at' | 'updated_at'>;

// ─── SeoArticles ──────────────────────────────────────────────────────────────
export interface SeoArticle {
  id: number;
  title: string;
  slug: string;
  meta_description: string | null;
  canonical_path: string | null;
  primary_keyword: string | null;
  secondary_keywords: string;
  h1: string | null;
  short_answer: string | null;
  body: string | null;
  faq_json: string;
  published: boolean;
  updated_at: string;
  created_at: string;
}
export type InsertSeoArticle = Omit<SeoArticle, 'id' | 'created_at' | 'updated_at'>;

// ─── ListingWatches ───────────────────────────────────────────────────────────
export interface ListingWatch {
  id: number;
  email: string;
  listing_id: number;
  price_at_watch: number;
  alerted_at: string | null;
  alert_price: number | null;
  alert_pct: number | null;
  dismissed: boolean;
  created_at: string;
}
export type InsertListingWatch = Omit<ListingWatch, 'id' | 'created_at'>;

// ─── SavedListings ────────────────────────────────────────────────────────────
export interface SavedListing {
  id: number;
  email: string;
  listing_id: number;
  created_at: string;
}
export type InsertSavedListing = Omit<SavedListing, 'id' | 'created_at'>;
