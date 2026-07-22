/**
 * CartIQ — Stealth Sitemap Fetcher
 *
 * Handles SiteGround JS Challenge (sgcaptcha) by:
 *  1. Loading the page — SG serves a JS challenge (~202)
 *  2. Waiting for the JS to auto-solve and redirect (~4s)
 *  3. Using an in-page fetch() with the session cookie to get the actual XML
 *
 * Tested against: golfcartsjacksonville.com (SiteGround SG Captcha)
 *
 * Only used by cron/worker environment where playwright-extra is available.
 */

let stealthBrowserSetup: any = null;

async function getStealthChromium() {
  if (stealthBrowserSetup) return stealthBrowserSetup;
  try {
    const { chromium } = await import('playwright-extra');
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
    chromium.use(StealthPlugin());
    stealthBrowserSetup = chromium;
    return chromium;
  } catch {
    // Fallback to plain playwright if playwright-extra not available
    const { chromium } = await import('playwright');
    return chromium;
  }
}

export interface StealthFetchResult {
  success: boolean;
  urls: string[];
  error?: string;
}

/**
 * Fetch a sitemap XML via stealth browser, bypassing SG JS challenge.
 * Returns all <loc> URLs matching the given pattern.
 */
export async function stealthFetchSitemapUrls(
  sitemapUrl: string,
  urlPattern: RegExp,
  timeoutMs = 25000
): Promise<StealthFetchResult> {
  const chromium = await getStealthChromium();

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  try {
    // Step 1: Warm up on the homepage to let SG set the session cookie
    const origin = new URL(sitemapUrl).origin;
    await page.goto(origin, { waitUntil: 'networkidle', timeout: timeoutMs });
    await page.waitForTimeout(3000);

    // Step 2: In-page fetch — cookie is now set, SG won't challenge same-origin requests
    const xmlContent: string = await page.evaluate(async (url: string) => {
      try {
        const resp = await fetch(url, { credentials: 'same-origin' });
        return await resp.text();
      } catch (e: any) {
        return '';
      }
    }, sitemapUrl);

    if (!xmlContent || xmlContent.length < 50) {
      return { success: false, urls: [], error: 'Empty response from in-page fetch' };
    }

    // Extract <loc> URLs matching the pattern
    const matches = [...xmlContent.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(m => m[1].trim())
      .filter(url => urlPattern.test(url));

    const urls = [...new Set(matches)];
    return { success: true, urls };
  } catch (e: any) {
    return { success: false, urls: [], error: String(e?.message || e) };
  } finally {
    await browser.close();
  }
}
