import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { calculateCartIQValue } from "./pricing";
import { parseCsv, csvRowToListing } from "./csvParser";
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
// The internal $350 estimate is stored for scoring purposes only — never expose
// it to buyers as a real delivery quote.
function suppressDeliveryIfUnavailable(listing: Record<string, any>): Record<string, any> {
  const offersDelivery = listing.deliveryAvailable === true || listing.deliveryAvailable === 1
    || listing.deliveryIncluded === true || listing.deliveryIncluded === 1;
  if (offersDelivery) return listing;
  return { ...listing, estimatedDeliveryCost: null, totalDeliveredCost: null };
}

function enrichListingWithPricing(data: Record<string, any>): Record<string, any> {
  const result = calculateCartIQValue({
    askingPrice: data.askingPrice,
    regularPrice: data.regularPrice,
    salePrice: data.salePrice,
    deliveryCost: data.estimatedDeliveryCost,
    deliveryIncluded: data.deliveryIncluded,
    deliveryAvailable: data.deliveryAvailable ? "yes" : "no",
    year: data.year,
    brand: data.brand,
    model: data.model,
    powerType: data.powerType,
    batteryType: data.batteryType,
    batteryAh: data.batteryAh,
    batteryAgeMonths: data.batteryAgeMonths,
    seating: data.seating,
    lifted: data.lifted,
    streetLegalClaimed: data.streetLegalClaimed,
    chargerIncluded: data.chargerIncluded,
    warrantyIncluded: data.warrantyIncluded,
    warrantyProvider: data.warrantyProvider,
    warrantyMonths: data.warrantyMonths,
    batteryWarrantyIncluded: data.batteryWarrantyIncluded,
    sellerType: data.sellerType,
    state: data.state,
  });

  // FIX: only expose estimatedDeliveryCost / totalDeliveredCost when delivery
  // is actually available from the seller. When deliveryAvailable=false, the
  // internal $350 estimate is used for scoring only — it should not be shown
  // to buyers as a real quote.
  const sellerOffersDelivery = data.deliveryAvailable === true || data.deliveryIncluded === true;
  return {
    ...data,
    cartiqEstimatedValue: result.cartiqEstimatedValue,
    estimatedDeliveryCost: sellerOffersDelivery
      ? (result.estimatedDeliveryCost >= 0 ? result.estimatedDeliveryCost : data.estimatedDeliveryCost)
      : null,
    totalDeliveredCost: sellerOffersDelivery && result.totalDeliveredCost >= 0
      ? result.totalDeliveredCost
      : null,
    dealDelta: result.dealDelta,
    dealRating: result.dealRating,
    buyerScore: result.buyerScore,
    streetLegalConfidence: result.streetLegalConfidence,
  };
}

export function registerRoutes(httpServer: Server, app: Express) {
  // ─── Auth middleware ────────────────────────────────────────────────────────
  function requireAdmin(req: any, res: any, next: any) {
    const token = req.headers["x-admin-token"] || req.query.adminToken;
    if (token === ADMIN_PASSWORD) return next();
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ─── Listings ───────────────────────────────────────────────────────────────
  app.get("/api/listings", (req, res) => {
    try {
      const filters: Record<string, unknown> = { publicOnly: true, status: "active" };
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
      const listings = storage.getListings(filters).map(suppressDeliveryIfUnavailable);
      res.json(listings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/listings/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const listing = isNaN(id)
        ? storage.getListingBySlug(req.params.id)
        : storage.getListingById(id);
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      res.json(suppressDeliveryIfUnavailable(listing as any));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/listings", requireAdmin, (req, res) => {
    try {
      const data = req.body as Record<string, any>;

      // Region check
      if (data.state && !PILOT_STATES.includes(data.state?.toUpperCase()) && !data.sourceType?.includes("retail")) {
        data.publicListing = false;
        data._outOfPilotWarning = true;
      }

      const baseSlug = slugify(`${data.brand || "cart"}-${data.model || "listing"}-${data.city || "fl"}`);
      data.slug = data.slug || `${baseSlug}-${Date.now()}`;

      const enriched = enrichListingWithPricing(data);
      const listing = storage.createListing(enriched as any);
      res.status(201).json(listing);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/listings/:id", requireAdmin, (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = req.body as Record<string, any>;

      // Capture old effective price BEFORE update for price-drop detection
      const oldListing = storage.getListingById(id);
      const oldEffectivePrice = oldListing
        ? (oldListing.askingPrice ?? oldListing.salePrice ?? oldListing.regularPrice ?? 0)
        : null;

      const enriched = enrichListingWithPricing(data);
      const listing = storage.updateListing(id, enriched as any);
      if (!listing) return res.status(404).json({ error: "Listing not found" });

      // Fire price-drop alerts if the effective price dropped
      const newEffectivePrice = listing.askingPrice ?? listing.salePrice ?? listing.regularPrice ?? 0;
      let alerts: any[] = [];
      if (oldEffectivePrice !== null && newEffectivePrice < oldEffectivePrice) {
        alerts = storage.firePriceDropAlerts(id, newEffectivePrice);
      }

      res.json({ ...suppressDeliveryIfUnavailable(listing as any), _alertsFired: alerts.length });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/listings/:id", requireAdmin, (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = storage.deleteListing(id);
      if (!deleted) return res.status(404).json({ error: "Listing not found" });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Deal Checks ────────────────────────────────────────────────────────────
  app.post("/api/deal-checks", (req, res) => {
    try {
      const data = req.body as Record<string, any>;

      if (!data.userConfirmedDisclosure) {
        return res.status(400).json({
          error: "You must confirm the disclosure before submitting a deal check.",
        });
      }

      // FIX: accept 'make' as alias for 'brand' — brand-tier multiplier always applied
      const brand = data.brand || data.make || null;

      // FIX: coerce JSON booleans → string for lifted/streetLegalClaimed
      // SQLite text columns throw on raw JS booleans
      const coerceBoolStr = (v: any): string => {
        if (v === true || v === "true" || v === "yes") return "yes";
        if (v === false || v === "false" || v === "no") return "no";
        return "unknown";
      };
      const liftedStr = coerceBoolStr(data.lifted);
      const streetLegalStr = coerceBoolStr(data.streetLegalClaimed);

      // FIX: accept estimatedDeliveryCost as alias for deliveryCost
      const deliveryCost = data.deliveryCost ?? data.estimatedDeliveryCost ?? null;

      // Pilot warning for out-of-state
      let pilotWarning: string | null = null;
      if (data.state && !PILOT_STATES.includes(data.state?.toUpperCase())) {
        pilotWarning =
          "CartIQ pilot coverage is currently Florida and Georgia. Market estimates outside this area may be limited.";
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
      });

      const dealCheck = storage.createDealCheck({
        sourcePlatform: data.sourcePlatform || "other",
        sourceUrl: data.sourceUrl,
        extractionMethod: "manual_user_entry",
        userConfirmedDisclosure: true,
        askingPrice: data.askingPrice,
        regularPrice: data.regularPrice,
        salePrice: data.salePrice,
        year: data.year,
        brand,
        model: data.model,
        city: data.city,
        state: data.state,
        sellerType: data.sellerType,
        retailerName: data.retailerName,
        powerType: data.powerType || "unknown",
        batteryType: data.batteryType || "unknown",
        batteryAh: data.batteryAh,
        batteryAgeMonths: data.batteryAgeMonths,
        seating: data.seating,
        lifted: liftedStr,
        streetLegalClaimed: streetLegalStr,
        chargerIncluded: data.chargerIncluded || "unknown",
        warrantyIncluded: data.warrantyIncluded || "unknown",
        warrantyProvider: data.warrantyProvider || "unknown",
        warrantyMonths: data.warrantyMonths,
        batteryWarrantyIncluded: data.batteryWarrantyIncluded || "unknown",
        warrantyNotes: data.warrantyNotes,
        deliveryAvailable: data.deliveryAvailable || "unknown",
        deliveryCost,
        lastVerifiedAt: data.lastVerifiedAt,
        cartiqEstimatedValue: pricing.cartiqEstimatedValue,
        totalDeliveredCost: pricing.totalDeliveredCost >= 0 ? pricing.totalDeliveredCost : undefined,
        dealDelta: pricing.dealDelta,
        dealRating: pricing.dealRating,
        buyerScore: pricing.buyerScore,
        batteryRisk: pricing.batteryRisk,
        chargerWarning: pricing.chargerWarning ?? undefined,
        warrantySignal: pricing.warrantySignal ?? undefined,
        streetLegalConfidence: pricing.streetLegalConfidence,
        redFlags: JSON.stringify(pricing.redFlags),
        questionsToAsk: JSON.stringify(pricing.questionsToAsk),
        negotiationLow: pricing.negotiationLow,
        negotiationHigh: pricing.negotiationHigh,
      });

      res.status(201).json({ ...dealCheck, pilotWarning });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/deal-checks/:id", requireAdmin, (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const dc = storage.getDealCheckById(id);
      if (!dc) return res.status(404).json({ error: "Deal check not found" });
      res.json(dc);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Watches ──────────────────────────────────────────────────────────────

  // POST /api/watches — create a watch
  app.post("/api/watches", (req, res) => {
    try {
      const { email, listingId } = req.body as { email: string; listingId: number };
      if (!email || !listingId) return res.status(400).json({ error: "email and listingId are required" });
      const listing = storage.getListingById(listingId);
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      if (storage.isWatching(email, listingId)) return res.status(200).json({ alreadyWatching: true });
      const effectivePrice = listing.askingPrice ?? listing.salePrice ?? listing.regularPrice ?? 0;
      const watch = storage.createWatch({ email, listingId, priceAtWatch: effectivePrice });
      res.status(201).json(watch);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // GET /api/watches?email= — get all watches (with alerts) for an email
  app.get("/api/watches", (req, res) => {
    try {
      const { email } = req.query as { email: string };
      if (!email) return res.status(400).json({ error: "email is required" });
      const watches = storage.getWatchesByEmail(email);
      const enriched = watches.map((w) => {
        const listing = storage.getListingById(w.listingId);
        return { ...w, listing: listing ? suppressDeliveryIfUnavailable(listing as any) : null };
      });
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/watches/:id — unwatch
  app.delete("/api/watches/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { email } = req.query as { email: string };
      const watch = storage.getWatchById(id);
      if (!watch) return res.status(404).json({ error: "Watch not found" });
      if (email && watch.email !== email.toLowerCase().trim()) return res.status(403).json({ error: "Unauthorized" });
      storage.deleteWatch(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/watches/:id/dismiss — dismiss an alert without removing the watch
  app.post("/api/watches/:id/dismiss", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      storage.dismissWatch(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/watches/status?email=&listingId= — check if watching
  app.get("/api/watches/status", (req, res) => {
    try {
      const { email, listingId } = req.query as { email: string; listingId: string };
      if (!email || !listingId) return res.status(400).json({ error: "email and listingId are required" });
      const watching = storage.isWatching(email, parseInt(listingId));
      res.json({ watching });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Saves ─────────────────────────────────────────────────────────────────

  // POST /api/saves — save a listing
  app.post("/api/saves", (req, res) => {
    try {
      const { email, listingId } = req.body as { email: string; listingId: number };
      if (!email || !listingId) return res.status(400).json({ error: "email and listingId are required" });
      const listing = storage.getListingById(listingId);
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      const saved = storage.saveListing(email, listingId);
      res.status(201).json(saved);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // DELETE /api/saves — unsave a listing
  app.delete("/api/saves", (req, res) => {
    try {
      const { email, listingId } = req.body as { email: string; listingId: number };
      if (!email || !listingId) return res.status(400).json({ error: "email and listingId are required" });
      storage.unsaveListing(email, listingId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/saves?email= — get all saved listings for an email
  app.get("/api/saves", (req, res) => {
    try {
      const { email } = req.query as { email: string };
      if (!email) return res.status(400).json({ error: "email is required" });
      const saves = storage.getSavedByEmail(email);
      const enriched = saves.map((s) => {
        const listing = storage.getListingById(s.listingId);
        return { ...s, listing: listing ? suppressDeliveryIfUnavailable(listing as any) : null };
      });
      res.json(enriched);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/saves/status?email=&listingId= — check if saved
  app.get("/api/saves/status", (req, res) => {
    try {
      const { email, listingId } = req.query as { email: string; listingId: string };
      if (!email || !listingId) return res.status(400).json({ error: "email and listingId are required" });
      const saved = storage.isSaved(email, parseInt(listingId));
      res.json({ saved });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── CSV Import ─────────────────────────────────────────────────────────────
  app.post("/api/admin/csv-import", requireAdmin, (req, res) => {
    try {
      const { csvText } = req.body as { csvText: string };
      if (!csvText) return res.status(400).json({ error: "csvText is required" });

      const { valid, errors } = parseCsv(csvText);

      const created = valid.map((row, idx) => {
        const data = csvRowToListing(row, idx) as any;
        const enriched = enrichListingWithPricing(data) as any;
        return storage.createListing(enriched);
      });

      res.json({
        imported: created.length,
        errors,
        listings: created,
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Dealers ────────────────────────────────────────────────────────────────
  app.get("/api/dealers", (req, res) => {
    res.json(storage.getDealers());
  });

  app.post("/api/dealers", requireAdmin, (req, res) => {
    try {
      const data = req.body as any;
      if (!data.slug) data.slug = slugify(data.name || "dealer");
      const dealer = storage.createDealer(data);
      res.status(201).json(dealer);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/dealers/:id", requireAdmin, (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const dealer = storage.updateDealer(id, req.body);
      if (!dealer) return res.status(404).json({ error: "Dealer not found" });
      res.json(dealer);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Retail Sources ─────────────────────────────────────────────────────────
  app.get("/api/retail-sources", (req, res) => {
    res.json(storage.getRetailSources());
  });

  app.post("/api/retail-sources", requireAdmin, (req, res) => {
    try {
      const data = req.body as any;
      if (!data.slug) data.slug = slugify(data.name || "retailer");
      const rs = storage.createRetailSource(data);
      res.status(201).json(rs);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/retail-sources/:id", requireAdmin, (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const rs = storage.updateRetailSource(id, req.body);
      if (!rs) return res.status(404).json({ error: "Retail source not found" });
      res.json(rs);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Inventory Sources ──────────────────────────────────────────────────────
  app.get("/api/inventory-sources", requireAdmin, (req, res) => {
    res.json(storage.getInventorySources());
  });

  app.post("/api/inventory-sources", requireAdmin, (req, res) => {
    try {
      const src = storage.createInventorySource(req.body);
      res.status(201).json(src);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/inventory-sources/:id", requireAdmin, (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const src = storage.updateInventorySource(id, req.body);
      if (!src) return res.status(404).json({ error: "Inventory source not found" });
      res.json(src);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── Buyer Guide / SEO Articles ─────────────────────────────────────────────
  app.get("/api/buyer-guide", (req, res) => {
    res.json(storage.getSeoArticles());
  });

  app.get("/api/buyer-guide/:slug", (req, res) => {
    const article = storage.getSeoArticleBySlug(req.params.slug);
    if (!article) return res.status(404).json({ error: "Article not found" });
    res.json(article);
  });

  // ─── Connector Status ────────────────────────────────────────────────────────
  app.get("/api/connectors/meta-marketplace", (req, res) => {
    res.json(getMetaConnectorStatus());
  });

  app.get("/api/connectors/retail-source", (req, res) => {
    const retailer = (req.query.retailer as string) || "Costco";
    res.json(getRetailConnectorStatus(retailer));
  });

  // ─── Admin: all listings (including non-public) ──────────────────────────────
  app.get("/api/admin/listings", requireAdmin, (req, res) => {
    const listings = storage.getListings({});
    res.json(listings);
  });

  return httpServer;
}
