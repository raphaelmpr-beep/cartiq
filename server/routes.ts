import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { calculateCartIQValue } from "./pricing";
import { parseCsv, csvRowToListing } from "./csvParser";

// ─── snake_case → camelCase normalizer ───────────────────────────────────────
// Supabase returns column names as snake_case. The frontend expects camelCase.
// This adapter runs on all outbound listing/dealer/dealCheck objects.
function toCamel(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = obj[key];
  }
  return out;
}
function normList(rows: any[]): any[] { return rows.map(r => norm(r)); }

// For deal-check objects: enrich camelCase output with derived fields
// that are computed on the fly (not stored in DB) so the frontend always
// has current values without a schema migration.
function normDealCheck(row: any): any {
  const base = toCamel(row);
  const cmv = base.cartiqEstimatedValue ?? base.cartiqMarketValue ?? null;
  const tdc = base.totalDeliveredCost ?? null;
  if (cmv && tdc) {
    const fairCeil  = Math.round(cmv * 1.05);
    const goodCeil  = Math.round(cmv * 0.95);
    const greatCeil = Math.round(cmv * 0.85);
    base.cartiqMarketValue = cmv;
    base.dealDeltaPercent  = (tdc - cmv) / cmv;
    base.priceToImprove = {
      toFairPrice:  tdc > fairCeil  ? tdc - fairCeil  : null,
      toGoodDeal:   tdc > goodCeil  ? tdc - goodCeil  : null,
      toGreatDeal:  tdc > greatCeil ? tdc - greatCeil : null,
    };
  } else {
    base.cartiqMarketValue = cmv;
    base.dealDeltaPercent  = null;
    base.priceToImprove    = { toFairPrice: null, toGoodDeal: null, toGreatDeal: null };
  }
  return base;
}

function norm(row: any): any { return toCamel(row); }

import { getMetaConnectorStatus } from "./connectors/metaMarketplace";
import { getRetailConnectorStatus } from "./connectors/retailSource";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "cartiq2024";
const PILOT_STATES = ["FL", "GA"];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 80);
}

// Suppress delivery fields from a DB record when seller doesn't offer delivery.
function suppressDeliveryIfUnavailable(listing: Record<string, any>): Record<string, any> {
  const offersDelivery = listing.delivery_available === true || listing.delivery_included === true;
  if (offersDelivery) return listing;
  return { ...listing, estimated_delivery_cost: null, total_delivered_cost: null };
}

function enrichListingWithPricing(data: Record<string, any>): Record<string, any> {
  const result = calculateCartIQValue({
    askingPrice: data.asking_price ?? data.askingPrice,
    regularPrice: data.regular_price ?? data.regularPrice,
    salePrice: data.sale_price ?? data.salePrice,
    deliveryCost: data.estimated_delivery_cost ?? data.estimatedDeliveryCost,
    deliveryIncluded: data.delivery_included ?? data.deliveryIncluded,
    deliveryAvailable: (data.delivery_available ?? data.deliveryAvailable) ? "yes" : "no",
    year: data.year,
    brand: data.brand,
    model: data.model,
    powerType: data.power_type ?? data.powerType,
    batteryType: data.battery_type ?? data.batteryType,
    batteryAh: data.battery_ah ?? data.batteryAh,
    batteryAgeMonths: data.battery_age_months ?? data.batteryAgeMonths,
    seating: data.seating,
    lifted: data.lifted,
    streetLegalClaimed: data.street_legal_claimed ?? data.streetLegalClaimed,
    chargerIncluded: data.charger_included ?? data.chargerIncluded,
    warrantyIncluded: data.warranty_included ?? data.warrantyIncluded,
    warrantyProvider: data.warranty_provider ?? data.warrantyProvider,
    warrantyMonths: data.warranty_months ?? data.warrantyMonths,
    batteryWarrantyIncluded: data.battery_warranty_included ?? data.batteryWarrantyIncluded,
    sellerType: data.seller_type ?? data.sellerType,
    state: data.state,
    condition: data.condition,
  });

  const sellerOffersDelivery = (data.delivery_available ?? data.deliveryAvailable) === true
    || (data.delivery_included ?? data.deliveryIncluded) === true;

  return {
    ...data,
    cartiq_estimated_value: result.cartiqMarketValue,
    estimated_delivery_cost: sellerOffersDelivery
      ? (result.estimatedDeliveryCost >= 0 ? result.estimatedDeliveryCost : (data.estimated_delivery_cost ?? data.estimatedDeliveryCost))
      : null,
    total_delivered_cost: sellerOffersDelivery && result.totalDeliveredCost >= 0
      ? result.totalDeliveredCost
      : null,
    deal_delta: result.dealDelta,
    deal_rating: result.dealRating,
    buyer_score: result.buyerScore,
    street_legal_confidence: result.streetLegalConfidence,
  };
}

export function registerRoutes(httpServer: Server, app: Express) {
  // ─── Health ─────────────────────────────────────────────────────────────────
  app.get("/api/health", async (_req, res) => {
    try {
      const count = await storage.getListingCount();
      res.json({ ok: true, listings: count, env: process.env.NODE_ENV, db: "supabase" });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─── Auth middleware ─────────────────────────────────────────────────────────
  function requireAdmin(req: any, res: any, next: any) {
    const token = req.headers["x-admin-token"] || req.query.adminToken;
    if (token === ADMIN_PASSWORD) return next();
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ─── Listings ────────────────────────────────────────────────────────────────
  app.get("/api/listings", async (req, res) => {
    try {
      const filters: Record<string, unknown> = {};
      if (req.query.state) filters.state = req.query.state as string;
      if (req.query.city) filters.city = req.query.city as string;
      if (req.query.brand) filters.brand = req.query.brand as string;
      if (req.query.sellerType) filters.sellerType = req.query.sellerType as string;
      if (req.query.batteryType) filters.batteryType = req.query.batteryType as string;
      if (req.query.dealRating) filters.dealRating = req.query.dealRating as string;
      if (req.query.warrantyIncluded) filters.warrantyIncluded = req.query.warrantyIncluded as string;
      if (req.query.minPrice) filters.minPrice = parseFloat(req.query.minPrice as string);
      if (req.query.maxPrice) filters.maxPrice = parseFloat(req.query.maxPrice as string);
      if (req.query.streetLegal === "true") filters.streetLegal = true;
      if (req.query.lifted === "true") filters.lifted = true;
      const listings = await storage.getListings(filters);
      res.json(normList(listings.map(suppressDeliveryIfUnavailable)));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/listings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const listing = isNaN(id)
        ? await storage.getListingBySlug(req.params.id)
        : await storage.getListingById(id);
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      res.json(norm(suppressDeliveryIfUnavailable(listing as any)));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/listings", requireAdmin, async (req, res) => {
    try {
      const data = req.body as Record<string, any>;
      if (data.state && !PILOT_STATES.includes(data.state?.toUpperCase()) && !data.source_type?.includes("retail")) {
        data.public_listing = false;
      }
      const baseSlug = slugify(`${data.brand || "cart"}-${data.model || "listing"}-${data.city || "fl"}`);
      data.slug = data.slug || `${baseSlug}-${Date.now()}`;
      const enriched = enrichListingWithPricing(data);
      const listing = await storage.createListing(enriched as any);
      res.status(201).json(norm(listing as any));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/listings/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = req.body as Record<string, any>;
      const oldListing = await storage.getListingById(id);
      const oldEffectivePrice = oldListing
        ? (oldListing.asking_price ?? oldListing.sale_price ?? oldListing.regular_price ?? 0)
        : null;
      const enriched = enrichListingWithPricing(data);
      const listing = await storage.updateListing(id, enriched as any);
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      const newEffectivePrice = listing.asking_price ?? listing.sale_price ?? listing.regular_price ?? 0;
      let alerts: any[] = [];
      if (oldEffectivePrice !== null && newEffectivePrice < oldEffectivePrice) {
        alerts = await storage.firePriceDropAlerts(id, newEffectivePrice);
      }
      res.json({ ...norm(suppressDeliveryIfUnavailable(listing as any)), _alertsFired: alerts.length });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/listings/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteListing(id);
      if (!deleted) return res.status(404).json({ error: "Listing not found" });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Deal Checks ─────────────────────────────────────────────────────────────
  app.post("/api/deal-checks", async (req, res) => {
    try {
      const data = req.body as Record<string, any>;
      if (!data.userConfirmedDisclosure) {
        return res.status(400).json({ error: "You must confirm the disclosure before submitting a deal check." });
      }
      const brand = data.brand || data.make || null;
      const coerceBoolStr = (v: any): string => {
        if (v === true || v === "true" || v === "yes") return "yes";
        if (v === false || v === "false" || v === "no") return "no";
        return "unknown";
      };
      const liftedStr = coerceBoolStr(data.lifted);
      const streetLegalStr = coerceBoolStr(data.streetLegalClaimed);
      const deliveryCost = data.deliveryCost ?? data.estimatedDeliveryCost ?? null;
      let pilotWarning: string | null = null;
      if (data.state && !PILOT_STATES.includes(data.state?.toUpperCase())) {
        pilotWarning = "CartIQ pilot coverage is currently Florida and Georgia. Market estimates outside this area may be limited.";
      }
      const pricing = calculateCartIQValue({
        askingPrice: data.askingPrice,
        regularPrice: data.regularPrice,
        salePrice: data.salePrice,
        deliveryCost,
        deliveryIncluded: false,
        deliveryAvailable: data.deliveryAvailable,
        year: data.year,
        brand,
        model: data.model,
        powerType: data.powerType,
        batteryType: data.batteryType,
        batteryAh: data.batteryAh,
        batteryAgeMonths: data.batteryAgeMonths,
        seating: data.seating,
        lifted: liftedStr,
        streetLegalClaimed: streetLegalStr,
        chargerIncluded: data.chargerIncluded,
        warrantyIncluded: data.warrantyIncluded,
        warrantyProvider: data.warrantyProvider,
        warrantyMonths: data.warrantyMonths,
        batteryWarrantyIncluded: data.batteryWarrantyIncluded,
        sellerType: data.sellerType,
        state: data.state,
        condition: data.condition,
      });

      const dealCheck = await storage.createDealCheck({
        source_platform: data.sourcePlatform || "other",
        source_url: data.sourceUrl,
        extraction_method: "manual_user_entry",
        user_confirmed_disclosure: true,
        asking_price: data.askingPrice,
        regular_price: data.regularPrice,
        sale_price: data.salePrice,
        year: data.year,
        brand,
        model: data.model,
        city: data.city,
        state: data.state,
        seller_type: data.sellerType,
        retailer_name: data.retailerName,
        power_type: data.powerType || "unknown",
        battery_type: data.batteryType || "unknown",
        battery_ah: data.batteryAh,
        battery_age_months: data.batteryAgeMonths,
        seating: data.seating,
        lifted: liftedStr,
        street_legal_claimed: streetLegalStr,
        charger_included: data.chargerIncluded || "unknown",
        warranty_included: data.warrantyIncluded || "unknown",
        warranty_provider: data.warrantyProvider || "unknown",
        warranty_months: data.warrantyMonths,
        battery_warranty_included: data.batteryWarrantyIncluded || "unknown",
        warranty_notes: data.warrantyNotes,
        delivery_available: data.deliveryAvailable || "unknown",
        delivery_cost: deliveryCost,
        last_verified_at: data.lastVerifiedAt,
        cartiq_estimated_value: pricing.cartiqEstimatedValue,
        total_delivered_cost: pricing.totalDeliveredCost >= 0 ? pricing.totalDeliveredCost : undefined,
        deal_delta: pricing.dealDelta,
        deal_rating: pricing.dealRating,
        buyer_score: pricing.buyerScore,
        battery_risk: pricing.batteryRisk,
        charger_warning: pricing.chargerWarning ?? undefined,
        warranty_signal: pricing.warrantySignal ?? undefined,
        street_legal_confidence: pricing.streetLegalConfidence,
        red_flags: JSON.stringify(pricing.redFlags),
        questions_to_ask: JSON.stringify(pricing.questionsToAsk),
        negotiation_low: pricing.negotiationLow,
        negotiation_high: pricing.negotiationHigh,
        user_id: null,
      });

      const enrichedCheck = {
        ...normDealCheck(dealCheck as any),
        // Include live pricing fields not stored in DB
        dealDeltaPercent: pricing.dealDeltaPercent,
        priceToImprove: pricing.priceToImprove,
        cartiqMarketValue: pricing.cartiqMarketValue,
        pilotWarning,
      };
      res.status(201).json(enrichedCheck);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/deal-checks/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const dc = await storage.getDealCheckById(id);
      if (!dc) return res.status(404).json({ error: "Deal check not found" });
      res.json(norm(dc as any));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Watches ─────────────────────────────────────────────────────────────────
  app.post("/api/watches", async (req, res) => {
    try {
      const { email, listingId } = req.body as { email: string; listingId: number };
      if (!email || !listingId) return res.status(400).json({ error: "email and listingId are required" });
      const listing = await storage.getListingById(listingId);
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      if (await storage.isWatching(email, listingId)) return res.status(200).json({ alreadyWatching: true });
      const effectivePrice = listing.asking_price ?? listing.sale_price ?? listing.regular_price ?? 0;
      const watch = await storage.createWatch({ email, listing_id: listingId, price_at_watch: effectivePrice, dismissed: false, alerted_at: null, alert_price: null, alert_pct: null });
      res.status(201).json(norm(watch as any));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/watches", async (req, res) => {
    try {
      const { email } = req.query as { email: string };
      if (!email) return res.status(400).json({ error: "email is required" });
      const watches = await storage.getWatchesByEmail(email);
      const enriched = await Promise.all(watches.map(async (w) => {
        const listing = await storage.getListingById(w.listing_id);
        const normalized = norm(w as any);
        normalized.listing = listing ? norm(suppressDeliveryIfUnavailable(listing as any)) : null;
        return normalized;
      }));
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/watches/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { email } = req.query as { email: string };
      const watch = await storage.getWatchById(id);
      if (!watch) return res.status(404).json({ error: "Watch not found" });
      if (email && watch.email !== email.toLowerCase().trim()) return res.status(403).json({ error: "Unauthorized" });
      await storage.deleteWatch(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/watches/:id/dismiss", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.dismissWatch(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/watches/status", async (req, res) => {
    try {
      const { email, listingId } = req.query as { email: string; listingId: string };
      if (!email || !listingId) return res.status(400).json({ error: "email and listingId are required" });
      const watching = await storage.isWatching(email, parseInt(listingId));
      res.json({ watching });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Saves ───────────────────────────────────────────────────────────────────
  app.post("/api/saves", async (req, res) => {
    try {
      const { email, listingId } = req.body as { email: string; listingId: number };
      if (!email || !listingId) return res.status(400).json({ error: "email and listingId are required" });
      const listing = await storage.getListingById(listingId);
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      const saved = await storage.saveListing(email, listingId);
      res.status(201).json(saved);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/saves", async (req, res) => {
    try {
      const { email, listingId } = req.body as { email: string; listingId: number };
      if (!email || !listingId) return res.status(400).json({ error: "email and listingId are required" });
      await storage.unsaveListing(email, listingId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/saves", async (req, res) => {
    try {
      const { email } = req.query as { email: string };
      if (!email) return res.status(400).json({ error: "email is required" });
      const saves = await storage.getSavedByEmail(email);
      const enriched = await Promise.all(saves.map(async (s) => {
        const listing = await storage.getListingById(s.listing_id);
        const normalized = norm(s as any);
        normalized.listing = listing ? norm(suppressDeliveryIfUnavailable(listing as any)) : null;
        return normalized;
      }));
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/saves/status", async (req, res) => {
    try {
      const { email, listingId } = req.query as { email: string; listingId: string };
      if (!email || !listingId) return res.status(400).json({ error: "email and listingId are required" });
      const saved = await storage.isSaved(email, parseInt(listingId));
      res.json({ saved });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── CSV Import ──────────────────────────────────────────────────────────────
  app.post("/api/admin/csv-import", requireAdmin, async (req, res) => {
    try {
      const { csvText } = req.body as { csvText: string };
      if (!csvText) return res.status(400).json({ error: "csvText is required" });
      const { valid, errors } = parseCsv(csvText);
      const created = await Promise.all(valid.map(async (row, idx) => {
        const data = csvRowToListing(row, idx) as any;
        const enriched = enrichListingWithPricing(data) as any;
        return storage.createListing(enriched);
      }));
      res.json({ imported: created.length, errors, listings: normList(created as any[]) });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Dealers ─────────────────────────────────────────────────────────────────
  app.get("/api/dealers", async (_req, res) => {
    res.json(normList(await storage.getDealers() as any[]));
  });

  app.post("/api/dealers", requireAdmin, async (req, res) => {
    try {
      const data = req.body as any;
      if (!data.slug) data.slug = slugify(data.name || "dealer");
      const dealer = await storage.createDealer(data);
      res.status(201).json(norm(dealer as any));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/dealers/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const dealer = await storage.updateDealer(id, req.body);
      if (!dealer) return res.status(404).json({ error: "Dealer not found" });
      res.json(norm(dealer as any));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Retail Sources ───────────────────────────────────────────────────────────
  app.get("/api/retail-sources", async (_req, res) => {
    res.json(normList(await storage.getRetailSources() as any[]));
  });

  app.post("/api/retail-sources", requireAdmin, async (req, res) => {
    try {
      const data = req.body as any;
      if (!data.slug) data.slug = slugify(data.name || "retailer");
      const rs = await storage.createRetailSource(data);
      res.status(201).json(norm(rs as any));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/retail-sources/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const rs = await storage.updateRetailSource(id, req.body);
      if (!rs) return res.status(404).json({ error: "Retail source not found" });
      res.json(norm(rs as any));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Inventory Sources ────────────────────────────────────────────────────────
  app.get("/api/inventory-sources", requireAdmin, async (_req, res) => {
    res.json(normList(await storage.getInventorySources() as any[]));
  });

  app.post("/api/inventory-sources", requireAdmin, async (req, res) => {
    try {
      const src = await storage.createInventorySource(req.body);
      res.status(201).json(norm(src as any));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/inventory-sources/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const src = await storage.updateInventorySource(id, req.body);
      if (!src) return res.status(404).json({ error: "Inventory source not found" });
      res.json(norm(src as any));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Buyer Guide / SEO Articles ───────────────────────────────────────────────
  app.get("/api/buyer-guide", async (_req, res) => {
    res.json(normList(await storage.getSeoArticles() as any[]));
  });

  app.get("/api/buyer-guide/:slug", async (req, res) => {
    const article = await storage.getSeoArticleBySlug(req.params.slug);
    if (!article) return res.status(404).json({ error: "Article not found" });
    res.json(norm(article as any));
  });

  // ─── Connector Status ─────────────────────────────────────────────────────────
  app.get("/api/connectors/meta-marketplace", (_req, res) => {
    res.json(getMetaConnectorStatus());
  });

  app.get("/api/connectors/retail-source", (req, res) => {
    const retailer = (req.query.retailer as string) || "Costco";
    res.json(getRetailConnectorStatus(retailer));
  });

  // ─── Admin: all listings ──────────────────────────────────────────────────────
  app.get("/api/admin/listings", requireAdmin, async (_req, res) => {
    res.json(normList(await storage.getListings({}) as any[]));
  });

  // ─── Sync Pipeline ───────────────────────────────────────────────────────────
  // POST /api/admin/sync — run verification or discovery pipeline (Lambda-safe)
  app.post("/api/admin/sync", requireAdmin, async (req, res) => {
    try {
      const { runLambdaSync } = await import("./sync/pipeline-lambda.js");
      const opts = {
        mode: (req.body.mode || "discover_sitemap") as "discover_sitemap" | "import" | "status",
        dealer: req.body.dealer || "all",
        limit: parseInt(req.body.limit) || 10,
        import_id: req.body.import_id,
        dry_run: req.body.dry_run === true,
      };
      const result = await runLambdaSync(opts);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/pending-imports — list queued listings awaiting review
  app.get("/api/admin/pending-imports", requireAdmin, async (req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
      const status = (req.query.status as string) || "pending";
      const dealer = req.query.dealer as string | undefined;
      let q = sb.from("pending_imports").select("*").eq("status", status).order("found_at", { ascending: false }).limit(50);
      if (dealer) q = q.eq("dealer_slug", dealer);
      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/admin/pending-imports/:id — approve/reject a pending import
  app.patch("/api/admin/pending-imports/:id", requireAdmin, async (req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
      const id = parseInt(req.params.id);
      const { action } = req.body; // 'approve' | 'reject'
      if (action === "approve") {
        const { runSync } = await import("./sync/pipeline.js");
        const result = await runSync({ mode: "import", import_id: id });
        return res.json(result);
      }
      if (action === "reject") {
        const { data, error } = await sb.from("pending_imports").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
      }
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/coverage-audit — dealer coverage summary from dealer_coverage_log
  // Falls back to a live DB aggregate when no log rows exist yet (pre-backfill state).
  app.get("/api/admin/coverage-audit", requireAdmin, async (_req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

      // Most-recent log row per dealer_slug
      const { data: logRows, error: logErr } = await sb
        .from("dealer_coverage_log")
        .select("*")
        .order("scanned_at", { ascending: false });

      // Live listing counts per sync_source for the fallback / enrichment
      const { data: liveCounts, error: liveErr } = await sb
        .from("listings")
        .select("sync_source, deal_rating")
        .not("sync_source", "is", null);

      // Live pending_import counts per dealer_slug
      const { data: pendingCounts } = await sb
        .from("pending_imports")
        .select("dealer_slug")
        .eq("status", "pending");

      if (logErr || liveErr) return res.status(500).json({ error: logErr?.message || liveErr?.message });

      // Build live aggregates
      const liveBySource: Record<string, { total: number; allGreatDeal: boolean; greatDealCount: number }> = {};
      for (const row of (liveCounts || [])) {
        const k = row.sync_source;
        if (!liveBySource[k]) liveBySource[k] = { total: 0, allGreatDeal: true, greatDealCount: 0 };
        liveBySource[k].total++;
        if (row.deal_rating === "great_deal") liveBySource[k].greatDealCount++;
        if (row.deal_rating !== "great_deal") liveBySource[k].allGreatDeal = false;
      }

      const pendingByDealer: Record<string, number> = {};
      for (const row of (pendingCounts || [])) {
        pendingByDealer[row.dealer_slug] = (pendingByDealer[row.dealer_slug] || 0) + 1;
      }

      // Deduplicate log rows — keep most recent per dealer_slug
      const latestByDealer: Record<string, any> = {};
      for (const row of (logRows || [])) {
        if (!latestByDealer[row.dealer_slug]) latestByDealer[row.dealer_slug] = row;
      }

      // Merge live data into log rows, add synthetic rows for sources with no log entry
      const allDealers = new Set([
        ...Object.keys(latestByDealer),
        ...Object.keys(liveBySource),
      ]);

      const result = Array.from(allDealers).map(slug => {
        const log = latestByDealer[slug] || null;
        const live = liveBySource[slug] || { total: 0, allGreatDeal: false, greatDealCount: 0 };
        const pending = pendingByDealer[slug] || 0;
        const valuationReview = live.total > 0 && live.allGreatDeal;
        return {
          dealer_slug: slug,
          inventory_url:          log?.inventory_url || null,
          discovered_count:       log?.discovered_count || 0,
          pending_imports_count:  pending,
          public_listings_count:  live.total,
          duplicate_count:        log?.duplicate_count || 0,
          skipped_count:          log?.skipped_count || 0,
          pagination_detected:    log?.pagination_detected || false,
          pages_visited:          log?.pages_visited || 0,
          load_more_detected:     log?.load_more_detected || false,
          scroll_required:        log?.scroll_required || false,
          detail_pages_visited:   log?.detail_pages_visited || 0,
          source_page_type:       log?.source_page_type || null,
          coverage_status:        log?.coverage_status || "needs_manual_review",
          valuation_review_needed: valuationReview || log?.valuation_review_needed || false,
          adapter_notes:          log?.adapter_notes || null,
          scanned_at:             log?.scanned_at || null,
        };
      });

      // Sort: active sources with listings first, then by slug
      result.sort((a, b) => b.public_listings_count - a.public_listings_count || a.dealer_slug.localeCompare(b.dealer_slug));
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/sync-log — recent sync activity
  app.get("/api/admin/sync-log", requireAdmin, async (_req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
      const { data, error } = await sb.from("sync_log").select("*, listings(title)").order("synced_at", { ascending: false }).limit(100);
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return httpServer;
}
