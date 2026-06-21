import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, like, gte, lte, sql, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";

const sqlite = new Database("data.db");
const db = drizzle(sqlite, { schema });

// Enable WAL mode for better performance
sqlite.pragma("journal_mode = WAL");

// Create tables on startup
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'buyer',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dealers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    website_url TEXT,
    phone TEXT,
    email TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    lat REAL,
    lng REAL,
    service_area_miles INTEGER,
    delivery_available INTEGER DEFAULT 0,
    delivery_included INTEGER DEFAULT 0,
    delivery_base_fee REAL,
    delivery_per_mile_fee REAL,
    delivery_free_radius_miles INTEGER,
    default_warranty_included INTEGER DEFAULT 0,
    default_warranty_months INTEGER,
    default_warranty_notes TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS retail_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    website_url TEXT,
    source_type TEXT NOT NULL DEFAULT 'retailer',
    authorized_mode TEXT NOT NULL DEFAULT 'manual',
    allowed_use_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    source_type TEXT NOT NULL DEFAULT 'admin_manual',
    source_url TEXT,
    public_listing INTEGER NOT NULL DEFAULT 1,
    seller_type TEXT NOT NULL DEFAULT 'private',
    status TEXT NOT NULL DEFAULT 'active',
    dealer_id INTEGER,
    retail_source_id INTEGER,
    retailer_name TEXT,
    retailer_sku TEXT,
    retailer_product_url TEXT,
    retail_event_name TEXT,
    retail_event_dates TEXT,
    availability_status TEXT,
    ship_to_states TEXT,
    last_verified_at TEXT,
    asking_price REAL,
    regular_price REAL,
    sale_price REAL,
    cartiq_estimated_value REAL,
    estimated_delivery_cost REAL,
    total_delivered_cost REAL,
    deal_delta REAL,
    deal_rating TEXT DEFAULT 'unknown',
    buyer_score INTEGER DEFAULT 70,
    year INTEGER,
    brand TEXT,
    model TEXT,
    condition TEXT,
    power_type TEXT DEFAULT 'unknown',
    battery_type TEXT DEFAULT 'unknown',
    battery_ah INTEGER,
    battery_age_months INTEGER,
    seating INTEGER,
    lifted INTEGER DEFAULT 0,
    street_legal_claimed INTEGER DEFAULT 0,
    street_legal_confidence TEXT DEFAULT 'unknown',
    charger_included TEXT DEFAULT 'unknown',
    warranty_included TEXT DEFAULT 'unknown',
    warranty_provider TEXT DEFAULT 'unknown',
    warranty_months INTEGER,
    battery_warranty_included TEXT DEFAULT 'unknown',
    warranty_notes TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    lat REAL,
    lng REAL,
    delivery_available INTEGER DEFAULT 0,
    delivery_included INTEGER DEFAULT 0,
    delivery_notes TEXT,
    image_url TEXT,
    seller_name TEXT,
    seller_phone TEXT,
    seller_email TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS deal_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    source_platform TEXT NOT NULL DEFAULT 'other',
    source_url TEXT,
    extraction_method TEXT NOT NULL DEFAULT 'manual_user_entry',
    user_confirmed_disclosure INTEGER NOT NULL DEFAULT 0,
    asking_price REAL,
    regular_price REAL,
    sale_price REAL,
    year INTEGER,
    brand TEXT,
    model TEXT,
    city TEXT,
    state TEXT,
    seller_type TEXT,
    retailer_name TEXT,
    power_type TEXT DEFAULT 'unknown',
    battery_type TEXT DEFAULT 'unknown',
    battery_ah INTEGER,
    battery_age_months INTEGER,
    seating INTEGER,
    lifted TEXT DEFAULT 'unknown',
    street_legal_claimed TEXT DEFAULT 'unknown',
    charger_included TEXT DEFAULT 'unknown',
    warranty_included TEXT DEFAULT 'unknown',
    warranty_provider TEXT DEFAULT 'unknown',
    warranty_months INTEGER,
    battery_warranty_included TEXT DEFAULT 'unknown',
    warranty_notes TEXT,
    delivery_available TEXT DEFAULT 'unknown',
    delivery_cost REAL,
    last_verified_at TEXT,
    cartiq_estimated_value REAL,
    total_delivered_cost REAL,
    deal_delta REAL,
    deal_rating TEXT DEFAULT 'unknown',
    buyer_score INTEGER DEFAULT 70,
    battery_risk TEXT DEFAULT 'unknown',
    charger_warning TEXT,
    warranty_signal TEXT,
    street_legal_confidence TEXT DEFAULT 'unknown',
    red_flags TEXT DEFAULT '[]',
    questions_to_ask TEXT DEFAULT '[]',
    negotiation_low REAL,
    negotiation_high REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS market_comps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER,
    brand TEXT,
    model TEXT,
    year_min INTEGER,
    year_max INTEGER,
    state TEXT,
    city TEXT,
    radius_miles INTEGER,
    sample_size INTEGER,
    median_price REAL,
    adjusted_value REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inventory_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'active',
    base_url TEXT,
    api_provider TEXT,
    allowed_use_notes TEXT,
    last_sync_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS seo_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    meta_description TEXT,
    canonical_path TEXT,
    primary_keyword TEXT,
    secondary_keywords TEXT DEFAULT '[]',
    h1 TEXT,
    short_answer TEXT,
    body TEXT,
    faq_json TEXT DEFAULT '[]',
    published INTEGER DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS listing_watches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    listing_id INTEGER NOT NULL,
    price_at_watch REAL NOT NULL,
    alerted_at TEXT,
    alert_price REAL,
    alert_pct REAL,
    dismissed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS saved_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    listing_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(email, listing_id)
  );
`);

export interface IStorage {
  // Listings
  getListings(filters?: Record<string, unknown>): schema.Listing[];
  getListingById(id: number): schema.Listing | undefined;
  getListingBySlug(slug: string): schema.Listing | undefined;
  createListing(data: schema.InsertListing): schema.Listing;
  updateListing(id: number, data: Partial<schema.InsertListing>): schema.Listing | undefined;
  deleteListing(id: number): boolean;
  createManyListings(data: schema.InsertListing[]): schema.Listing[];

  // Dealers
  getDealers(): schema.Dealer[];
  getDealerById(id: number): schema.Dealer | undefined;
  createDealer(data: schema.InsertDealer): schema.Dealer;
  updateDealer(id: number, data: Partial<schema.InsertDealer>): schema.Dealer | undefined;

  // Retail Sources
  getRetailSources(): schema.RetailSource[];
  getRetailSourceById(id: number): schema.RetailSource | undefined;
  createRetailSource(data: schema.InsertRetailSource): schema.RetailSource;
  updateRetailSource(id: number, data: Partial<schema.InsertRetailSource>): schema.RetailSource | undefined;

  // Deal Checks
  createDealCheck(data: schema.InsertDealCheck): schema.DealCheck;
  getDealCheckById(id: number): schema.DealCheck | undefined;

  // Inventory Sources
  getInventorySources(): schema.InventorySource[];
  createInventorySource(data: schema.InsertInventorySource): schema.InventorySource;
  updateInventorySource(id: number, data: Partial<schema.InsertInventorySource>): schema.InventorySource | undefined;

  // SEO Articles
  getSeoArticles(): schema.SeoArticle[];
  getSeoArticleBySlug(slug: string): schema.SeoArticle | undefined;
  createSeoArticle(data: schema.InsertSeoArticle): schema.SeoArticle;
  hasSeoArticle(slug: string): boolean;
  hasDealer(slug: string): boolean;
  hasListing(slug: string): boolean;
  hasInventorySource(name: string): boolean;
}

class SQLiteStorage implements IStorage {
  getListings(filters: Record<string, unknown> = {}): schema.Listing[] {
    const rows = db
      .select()
      .from(schema.listings)
      .all() as schema.Listing[];

    return rows.filter((r) => {
      if (filters.state && r.state !== filters.state) return false;
      if (filters.city && r.city?.toLowerCase() !== (filters.city as string).toLowerCase()) return false;
      if (filters.brand && r.brand?.toLowerCase() !== (filters.brand as string).toLowerCase()) return false;
      if (filters.sellerType && r.sellerType !== filters.sellerType) return false;
      if (filters.batteryType && r.batteryType !== filters.batteryType) return false;
      if (filters.dealRating && r.dealRating !== filters.dealRating) return false;
      if (filters.minPrice && (r.askingPrice ?? 0) < (filters.minPrice as number)) return false;
      if (filters.maxPrice && (r.askingPrice ?? 0) > (filters.maxPrice as number)) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (filters.publicOnly && !r.publicListing) return false;
      if (filters.warrantyIncluded && r.warrantyIncluded !== filters.warrantyIncluded) return false;
      if (filters.streetLegal !== undefined && filters.streetLegal !== null) {
        if (filters.streetLegal === true && !r.streetLegalClaimed) return false;
      }
      if (filters.lifted !== undefined && filters.lifted !== null) {
        if (filters.lifted === true && !r.lifted) return false;
      }
      return true;
    });
  }

  getListingById(id: number): schema.Listing | undefined {
    return db.select().from(schema.listings).where(eq(schema.listings.id, id)).get() as schema.Listing | undefined;
  }

  getListingBySlug(slug: string): schema.Listing | undefined {
    return db.select().from(schema.listings).where(eq(schema.listings.slug, slug)).get() as schema.Listing | undefined;
  }

  createListing(data: schema.InsertListing): schema.Listing {
    return db.insert(schema.listings).values({ ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).returning().get() as schema.Listing;
  }

  updateListing(id: number, data: Partial<schema.InsertListing>): schema.Listing | undefined {
    return db.update(schema.listings).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(schema.listings.id, id)).returning().get() as schema.Listing | undefined;
  }

  deleteListing(id: number): boolean {
    const result = db.delete(schema.listings).where(eq(schema.listings.id, id)).run();
    return result.changes > 0;
  }

  createManyListings(data: schema.InsertListing[]): schema.Listing[] {
    return data.map((d) => this.createListing(d));
  }

  getDealers(): schema.Dealer[] {
    return db.select().from(schema.dealers).all() as schema.Dealer[];
  }

  getDealerById(id: number): schema.Dealer | undefined {
    return db.select().from(schema.dealers).where(eq(schema.dealers.id, id)).get() as schema.Dealer | undefined;
  }

  createDealer(data: schema.InsertDealer): schema.Dealer {
    return db.insert(schema.dealers).values({ ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).returning().get() as schema.Dealer;
  }

  updateDealer(id: number, data: Partial<schema.InsertDealer>): schema.Dealer | undefined {
    return db.update(schema.dealers).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(schema.dealers.id, id)).returning().get() as schema.Dealer | undefined;
  }

  getRetailSources(): schema.RetailSource[] {
    return db.select().from(schema.retailSources).all() as schema.RetailSource[];
  }

  getRetailSourceById(id: number): schema.RetailSource | undefined {
    return db.select().from(schema.retailSources).where(eq(schema.retailSources.id, id)).get() as schema.RetailSource | undefined;
  }

  createRetailSource(data: schema.InsertRetailSource): schema.RetailSource {
    return db.insert(schema.retailSources).values({ ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).returning().get() as schema.RetailSource;
  }

  updateRetailSource(id: number, data: Partial<schema.InsertRetailSource>): schema.RetailSource | undefined {
    return db.update(schema.retailSources).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(schema.retailSources.id, id)).returning().get() as schema.RetailSource | undefined;
  }

  createDealCheck(data: schema.InsertDealCheck): schema.DealCheck {
    return db.insert(schema.dealChecks).values({ ...data, createdAt: new Date().toISOString() }).returning().get() as schema.DealCheck;
  }

  getDealCheckById(id: number): schema.DealCheck | undefined {
    return db.select().from(schema.dealChecks).where(eq(schema.dealChecks.id, id)).get() as schema.DealCheck | undefined;
  }

  getInventorySources(): schema.InventorySource[] {
    return db.select().from(schema.inventorySources).all() as schema.InventorySource[];
  }

  createInventorySource(data: schema.InsertInventorySource): schema.InventorySource {
    return db.insert(schema.inventorySources).values({ ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).returning().get() as schema.InventorySource;
  }

  updateInventorySource(id: number, data: Partial<schema.InsertInventorySource>): schema.InventorySource | undefined {
    return db.update(schema.inventorySources).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(schema.inventorySources.id, id)).returning().get() as schema.InventorySource | undefined;
  }

  getSeoArticles(): schema.SeoArticle[] {
    return db.select().from(schema.seoArticles).where(eq(schema.seoArticles.published, true)).all() as schema.SeoArticle[];
  }

  getSeoArticleBySlug(slug: string): schema.SeoArticle | undefined {
    return db.select().from(schema.seoArticles).where(eq(schema.seoArticles.slug, slug)).get() as schema.SeoArticle | undefined;
  }

  createSeoArticle(data: schema.InsertSeoArticle): schema.SeoArticle {
    return db.insert(schema.seoArticles).values({ ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).returning().get() as schema.SeoArticle;
  }

  hasSeoArticle(slug: string): boolean {
    return !!db.select().from(schema.seoArticles).where(eq(schema.seoArticles.slug, slug)).get();
  }

  hasDealer(slug: string): boolean {
    return !!db.select().from(schema.dealers).where(eq(schema.dealers.slug, slug)).get();
  }

  hasListing(slug: string): boolean {
    return !!db.select().from(schema.listings).where(eq(schema.listings.slug, slug)).get();
  }

  hasInventorySource(name: string): boolean {
    return !!db.select().from(schema.inventorySources).where(eq(schema.inventorySources.name, name)).get();
  }

  // ─── Watches ───────────────────────────────────────────────────────────────

  createWatch(data: schema.InsertListingWatch): schema.ListingWatch {
    return db.insert(schema.listingWatches).values(data).returning().get();
  }

  getWatchesByEmail(email: string): schema.ListingWatch[] {
    return db.select().from(schema.listingWatches)
      .where(and(eq(schema.listingWatches.email, email.toLowerCase().trim()), eq(schema.listingWatches.dismissed, false)))
      .all();
  }

  getWatchesForListing(listingId: number): schema.ListingWatch[] {
    return db.select().from(schema.listingWatches)
      .where(and(eq(schema.listingWatches.listingId, listingId), eq(schema.listingWatches.dismissed, false)))
      .all();
  }

  getWatchById(id: number): schema.ListingWatch | undefined {
    return db.select().from(schema.listingWatches).where(eq(schema.listingWatches.id, id)).get();
  }

  isWatching(email: string, listingId: number): boolean {
    return !!db.select().from(schema.listingWatches)
      .where(and(
        eq(schema.listingWatches.email, email.toLowerCase().trim()),
        eq(schema.listingWatches.listingId, listingId),
        eq(schema.listingWatches.dismissed, false)
      )).get();
  }

  // Fire price-drop alerts: called after a listing price update.
  // Returns the watches that were newly alerted.
  firePriceDropAlerts(listingId: number, newPrice: number): schema.ListingWatch[] {
    const watches = this.getWatchesForListing(listingId);
    const alerted: schema.ListingWatch[] = [];
    const now = new Date().toISOString();
    for (const w of watches) {
      if (w.alertedAt) continue; // already alerted
      if (newPrice < w.priceAtWatch) {
        const pct = ((w.priceAtWatch - newPrice) / w.priceAtWatch) * 100;
        const updated = db.update(schema.listingWatches)
          .set({ alertedAt: now, alertPrice: newPrice, alertPct: Math.round(pct * 10) / 10 })
          .where(eq(schema.listingWatches.id, w.id))
          .returning().get();
        if (updated) alerted.push(updated);
      }
    }
    return alerted;
  }

  dismissWatch(id: number): boolean {
    const result = db.update(schema.listingWatches)
      .set({ dismissed: true })
      .where(eq(schema.listingWatches.id, id))
      .returning().get();
    return !!result;
  }

  deleteWatch(id: number): boolean {
    const result = db.delete(schema.listingWatches).where(eq(schema.listingWatches.id, id)).returning().get();
    return !!result;
  }

  // ─── Saved Listings ─────────────────────────────────────────────────────

  saveListing(email: string, listingId: number): schema.SavedListing {
    const existing = this.getSavedEntry(email, listingId);
    if (existing) return existing;
    return db.insert(schema.savedListings)
      .values({ email: email.toLowerCase().trim(), listingId })
      .returning().get();
  }

  unsaveListing(email: string, listingId: number): boolean {
    const result = db.delete(schema.savedListings)
      .where(and(
        eq(schema.savedListings.email, email.toLowerCase().trim()),
        eq(schema.savedListings.listingId, listingId)
      )).returning().get();
    return !!result;
  }

  isSaved(email: string, listingId: number): boolean {
    return !!this.getSavedEntry(email, listingId);
  }

  private getSavedEntry(email: string, listingId: number): schema.SavedListing | undefined {
    return db.select().from(schema.savedListings)
      .where(and(
        eq(schema.savedListings.email, email.toLowerCase().trim()),
        eq(schema.savedListings.listingId, listingId)
      )).get();
  }

  getSavedByEmail(email: string): schema.SavedListing[] {
    return db.select().from(schema.savedListings)
      .where(eq(schema.savedListings.email, email.toLowerCase().trim()))
      .all();
  }
}

export const storage = new SQLiteStorage();
