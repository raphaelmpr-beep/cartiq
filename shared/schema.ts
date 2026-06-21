import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role").notNull().default("buyer"), // buyer | admin | dealer
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Dealers ─────────────────────────────────────────────────────────────────
export const dealers = sqliteTable("dealers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  websiteUrl: text("website_url"),
  phone: text("phone"),
  email: text("email"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  lat: real("lat"),
  lng: real("lng"),
  serviceAreaMiles: integer("service_area_miles"),
  deliveryAvailable: integer("delivery_available", { mode: "boolean" }).default(false),
  deliveryIncluded: integer("delivery_included", { mode: "boolean" }).default(false),
  deliveryBaseFee: real("delivery_base_fee"),
  deliveryPerMileFee: real("delivery_per_mile_fee"),
  deliveryFreeRadiusMiles: integer("delivery_free_radius_miles"),
  defaultWarrantyIncluded: integer("default_warranty_included", { mode: "boolean" }).default(false),
  defaultWarrantyMonths: integer("default_warranty_months"),
  defaultWarrantyNotes: text("default_warranty_notes"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});
export const insertDealerSchema = createInsertSchema(dealers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDealer = z.infer<typeof insertDealerSchema>;
export type Dealer = typeof dealers.$inferSelect;

// ─── RetailSources ────────────────────────────────────────────────────────────
export const retailSources = sqliteTable("retail_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  websiteUrl: text("website_url"),
  sourceType: text("source_type").notNull().default("retailer"), // costco | retailer | other
  authorizedMode: text("authorized_mode").notNull().default("manual"), // manual | csv | approved_api | placeholder
  allowedUseNotes: text("allowed_use_notes"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});
export const insertRetailSourceSchema = createInsertSchema(retailSources).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRetailSource = z.infer<typeof insertRetailSourceSchema>;
export type RetailSource = typeof retailSources.$inferSelect;

// ─── Listings ─────────────────────────────────────────────────────────────────
export const listings = sqliteTable("listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sourceType: text("source_type").notNull().default("admin_manual"),
  // dealer_direct | private_direct | admin_manual | buyer_submitted | dealer_csv
  // retail_manual | retail_csv | official_meta_api
  sourceUrl: text("source_url"),
  publicListing: integer("public_listing", { mode: "boolean" }).notNull().default(true),
  sellerType: text("seller_type").notNull().default("private"), // dealer | private | retail
  status: text("status").notNull().default("active"), // active | pending | sold | inactive | unavailable
  dealerId: integer("dealer_id"),
  retailSourceId: integer("retail_source_id"),
  retailerName: text("retailer_name"),
  retailerSku: text("retailer_sku"),
  retailerProductUrl: text("retailer_product_url"),
  retailEventName: text("retail_event_name"),
  retailEventDates: text("retail_event_dates"),
  availabilityStatus: text("availability_status"),
  shipToStates: text("ship_to_states"), // JSON array
  lastVerifiedAt: text("last_verified_at"),
  askingPrice: real("asking_price"),
  regularPrice: real("regular_price"),
  salePrice: real("sale_price"),
  cartiqEstimatedValue: real("cartiq_estimated_value"),
  estimatedDeliveryCost: real("estimated_delivery_cost"),
  totalDeliveredCost: real("total_delivered_cost"),
  dealDelta: real("deal_delta"),
  dealRating: text("deal_rating").default("unknown"),
  // great_deal | good_deal | fair_price | high_price | over_market | unknown
  buyerScore: integer("buyer_score").default(70),
  year: integer("year"),
  brand: text("brand"),
  model: text("model"),
  condition: text("condition"),
  powerType: text("power_type").default("unknown"), // gas | electric | unknown
  batteryType: text("battery_type").default("unknown"), // lithium | lead_acid | gas | unknown
  batteryAh: integer("battery_ah"),
  batteryAgeMonths: integer("battery_age_months"),
  seating: integer("seating"),
  lifted: integer("lifted", { mode: "boolean" }).default(false),
  streetLegalClaimed: integer("street_legal_claimed", { mode: "boolean" }).default(false),
  streetLegalConfidence: text("street_legal_confidence").default("unknown"), // high | medium | low | unknown
  chargerIncluded: text("charger_included").default("unknown"), // yes | no | unknown
  warrantyIncluded: text("warranty_included").default("unknown"), // yes | no | unknown
  warrantyProvider: text("warranty_provider").default("unknown"), // dealer | manufacturer | third_party | retailer | none | unknown
  warrantyMonths: integer("warranty_months"),
  batteryWarrantyIncluded: text("battery_warranty_included").default("unknown"), // yes | no | unknown
  warrantyNotes: text("warranty_notes"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  lat: real("lat"),
  lng: real("lng"),
  deliveryAvailable: integer("delivery_available", { mode: "boolean" }).default(false),
  deliveryIncluded: integer("delivery_included", { mode: "boolean" }).default(false),
  deliveryNotes: text("delivery_notes"),
  imageUrl: text("image_url"),
  imageUrls: text("image_urls"),            // JSON array of additional image URLs for carousel
  sellerName: text("seller_name"),          // dealer business name or "Private Seller"
  sellerPhone: text("seller_phone"),        // displayed on card and detail page
  sellerEmail: text("seller_email"),        // shown on detail page only
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});
export const insertListingSchema = createInsertSchema(listings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listings.$inferSelect;

// ─── DealChecks ──────────────────────────────────────────────────────────────
export const dealChecks = sqliteTable("deal_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  sourcePlatform: text("source_platform").notNull().default("other"),
  // facebook_marketplace | craigslist | offerup | dealer_website | costco_retailer | other
  sourceUrl: text("source_url"),
  extractionMethod: text("extraction_method").notNull().default("manual_user_entry"),
  // manual_user_entry | user_pasted_text | user_uploaded_screenshot | seller_authorized_import | official_meta_api
  userConfirmedDisclosure: integer("user_confirmed_disclosure", { mode: "boolean" }).notNull().default(false),
  askingPrice: real("asking_price"),
  regularPrice: real("regular_price"),
  salePrice: real("sale_price"),
  year: integer("year"),
  brand: text("brand"),
  model: text("model"),
  city: text("city"),
  state: text("state"),
  sellerType: text("seller_type"),
  retailerName: text("retailer_name"),
  powerType: text("power_type").default("unknown"),
  batteryType: text("battery_type").default("unknown"),
  batteryAh: integer("battery_ah"),
  batteryAgeMonths: integer("battery_age_months"),
  seating: integer("seating"),
  lifted: text("lifted").default("unknown"), // yes | no | unknown
  streetLegalClaimed: text("street_legal_claimed").default("unknown"),
  chargerIncluded: text("charger_included").default("unknown"),
  warrantyIncluded: text("warranty_included").default("unknown"),
  warrantyProvider: text("warranty_provider").default("unknown"),
  warrantyMonths: integer("warranty_months"),
  batteryWarrantyIncluded: text("battery_warranty_included").default("unknown"),
  warrantyNotes: text("warranty_notes"),
  deliveryAvailable: text("delivery_available").default("unknown"),
  deliveryCost: real("delivery_cost"),
  lastVerifiedAt: text("last_verified_at"),
  cartiqEstimatedValue: real("cartiq_estimated_value"),
  totalDeliveredCost: real("total_delivered_cost"),
  dealDelta: real("deal_delta"),
  dealRating: text("deal_rating").default("unknown"),
  buyerScore: integer("buyer_score").default(70),
  batteryRisk: text("battery_risk").default("unknown"), // high | medium | low | unknown
  chargerWarning: text("charger_warning"),
  warrantySignal: text("warranty_signal"),
  streetLegalConfidence: text("street_legal_confidence").default("unknown"),
  redFlags: text("red_flags").default("[]"), // JSON
  questionsToAsk: text("questions_to_ask").default("[]"), // JSON
  negotiationLow: real("negotiation_low"),
  negotiationHigh: real("negotiation_high"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});
export const insertDealCheckSchema = createInsertSchema(dealChecks).omit({ id: true, createdAt: true });
export type InsertDealCheck = z.infer<typeof insertDealCheckSchema>;
export type DealCheck = typeof dealChecks.$inferSelect;

// ─── MarketComps ─────────────────────────────────────────────────────────────
export const marketComps = sqliteTable("market_comps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id"),
  brand: text("brand"),
  model: text("model"),
  yearMin: integer("year_min"),
  yearMax: integer("year_max"),
  state: text("state"),
  city: text("city"),
  radiusMiles: integer("radius_miles"),
  sampleSize: integer("sample_size"),
  medianPrice: real("median_price"),
  adjustedValue: real("adjusted_value"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});
export const insertMarketCompSchema = createInsertSchema(marketComps).omit({ id: true, createdAt: true });
export type InsertMarketComp = z.infer<typeof insertMarketCompSchema>;
export type MarketComp = typeof marketComps.$inferSelect;

// ─── InventorySources ─────────────────────────────────────────────────────────
export const inventorySources = sqliteTable("inventory_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull().default("manual"),
  // manual | csv | dealer_authorized | buyer_submitted | seller_authorized
  // official_meta_api | retail_manual | retail_csv | approved_retail_api
  status: text("status").notNull().default("active"),
  // active | inactive | not_configured | pending_access | approved | disabled | error
  baseUrl: text("base_url"),
  apiProvider: text("api_provider"),
  allowedUseNotes: text("allowed_use_notes"),
  lastSyncAt: text("last_sync_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});
export const insertInventorySourceSchema = createInsertSchema(inventorySources).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInventorySource = z.infer<typeof insertInventorySourceSchema>;
export type InventorySource = typeof inventorySources.$inferSelect;

// ─── SeoArticles ─────────────────────────────────────────────────────────────
export const seoArticles = sqliteTable("seo_articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  metaDescription: text("meta_description"),
  canonicalPath: text("canonical_path"),
  primaryKeyword: text("primary_keyword"),
  secondaryKeywords: text("secondary_keywords").default("[]"), // JSON
  h1: text("h1"),
  shortAnswer: text("short_answer"),
  body: text("body"),
  faqJson: text("faq_json").default("[]"), // JSON
  published: integer("published", { mode: "boolean" }).default(true),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});
export const insertSeoArticleSchema = createInsertSchema(seoArticles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSeoArticle = z.infer<typeof insertSeoArticleSchema>;
export type SeoArticle = typeof seoArticles.$inferSelect;

// ─── ListingWatches ───────────────────────────────────────────────────────────
export const listingWatches = sqliteTable("listing_watches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  listingId: integer("listing_id").notNull(),
  priceAtWatch: real("price_at_watch").notNull(), // effective price when watch was created
  alertedAt: text("alerted_at"),                  // set when a price-drop alert fires
  alertPrice: real("alert_price"),                // the dropped price that triggered the alert
  alertPct: real("alert_pct"),                    // % drop that triggered the alert
  dismissed: integer("dismissed", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});
export const insertListingWatchSchema = createInsertSchema(listingWatches).omit({ id: true, createdAt: true });
export type InsertListingWatch = z.infer<typeof insertListingWatchSchema>;
export type ListingWatch = typeof listingWatches.$inferSelect;

// ─── SavedListings ────────────────────────────────────────────────────────────
export const savedListings = sqliteTable("saved_listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  listingId: integer("listing_id").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});
export const insertSavedListingSchema = createInsertSchema(savedListings).omit({ id: true, createdAt: true });
export type InsertSavedListing = z.infer<typeof insertSavedListingSchema>;
export type SavedListing = typeof savedListings.$inferSelect;
