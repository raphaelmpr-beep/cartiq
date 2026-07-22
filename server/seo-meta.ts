/**
 * GolfCartIQ — Server-Side SEO Meta Injection
 *
 * This module provides per-route title, meta description, and canonical
 * for server-side injection into index.html BEFORE it reaches crawlers.
 *
 * The client-side seo.ts / seo-config.ts still runs in the browser for
 * hydration — this server layer ensures Googlebot sees correct values
 * on first response without waiting for JavaScript execution.
 *
 * IMPORTANT: Keep slugs/titles in sync with client/src/lib/seo-config.ts
 */

import { storage } from "./storage";
import type { Listing } from "@shared/schema";

const BASE_URL = "https://golfcartiq.com";
const SITE_NAME = "GolfCartIQ";
const DEFAULT_TITLE = `${SITE_NAME} | Golf Cart Prices & Deals — FL & GA`;
const DEFAULT_DESC =
  "Know what any golf cart is worth before you buy or sell. Compare live dealer prices, get a free value estimate, and see local deals across Florida and Georgia.";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

export interface RouteMeta {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogImage: string;
  jsonLd: object | null;
  /** Optional server-rendered content block injected into <body> before React hydrates.
   *  Ensures Google sees unique visible content on the first response even before JS runs. */
  bodyContent?: string;
  /** Set to true when the page should be marked noindex (sold/expired/inactive listings). */
  noindex?: boolean;
}

// ─── Static route map ─────────────────────────────────────────────────────────

const STATIC_ROUTES: Record<string, { title: string; description: string }> = {
  "/": {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
  },
  "/search": {
    title: `Search Golf Carts for Sale in Florida & Georgia | ${SITE_NAME}`,
    description:
      "Search thousands of golf cart listings from dealers in FL and GA. Filter by brand, price, battery type, seating, and location.",
  },
  "/deal-checker": {
    title: `Golf Cart Deal Checker — Is It a Good Price? | ${SITE_NAME}`,
    description:
      "Instantly check if a golf cart price is fair. Get a deal rating, market comparison, and IQ score for any cart in Florida or Georgia.",
  },
  "/buyer-guide": {
    title: `Golf Cart Buyer Guide for Florida & Georgia | ${SITE_NAME}`,
    description:
      "Everything you need to know before buying a golf cart in FL or GA. Battery types, brands, pricing, and dealer tips from GolfCartIQ.",
  },
  "/buyer-guide/how-much-does-a-golf-cart-cost-in-florida": {
    title: `How Much Does a Golf Cart Cost in Florida? (2026 Prices) | ${SITE_NAME}`,
    description:
      "Used golf carts in Florida sell for $4,000–$12,000; new models range $8,500–$18,500. See current prices by brand and condition.",
  },
  "/buyer-guide/lithium-vs-lead-acid-golf-cart-battery": {
    title: `Lithium vs Lead-Acid Golf Cart Battery: Which is Better? | ${SITE_NAME}`,
    description:
      "Compare lithium and lead-acid golf cart batteries on cost, lifespan, charge time, and value. Which is right for you in Florida or Georgia?",
  },
  "/buyer-guide/best-golf-cart-brands-florida-georgia": {
    title: `Best Golf Cart Brands in Florida & Georgia (2026) | ${SITE_NAME}`,
    description:
      "Club Car, E-Z-GO, Yamaha, ICON, Evolution — compare the top golf cart brands for FL and GA buyers in 2026.",
  },
  "/buyer-guide/new-vs-used-golf-cart": {
    title: `New vs Used Golf Cart: Which Should You Buy? | ${SITE_NAME}`,
    description:
      "Compare new and used golf carts on price, warranty, condition, and value. Expert guidance for FL and GA buyers.",
  },
  "/buyer-guide/street-legal-golf-cart-florida": {
    title: `Street Legal Golf Carts in Florida: Requirements & Best Options | ${SITE_NAME}`,
    description:
      "Florida street legal golf cart requirements, LSV laws, and the best street-legal models available in FL and GA.",
  },
  "/buyer-guide/golf-cart-dealer-vs-private-seller": {
    title: `Golf Cart Dealer vs Private Seller: Pros and Cons | ${SITE_NAME}`,
    description:
      "Should you buy from a dealer or private seller? Compare warranty, price, risk, and negotiation power in Florida and Georgia.",
  },
  "/buyer-guide/how-to-check-golf-cart-deal": {
    title: `How to Check If a Golf Cart Deal Is Good | ${SITE_NAME}`,
    description:
      "Use deal ratings, market comps, and the GolfCartIQ Deal Checker to know if a cart is priced fairly before you buy.",
  },
  "/buyer-guide/golf-cart-warranty-what-to-know": {
    title: `Golf Cart Warranty: What to Know Before You Buy | ${SITE_NAME}`,
    description:
      "Understand golf cart warranties — what's covered, for how long, and what to ask dealers in Florida and Georgia.",
  },
  "/buyer-guide/golf-cart-delivery-florida": {
    title: `Golf Cart Delivery in Florida: Cost, Distance & What to Expect | ${SITE_NAME}`,
    description:
      "How much does golf cart delivery cost in Florida? Learn what dealers charge and how delivery affects total price.",
  },
  "/buyer-guide/golf-cart-communities-florida": {
    title: `Best Golf Cart Communities in Florida | ${SITE_NAME}`,
    description:
      "The top golf cart-friendly communities in Florida — from The Villages to Nocatee. Find your next home and cart.",
  },
  "/buyer-guide/used-golf-cart-cost-florida": {
    title: `Used Golf Cart Cost in Florida: 2026 Price Guide | ${SITE_NAME}`,
    description:
      "How much does a used golf cart cost in Florida? See 2026 price ranges by brand, condition, and battery type — with real dealer data from GolfCartIQ.",
  },
  // ─── City pages ────────────────────────────────────────────────────────────
  "/golf-carts-for-sale/the-villages-fl": {
    title: `Golf Carts For Sale in The Villages, FL | ${SITE_NAME}`,
    description:
      "Browse verified golf cart listings near The Villages, FL. Compare prices, battery types, and dealer warranty coverage. Updated daily.",
  },
  "/golf-carts-for-sale/wildwood-fl": {
    title: `Golf Carts For Sale in Wildwood, FL | ${SITE_NAME}`,
    description:
      "Find golf carts for sale in Wildwood, FL. Wildwood dealers serve The Villages market — compare prices, warranties, and battery specs on GolfCartIQ.",
  },
  "/golf-carts-for-sale/lady-lake-fl": {
    title: `Golf Carts For Sale in Lady Lake, FL | ${SITE_NAME}`,
    description:
      "Browse golf cart listings in Lady Lake, FL. Dealers serving The Villages corridor — compare prices, battery types, and warranty coverage.",
  },
  "/golf-carts-for-sale/nocatee-fl": {
    title: `Golf Carts For Sale in Nocatee, FL | ${SITE_NAME}`,
    description:
      "Golf carts for sale near Nocatee, FL. Browse verified dealer listings for this master-planned community near St. Johns County.",
  },
  "/golf-carts-for-sale/st-augustine-fl": {
    title: `Golf Carts For Sale in St. Augustine, FL | ${SITE_NAME}`,
    description:
      "Find golf carts for sale in St. Augustine, FL. Compare dealer listings with verified prices, battery types, and warranty coverage. Updated daily.",
  },
  "/golf-carts-for-sale/jacksonville-fl": {
    title: `Golf Carts For Sale in Jacksonville, FL | ${SITE_NAME}`,
    description:
      "Browse golf cart listings in Jacksonville, FL. Compare prices, battery types, and dealer warranties across Northeast Florida's largest city.",
  },
  "/golf-carts-for-sale/clearwater-fl": {
    title: `Golf Carts For Sale in Clearwater, FL | ${SITE_NAME}`,
    description:
      "Golf carts for sale in Clearwater, FL. Browse verified listings with prices, battery types, and warranty info from Tampa Bay area dealers.",
  },
  "/golf-carts-for-sale/port-orange-fl": {
    title: `Golf Carts For Sale in Port Orange, FL | ${SITE_NAME}`,
    description:
      "Find golf carts for sale in Port Orange, FL. Compare dealer prices, battery types, and warranties in the Daytona Beach area on GolfCartIQ.",
  },
  "/golf-carts-for-sale/panama-city-beach-fl": {
    title: `Golf Carts For Sale in Panama City Beach, FL | ${SITE_NAME}`,
    description:
      "Browse golf cart listings in Panama City Beach, FL. Find beach-area dealers with verified prices and battery specs on GolfCartIQ.",
  },
  "/golf-carts-for-sale/peachtree-city-ga": {
    title: `Golf Carts For Sale in Peachtree City, GA | ${SITE_NAME}`,
    description:
      "Golf carts for sale in Peachtree City, GA — the golf cart capital of Georgia. Compare verified dealer listings with prices and specs.",
  },
  "/golf-carts-for-sale/atlanta-ga": {
    title: `Golf Carts For Sale in Atlanta, GA | ${SITE_NAME}`,
    description:
      "Browse golf cart listings near Atlanta, GA. Compare prices from dealers across the metro area including Woodstock, Peachtree City, and beyond.",
  },
  // ─── Brand pages ────────────────────────────────────────────────────────────
  "/brands/ezgo": {
    title: `E-Z-GO Golf Carts For Sale in FL & GA | ${SITE_NAME}`,
    description:
      "Browse E-Z-GO golf cart listings in Florida and Georgia. Compare RXV, TXT, and Express models with verified prices and dealer warranties.",
  },
  "/brands/club-car": {
    title: `Club Car Golf Carts For Sale in FL & GA | ${SITE_NAME}`,
    description:
      "Browse Club Car golf cart listings in Florida and Georgia. Compare Onward, Tempo, and Precedent models with verified prices on GolfCartIQ.",
  },
  "/brands/yamaha": {
    title: `Yamaha Golf Carts For Sale in FL & GA | ${SITE_NAME}`,
    description:
      "Browse Yamaha golf cart listings in Florida and Georgia. Compare Drive2, Adventurer, and QuieTech models with verified prices.",
  },
  "/brands/icon": {
    title: `ICON Golf Carts For Sale in FL & GA | ${SITE_NAME}`,
    description:
      "Browse ICON golf cart listings in Florida and Georgia. Compare i40, i60, and i80 models — lithium-standard, street-legal builds.",
  },
  "/brands/evolution": {
    title: `Evolution Golf Carts For Sale in FL & GA | ${SITE_NAME}`,
    description:
      "Browse Evolution golf cart listings in Florida and Georgia. Lithium-standard models, Classic, Carrier, and Forester series. Compare prices.",
  },
  "/brands/venom-ev": {
    title: `Venom EV Golf Carts For Sale in FL & GA | ${SITE_NAME}`,
    description:
      "Browse Venom EV golf cart listings in Florida. Strike, Stealth, and other models with 105Ah Eco Battery standard and 8-year warranty.",
  },
  "/brands/bintelli": {
    title: `Bintelli Golf Carts For Sale in FL & GA | ${SITE_NAME}`,
    description:
      "Browse Bintelli golf cart listings in Florida and Georgia. Beyond, Beachcomber, and other lithium models — compare prices and dealer warranties.",
  },
  "/brands/epic": {
    title: `Epic Golf Carts For Sale in FL & GA | ${SITE_NAME}`,
    description:
      "Browse Epic golf cart listings in Florida and Georgia. Compare E40, E60, and E80 models with verified prices and specs on GolfCartIQ.",
  },
  "/brands/denago": {
    title: `Denago EV Golf Carts For Sale in FL & GA | ${SITE_NAME}`,
    description:
      "Browse Denago EV golf cart listings in Florida and Georgia. Compare prices, battery specs, and dealer warranties on GolfCartIQ.",
  },
  "/brands/teko-ev": {
    title: `Teko EV Golf Carts For Sale in FL & GA | ${SITE_NAME}`,
    description:
      "Browse Teko EV golf cart listings in Florida and Georgia. LiFePO4 lithium models with lifetime chassis warranty. Compare prices.",
  },
  "/brands/sivo": {
    title: `Sivo Golf Carts For Sale in FL & GA | ${SITE_NAME}`,
    description:
      "Browse Sivo golf cart listings in Florida. Bintelli sub-brand with 8-year EcoBattery warranty. Compare prices on GolfCartIQ.",
  },
  "/brands/dach-vehicles": {
    title: `DACH Vehicles Golf Carts For Sale in FL & GA | ${SITE_NAME}`,
    description:
      "Browse DACH Vehicles golf cart listings in Florida. Orlando-assembled modern EVs distributed through Jeffrey Allen Inc. Compare prices.",
  },
  "/brands/verdi": {
    title: `Verdi Golf Carts For Sale in FL & GA | ${SITE_NAME}`,
    description:
      "Browse Verdi golf cart listings in Florida. 150Ah lithium battery standard — more range than most competitors. Compare prices on GolfCartIQ.",
  },
  // ─── Battery pages ──────────────────────────────────────────────────────────
  "/golf-cart-batteries": {
    title: `Golf Cart Battery Guide | Lithium vs Lead-Acid, Chargers & More | ${SITE_NAME}`,
    description:
      "Everything you need to know about golf cart batteries — lithium vs lead-acid, amp hours, charger compatibility, and how to evaluate battery age when buying used.",
  },
  "/golf-cart-batteries/lithium-vs-lead-acid": {
    title: `Lithium vs Lead-Acid Golf Cart Batteries: Which Is Better? | ${SITE_NAME}`,
    description:
      "Lithium vs lead-acid golf cart batteries compared: cost, lifespan, range, maintenance, and total cost of ownership. Make the right call before buying.",
  },
  "/golf-cart-batteries/105ah-vs-150ah": {
    title: `105Ah vs 150Ah Golf Cart Battery: What's the Difference? | ${SITE_NAME}`,
    description:
      "105Ah vs 150Ah lithium golf cart battery comparison. How far will each pack go? Is the range upgrade worth the extra cost?",
  },
  "/golf-cart-batteries/charger-included": {
    title: `Does a Used Golf Cart Come With a Charger? | ${SITE_NAME}`,
    description:
      "Does a golf cart come with a charger? What to look for, lithium vs lead-acid charger compatibility, and what to budget if one isn't included.",
  },
  "/golf-cart-values": {
    title: `Golf Cart Values 2026: What Every Brand Is Really Worth | ${SITE_NAME}`,
    description:
      "See real golf cart values for 2026 by brand, age, and condition. Compare depreciation curves for Club Car, E-Z-GO, Yamaha, Evolution, ICON and more — with live dealer pricing.",
  },
  "/used-golf-cart-value": {
    title: `Used Golf Cart Value Guide: How to Price a Used Cart in 2026 | ${SITE_NAME}`,
    description:
      "How to figure out what a used golf cart is worth: brand-by-brand depreciation, battery age adjustments, condition grading, and a fair-price checklist for buyers and sellers.",
  },
  "/golf-cart-value-estimator": {
    title: `Golf Cart Value Estimator — What's My Golf Cart Worth? (Free) | ${SITE_NAME}`,
    description:
      "How much is your golf cart worth? Free instant value estimator for Club Car, E-Z-GO, Yamaha, ICON, Evolution and more. See private-sale and dealer trade-in ranges in 30 seconds — no email required.",
  },
  // ─── Other pages ─────────────────────────────────────────────────────────────
  "/how-it-works": {
    title: `How GolfCartIQ Works | Golf Cart Price Intelligence`,
    description:
      "Learn how GolfCartIQ collects prices, rates deals, and helps buyers find the best golf cart value in Florida and Georgia.",
  },
  "/sell-my-cart": {
    title: `Sell My Golf Cart | List Your Cart on ${SITE_NAME}`,
    description:
      "List your golf cart for sale on GolfCartIQ. Reach buyers across Florida and Georgia.",
  },
  "/disclosure": {
    title: `Disclosure & Affiliate Policy | ${SITE_NAME}`,
    description:
      "GolfCartIQ pricing and affiliate disclosure. Understand how we earn and how it affects our recommendations.",
  },
};

// ─── Schema.org JSON-LD builders ──────────────────────────────────────────────

function websiteSchema(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: BASE_URL,
    description:
      "GolfCartIQ is Florida & Georgia's golf cart market intelligence platform. Compare dealer prices, check fair value, and find the best deals on new and used golf carts.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

function articleSchema(title: string, description: string, canonical: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: canonical,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/favicon.png`,
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
  };
}

function itemListSchema(title: string, description: string, canonical: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url: canonical,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function getRouteMeta(pathname: string): RouteMeta {
  // Normalize: strip trailing slash (except root), lowercase
  const normalized =
    pathname === "/" ? "/" : pathname.replace(/\/$/, "").toLowerCase();

  // 1. Exact static match
  const staticMatch = STATIC_ROUTES[normalized];
  if (staticMatch) {
    const canonical = `${BASE_URL}${normalized}`;
    const jsonLd = buildJsonLd(normalized, staticMatch.title, staticMatch.description, canonical);
    return buildMeta(staticMatch.title, staticMatch.description, canonical, jsonLd);
  }

  // 2. Dynamic: /listing/:slug
  if (normalized.startsWith("/listing/")) {
    const slug = normalized.replace("/listing/", "");
    const canonical = `${BASE_URL}/listing/${slug}`;
    const title = `Golf Cart Listing | ${SITE_NAME}`;
    const description =
      "View golf cart details, deal rating, price history, and dealer information on GolfCartIQ.";
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "ItemPage",
      name: title,
      description,
      url: canonical,
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: BASE_URL },
    };
    return buildMeta(title, description, canonical, jsonLd);
  }

  // 3. Dynamic: /golf-carts-for-sale/:city (not in static map)
  if (normalized.startsWith("/golf-carts-for-sale/")) {
    const citySlug = normalized.replace("/golf-carts-for-sale/", "");
    const cityLabel = citySlug
      .replace(/-fl$/, ", FL")
      .replace(/-ga$/, ", GA")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const canonical = `${BASE_URL}/golf-carts-for-sale/${citySlug}`;
    const title = `Golf Carts For Sale in ${cityLabel} | ${SITE_NAME}`;
    const description = `Browse golf cart listings near ${cityLabel} from local dealers. Compare prices and deal ratings on GolfCartIQ.`;
    const jsonLd = itemListSchema(title, description, canonical);
    return buildMeta(title, description, canonical, jsonLd);
  }

  // 4. Dynamic: /buyer-guide/:slug (not in static map — fallback for future articles)
  if (normalized.startsWith("/buyer-guide/")) {
    const articleSlug = normalized.replace("/buyer-guide/", "");
    const articleLabel = articleSlug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const canonical = `${BASE_URL}/buyer-guide/${articleSlug}`;
    const title = `${articleLabel} | ${SITE_NAME}`;
    const description = `Expert golf cart buying advice on ${articleLabel.toLowerCase()}. GolfCartIQ guides Florida and Georgia buyers with real dealer data and market intelligence.`;
    const jsonLd = articleSchema(title, description, canonical);
    return buildMeta(title, description, canonical, jsonLd);
  }

  // 5. Dynamic: /brands/:slug (not in static map)
  if (normalized.startsWith("/brands/")) {
    const brandSlug = normalized.replace("/brands/", "");
    const brandLabel = brandSlug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const canonical = `${BASE_URL}/brands/${brandSlug}`;
    const title = `${brandLabel} Golf Carts For Sale in FL & GA | ${SITE_NAME}`;
    const description = `Browse ${brandLabel} golf cart listings in Florida and Georgia. Compare prices, models, and deal ratings on GolfCartIQ.`;
    const jsonLd = itemListSchema(title, description, canonical);
    return buildMeta(title, description, canonical, jsonLd);
  }

  // 6. Fallback — homepage defaults (no per-page canonical signal for unknown routes)
  return buildMeta(DEFAULT_TITLE, DEFAULT_DESC, `${BASE_URL}/`, websiteSchema());
}

// ─── Async listing meta ───────────────────────────────────────────────────────

/** Product JSON-LD for a single listing. */
function productSchema(l: Listing, canonical: string, imageUrl: string | null): object {
  const name = String(l.title ?? "").trim() || `Golf Cart Listing #${l.id}`;
  const brand = l.brand ? { "@type": "Brand", name: String(l.brand) } : undefined;
  const offers =
    l.asking_price != null && Number(l.asking_price) > 0
      ? {
          "@type": "Offer",
          price: Number(l.asking_price).toFixed(2),
          priceCurrency: "USD",
          availability:
            l.status === "active" && l.public_listing === true
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          url: canonical,
        }
      : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(brand ? { brand } : {}),
    ...(l.model ? { model: String(l.model) } : {}),
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(offers ? { offers } : {}),
    url: canonical,
  };
}

/** HTML-escape (mirror of static.ts esc — kept local to avoid a circular import). */
function escHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Build a human-readable descriptor line for a listing.
 *  Used both in <title>/description and the body-content block. */
function listingDescriptor(l: Listing): {
  headline: string;
  descriptionSentence: string;
  locationLine: string;
  attrLine: string;
  priceLine: string;
} {
  const cityState = [l.city, l.state].filter(Boolean).join(", ").trim();
  const yearBrandModel = [l.year, l.brand, l.model].filter(Boolean).join(" ").trim();
  const dealer = (l as any).dealer_name ?? (l as any).seller_name ?? "";
  const priceNum = l.asking_price != null ? Number(l.asking_price) : NaN;
  const priceStr =
    Number.isFinite(priceNum) && priceNum > 0
      ? `$${Math.round(priceNum).toLocaleString("en-US")}`
      : "";

  const headlineCore = yearBrandModel || String(l.title ?? "").trim() || "Golf Cart";
  const headline = cityState
    ? `${headlineCore} for sale in ${cityState}`
    : `${headlineCore} for sale`;

  const parts: string[] = [];
  if (priceStr) parts.push(`Listed at ${priceStr}`);
  if (dealer) parts.push(`from ${dealer}`);
  if (cityState) parts.push(`in ${cityState}`);
  if (l.battery_type) parts.push(`${String(l.battery_type)} battery`);
  if (l.seating) parts.push(`${l.seating}-seat`);
  if (l.condition) parts.push(String(l.condition));

  const descriptionSentence = parts.length
    ? `${headline}. ${parts.join(", ")}.`
    : `${headline}. Compare price, deal rating, and dealer details on ${SITE_NAME}.`;

  const attrLine = [l.year, l.brand, l.model].filter(Boolean).join(" · ");

  return {
    headline,
    descriptionSentence,
    locationLine: cityState,
    attrLine,
    priceLine: priceStr,
  };
}

/** Build per-listing RouteMeta including body content for the initial DOM. */
function buildListingMeta(l: Listing): RouteMeta {
  const slug = l.slug ?? String(l.id);
  const canonical = `${BASE_URL}/listing/${slug}`;
  const d = listingDescriptor(l);
  const title = `${d.headline} | ${SITE_NAME}`;
  const description = d.descriptionSentence;
  const imageUrl =
    l.image_url && String(l.image_url).trim().length > 0 ? String(l.image_url) : DEFAULT_IMAGE;
  const jsonLd = productSchema(l, canonical, imageUrl);

  // Non-active listings should be noindex, but the page can stay live for link equity.
  const isIndexable = l.status === "active" && l.public_listing === true;

  // Server-rendered content block. Hidden from user (React re-renders on hydrate)
  // but visible to Googlebot in the initial HTML. Includes title, geo, dealer,
  // price if any, year/brand/model, and an SEO paragraph.
  const dealer = (l as any).dealer_name ?? (l as any).seller_name ?? "";
  const bodyContent =
    `<div id="__seo_ssr__" data-seo="listing" hidden>` +
    `<h1>${escHtml(d.headline)}</h1>` +
    (d.attrLine ? `<p>${escHtml(d.attrLine)}</p>` : "") +
    (d.locationLine ? `<p>Location: ${escHtml(d.locationLine)}</p>` : "") +
    (dealer ? `<p>Dealer: ${escHtml(dealer)}</p>` : "") +
    (d.priceLine ? `<p>Price: ${escHtml(d.priceLine)}</p>` : "") +
    `<p>${escHtml(d.descriptionSentence)}</p>` +
    `</div>`;

  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogUrl: canonical,
    ogImage: imageUrl,
    jsonLd,
    bodyContent,
    noindex: !isIndexable,
  };
}

/**
 * Async variant of getRouteMeta.
 * For /listing/:slug, fetches the listing from storage and produces rich per-
 * listing meta + a body-content block. All other routes delegate to the
 * synchronous getRouteMeta so existing behavior is unchanged.
 */
export async function getRouteMetaAsync(pathname: string): Promise<RouteMeta> {
  const normalized =
    pathname === "/" ? "/" : pathname.replace(/\/$/, "").toLowerCase();

  if (normalized.startsWith("/listing/")) {
    const idOrSlug = normalized.replace("/listing/", "").split("?")[0];
    if (idOrSlug) {
      try {
        const isNumeric = /^\d+$/.test(idOrSlug);
        const listing = isNumeric
          ? await storage.getListingById(Number(idOrSlug))
          : await storage.getListingBySlug(idOrSlug);
        if (listing) return buildListingMeta(listing as Listing);
      } catch {
        // fall through to generic listing meta below
      }
    }
  }

  return getRouteMeta(pathname);
}

function buildJsonLd(
  path: string,
  title: string,
  description: string,
  canonical: string
): object | null {
  if (path === "/") return websiteSchema();
  if (path.startsWith("/buyer-guide/") || path.startsWith("/golf-cart-batteries/")) {
    return articleSchema(title, description, canonical);
  }
  if (path.startsWith("/golf-carts-for-sale/") || path.startsWith("/brands/")) {
    return itemListSchema(title, description, canonical);
  }
  return null;
}

function buildMeta(
  title: string,
  description: string,
  canonical: string,
  jsonLd: object | null
): RouteMeta {
  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogUrl: canonical,
    ogImage: DEFAULT_IMAGE,
    jsonLd,
  };
}
