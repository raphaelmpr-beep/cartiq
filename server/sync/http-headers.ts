/**
 * Shared HTTP header helpers for sitemap / listing-page fetches.
 *
 * Some dealer sites (icongolfcartsusa.com, golfcartsofstaugustine.com,
 * golfcartsunlimited.com) reject the default `CartIQ-Sync/1.0` User-Agent
 * with HTTP 403. Rotating through realistic desktop-browser User-Agents
 * and sending Accept / Accept-Language / (optional) Referer headers is
 * enough to get past the naive UA-based blocks in front of them.
 *
 * This is only about scraping public sitemaps and product pages we're
 * already authorized to read — it's not evasion of authentication.
 */

const BROWSER_UAS: string[] = [
  // Chrome 122 / macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  // Chrome 122 / Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  // Firefox 124 / Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  // Safari 17 / macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  // Edge / Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
];

/** Pick a random realistic browser User-Agent. */
export function pickBrowserUA(): string {
  return BROWSER_UAS[Math.floor(Math.random() * BROWSER_UAS.length)];
}

/**
 * Build realistic browser-style request headers. Pass a `url` to derive a
 * matching Referer (site's own origin) so requests look like an on-site
 * navigation instead of a cold cross-origin hit.
 */
export function browserHeaders(url?: string, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent':       pickBrowserUA(),
    'Accept':           'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language':  'en-US,en;q=0.9',
    'Accept-Encoding':  'gzip, deflate, br',
    'Cache-Control':    'no-cache',
    'Pragma':           'no-cache',
    'Upgrade-Insecure-Requests': '1',
  };
  if (url) {
    try {
      const u = new URL(url);
      headers['Referer'] = `${u.protocol}//${u.hostname}/`;
    } catch { /* ignore bad URL */ }
  }
  return { ...headers, ...(extra || {}) };
}

/** Same shape but with XML-friendly Accept for sitemap fetches. */
export function sitemapHeaders(url?: string): Record<string, string> {
  return browserHeaders(url, {
    'Accept': 'application/xml,text/xml;q=0.9,text/html;q=0.8,*/*;q=0.5',
  });
}
