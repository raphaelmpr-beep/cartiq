import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { calculateCartIQValue, enrichListing } from "./pricing";
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

// Sync (no-comp) pricing — used for CSV import and places where we don't have comps handy
function enrichListingWithPricing(data: Record<string, any>): Record<string, any> {
  const pricing = enrichListing(data, []); // no comps — formula fallback
  return { ...data, ...pricing };
}

// Async (comp-aware) pricing — used for single listing create/update
async function enrichListingWithComps(data: Record<string, any>, excludeId?: number): Promise<Record<string, any>> {
  const brand     = data.brand ?? data.brand;
  const model     = data.model ?? data.model;
  const year      = data.year ?? new Date().getFullYear();
  const condition = data.condition ?? "new";
  let comps: any[] = [];
  if (brand && model) {
    comps = await storage.getCompsForListing(brand, model, year, condition, excludeId);
  }
  const pricing = enrichListing(data, comps);
  return { ...data, ...pricing };
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


  // ─── SEO: robots.txt ────────────────────────────────────────────────────────
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(`# CartIQ — Florida & Georgia Golf Cart Price Intelligence
# https://cartiq-chi.vercel.app

User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /my-garage

User-agent: GPTBot
Allow: /
Disallow: /admin
Disallow: /api/

User-agent: Claude-Web
Allow: /
Disallow: /admin
Disallow: /api/

User-agent: PerplexityBot
Allow: /
Disallow: /admin
Disallow: /api/

User-agent: Google-Extended
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: https://cartiq-chi.vercel.app/sitemap.xml`);
  });

  // ─── SEO: llms.txt (AI crawler guidance) ────────────────────────────────────
  app.get("/llms.txt", (_req, res) => {
    res.type("text/plain").send(`# CartIQ — Florida & Georgia Golf Cart Price Intelligence
# https://cartiq-chi.vercel.app

## About CartIQ
CartIQ is a golf cart market intelligence platform for Florida and Georgia.
It aggregates 1,300+ listings from dealers, applies comp-based pricing (CarGurus-style),
and provides deal ratings, buyer scores, and delivery-adjusted pricing.

## Allowed for AI indexing
- Public listing pages (/listing/*)
- Search (/search), Buyer Guide (/buyer-guide/*), Homepage (/), Deal Checker (/deal-checker)

## Restricted
- /admin, /api/*, /my-garage

## Attribution
Source: CartIQ (cartiq-chi.vercel.app)`);
  });

  // ─── SEO: sitemap.xml (dynamic) ─────────────────────────────────────────────
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const listings = await storage.getListings({ status: "active", public_listing: true });
      const articles = await storage.getSeoArticles() as any[];
      const base = "https://cartiq-chi.vercel.app";
      const today = new Date().toISOString().split("T")[0];
      const staticPages = [
        { path: "/",             priority: "1.0", changefreq: "weekly" },
        { path: "/search",       priority: "0.9", changefreq: "daily"  },
        { path: "/deal-checker", priority: "0.8", changefreq: "weekly" },
        { path: "/buyer-guide",  priority: "0.8", changefreq: "weekly" },
        { path: "/sell-my-cart",  priority: "0.5", changefreq: "monthly" },
        { path: "/how-it-works",   priority: "0.7", changefreq: "monthly" },
        { path: "/disclosure",     priority: "0.3", changefreq: "yearly"  },
        // City landing pages
        { path: "/golf-carts-for-sale/the-villages-fl",      priority: "0.8", changefreq: "daily" },
        { path: "/golf-carts-for-sale/wildwood-fl",          priority: "0.8", changefreq: "daily" },
        { path: "/golf-carts-for-sale/lady-lake-fl",         priority: "0.8", changefreq: "daily" },
        { path: "/golf-carts-for-sale/nocatee-fl",           priority: "0.8", changefreq: "daily" },
        { path: "/golf-carts-for-sale/st-augustine-fl",      priority: "0.8", changefreq: "daily" },
        { path: "/golf-carts-for-sale/jacksonville-fl",      priority: "0.8", changefreq: "daily" },
        { path: "/golf-carts-for-sale/clearwater-fl",        priority: "0.8", changefreq: "daily" },
        { path: "/golf-carts-for-sale/port-orange-fl",       priority: "0.7", changefreq: "daily" },
        { path: "/golf-carts-for-sale/panama-city-beach-fl", priority: "0.7", changefreq: "daily" },
        { path: "/golf-carts-for-sale/peachtree-city-ga",    priority: "0.8", changefreq: "daily" },
        { path: "/golf-carts-for-sale/atlanta-ga",           priority: "0.8", changefreq: "daily" },
        // Brand pages
        { path: "/brands/ezgo",       priority: "0.8", changefreq: "weekly" },
        { path: "/brands/club-car",   priority: "0.8", changefreq: "weekly" },
        { path: "/brands/yamaha",     priority: "0.7", changefreq: "weekly" },
        { path: "/brands/icon",       priority: "0.7", changefreq: "weekly" },
        { path: "/brands/evolution",  priority: "0.7", changefreq: "weekly" },
        { path: "/brands/venom-ev",   priority: "0.7", changefreq: "weekly" },
        { path: "/brands/bintelli",   priority: "0.6", changefreq: "weekly" },
        { path: "/brands/epic",       priority: "0.6", changefreq: "weekly" },
        { path: "/brands/denago",     priority: "0.6", changefreq: "weekly" },
        // Battery guide pages
        { path: "/golf-cart-batteries",                        priority: "0.8", changefreq: "monthly" },
        { path: "/golf-cart-batteries/lithium-vs-lead-acid",   priority: "0.8", changefreq: "monthly" },
        { path: "/golf-cart-batteries/105ah-vs-150ah",         priority: "0.7", changefreq: "monthly" },
        { path: "/golf-cart-batteries/charger-included",       priority: "0.7", changefreq: "monthly" },
      ];
      const urls = [
        ...staticPages.map(p =>
          `  <url><loc>${base}${p.path}</loc><lastmod>${today}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
        ),
        // Buyer Guide articles
        ...articles.filter((a: any) => a.published).map((a: any) => {
          const lastmod = (a.updated_at ?? a.updatedAt ?? today).toString().slice(0, 10);
          return `  <url><loc>${base}/buyer-guide/${a.slug}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`;
        }),
        // Listing detail pages
        ...listings.map((l: any) => {
          const slug = l.slug ?? l.id;
          const lastmod = (l.updatedAt ?? l.updated_at ?? today).toString().slice(0, 10);
          return `  <url><loc>${base}/listing/${slug}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`;
        }),
      ];
      res.type("application/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`
      );
    } catch (e: any) {
      res.status(500).send("<!-- sitemap error -->");
    }
  });

  // ─── Auth middleware ─────────────────────────────────────────────────────────
  function requireAdmin(req: any, res: any, next: any) {
    const token = req.headers["x-admin-token"] || req.query.adminToken;
    if (token === ADMIN_PASSWORD) return next();
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ─── Listings ────────────────────────────────────────────────────────────────

  // Hot deals carousel — great_deal + good_deal, priced + imaged, sorted by buyer_score
  app.get("/api/listings/hot-deals", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 40);
      const deals = await storage.getHotDeals(limit);
      res.json(normList(deals.map(suppressDeliveryIfUnavailable)));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  // ─── Daily price refresh ────────────────────────────────────────────────────
  // Called by cron every day at 6 AM EDT.
  // Fetches the source page for each hot-deal listing that has a specific product URL,
  // extracts the current price, and updates asking_price + updated_at if it changed.
  app.post("/api/admin/daily-price-refresh", async (req, res) => {
    const token = req.headers["x-admin-token"];
    if (token !== "cartiq2024") return res.status(401).json({ error: "Unauthorized" });

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

      // Fetch all active hot-deal listings with a non-category source_url
      const { data: candidates, error } = await db
        .from("listings")
        .select("id, title, asking_price, source_url, deal_rating, dealer_id, updated_at")
        .eq("status", "active")
        .eq("public_listing", true)
        .in("deal_rating", ["great_deal", "good_deal"])
        .not("source_url", "is", null)
        .not("asking_price", "is", null);

      if (error) throw new Error(error.message);

      // Filter to listings with specific product-level URLs (not category/listing pages)
      // A product URL typically has a slug/ID at the end, not just /inventory or /products
      const CATEGORY_PATTERNS = [
        /\/inventory\/?$/i,
        /\/products\/?$/i,
        /\/for-sale\/?$/i,
        /\/shop\/?$/i,
        /\/golf-carts\/?$/i,
        /--inventory/i,
      ];
      const isProductUrl = (url: string) =>
        url && !CATEGORY_PATTERNS.some((p) => p.test(url));

      const toCheck = (candidates ?? []).filter((l: any) => isProductUrl(l.source_url));

      const results = { checked: 0, updated: 0, unchanged: 0, errors: 0, skipped: 0 };
      results.skipped = (candidates?.length ?? 0) - toCheck.length;

      // Price extraction: look for common patterns in page HTML
      const extractPrice = (html: string): number | null => {
        // Matches: $9,999  $9999  9,999.00  9999
        const patterns = [
          /\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/g,
          /"price"\s*:\s*"?([0-9]{3,6}(?:\.[0-9]{2})?)"?/gi,
          /data-price="([0-9]{3,6})"/gi,
          /class="[^"]*price[^"]*"[^>]*>\s*\$?([0-9]{1,3}(?:,[0-9]{3})*)/gi,
        ];
        const found: number[] = [];
        for (const pattern of patterns) {
          let m;
          while ((m = pattern.exec(html)) !== null) {
            const n = parseFloat(m[1].replace(/,/g, ""));
            if (n >= 500 && n <= 80000) found.push(n);
          }
        }
        if (!found.length) return null;
        // Return the most-frequently-occurring price
        const freq: Record<number, number> = {};
        for (const p of found) freq[p] = (freq[p] || 0) + 1;
        return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
      };

      // Process in small batches to avoid timeout
      const BATCH = 5;
      for (let i = 0; i < Math.min(toCheck.length, 30); i += BATCH) {
        const batch = toCheck.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async (listing: any) => {
            try {
              results.checked++;
              const resp = await fetch(listing.source_url, {
                signal: AbortSignal.timeout(8000),
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (compatible; CartIQ-PriceBot/1.0; +https://cartiq-chi.vercel.app)",
                },
              });
              if (!resp.ok) { results.errors++; return; }

              const html = await resp.text();
              const livePrice = extractPrice(html);
              if (!livePrice) { results.errors++; return; }

              const currentPrice = listing.asking_price;
              const delta = Math.abs(livePrice - currentPrice);
              const pctChange = delta / currentPrice;

              // Only update if price changed by >1% (noise filter)
              if (pctChange > 0.01) {
                await db
                  .from("listings")
                  .update({
                    asking_price: livePrice,
                    price_scraped: livePrice,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", listing.id);
                results.updated++;
              } else {
                // Re-stamp updated_at to confirm price was checked today
                await db
                  .from("listings")
                  .update({ updated_at: new Date().toISOString() })
                  .eq("id", listing.id);
                results.unchanged++;
              }
            } catch {
              results.errors++;
            }
          })
        );
      }

      res.json({
        ok: true,
        date: new Date().toISOString().slice(0, 10),
        ...results,
        total_candidates: candidates?.length ?? 0,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Last-refresh status endpoint (public — used by carousel header)
  app.get("/api/listings/hot-deals-meta", async (req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
      const { data } = await db
        .from("listings")
        .select("updated_at")
        .in("deal_rating", ["great_deal", "good_deal"])
        .eq("status", "active")
        .eq("public_listing", true)
        .order("updated_at", { ascending: false })
        .limit(1);

      const lastUpdated = data?.[0]?.updated_at ?? null;
      res.json({ lastUpdated });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

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
      if (req.query.limit) filters.limit = Math.min(parseInt(req.query.limit as string) || 500, 5000);
      else filters.limit = 500; // default cap for /api/listings (search page)
      const listings = await storage.getListings(filters);
      res.json(normList(listings.map(suppressDeliveryIfUnavailable)));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/listings/:id", async (req, res) => {
    try {
      // Use strict numeric check — parseInt("2027-some-slug") = 2027 which is wrong.
      // Only treat param as a numeric ID if the ENTIRE string is digits.
      const isNumericId = /^\d+$/.test(req.params.id);
      const id = isNumericId ? parseInt(req.params.id) : NaN;
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
      const enriched = await enrichListingWithComps(data);
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
      const enriched = await enrichListingWithComps(data, id);
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

  // ─── Reprice All ─────────────────────────────────────────────────────────────
  // Backfills cartiq_estimated_value, deal_rating, deal_delta, buyer_score,
  // price_confidence, valuation_confidence for every active public listing.
  // Uses comp-based IMV engine. Safe to call multiple times (idempotent).
  app.post("/api/admin/reprice-all", requireAdmin, async (req, res) => {
    const BATCH = 100;
    let offset = 0;
    let processed = 0;
    let updated = 0;
    const errors: string[] = [];

    try {
      const totalCount = await storage.getListingCount();
      console.log(`[reprice-all] Starting — ${totalCount} listings`);

      while (true) {
        const batch = await storage.getAllListingsForReprice(offset, BATCH);
        if (!batch.length) break;

        // Fetch comps for each unique brand+model+year+condition group once
        type CompKey = string;
        const compCache = new Map<CompKey, any[]>();

        for (const listing of batch) {
          processed++;
          try {
            const brand     = listing.brand || "";
            const model     = listing.model || "";
            const year      = listing.year  || new Date().getFullYear();
            const condition = listing.condition || "new";
            const key: CompKey = `${brand}||${model}||${year}||${condition}`;

            if (!compCache.has(key)) {
              const comps = brand && model
                ? await storage.getCompsForListing(brand, model, year, condition, listing.id)
                : [];
              compCache.set(key, comps);
            }

            const comps = compCache.get(key)!;
            const pricing = enrichListing(listing, comps);

            // Only write fields managed by the pricing engine
            const patch: Record<string, any> = {
              cartiq_estimated_value: pricing.cartiq_estimated_value,
              deal_rating:            pricing.deal_rating,
              deal_delta:             pricing.deal_delta,
              buyer_score:            pricing.buyer_score,
              price_confidence:       pricing.price_confidence,
              valuation_confidence:   pricing.valuation_confidence,
            };
            if (pricing.estimated_delivery_cost !== null) patch.estimated_delivery_cost = pricing.estimated_delivery_cost;
            if (pricing.total_delivered_cost    !== null) patch.total_delivered_cost    = pricing.total_delivered_cost;

            await storage.updateListing(listing.id, patch as any);
            updated++;
          } catch (err: any) {
            errors.push(`id=${listing.id}: ${err.message}`);
          }
        }

        offset += BATCH;
        console.log(`[reprice-all] Progress: ${processed} processed, ${updated} updated`);
        if (batch.length < BATCH) break;
      }

      console.log(`[reprice-all] Done — ${updated}/${processed} updated, ${errors.length} errors`);
      res.json({ processed, updated, errors: errors.slice(0, 20) });
    } catch (e: any) {
      res.status(500).json({ error: e.message, processed, updated });
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

  app.get("/api/dealers/:slug", async (req, res) => {
    const slug = req.params.slug;
    let dealer = await storage.getDealerBySlug(slug);
    if (!dealer) {
      // fallback: try sync_source prefix match (e.g. 'jenkins' → 'jenkins-motorsports-lakeland')
      dealer = await storage.getDealerBySyncSource(slug);
    }
    if (!dealer) return res.status(404).json({ error: "Dealer not found" });
    res.json(norm(dealer as any));
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
      const dealer   = req.query.dealer as string | undefined;
      const reqLimit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
      const reqOffset = parseInt(req.query.offset as string) || 0;
      let q = sb.from("pending_imports").select("*", { count: "exact" })
        .eq("status", status)
        .order("found_at", { ascending: false })
        .range(reqOffset, reqOffset + reqLimit - 1);
      if (dealer) q = q.eq("dealer_slug", dealer);
      const { data, error, count } = await q;
      if (error) return res.status(500).json({ error: error.message });
      res.setHeader("X-Total-Count", String(count ?? 0));
      res.json(data || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Inline import helper — promotes pending_import → listing without pipeline.js ──
  async function approvePendingImport(sb: any, id: number): Promise<{ listingId: number; title: string }> {
    const { data: imp, error: fetchErr } = await sb
      .from("pending_imports")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !imp) throw new Error(fetchErr?.message || `pending_import #${id} not found`);

    const title = imp.raw_title || [imp.year, imp.make, imp.model].filter(Boolean).join(" ") || "Unknown listing";

    const baseSlug = slugify(`${imp.make || "cart"}-${imp.model || "listing"}-${imp.location_city || imp.dealer_slug || "fl"}`);
    const slug = `${baseSlug}-${Date.now()}`;

    const newListing = {
      slug,
      title,
      year:               imp.year        ?? null,
      brand:              imp.make        ?? null,
      model:              imp.model       ?? null,
      condition:          imp.condition   ?? null,
      asking_price:       imp.price       ?? null,
      image_url:          imp.image_url   ?? null,
      image_urls_json:    imp.image_urls_json ?? "[]",
      city:               imp.location_city  ?? null,
      state:              imp.location_state ?? null,
      source_listing_url: imp.source_url  ?? null,
      source_type:        "dealer_site",
      sync_source:        imp.dealer_slug ?? null,
      seller_type:        "dealer",
      status:             "active",
      public_listing:     true,
      price_confidence:   imp.price ? "confirmed" : "unavailable",
      deal_rating:        "unknown",
      valuation_confidence: "low",
      verified_at:        new Date().toISOString(),
      last_checked_at:    new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await sb
      .from("listings")
      .insert(newListing)
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    await sb.from("pending_imports").update({
      status: "imported",
      reviewed_at: new Date().toISOString(),
      imported_listing_id: inserted.id,
    }).eq("id", id);

    return { listingId: inserted.id, title };
  }

  // PATCH /api/admin/pending-imports/:id — approve/reject a pending import
  app.patch("/api/admin/pending-imports/:id", requireAdmin, async (req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
      const id = parseInt(req.params.id);
      const { action } = req.body; // 'approve' | 'reject'
      if (action === "approve") {
        const result = await approvePendingImport(sb, id);
        return res.json({ ok: true, ...result });
      }
      if (action === "reject") {
        const { data, error } = await sb.from("pending_imports")
          .update({ status: "rejected", reviewed_at: new Date().toISOString() })
          .eq("id", id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
      }
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/pending-imports/bulk-approve-all — approve ALL pending, optionally filtered by dealer_slug
  app.post("/api/admin/pending-imports/bulk-approve-all", requireAdmin, async (req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
      const { dealer_slug } = req.body as { dealer_slug?: string };

      // Fetch all pending IDs (paginate to handle 1000+)
      let allIds: number[] = [];
      let from = 0;
      const PAGE = 500;
      while (true) {
        let q = sb.from("pending_imports").select("id").eq("status", "pending").range(from, from + PAGE - 1);
        if (dealer_slug) q = q.eq("dealer_slug", dealer_slug);
        const { data, error } = await q;
        if (error) return res.status(500).json({ error: error.message });
        allIds = allIds.concat((data || []).map((r: any) => r.id));
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }

      if (allIds.length === 0) return res.json({ approved: 0, failed: 0, errors: [], total: 0 });

      let approved = 0, failed = 0;
      const errors: { id: number; error: string }[] = [];
      for (const id of allIds) {
        try { await approvePendingImport(sb, id); approved++; }
        catch (e: any) { failed++; errors.push({ id, error: e.message }); }
      }
      res.json({ approved, failed, errors: errors.slice(0, 20), total: allIds.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/pending-imports/bulk-approve — approve a set of pending imports
  app.post("/api/admin/pending-imports/bulk-approve", requireAdmin, async (req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
      const { dealer_slug, ids } = req.body as { dealer_slug?: string; ids?: number[] };

      let q = sb.from("pending_imports").select("id").eq("status", "pending");
      if (ids && ids.length > 0) {
        q = q.in("id", ids);
      } else if (dealer_slug) {
        q = q.eq("dealer_slug", dealer_slug);
      } else {
        return res.status(400).json({ error: "Provide dealer_slug or ids" });
      }
      const { data: rows, error: fetchErr } = await q;
      if (fetchErr) return res.status(500).json({ error: fetchErr.message });
      if (!rows || rows.length === 0) return res.json({ approved: 0, failed: 0, errors: [], total: 0 });

      let approved = 0;
      let failed = 0;
      const errors: { id: number; error: string }[] = [];

      for (const row of rows) {
        try {
          await approvePendingImport(sb, row.id);
          approved++;
        } catch (e: any) {
          failed++;
          errors.push({ id: row.id, error: e.message });
        }
      }

      res.json({ approved, failed, errors, total: rows.length });
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

  // POST /api/admin/coverage-baseline — write a baseline dealer_coverage_log row
  // for a dealer that has active listings but no log entry yet.
  // Sets coverage_status = 'partial_inventory' (has real data, not yet fully audited).
  app.post("/api/admin/coverage-baseline", requireAdmin, async (req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
      const { dealer_slug } = req.body;
      if (!dealer_slug) return res.status(400).json({ error: "dealer_slug required" });

      // Count active listings for this dealer
      const { count: activeCount } = await sb
        .from("listings")
        .select("*", { count: "exact", head: true })
        .eq("sync_source", dealer_slug)
        .eq("status", "active")
        .eq("public_listing", true);

      // Count pending imports
      const { count: pendingCount } = await sb
        .from("pending_imports")
        .select("*", { count: "exact", head: true })
        .eq("dealer_slug", dealer_slug)
        .eq("status", "pending");

      // Check for existing log entry
      const { data: existing } = await sb
        .from("dealer_coverage_log")
        .select("id")
        .eq("dealer_slug", dealer_slug)
        .order("scanned_at", { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        return res.json({ ok: true, message: `Coverage log already exists for ${dealer_slug}`, skipped: true });
      }

      // Insert baseline row
      const { error: insErr } = await sb.from("dealer_coverage_log").insert({
        dealer_slug,
        coverage_status:        "partial_inventory",
        source_page_type:       "sitemap",
        discovered_count:       (activeCount || 0) + (pendingCount || 0),
        pending_imports_count:  pendingCount || 0,
        pagination_detected:    false,
        pages_visited:          1,
        load_more_detected:     false,
        scroll_required:        false,
        detail_pages_visited:   0,
        valuation_review_needed: false,
        adapter_notes:          `Baseline auto-generated from existing listings. Active: ${activeCount || 0}, Pending: ${pendingCount || 0}. Full audit pending.`,
        scanned_at:             new Date().toISOString(),
      });

      if (insErr) return res.status(500).json({ error: insErr.message });
      res.json({ ok: true, dealer_slug, activeCount, pendingCount, message: `Baseline set: partial_inventory` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/inventory-reconciliation — full inventory gap audit
  app.get("/api/admin/inventory-reconciliation", requireAdmin, async (_req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

      const [
        { data: allListings },
        { data: allDealers },
        { data: allPending },
        { data: syncLogs },
        { data: coverageLogs },
        adapterRunsResult,
      ] = await Promise.all([
        sb.from("listings").select("id,sync_source,source_type,dealer_id,status,public_listing,price_confidence,state").limit(2000),
        sb.from("dealers").select("id,slug,name,state,city,website_url,adapter_key,platform_type,discovery_strategy,inventory_source_url,browser_required,last_discovery_status,last_discovery_message").limit(500),
        sb.from("pending_imports").select("dealer_slug,status").limit(2000),
        sb.from("sync_log").select("dealer_slug,status,synced_at,notes").order("synced_at", { ascending: false }).limit(500),
        sb.from("dealer_coverage_log").select("dealer_slug,coverage_status,source_page_type,pagination_detected,pages_visited,load_more_detected,discovered_count,pending_imports_count,duplicate_count,scanned_at,adapter_notes,valuation_review_needed,inventory_url").order("scanned_at", { ascending: false }).limit(500),
        sb.from("adapter_run_log").select("dealer_slug,status,coverage_status,source_page_type,discovered_count,inserted_pending_count,duplicate_count,skipped_count,started_at,notes,error_message").order("started_at", { ascending: false }).limit(500).then((r: any) => r).catch(() => ({ data: [] as any[] })),
      ]);
      const adapterRuns = (adapterRunsResult as any).data || [];

      const L = allListings || [];
      const P = allPending || [];
      const D = allDealers || [];

      // ── Listing breakdowns ──────────────────────────────────────────────────
      // All admin records (what Listings tab shows)
      const totalAdminListings      = L.length;
      const activeListings          = L.filter((l: any) => l.status === "active");
      const inactiveListings        = L.filter((l: any) => l.status === "inactive");
      const pendingReviewListings   = L.filter((l: any) => l.status === "pending_review");
      // Active public = what /api/listings returns (no state filter)
      const activePublicAll         = activeListings.filter((l: any) => l.public_listing);
      // Active public FL/GA = what Search page actually shows (state filter)
      const activePublicFlGa        = activeListings.filter((l: any) => l.public_listing && (l.state === "FL" || l.state === "GA"));
      // Active public with null state — these appear in /api/listings but NOT in search when state filtered
      const activePublicNullState   = activeListings.filter((l: any) => l.public_listing && !l.state);
      // Active private (public_listing=false)
      const activePrivate           = activeListings.filter((l: any) => !l.public_listing);
      // price_confidence breakdown
      const priceConfirmed          = activePublicAll.filter((l: any) => l.price_confidence === "confirmed");
      const priceUnavailable        = activePublicAll.filter((l: any) => l.price_confidence === "unavailable");

      // ── Listings by sync_source ─────────────────────────────────────────────
      type ListingBucket = { active: number; inactive: number; pending_review: number; unavailable: number; nullState: number };
      const listingsBySource: Record<string, ListingBucket> = {};
      for (const l of L) {
        const k = (l as any).sync_source || "__manual__";
        if (!listingsBySource[k]) listingsBySource[k] = { active: 0, inactive: 0, pending_review: 0, unavailable: 0, nullState: 0 };
        if ((l as any).status === "active" && (l as any).public_listing) {
          listingsBySource[k].active++;
          if (!(l as any).state) listingsBySource[k].nullState++;
        } else if ((l as any).status === "inactive") listingsBySource[k].inactive++;
        else if ((l as any).status === "pending_review") listingsBySource[k].pending_review++;
        if ((l as any).price_confidence === "unavailable") listingsBySource[k].unavailable++;
      }

      // ── Pending imports breakdown ───────────────────────────────────────────
      type PendingBucket = { pending: number; imported: number; rejected: number; duplicate: number };
      const pendingByDealer: Record<string, PendingBucket> = {};
      for (const p of P) {
        const k = (p as any).dealer_slug;
        if (!pendingByDealer[k]) pendingByDealer[k] = { pending: 0, imported: 0, rejected: 0, duplicate: 0 };
        if ((p as any).status === "pending") pendingByDealer[k].pending++;
        else if ((p as any).status === "imported") pendingByDealer[k].imported++;
        else if ((p as any).status === "rejected") pendingByDealer[k].rejected++;
        else if ((p as any).status === "duplicate") pendingByDealer[k].duplicate++;
      }

      // ── Lookups ─────────────────────────────────────────────────────────────
      const lastSyncByDealer: Record<string, any> = {};
      for (const s of (syncLogs || [])) {
        if (!lastSyncByDealer[(s as any).dealer_slug]) lastSyncByDealer[(s as any).dealer_slug] = s;
      }
      const lastAdapterRun: Record<string, any> = {};
      for (const r of adapterRuns) {
        if (!lastAdapterRun[r.dealer_slug]) lastAdapterRun[r.dealer_slug] = r;
      }
      const lastCoverage: Record<string, any> = {};
      for (const r of (coverageLogs || [])) {
        if (!lastCoverage[(r as any).dealer_slug]) lastCoverage[(r as any).dealer_slug] = r;
      }
      const dealerBySlug: Record<string, any> = {};
      for (const d of D) dealerBySlug[(d as any).slug] = d;

      // ── Build byDealer union ────────────────────────────────────────────────
      // Union: sync_source slugs with any activity + all FL/GA dealer profiles
      const allSlugs = new Set<string>([
        ...Object.keys(listingsBySource).filter(k => k !== "__manual__"),
        ...Object.keys(pendingByDealer),
        ...Object.keys(lastSyncByDealer),
        ...Object.keys(lastAdapterRun),
        ...D.filter((d: any) => d.state === "FL" || d.state === "GA").map((d: any) => d.slug),
      ]);

      const byDealer: any[] = [];

      for (const slug of Array.from(allSlugs).sort()) {
        const dealer = dealerBySlug[slug];
        const listings = listingsBySource[slug] || { active: 0, inactive: 0, pending_review: 0, unavailable: 0, nullState: 0 };
        const pending = pendingByDealer[slug] || { pending: 0, imported: 0, rejected: 0, duplicate: 0 };
        const lastSync = lastSyncByDealer[slug];
        const lastRun = lastAdapterRun[slug];
        const coverage = lastCoverage[slug];

        // Coverage status: prefer coverage_log, then adapter_run_log, then infer
        let coverageStatus: string = coverage?.coverage_status || lastRun?.coverage_status || "not_synced";
        if (listings.active > 0 && coverageStatus === "not_synced") coverageStatus = "needs_manual_review";

        // Action needed — specific, not vague
        let actionNeeded = "none";
        if (coverageStatus === "not_synced") actionNeeded = "run_discovery";
        else if (coverageStatus === "partial_inventory") actionNeeded = "run_discovery";
        else if (coverageStatus === "pagination_incomplete") actionNeeded = "handle_pagination";
        else if (coverageStatus === "location_filter_needed") actionNeeded = "split_location_inventory";
        else if (coverageStatus === "adapter_error" || coverageStatus === "blocked") actionNeeded = "fix_adapter";
        else if (coverageStatus === "browser_required") actionNeeded = "run_discovery";
        else if (coverageStatus === "featured_only") actionNeeded = "run_discovery";
        else if (coverageStatus === "needs_manual_review" && listings.active === 0) actionNeeded = "run_discovery";
        else if (pending.pending > 0) actionNeeded = "review_pending_imports";
        else if (coverage?.valuation_review_needed) actionNeeded = "valuation_review";
        else if (listings.inactive > 0) actionNeeded = "verify_public_listings";

        const notes: string | null = coverage?.adapter_notes || lastRun?.notes || null;

        byDealer.push({
          dealerSlug: slug,
          dealerName: dealer?.name || slug,
          state: dealer?.state || null,
          city: dealer?.city || null,
          websiteUrl: dealer?.website_url || null,
          adapterKey: dealer?.adapter_key || null,
          platformType: dealer?.platform_type || null,
          discoveryStrategy: dealer?.discovery_strategy || null,
          inventorySourceUrl: dealer?.inventory_source_url || null,
          browserRequired: dealer?.browser_required || false,
          lastDiscoveryStatus: dealer?.last_discovery_status || null,
          lastDiscoveryMessage: dealer?.last_discovery_message || null,
          inventoryUrl: coverage?.inventory_url || dealer?.inventory_source_url || null,
          publicActiveCount: listings.active,
          publicActiveNullState: listings.nullState,
          publicInactiveCount: listings.inactive,
          pendingReviewListingCount: listings.pending_review,
          unavailableCount: listings.unavailable,
          totalImportRecords: pending.pending + pending.imported + pending.rejected + pending.duplicate,
          pendingReviewCount: pending.pending,
          importedCount: pending.imported,
          rejectedPendingCount: pending.rejected,
          duplicatePendingCount: pending.duplicate,
          lastSyncAt: lastSync?.synced_at || lastRun?.started_at || null,
          lastSyncStatus: lastSync?.status || lastRun?.status || null,
          lastDiscoveredCount: lastRun?.discovered_count ?? coverage?.discovered_count ?? null,
          lastInsertedPendingCount: lastRun?.inserted_pending_count ?? coverage?.pending_imports_count ?? null,
          lastDuplicateCount: lastRun?.duplicate_count ?? coverage?.duplicate_count ?? null,
          lastSkippedCount: lastRun?.skipped_count ?? null,
          valuationReviewNeeded: coverage?.valuation_review_needed || false,
          coverageStatus,
          actionNeeded,
          notes,
        });
      }

      byDealer.sort((a: any, b: any) => b.publicActiveCount - a.publicActiveCount || a.dealerSlug.localeCompare(b.dealerSlug));

      const flGaDealers = D.filter((d: any) => d.state === "FL" || d.state === "GA");

      const totals = {
        // ── Listing counts ───────────────────────────────
        totalAdminListings,                          // What Listings tab shows
        activeListingsTotal:      activeListings.length,
        activePublicAll:          activePublicAll.length,    // /api/listings count
        activePublicFlGa:         activePublicFlGa.length,   // Search page count (state=FL|GA)
        activePublicNullState:    activePublicNullState.length, // Active+public but state=NULL (in /api/listings but not search)
        activePrivate:            activePrivate.length,
        inactiveListings:         inactiveListings.length,
        pendingReviewListings:    pendingReviewListings.length,
        // price_confidence on active+public listings
        priceConfirmed:           priceConfirmed.length,
        priceUnavailable:         priceUnavailable.length,

        // ── Pending import counts ─────────────────────────
        totalPendingImportRecords: P.length,
        pendingAwaitingReview:    P.filter((p: any) => p.status === "pending").length,
        importedFromPending:      P.filter((p: any) => p.status === "imported").length,
        rejectedFromPending:      P.filter((p: any) => p.status === "rejected").length,
        duplicateFromPending:     P.filter((p: any) => p.status === "duplicate").length,

        // ── Dealer / source counts ────────────────────────
        mappedDealerProfiles:     flGaDealers.length,         // Rows in dealers table (FL+GA)
        totalAuditSources:        byDealer.length,            // Union of dealer profiles + sync_source slugs
        sourcesWithPublicListings: byDealer.filter((d: any) => d.publicActiveCount > 0).length,
        sourcesNeverSynced:       byDealer.filter((d: any) => d.coverageStatus === "not_synced").length,
        sourcesWithAdapterErrors: byDealer.filter((d: any) => d.coverageStatus === "adapter_error" || d.coverageStatus === "blocked").length,
        sourcesPartialCoverage:   byDealer.filter((d: any) => ["partial_inventory","featured_only","pagination_incomplete","location_filter_needed","browser_required"].includes(d.coverageStatus)).length,
        sourcesWithPendingImports: byDealer.filter((d: any) => d.pendingReviewCount > 0).length,

        // ── Gap summary (why counts differ) ───────────────
        gapSummary: {
          // 134: active + public + state=FL|GA  (what Search shows)
          searchPageListings:        activePublicFlGa.length,
          // 158: active + public (all states)  (what /api/listings returns, what Listings tab shows)
          apiListingsCount:          activePublicAll.length,
          // Gap: listings in /api/listings but not in Search page (state=NULL)
          activePublicNullStateGap:  activePublicNullState.length,
          // Inactive (hidden from everything)
          inactiveHidden:            inactiveListings.length,
          // pending_review listings (in DB, public=true, but status blocks search)
          pendingReviewHidden:       pendingReviewListings.length,
          // Import records with no state — these imported but have null state
          importedNullState:         activePublicNullState.length,
          // Pending review in imports
          pendingImportAwaitingReview: P.filter((p: any) => p.status === "pending").length,
          rejectedImports:           P.filter((p: any) => p.status === "rejected").length,
          notSyncedSources:          byDealer.filter((d: any) => d.coverageStatus === "not_synced").length,
          partialSources:            byDealer.filter((d: any) => ["partial_inventory","browser_required","featured_only","pagination_incomplete"].includes(d.coverageStatus)).length,
        },
      };

      res.json({ totals, byDealer });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/run-migration — execute DDL using service-role key
  app.post("/api/admin/run-migration", requireAdmin, async (req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
      const { query } = req.body;
      if (!query || typeof query !== "string") return res.status(400).json({ error: "query required" });
      // Only allow DDL (ALTER, CREATE, CREATE INDEX, COMMENT)
      const allowed = /^\s*(ALTER|CREATE|COMMENT|DROP INDEX|DO \$\$)/i.test(query);
      if (!allowed) return res.status(403).json({ error: "Only DDL statements allowed" });
      const { error } = await sb.rpc("exec_ddl", { ddl: query }).single();
      if (error) {
        // Supabase anon key can't run DDL via RPC — use raw pg via supabase-js query builder workaround
        // Fall back to reporting the SQL for manual application
        return res.status(500).json({ error: error.message, hint: "Apply this SQL manually in Supabase SQL editor", sql: query });
      }
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/admin/dealers/:slug/source-registry — update source registry fields
  app.patch("/api/admin/dealers/:slug/source-registry", requireAdmin, async (req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
      const { slug } = req.params;
      const allowed = [
        "adapter_key", "platform_type", "discovery_strategy",
        "inventory_source_url", "canonical_domain", "domain_aliases",
        "browser_required", "sync_enabled",
        "last_discovery_status", "last_discovery_message", "last_discovery_at",
      ];
      const update: Record<string, any> = {};
      for (const k of allowed) { if (req.body[k] !== undefined) update[k] = req.body[k]; }
      if (Object.keys(update).length === 0) return res.status(400).json({ error: "No valid fields" });
      const { error } = await sb.from("dealers").update(update).eq("slug", slug);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ ok: true, slug, updated: update });
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

  // POST /api/admin/detect-source — queue a crawl4ai platform-detection job
  app.post("/api/admin/detect-source", requireAdmin, async (req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb: any = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
      const { dealer_slug } = req.body as { dealer_slug?: string };
      if (!dealer_slug) return res.status(400).json({ error: "dealer_slug is required" });

      const { data: dealer, error: dealerErr } = await sb
        .from("dealers")
        .select("slug, website_url, adapter_key")
        .eq("slug", dealer_slug)
        .maybeSingle();
      if (dealerErr) return res.status(500).json({ error: dealerErr.message });
      if (!dealer) return res.status(404).json({ error: "Dealer not found" });
      if (!dealer.website_url) return res.status(400).json({ error: "Dealer has no website_url" });
      if (dealer.adapter_key) return res.status(400).json({ error: "Dealer already has adapter_key set" });

      const { data: job, error: jobErr } = await sb
        .from("detect_source_jobs")
        .insert({ dealer_slug, status: "queued" })
        .select("id")
        .single();
      if (jobErr) return res.status(500).json({ error: jobErr.message });

      res.status(202).json({
        job_id: job.id,
        dealer_slug,
        status: "queued",
        message: "Detection job queued",
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/detect-source-jobs?dealer_slug=:slug — recent detection jobs for a dealer
  app.get("/api/admin/detect-source-jobs", requireAdmin, async (req, res) => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb: any = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
      const dealer_slug = req.query.dealer_slug as string | undefined;
      if (!dealer_slug) return res.status(400).json({ error: "dealer_slug is required" });
      const { data, error } = await sb
        .from("detect_source_jobs")
        .select("*")
        .eq("dealer_slug", dealer_slug)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return httpServer;
}
