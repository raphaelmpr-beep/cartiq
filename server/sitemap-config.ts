/**
 * Static sitemap entries — grouped by child sitemap.
 *
 * Anything referenced here MUST be a real 200-returning page whose canonical
 * tag matches the emitted URL. If a page is removed or moved, remove it here
 * or Google will pick up a redirect chain / soft-404.
 */

export interface StaticPageEntry {
  path: string;
  priority: string;
  changefreq: string;
}

export const CITY_PAGE_ENTRIES: StaticPageEntry[] = [
  { path: "/golf-carts-for-sale/the-villages-fl",      priority: "0.8", changefreq: "weekly" },
  { path: "/golf-carts-for-sale/wildwood-fl",          priority: "0.8", changefreq: "weekly" },
  { path: "/golf-carts-for-sale/lady-lake-fl",         priority: "0.8", changefreq: "weekly" },
  { path: "/golf-carts-for-sale/nocatee-fl",           priority: "0.8", changefreq: "weekly" },
  { path: "/golf-carts-for-sale/st-augustine-fl",      priority: "0.8", changefreq: "weekly" },
  { path: "/golf-carts-for-sale/jacksonville-fl",      priority: "0.8", changefreq: "weekly" },
  { path: "/golf-carts-for-sale/clearwater-fl",        priority: "0.8", changefreq: "weekly" },
  { path: "/golf-carts-for-sale/port-orange-fl",       priority: "0.7", changefreq: "weekly" },
  { path: "/golf-carts-for-sale/panama-city-beach-fl", priority: "0.7", changefreq: "weekly" },
  { path: "/golf-carts-for-sale/peachtree-city-ga",    priority: "0.8", changefreq: "weekly" },
  { path: "/golf-carts-for-sale/atlanta-ga",           priority: "0.8", changefreq: "weekly" },
];

export const STATIC_PAGE_ENTRIES: StaticPageEntry[] = [
  // Core pages
  { path: "/",              priority: "1.0", changefreq: "weekly" },
  { path: "/search",        priority: "0.9", changefreq: "daily"  },
  { path: "/deal-checker",  priority: "0.8", changefreq: "weekly" },
  { path: "/buyer-guide",   priority: "0.8", changefreq: "weekly" },
  { path: "/how-it-works",  priority: "0.7", changefreq: "monthly" },
  { path: "/disclosure",    priority: "0.3", changefreq: "yearly"  },

  // Brand hub + brand detail pages
  { path: "/brands",             priority: "0.8", changefreq: "monthly" },
  { path: "/brands/ezgo",        priority: "0.8", changefreq: "weekly"  },
  { path: "/brands/club-car",    priority: "0.8", changefreq: "weekly"  },
  { path: "/brands/yamaha",      priority: "0.7", changefreq: "weekly"  },
  { path: "/brands/icon",        priority: "0.7", changefreq: "weekly"  },
  { path: "/brands/evolution",   priority: "0.7", changefreq: "weekly"  },
  { path: "/brands/venom-ev",    priority: "0.7", changefreq: "weekly"  },
  { path: "/brands/bintelli",    priority: "0.6", changefreq: "weekly"  },
  { path: "/brands/epic",        priority: "0.6", changefreq: "weekly"  },
  { path: "/brands/denago",      priority: "0.6", changefreq: "weekly"  },

  // Battery guide pages
  { path: "/golf-cart-batteries",                      priority: "0.8", changefreq: "monthly" },
  { path: "/golf-cart-batteries/lithium-vs-lead-acid", priority: "0.8", changefreq: "monthly" },
  { path: "/golf-cart-batteries/105ah-vs-150ah",       priority: "0.7", changefreq: "monthly" },
  { path: "/golf-cart-batteries/charger-included",     priority: "0.7", changefreq: "monthly" },
];
