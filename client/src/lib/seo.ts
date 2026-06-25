/**
 * GolfCartWise SEO utilities
 * Manages <title>, <meta>, Open Graph, Twitter Card, and JSON-LD
 * for Google, Bing, and AI crawler compliance.
 */

const SITE_NAME = "GolfCartWise";
const BASE_URL  = "https://golfcartwise.app";
const DEFAULT_DESCRIPTION =
  "GolfCartWise is Florida & Georgia's golf cart market intelligence platform. Compare dealer prices, check fair value, and find the best deals on new and used golf carts.";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

interface SEOOptions {
  title?: string;
  description?: string;
  image?: string;
  canonical?: string;
  noindex?: boolean;
  jsonLd?: object | object[];
}

/** Set all SEO meta tags for the current page. Call on every route change. */
export function setSEO(opts: SEOOptions = {}): void {
  const title = opts.title
    ? `${opts.title} | ${SITE_NAME}`
    : `${SITE_NAME} — Florida & Georgia Golf Cart Price Intelligence`;
  const description = opts.description ?? DEFAULT_DESCRIPTION;
  const image       = opts.image ?? DEFAULT_IMAGE;
  const canonical   = opts.canonical ?? (BASE_URL + window.location.pathname);

  // ── <title> ─────────────────────────────────────────────────────────────
  document.title = title;

  // ── Helper ──────────────────────────────────────────────────────────────
  function setMeta(selector: string, attr: string, value: string) {
    let el = document.querySelector<HTMLMetaElement>(selector);
    if (!el) {
      el = document.createElement("meta");
      const [attrName, attrValue] = selector
        .replace(/[\[\]"]/g, "")
        .split("=");
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  }

  function setLink(rel: string, href: string) {
    let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement("link");
      el.rel = rel;
      document.head.appendChild(el);
    }
    el.href = href;
  }

  // ── Standard meta ───────────────────────────────────────────────────────
  setMeta('meta[name="description"]',                  "content", description);
  setMeta('meta[name="robots"]',                       "content", opts.noindex ? "noindex,nofollow" : "index,follow");
  setMeta('meta[name="author"]',                       "content", "GolfCartWise");

  // ── Canonical ────────────────────────────────────────────────────────────
  setLink("canonical", canonical);

  // ── Sitemap discovery (helps Googlebot find the sitemap from any page) ────
  let sitemapEl = document.querySelector<HTMLLinkElement>('link[rel="sitemap"]');
  if (!sitemapEl) {
    sitemapEl = document.createElement("link");
    sitemapEl.rel = "sitemap";
    sitemapEl.setAttribute("type", "application/xml");
    document.head.appendChild(sitemapEl);
  }
  sitemapEl.href = `${BASE_URL}/sitemap.xml`;

  // ── Open Graph ───────────────────────────────────────────────────────────
  setMeta('meta[property="og:type"]',        "content", "website");
  setMeta('meta[property="og:site_name"]',   "content", SITE_NAME);
  setMeta('meta[property="og:title"]',       "content", title);
  setMeta('meta[property="og:description"]', "content", description);
  setMeta('meta[property="og:image"]',       "content", image);
  setMeta('meta[property="og:image:width"]', "content", "1200");
  setMeta('meta[property="og:image:height"]',"content", "630");
  setMeta('meta[property="og:image:alt"]',   "content", opts.title ?? SITE_NAME);
  setMeta('meta[property="og:url"]',         "content", canonical);
  setMeta('meta[property="og:locale"]',      "content", "en_US");

  // ── Twitter / X Card ─────────────────────────────────────────────────────
  setMeta('meta[name="twitter:card"]',        "content", "summary_large_image");
  setMeta('meta[name="twitter:site"]',        "content", "@GolfCartWise");
  setMeta('meta[name="twitter:title"]',       "content", title);
  setMeta('meta[name="twitter:description"]', "content", description);
  setMeta('meta[name="twitter:image"]',       "content", image);

  // ── JSON-LD structured data ───────────────────────────────────────────────
  // Remove any previously injected JSON-LD scripts
  document.querySelectorAll('script[data-cartiq-jsonld]').forEach(el => el.remove());

  const schemas: object[] = [];

  // Always include WebSite + SearchAction
  schemas.push({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": SITE_NAME,
    "url": BASE_URL,
    "description": DEFAULT_DESCRIPTION,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${BASE_URL}/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  });

  // Always include Organization
  schemas.push({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE_NAME,
    "url": BASE_URL,
    "logo": `${BASE_URL}/favicon.png`,
    "description": DEFAULT_DESCRIPTION,
    "areaServed": ["Florida", "Georgia"],
    "serviceType": "Golf Cart Price Intelligence"
  });

  // Page-specific schemas
  if (opts.jsonLd) {
    const extras = Array.isArray(opts.jsonLd) ? opts.jsonLd : [opts.jsonLd];
    schemas.push(...extras);
  }

  // Inject all schemas as a single @graph block
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.setAttribute("data-cartiq-jsonld", "true");
  script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": schemas });
  document.head.appendChild(script);
}

/** Build a Product schema for a single listing */
export function listingToProductSchema(listing: {
  id: number;
  title: string;
  brand?: string;
  model?: string;
  year?: number;
  condition?: string;
  askingPrice?: number;
  cartiqEstimatedValue?: number;
  dealRating?: string;
  imageUrl?: string;
  city?: string;
  state?: string;
  sellerName?: string;
  slug?: string;
}): object {
  const url = `${BASE_URL}/listing/${listing.slug ?? listing.id}`;
  const priceCurrency = "USD";
  const availability = "https://schema.org/InStock";
  const itemCondition = listing.condition === "used"
    ? "https://schema.org/UsedCondition"
    : "https://schema.org/NewCondition";

  return {
    "@type": "Product",
    "@id": url,
    "name": listing.title,
    "brand": listing.brand ? { "@type": "Brand", "name": listing.brand } : undefined,
    "model": listing.model,
    "productionDate": listing.year?.toString(),
    "itemCondition": itemCondition,
    "image": listing.imageUrl ?? `${BASE_URL}/favicon.png`,
    "url": url,
    "description": `${listing.year ?? ""} ${listing.brand ?? ""} ${listing.model ?? ""} for sale in ${listing.city ?? ""}, ${listing.state ?? ""}.`,
    "offers": {
      "@type": "Offer",
      "price": listing.askingPrice,
      "priceCurrency": priceCurrency,
      "availability": availability,
      "itemCondition": itemCondition,
      "seller": listing.sellerName
        ? { "@type": "AutoDealer", "name": listing.sellerName }
        : undefined,
      "url": url,
      "priceValidUntil": new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    },
  };
}

/** BreadcrumbList schema helper */
export function breadcrumbSchema(crumbs: { name: string; url: string }[]): object {
  return {
    "@type": "BreadcrumbList",
    "itemListElement": crumbs.map((c, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": c.name,
      "item": c.url,
    })),
  };
}
