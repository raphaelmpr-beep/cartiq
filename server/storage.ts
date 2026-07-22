/**
 * CartIQ Storage — Supabase/Postgres backend
 * All methods are async. Routes call await storage.method().
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  Listing, InsertListing,
  Dealer, InsertDealer,
  RetailSource, InsertRetailSource,
  DealCheck, InsertDealCheck,
  InventorySource, InsertInventorySource,
  SeoArticle, InsertSeoArticle,
  ListingWatch, InsertListingWatch,
  SavedListing, InsertSavedListing,
} from "@shared/schema";

function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Lazy singleton
let _client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_client) _client = getClient();
  return _client;
}

// ─── initStorage (no-op for Supabase — tables already exist) ─────────────────
export async function initStorage(): Promise<void> {
  console.log("[storage] Supabase mode — skipping local DB init");
}

// ─── IStorage interface ───────────────────────────────────────────────────────
export interface IStorage {
  getListings(filters?: Record<string, unknown>): Promise<Listing[]>;
  getHotDeals(limit?: number): Promise<Listing[]>;
  getListingById(id: number): Promise<Listing | undefined>;
  getListingBySlug(slug: string): Promise<Listing | undefined>;
  createListing(data: InsertListing): Promise<Listing>;
  updateListing(id: number, data: Partial<InsertListing>): Promise<Listing | undefined>;
  deleteListing(id: number): Promise<boolean>;
  createManyListings(data: InsertListing[]): Promise<Listing[]>;

  getDealers(): Promise<Dealer[]>;
  getDealerById(id: number): Promise<Dealer | undefined>;
  getDealerBySlug(slug: string): Promise<Dealer | undefined>;
  getDealerBySyncSource(syncSource: string): Promise<Dealer | undefined>;
  createDealer(data: InsertDealer): Promise<Dealer>;
  updateDealer(id: number, data: Partial<InsertDealer>): Promise<Dealer | undefined>;

  getRetailSources(): Promise<RetailSource[]>;
  getRetailSourceById(id: number): Promise<RetailSource | undefined>;
  createRetailSource(data: InsertRetailSource): Promise<RetailSource>;
  updateRetailSource(id: number, data: Partial<InsertRetailSource>): Promise<RetailSource | undefined>;

  getCompsForListing(brand: string, model: string, year: number, condition: string, excludeId?: number): Promise<any[]>;
  getBrandCompsForListing(brand: string, year: number, condition: string, excludeId?: number): Promise<any[]>;
  getAllListingsForReprice(offset: number, limit: number): Promise<any[]>;
  getListingCount(): Promise<number>;

  createDealCheck(data: InsertDealCheck): Promise<DealCheck>;
  getDealCheckById(id: number): Promise<DealCheck | undefined>;

  getInventorySources(): Promise<InventorySource[]>;
  createInventorySource(data: InsertInventorySource): Promise<InventorySource>;
  updateInventorySource(id: number, data: Partial<InsertInventorySource>): Promise<InventorySource | undefined>;

  getSeoArticles(): Promise<SeoArticle[]>;
  getSeoArticleBySlug(slug: string): Promise<SeoArticle | undefined>;
  createSeoArticle(data: InsertSeoArticle): Promise<SeoArticle>;
  hasSeoArticle(slug: string): Promise<boolean>;
  hasDealer(slug: string): Promise<boolean>;
  hasListing(slug: string): Promise<boolean>;
  hasInventorySource(name: string): Promise<boolean>;

  createWatch(data: InsertListingWatch): Promise<ListingWatch>;
  getWatchesByEmail(email: string): Promise<ListingWatch[]>;
  getWatchesForListing(listingId: number): Promise<ListingWatch[]>;
  getWatchById(id: number): Promise<ListingWatch | undefined>;
  isWatching(email: string, listingId: number): Promise<boolean>;
  firePriceDropAlerts(listingId: number, newPrice: number): Promise<ListingWatch[]>;
  dismissWatch(id: number): Promise<boolean>;
  deleteWatch(id: number): Promise<boolean>;

  saveListing(email: string, listingId: number): Promise<SavedListing>;
  unsaveListing(email: string, listingId: number): Promise<boolean>;
  isSaved(email: string, listingId: number): Promise<boolean>;
  getSavedByEmail(email: string): Promise<SavedListing[]>;

  getListingCount(): Promise<number>;
}

// ─── Helper: throw on Supabase error ─────────────────────────────────────────
function check<T>(result: { data: T; error: any }): T {
  if (result.error) throw new Error(`Supabase error: ${result.error.message}`);
  return result.data;
}

// ─── SupabaseStorage ──────────────────────────────────────────────────────────
class SupabaseStorage implements IStorage {

  // ─── Listings ───────────────────────────────────────────────────────────────

  async getListings(filters: Record<string, unknown> = {}): Promise<Listing[]> {
    const hardLimit = typeof filters.limit === "number" ? filters.limit : 5000;
    // Supabase REST API caps at 1000 rows per request regardless of range.
    // Paginate internally with PAGE_SIZE=1000 to fetch all rows up to hardLimit.
    const PAGE_SIZE = 1000;

    // renderable=true drops listings that would render as broken cards on the
    // public search/sitemap (missing image or missing price). Admin routes leave
    // this false so they still see every row for triage.
    const renderable = filters.renderable === true;

    function buildQuery(from: number, to: number) {
      let q = db()
        .from("listings")
        .select("*")
        .eq("status", "active")
        .eq("public_listing", true)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (renderable) {
        q = q
          .not("image_url", "is", null)
          .neq("image_url", "")
          .not("asking_price", "is", null);
      }
      if (filters.state)       q = q.eq("state", filters.state);
      if (filters.brand)       q = q.ilike("brand", filters.brand as string);
      if (filters.sellerType)  q = q.eq("seller_type", filters.sellerType);
      if (filters.batteryType) q = q.eq("battery_type", filters.batteryType);
      if (filters.dealRating)  q = q.eq("deal_rating", filters.dealRating);
      if (filters.warrantyIncluded) q = q.in("warranty_included", ["yes", "true"]);
      if (filters.minPrice)    q = q.gte("asking_price", filters.minPrice);
      if (filters.maxPrice)    q = q.lte("asking_price", filters.maxPrice);
      if (filters.streetLegal === true) q = q.eq("street_legal_claimed", true);
      if (filters.lifted === true)      q = q.eq("lifted", true);
      if (filters.city)        q = q.ilike("city", filters.city as string);
      return q;
    }

    let all: Listing[] = [];
    let offset = 0;
    while (all.length < hardLimit) {
      const to = Math.min(offset + PAGE_SIZE - 1, hardLimit - 1);
      const { data, error } = await buildQuery(offset, to);
      if (error) throw new Error(error.message);
      const batch = (data ?? []) as Listing[];
      all = all.concat(batch);
      if (batch.length < PAGE_SIZE) break; // no more rows
      offset += PAGE_SIZE;
    }
    return all.slice(0, hardLimit);
  }

  async getHotDeals(limit = 20): Promise<Listing[]> {
    // Hot deals: great_deal or good_deal, has price, has image, active+public.
    // Fetch a wide pool (4× the requested limit) then shuffle so every page
    // load surfaces a different mix. great_deal listings get a 2× weight boost
    // in the weighted shuffle so they stay prominent on average.
    const pool = limit * 4;
    const { data, error } = await db()
      .from("listings")
      .select("*")
      .eq("status", "active")
      .eq("public_listing", true)
      .in("deal_rating", ["great_deal", "good_deal"])
      .not("asking_price", "is", null)
      .not("image_url", "is", null)
      .neq("image_url", "")
      .order("updated_at", { ascending: false })
      .limit(pool);
    if (error) throw new Error(error.message);
    const candidates = (data ?? []) as Listing[];

    // Weighted Fisher-Yates: great_deal entries are duplicated once so they
    // appear roughly 2× as often, then we deduplicate after the shuffle.
    const weighted: Listing[] = [];
    for (const l of candidates) {
      weighted.push(l);
      if ((l as any).deal_rating === "great_deal") weighted.push(l);
    }
    // Fisher-Yates in-place shuffle
    for (let i = weighted.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
    }
    // Deduplicate by id, preserving shuffled order, then take limit
    const seen = new Set<number>();
    const result: Listing[] = [];
    for (const l of weighted) {
      if (seen.has((l as any).id)) continue;
      seen.add((l as any).id);
      result.push(l);
      if (result.length >= limit) break;
    }
    return result;
  }

  async getListingById(id: number): Promise<Listing | undefined> {
    const { data } = await db().from("listings").select("*").eq("id", id).maybeSingle();
    return (data as Listing) ?? undefined;
  }

  async getListingBySlug(slug: string): Promise<Listing | undefined> {
    const { data } = await db().from("listings").select("*").eq("slug", slug).maybeSingle();
    return (data as Listing) ?? undefined;
  }

  async createListing(data: InsertListing): Promise<Listing> {
    const result = check(await db().from("listings").insert(data).select().single());
    return result as Listing;
  }

  async updateListing(id: number, data: Partial<InsertListing>): Promise<Listing | undefined> {
    // Use maybeSingle so 0-row updates don't throw PGRST116; check error so
    // RLS-blocked writes stop silently returning undefined and confusing callers.
    const { data: result, error } = await db()
      .from("listings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) {
      console.error(`[updateListing id=${id}] Supabase error:`, error);
      throw new Error(`updateListing failed for id=${id}: ${error.message}`);
    }
    return (result as Listing) ?? undefined;
  }

  async deleteListing(id: number): Promise<boolean> {
    // Request the affected rows back so we can distinguish a real delete from
    // an RLS-blocked no-op. Anon key currently can't DELETE on `listings`;
    // callers relying on this should archive (status=archived) instead.
    const { data, error } = await db()
      .from("listings")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) {
      console.error(`[deleteListing id=${id}] Supabase error:`, error);
      throw new Error(`deleteListing failed for id=${id}: ${error.message}`);
    }
    return Array.isArray(data) && data.length > 0;
  }

  async createManyListings(data: InsertListing[]): Promise<Listing[]> {
    if (data.length === 0) return [];
    const result = check(await db().from("listings").insert(data).select());
    return (result ?? []) as Listing[];
  }

  async getListingCount(): Promise<number> {
    const { count } = await db().from("listings").select("*", { count: "exact", head: true }).eq("status", "active");
    return count ?? 0;
  }

  // ─── Comp fetch for pricing engine ──────────────────────────────────────────
  async getCompsForListing(
    brand: string,
    model: string,
    year: number,
    condition: string,
    excludeId?: number
  ): Promise<any[]> {
    let q = db()
      .from("listings")
      .select("asking_price,year,power_type,battery_type,seating,lifted,warranty_included,charger_included,delivery_available")
      .eq("status", "active")
      .eq("public_listing", true)
      .eq("brand", brand)
      .eq("model", model)
      .eq("condition", condition)
      .gte("year", year - 1)
      .lte("year", year + 1)
      .not("asking_price", "is", null)
      .limit(60);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q;
    return (data ?? []) as any[];
  }

  // ─── Brand-only comp fallback (same brand, any model, year±1, same condition) ─
  async getBrandCompsForListing(
    brand: string,
    year: number,
    condition: string,
    excludeId?: number
  ): Promise<any[]> {
    let q = db()
      .from("listings")
      .select("asking_price,year,power_type,battery_type,seating,lifted,warranty_included,charger_included,delivery_available")
      .eq("status", "active")
      .eq("public_listing", true)
      .eq("brand", brand)
      .eq("condition", condition)
      .gte("year", year - 1)
      .lte("year", year + 1)
      .not("asking_price", "is", null)
      .limit(60);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q;
    return (data ?? []) as any[];
  }

  // ─── Bulk reprice fetch (returns raw snake_case rows) ────────────────────────
  async getAllListingsForReprice(offset: number, limit: number): Promise<any[]> {
    const { data } = await db()
      .from("listings")
      .select("id,brand,model,year,condition,asking_price,sale_price,regular_price,power_type,battery_type,battery_ah,battery_age_months,seating,lifted,charger_included,warranty_included,warranty_months,delivery_available,delivery_included,estimated_delivery_cost,seller_type,street_legal_claimed")
      .eq("status", "active")
      .eq("public_listing", true)
      .not("asking_price", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    return (data ?? []) as any[];
  }

  // ─── Dealers ────────────────────────────────────────────────────────────────

  async getDealers(): Promise<Dealer[]> {
    const { data } = await db().from("dealers").select("*").order("name");
    return ((data ?? []) as Dealer[]).filter(d => !d.slug?.startsWith("__"));
  }

  async getDealerById(id: number): Promise<Dealer | undefined> {
    const { data } = await db().from("dealers").select("*").eq("id", id).maybeSingle();
    return (data as Dealer) ?? undefined;
  }

  async getDealerBySlug(slug: string): Promise<Dealer | undefined> {
    const { data } = await db().from("dealers").select("*").eq("slug", slug).maybeSingle();
    return (data as Dealer) ?? undefined;
  }

  async getDealerBySyncSource(syncSource: string): Promise<Dealer | undefined> {
    const { data } = await db()
      .from("dealers")
      .select("*")
      .ilike("slug", `${syncSource}%`)
      .limit(1)
      .maybeSingle();
    return (data as Dealer) ?? undefined;
  }

  async createDealer(data: InsertDealer): Promise<Dealer> {
    const result = check(await db().from("dealers").insert(data).select().single());
    return result as Dealer;
  }

  async updateDealer(id: number, data: Partial<InsertDealer>): Promise<Dealer | undefined> {
    const { data: result } = await db()
      .from("dealers")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    return (result as Dealer) ?? undefined;
  }

  // ─── Retail Sources ──────────────────────────────────────────────────────────

  async getRetailSources(): Promise<RetailSource[]> {
    const { data } = await db().from("retail_sources").select("*");
    return (data ?? []) as RetailSource[];
  }

  async getRetailSourceById(id: number): Promise<RetailSource | undefined> {
    const { data } = await db().from("retail_sources").select("*").eq("id", id).maybeSingle();
    return (data as RetailSource) ?? undefined;
  }

  async createRetailSource(data: InsertRetailSource): Promise<RetailSource> {
    const result = check(await db().from("retail_sources").insert(data).select().single());
    return result as RetailSource;
  }

  async updateRetailSource(id: number, data: Partial<InsertRetailSource>): Promise<RetailSource | undefined> {
    const { data: result } = await db()
      .from("retail_sources")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    return (result as RetailSource) ?? undefined;
  }

  // ─── Deal Checks ─────────────────────────────────────────────────────────────

  async createDealCheck(data: InsertDealCheck): Promise<DealCheck> {
    const result = check(await db().from("deal_checks").insert(data).select().single());
    return result as DealCheck;
  }

  async getDealCheckById(id: number): Promise<DealCheck | undefined> {
    const { data } = await db().from("deal_checks").select("*").eq("id", id).maybeSingle();
    return (data as DealCheck) ?? undefined;
  }

  // ─── Inventory Sources ────────────────────────────────────────────────────────

  async getInventorySources(): Promise<InventorySource[]> {
    const { data } = await db().from("inventory_sources").select("*");
    return (data ?? []) as InventorySource[];
  }

  async createInventorySource(data: InsertInventorySource): Promise<InventorySource> {
    const result = check(await db().from("inventory_sources").insert(data).select().single());
    return result as InventorySource;
  }

  async updateInventorySource(id: number, data: Partial<InsertInventorySource>): Promise<InventorySource | undefined> {
    const { data: result } = await db()
      .from("inventory_sources")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    return (result as InventorySource) ?? undefined;
  }

  // ─── SEO Articles ─────────────────────────────────────────────────────────────

  async getSeoArticles(): Promise<SeoArticle[]> {
    const { data } = await db().from("seo_articles").select("*").eq("published", true);
    return (data ?? []) as SeoArticle[];
  }

  async getSeoArticleBySlug(slug: string): Promise<SeoArticle | undefined> {
    const { data } = await db().from("seo_articles").select("*").eq("slug", slug).maybeSingle();
    return (data as SeoArticle) ?? undefined;
  }

  async createSeoArticle(data: InsertSeoArticle): Promise<SeoArticle> {
    const result = check(await db().from("seo_articles").insert(data).select().single());
    return result as SeoArticle;
  }

  async hasSeoArticle(slug: string): Promise<boolean> {
    const { count } = await db().from("seo_articles").select("*", { count: "exact", head: true }).eq("slug", slug);
    return (count ?? 0) > 0;
  }

  async hasDealer(slug: string): Promise<boolean> {
    const { count } = await db().from("dealers").select("*", { count: "exact", head: true }).eq("slug", slug);
    return (count ?? 0) > 0;
  }

  async hasListing(slug: string): Promise<boolean> {
    const { count } = await db().from("listings").select("*", { count: "exact", head: true }).eq("slug", slug);
    return (count ?? 0) > 0;
  }

  async hasInventorySource(name: string): Promise<boolean> {
    const { count } = await db().from("inventory_sources").select("*", { count: "exact", head: true }).eq("name", name);
    return (count ?? 0) > 0;
  }

  // ─── Watches ─────────────────────────────────────────────────────────────────

  async createWatch(data: InsertListingWatch): Promise<ListingWatch> {
    const result = check(await db().from("listing_watches").insert(data).select().single());
    return result as ListingWatch;
  }

  async getWatchesByEmail(email: string): Promise<ListingWatch[]> {
    const { data } = await db()
      .from("listing_watches")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .eq("dismissed", false);
    return (data ?? []) as ListingWatch[];
  }

  async getWatchesForListing(listingId: number): Promise<ListingWatch[]> {
    const { data } = await db()
      .from("listing_watches")
      .select("*")
      .eq("listing_id", listingId)
      .eq("dismissed", false);
    return (data ?? []) as ListingWatch[];
  }

  async getWatchById(id: number): Promise<ListingWatch | undefined> {
    const { data } = await db().from("listing_watches").select("*").eq("id", id).maybeSingle();
    return (data as ListingWatch) ?? undefined;
  }

  async isWatching(email: string, listingId: number): Promise<boolean> {
    const { count } = await db()
      .from("listing_watches")
      .select("*", { count: "exact", head: true })
      .eq("email", email.toLowerCase().trim())
      .eq("listing_id", listingId)
      .eq("dismissed", false);
    return (count ?? 0) > 0;
  }

  async firePriceDropAlerts(listingId: number, newPrice: number): Promise<ListingWatch[]> {
    const watches = await this.getWatchesForListing(listingId);
    const alerted: ListingWatch[] = [];
    const now = new Date().toISOString();
    for (const w of watches) {
      if (w.alerted_at) continue;
      if (newPrice < w.price_at_watch) {
        const pct = ((w.price_at_watch - newPrice) / w.price_at_watch) * 100;
        const { data } = await db()
          .from("listing_watches")
          .update({ alerted_at: now, alert_price: newPrice, alert_pct: Math.round(pct * 10) / 10 })
          .eq("id", w.id)
          .select()
          .single();
        if (data) alerted.push(data as ListingWatch);
      }
    }
    return alerted;
  }

  async dismissWatch(id: number): Promise<boolean> {
    const { error } = await db().from("listing_watches").update({ dismissed: true }).eq("id", id);
    return !error;
  }

  async deleteWatch(id: number): Promise<boolean> {
    const { error } = await db().from("listing_watches").delete().eq("id", id);
    return !error;
  }

  // ─── Saved Listings ───────────────────────────────────────────────────────────

  async saveListing(email: string, listingId: number): Promise<SavedListing> {
    const normalized = email.toLowerCase().trim();
    // upsert — ignore conflict
    const { data } = await db()
      .from("saved_listings")
      .upsert({ email: normalized, listing_id: listingId }, { onConflict: "email,listing_id", ignoreDuplicates: true })
      .select()
      .single();
    if (data) return data as SavedListing;
    // Already existed — fetch it
    const existing = await this.getSavedEntry(normalized, listingId);
    if (!existing) throw new Error("Failed to save listing");
    return existing;
  }

  async unsaveListing(email: string, listingId: number): Promise<boolean> {
    const { error } = await db()
      .from("saved_listings")
      .delete()
      .eq("email", email.toLowerCase().trim())
      .eq("listing_id", listingId);
    return !error;
  }

  async isSaved(email: string, listingId: number): Promise<boolean> {
    const entry = await this.getSavedEntry(email.toLowerCase().trim(), listingId);
    return !!entry;
  }

  async getSavedByEmail(email: string): Promise<SavedListing[]> {
    const { data } = await db()
      .from("saved_listings")
      .select("*")
      .eq("email", email.toLowerCase().trim());
    return (data ?? []) as SavedListing[];
  }

  private async getSavedEntry(email: string, listingId: number): Promise<SavedListing | undefined> {
    const { data } = await db()
      .from("saved_listings")
      .select("*")
      .eq("email", email)
      .eq("listing_id", listingId)
      .maybeSingle();
    return (data as SavedListing) ?? undefined;
  }
}

export const storage = new SupabaseStorage();
