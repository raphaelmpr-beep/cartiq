/**
 * CartIQ — Retail Product Source Connector Placeholder (Costco + others)
 *
 * STATUS: NOT CONFIGURED
 *
 * This connector is a placeholder for future approved Costco/retail product
 * data access. No scraping, login automation, proxies, or unauthorized data
 * collection is implemented or permitted.
 *
 * This connector will only be activated when:
 *   1. CartIQ has approved API/feed access from the retailer
 *   2. The retailer gives explicit permission
 *   3. The data source is legally licensed or authorized
 *   4. Implementation has been reviewed for terms compliance
 *
 * For MVP, Costco/retail listings are handled through:
 *   - manual_admin_listing
 *   - csv_import
 *   - buyer-submitted retail deal checks
 */

export type RetailConnectorStatus =
  | "not_configured"
  | "pending_access"
  | "approved"
  | "disabled"
  | "error";

export interface RetailProductSearchParams {
  query: string;
  retailerName?: string;
  state?: "FL" | "GA";
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}

export interface RetailProductResult {
  externalId?: string;
  retailerName: string;
  sourceUrl?: string;
  title?: string;
  price?: number;
  regularPrice?: number;
  salePrice?: number;
  year?: number;
  brand?: string;
  model?: string;
  batteryType?: string;
  batteryAh?: number;
  seating?: number;
  warrantyIncluded?: "yes" | "no" | "unknown";
  warrantyProvider?: string;
  warrantyMonths?: number;
  availabilityStatus?: string;
  shipToStates?: string[];
  deliveryCost?: number;
  rawAllowedFields?: Record<string, unknown>;
  fetchedAt: string;
}

export interface RetailProductSourceConnector {
  sourceName: string;
  sourceType: "approved_retail_api" | "retail_csv" | "retail_manual";
  retailerName: "Costco" | string;
  status: RetailConnectorStatus;
  searchRetailGolfCartProducts(
    params: RetailProductSearchParams
  ): Promise<RetailProductResult[]>;
}

export const costcoRetailConnector: RetailProductSourceConnector = {
  sourceName: "Costco Golf Cart Products",
  sourceType: "retail_manual",
  retailerName: "Costco",
  status: "not_configured",

  async searchRetailGolfCartProducts(
    _params: RetailProductSearchParams
  ): Promise<RetailProductResult[]> {
    // IMPORTANT: This connector is intentionally disabled.
    // Do NOT implement scraping, browser automation, login bots, or proxy-based
    // collection as a fallback. Do not copy Costco descriptions or images unless
    // explicitly allowed by an authorized data agreement.
    //
    // For MVP, Costco listings are added via:
    //   - Admin manual entry
    //   - CSV import
    //   - Buyer-submitted retail deal check
    throw new Error(
      "Costco retail connector is not configured. " +
        "Please add Costco listings manually via the Admin portal or CSV import."
    );
  },
};

export function getRetailConnectorStatus(retailerName = "Costco"): {
  status: RetailConnectorStatus;
  message: string;
  allowedMethods: string[];
} {
  return {
    status: "not_configured",
    message: `${retailerName} product connector is not configured. Retail listings must be added manually or via CSV import.`,
    allowedMethods: ["manual_admin_entry", "csv_import", "buyer_submitted_deal_check"],
  };
}
