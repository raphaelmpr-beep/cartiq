import { parse } from "csv-parse/sync";

const VALID_STATES_PUBLIC = ["FL", "GA"];
const IMAGE_URL_PATTERN = /\.(jpg|jpeg|png|webp|gif|svg|avif)(\?|$)/i;
const VALID_BATTERY_TYPES = ["lithium", "lead_acid", "gas", "unknown"];
const VALID_SOURCE_TYPES = [
  "dealer_direct", "private_direct", "admin_manual", "buyer_submitted",
  "dealer_csv", "retail_manual", "retail_csv", "official_meta_api",
];

export interface CsvRow {
  title?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  year?: string;
  brand?: string;
  model?: string;
  condition?: string;
  seller_type?: string;
  source_type?: string;
  dealer_name?: string;
  retailer_name?: string;
  retailer_sku?: string;
  retailer_product_url?: string;
  availability_status?: string;
  ship_to_states?: string;
  city?: string;
  state?: string;
  zip?: string;
  battery_type?: string;
  battery_ah?: string;
  battery_age_months?: string;
  seating?: string;
  street_legal_claimed?: string;
  lifted?: string;
  charger_included?: string;
  warranty_included?: string;
  warranty_provider?: string;
  warranty_months?: string;
  battery_warranty_included?: string;
  warranty_notes?: string;
  delivery_available?: string;
  delivery_cost?: string;
  image_url?: string;
  source_url?: string;
  description?: string;
  last_verified_at?: string;
}

export interface CsvValidationResult {
  valid: CsvRow[];
  errors: { row: number; field: string; message: string }[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 80);
}

export function parseCsv(csvText: string): CsvValidationResult {
  let records: CsvRow[];
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (e: any) {
    return { valid: [], errors: [{ row: 0, field: "file", message: `CSV parse error: ${e.message}` }] };
  }

  const valid: CsvRow[] = [];
  const errors: { row: number; field: string; message: string }[] = [];

  records.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed + header row
    const rowErrors: { row: number; field: string; message: string }[] = [];

    // State validation (FL/GA for public listings unless retail)
    const isRetail = row.source_type?.includes("retail");
    if (row.state && !VALID_STATES_PUBLIC.includes(row.state.toUpperCase()) && !isRetail) {
      rowErrors.push({
        row: rowNum,
        field: "state",
        message: `State "${row.state}" is outside the FL/GA pilot area. Mark as retail/national reference or correct the state.`,
      });
    }

    // Price validation — require at least one price field
    if (!row.price && !row.sale_price && !row.regular_price) {
      rowErrors.push({ row: rowNum, field: "price", message: "At least one of price, sale_price, or regular_price is required." });
    }
    if (row.price && isNaN(parseFloat(row.price))) {
      rowErrors.push({ row: rowNum, field: "price", message: "Price must be a number." });
    }
    if (row.sale_price && isNaN(parseFloat(row.sale_price))) {
      rowErrors.push({ row: rowNum, field: "sale_price", message: "Sale price must be a number." });
    }

    // Battery type validation
    if (row.battery_type && !VALID_BATTERY_TYPES.includes(row.battery_type.toLowerCase())) {
      rowErrors.push({
        row: rowNum,
        field: "battery_type",
        message: `Battery type "${row.battery_type}" is invalid. Must be: ${VALID_BATTERY_TYPES.join(", ")}.`,
      });
    }

    // Seating validation
    if (row.seating && isNaN(parseInt(row.seating))) {
      rowErrors.push({ row: rowNum, field: "seating", message: "Seating must be a number." });
    }

    // Warranty months validation
    if (row.warranty_months && isNaN(parseInt(row.warranty_months))) {
      rowErrors.push({ row: rowNum, field: "warranty_months", message: "Warranty months must be a number." });
    }

    // Delivery cost validation
    if (row.delivery_cost && isNaN(parseFloat(row.delivery_cost))) {
      rowErrors.push({ row: rowNum, field: "delivery_cost", message: "Delivery cost must be a number." });
    }

    // Source URL must not be a raw image file
    if (row.source_url && IMAGE_URL_PATTERN.test(row.source_url)) {
      rowErrors.push({
        row: rowNum,
        field: "source_url",
        message: `source_url appears to be an image file URL, not a product page. Provide the dealer product page URL instead.`,
      });
    }

    // Source type validation
    if (row.source_type && !VALID_SOURCE_TYPES.includes(row.source_type)) {
      rowErrors.push({
        row: rowNum,
        field: "source_type",
        message: `Source type "${row.source_type}" is invalid. Must be one of: ${VALID_SOURCE_TYPES.join(", ")}.`,
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      valid.push(row);
    }
  });

  return { valid, errors };
}

// ── Public listing quality gate ─────────────────────────────────────────────
// A listing may only be public if it has at least one contact path:
// a dealer_name/seller_name, a source URL that is a real product page
// (not a raw image file), or an explicit dealer identifier.
// This prevents incomplete imports from surfacing to end users.
export function canBePublic(opts: {
  dealerName?: string | null;
  sellerName?: string | null;
  sourceUrl?: string | null;
  dealerId?: number | null;
}): boolean {
  if (opts.dealerId) return true;
  if (opts.dealerName?.trim()) return true;
  if (opts.sellerName?.trim()) return true;
  // Source URL must exist and must NOT be a raw image file
  if (opts.sourceUrl?.trim() && !IMAGE_URL_PATTERN.test(opts.sourceUrl)) return true;
  return false;
}

export function csvRowToListing(row: CsvRow, idx: number): Record<string, unknown> {
  const baseSlug = slugify(`${row.brand || "cart"}-${row.model || "listing"}-${row.city || "fl"}-${idx}`);
  const isPublic = canBePublic({
    dealerName: row.dealer_name,
    sellerName: null, // CSV doesn't have a raw seller_name field
    sourceUrl: row.source_url,
  });
  return {
    title: row.title || `${row.year || ""} ${row.brand || ""} ${row.model || ""}`.trim() || "Golf Cart",
    slug: `${baseSlug}-${Date.now()}-${idx}`,
    description: row.description || null,
    sourceType: row.source_type || "dealer_csv",
    sourceUrl: row.source_url || null,
    publicListing: isPublic,
    sellerType: row.seller_type || "private",
    status: "active",
    retailerName: row.retailer_name || null,
    retailerSku: row.retailer_sku || null,
    retailerProductUrl: row.retailer_product_url || null,
    availabilityStatus: row.availability_status || null,
    shipToStates: row.ship_to_states || null,
    lastVerifiedAt: row.last_verified_at || null,
    askingPrice: row.price ? parseFloat(row.price) : null,
    regularPrice: row.regular_price ? parseFloat(row.regular_price) : null,
    salePrice: row.sale_price ? parseFloat(row.sale_price) : null,
    year: row.year ? parseInt(row.year) : null,
    brand: row.brand || null,
    model: row.model || null,
    condition: row.condition || null,
    batteryType: row.battery_type?.toLowerCase() || "unknown",
    batteryAh: row.battery_ah ? parseInt(row.battery_ah) : null,
    batteryAgeMonths: row.battery_age_months ? parseInt(row.battery_age_months) : null,
    seating: row.seating ? parseInt(row.seating) : null,
    lifted: row.lifted === "yes" || row.lifted === "true",
    streetLegalClaimed: row.street_legal_claimed === "yes" || row.street_legal_claimed === "true",
    chargerIncluded: row.charger_included || "unknown",
    warrantyIncluded: row.warranty_included || "unknown",
    warrantyProvider: row.warranty_provider || "unknown",
    warrantyMonths: row.warranty_months ? parseInt(row.warranty_months) : null,
    batteryWarrantyIncluded: row.battery_warranty_included || "unknown",
    warrantyNotes: row.warranty_notes || null,
    city: row.city || null,
    state: row.state?.toUpperCase() || null,
    zip: row.zip || null,
    deliveryAvailable: row.delivery_available === "yes" || row.delivery_available === "true",
    estimatedDeliveryCost: row.delivery_cost ? parseFloat(row.delivery_cost) : null,
    imageUrl: row.image_url || null,
  };
}
