/**
 * CartIQ — Official Meta/Facebook Marketplace API Connector Placeholder
 *
 * STATUS: NOT CONFIGURED
 *
 * This connector is a placeholder for future official Meta Content Library
 * Marketplace API access. No scraping, login automation, proxies, or
 * unauthorized data collection is implemented or permitted.
 *
 * This connector will only be activated when:
 *   1. CartIQ has approved API access from Meta
 *   2. The API terms allow CartIQ's specific use case
 *   3. Data retention, display, storage, and redistribution rules are followed
 *   4. Only allowed fields are stored
 *   5. If API terms prohibit public display/commercial use, data must not be
 *      used in the public CartIQ marketplace
 */

export type MarketplaceApiConnectorStatus =
  | "not_configured"
  | "pending_access"
  | "approved"
  | "disabled"
  | "error";

export interface MarketplaceSearchParams {
  query: string;
  state?: "FL" | "GA";
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}

export interface MarketplaceApiResult {
  externalId?: string;
  sourceUrl?: string;
  title?: string;
  price?: number;
  year?: number;
  brand?: string;
  model?: string;
  city?: string;
  state?: string;
  rawAllowedFields?: Record<string, unknown>;
  fetchedAt: string;
}

export interface OfficialMarketplaceApiConnector {
  sourceName: "Meta Content Library Marketplace API";
  sourceType: "official_meta_api";
  status: MarketplaceApiConnectorStatus;
  searchMarketplaceListings(
    params: MarketplaceSearchParams
  ): Promise<MarketplaceApiResult[]>;
}

export const metaMarketplaceConnector: OfficialMarketplaceApiConnector = {
  sourceName: "Meta Content Library Marketplace API",
  sourceType: "official_meta_api",
  status: "not_configured",

  async searchMarketplaceListings(
    _params: MarketplaceSearchParams
  ): Promise<MarketplaceApiResult[]> {
    // IMPORTANT: This connector is intentionally disabled.
    // Do NOT implement scraping, browser automation, login bots, proxy-based
    // collection, CAPTCHA bypass, or fake accounts as a fallback.
    //
    // When status is not_configured, fall back to buyer-submitted manual deal checks.
    throw new Error(
      "Meta Marketplace API connector is not configured. " +
        "Please submit details manually via the CartIQ Deal Checker."
    );
  },
};

export function getMetaConnectorStatus(): {
  status: MarketplaceApiConnectorStatus;
  message: string;
} {
  return {
    status: metaMarketplaceConnector.status,
    message:
      "Official Meta/Facebook Marketplace API access is not yet configured. " +
      "Paste the Facebook listing link and manually enter the details for private CartIQ analysis.",
  };
}
