// CartIQ Pricing Engine — Comp-Based IMV
// =============================================================================
// Inspired by CarGurus' Instant Market Value (IMV) approach:
//   1. Use REAL comps from the DB as the primary price anchor
//   2. Fall back to brand-tier × depreciation × feature formula only when no comps exist
//   3. Deal ratings are anchored to market comps, not asking price
// =============================================================================

export interface PricingInput {
  askingPrice?: number | null;
  regularPrice?: number | null;
  salePrice?: number | null;
  deliveryCost?: number | null;
  deliveryIncluded?: boolean | null;
  deliveryAvailable?: string | boolean | null;
  year?: number | null;
  brand?: string | null;
  model?: string | null;
  powerType?: string | null;
  batteryType?: string | null;
  batteryAh?: number | null;
  batteryAgeMonths?: number | null;
  seating?: number | null;
  lifted?: boolean | string | null;
  streetLegalClaimed?: boolean | string | null;
  chargerIncluded?: string | boolean | null;
  warrantyIncluded?: string | boolean | null;
  warrantyProvider?: string | null;
  warrantyMonths?: number | null;
  batteryWarrantyIncluded?: string | boolean | null;
  sellerType?: string | null;
  state?: string | null;
  city?: string | null;
  lastVerifiedAt?: string | null;
  condition?: string | null;
}

export interface CompListing {
  asking_price: number;
  year?: number | null;
  power_type?: string | null;
  battery_type?: string | null;
  seating?: number | null;
  lifted?: boolean | null;
  warranty_included?: string | boolean | null;
  charger_included?: string | boolean | null;
  delivery_available?: boolean | null;
}

export interface IMVResult {
  imv: number;
  priceConfidence: "high" | "medium" | "low";
  compCount: number;
  compTier: 1 | 2 | 3 | 4;
}

export interface PriceToImprove {
  toFairPrice: number | null;
  toGoodDeal: number | null;
  toGreatDeal: number | null;
}

export interface PricingResult {
  cartiqMarketValue: number;
  /** @deprecated use cartiqMarketValue */
  cartiqEstimatedValue: number;
  effectivePrice: number;
  estimatedDeliveryCost: number;
  totalDeliveredCost: number;
  dealDelta: number;
  dealDeltaPercent: number;
  dealRating: string;
  buyerScore: number;
  priceConfidence: string;
  batteryRisk: string;
  chargerWarning: string | null;
  warrantySignal: string | null;
  streetLegalConfidence: string;
  redFlags: string[];
  questionsToAsk: string[];
  negotiationLow: number;
  negotiationHigh: number;
  priceToImprove: PriceToImprove;
}

// =============================================================================
// Brand Tier Bases (FL/GA dealer new cart market, 2026 baseline)
// =============================================================================
const BRAND_TIERS: Record<string, { base: number; tier: string }> = {
  // Premium — high resale, strong dealer network
  "club car":   { base: 13500, tier: "premium" },
  "e-z-go":     { base: 13000, tier: "premium" },
  "ezgo":       { base: 13000, tier: "premium" },
  "yamaha":     { base: 12500, tier: "premium" },
  // Standard — solid market penetration, known brands
  "icon":       { base: 11500, tier: "standard" },
  "star ev":    { base: 11000, tier: "standard" },
  "advanced ev":{ base: 11000, tier: "standard" },
  "epic":       { base: 12000, tier: "standard" },
  "evolution":  { base: 11000, tier: "standard" },
  "cushman":    { base: 12000, tier: "standard" },
  // Value — newer brands with growing FL/GA footprint
  "bintelli":   { base: 10500, tier: "value" },
  "madjax":     { base: 9500,  tier: "value" },
  "teko ev":    { base: 10500, tier: "value" },
  "teko":       { base: 10000, tier: "value" },
  "dach":       { base: 10500, tier: "value" },
  "sivo":       { base: 10000, tier: "value" },
  "tara":       { base: 9500,  tier: "value" },
  "verdi":      { base: 9500,  tier: "value" },
  "whisper":    { base: 9000,  tier: "value" },
  "venom":      { base: 9000,  tier: "value" },
  "gem":        { base: 10000, tier: "value" },
  "blue cell":  { base: 9500,  tier: "value" },
  "denago":     { base: 9500,  tier: "value" },
  "star":       { base: 10000, tier: "value" },
};
const BUDGET_BASE = 7500;
const UNKNOWN_BASE = 8000;

function getBrandBase(brand: string | null | undefined): number {
  if (!brand) return UNKNOWN_BASE;
  const b = brand.toLowerCase().trim();
  for (const [key, val] of Object.entries(BRAND_TIERS)) {
    if (b.includes(key) || key.includes(b)) return val.base;
  }
  return BUDGET_BASE;
}

// =============================================================================
// Year depreciation multiplier — anchored to 2026 = 1.0
// New carts from dealers trade near MSRP so 2026/2027 are at or above 1.0
// =============================================================================
const YEAR_MULT: Record<number, number> = {
  2027: 1.05,
  2026: 1.00,
  2025: 0.90,
  2024: 0.82,
  2023: 0.75,
  2022: 0.68,
  2021: 0.62,
  2020: 0.56,
  2019: 0.50,
  2018: 0.44,
};
function getYearMult(year: number | null | undefined): number {
  if (!year) return 0.70;
  if (year >= 2027) return 1.05;
  if (year <= 2017) return 0.38;
  return YEAR_MULT[year] ?? 0.56;
}

// =============================================================================
// Condition multiplier — used only for formula tier (comps already match condition)
// =============================================================================
function getConditionMult(condition: string | null | undefined): number {
  const c = (condition || "new").toLowerCase();
  if (c === "new") return 1.00;
  if (c === "demo") return 0.88;
  if (c === "refurbished") return 0.72;
  if (c === "used") return 0.56;
  return 0.90;
}

// =============================================================================
// Feature adjustments (additive dollars, applied after base × year × condition)
// =============================================================================
function featureAdjustments(input: PricingInput): number {
  let adj = 0;
  const power = (input.powerType || "").toLowerCase();
  const battery = (input.batteryType || "").toLowerCase();

  if (power === "electric" && battery === "lithium") adj += 1200;
  else if (power === "electric") adj += 400;
  // gas: no adjustment

  const seating = input.seating || 4;
  if (seating >= 6) adj += 1500;
  else if (seating <= 2) adj -= 500;

  if (input.lifted === true || input.lifted === "yes") adj += 600;
  if (toBool(input.chargerIncluded)) adj += 200;
  if (toBool(input.warrantyIncluded)) adj += 300;

  return adj;
}

// =============================================================================
// computeIMV — Tiered comp-based market value
// comps: array of active listings with same brand+model, year±1, same condition
// =============================================================================
export function computeIMV(input: PricingInput, comps: CompListing[]): IMVResult {
  const validComps = comps.filter(c => c.asking_price > 500 && c.asking_price < 100000);

  // ── Tier 1: ≥3 direct comps — use trimmed median ─────────────────────────
  if (validComps.length >= 3) {
    const prices = validComps.map(c => c.asking_price).sort((a, b) => a - b);
    // Trim top/bottom 10% outliers (CarGurus-style)
    const trim = Math.floor(prices.length * 0.10);
    const trimmed = prices.slice(trim, prices.length - trim || undefined);
    const imv = Math.round(median(trimmed));
    return {
      imv,
      priceConfidence: validComps.length >= 8 ? "high" : "medium",
      compCount: validComps.length,
      compTier: 1,
    };
  }

  // ── Tier 2: 1–2 comps — use comp average + formula blend ─────────────────
  if (validComps.length >= 1) {
    const compAvg = validComps.reduce((s, c) => s + c.asking_price, 0) / validComps.length;
    const formulaIMV = computeFormulaIMV(input);
    // 60% comp / 40% formula when few comps
    const imv = Math.round(compAvg * 0.60 + formulaIMV * 0.40);
    return { imv, priceConfidence: "medium", compCount: validComps.length, compTier: 2 };
  }

  // ── Tier 3: No comps — pure formula ──────────────────────────────────────
  const imv = computeFormulaIMV(input);
  return { imv, priceConfidence: "low", compCount: 0, compTier: imv > 0 ? 3 : 4 };
}

function computeFormulaIMV(input: PricingInput): number {
  const base      = getBrandBase(input.brand);
  const yearMult  = getYearMult(input.year);
  const condMult  = getConditionMult(input.condition);
  const adj       = featureAdjustments(input);

  // Dealer new-cart premium: dealers price ~3% above open-market
  const sellerPremium = (input.condition === "new" && input.sellerType === "dealer") ? 1.03 : 1.0;

  return Math.round(base * yearMult * condMult * sellerPremium + adj);
}

// =============================================================================
// computeDealRating — Based on TDC vs IMV
// =============================================================================
export function computeDealRating(
  askingPrice: number,
  imv: number,
  deliveryCost = 0
): { dealRating: string; dealDelta: number; tdc: number } {
  const tdc = askingPrice + deliveryCost;
  const delta = tdc - imv;
  const pct = imv > 0 ? delta / imv : 0;

  let dealRating: string;
  if (askingPrice <= 0 || imv <= 0) {
    dealRating = "unknown";
  } else if (pct <= -0.15) {
    dealRating = "great_deal";
  } else if (pct <= -0.05) {
    dealRating = "good_deal";
  } else if (pct <= 0.05) {
    dealRating = "fair_price";
  } else if (pct <= 0.15) {
    dealRating = "high_price";
  } else {
    dealRating = "over_market";
  }

  return { dealRating, dealDelta: delta, tdc };
}

// =============================================================================
// computeBuyerScore — 0–100 composite (CarGurus-inspired)
// =============================================================================
export function computeBuyerScore(input: PricingInput, dealRating: string): number {
  let score = 0;

  // ── Deal component (50 pts) ───────────────────────────────────────────────
  const dealPts: Record<string, number> = {
    great_deal: 50, good_deal: 40, fair_price: 30,
    high_price: 15, over_market: 5, unknown: 22,
  };
  score += dealPts[dealRating] ?? 22;

  // ── Battery/power component (20 pts) ─────────────────────────────────────
  const battery = (input.batteryType || "").toLowerCase();
  const power   = (input.powerType || "").toLowerCase();
  const age     = input.batteryAgeMonths;
  if (power === "gas") {
    score += 10;
  } else if (battery === "lithium") {
    if (age != null && age <= 12) score += 20;
    else if (age == null)          score += 15;
    else if (age <= 24)            score += 12;
    else                           score += 8;
  } else if (battery === "lead_acid") {
    if (age != null && age < 24) score += 8;
    else                         score += 4;
  } else {
    // unknown battery
    score += 6;
  }

  // ── Warranty component (15 pts) ───────────────────────────────────────────
  const warrantyIncluded = toBool(input.warrantyIncluded);
  const warrantyMonths   = input.warrantyMonths;
  if (warrantyIncluded === true) {
    score += (warrantyMonths != null && warrantyMonths >= 36) ? 15 : 10;
  } else if (warrantyIncluded === false) {
    score += 0;
  } else {
    score += 5; // unknown
  }

  // ── Charger component (10 pts) ────────────────────────────────────────────
  const charger = toBool(input.chargerIncluded);
  if (charger === true)        score += 10;
  else if (charger === false)  score += 0;
  else                         score += 5;

  // ── Delivery component (5 pts) ────────────────────────────────────────────
  const delivery = input.deliveryAvailable === true
    || input.deliveryAvailable === "yes"
    || input.deliveryIncluded === true;
  score += delivery ? 5 : 2;

  return Math.max(0, Math.min(100, score));
}

// =============================================================================
// enrichListing — Main entry point called at write time and in reprice-all
// Returns the pricing fields to persist to Supabase
// =============================================================================
export function enrichListing(
  listing: Record<string, any>,
  comps: CompListing[]
): {
  cartiq_estimated_value: number;
  deal_rating: string;
  deal_delta: number;
  buyer_score: number;
  price_confidence: string;
  valuation_confidence: string;
  estimated_delivery_cost: number | null;
  total_delivered_cost: number | null;
} {
  const input = listingToInput(listing);
  const effectivePrice = input.salePrice ?? input.askingPrice ?? 0;

  if (!effectivePrice || effectivePrice <= 0) {
    return {
      cartiq_estimated_value: 0,
      deal_rating: "unknown",
      deal_delta: 0,
      buyer_score: 25,
      price_confidence: "low",
      valuation_confidence: "low",
      estimated_delivery_cost: null,
      total_delivered_cost: null,
    };
  }

  const { imv, priceConfidence, compTier } = computeIMV(input, comps);

  // Delivery cost for TDC
  const offersDelivery = listing.delivery_available === true || listing.delivery_included === true;
  let deliveryCost = 0;
  if (offersDelivery) {
    deliveryCost = listing.estimated_delivery_cost
      ?? listing.delivery_included ? 0 : 350;
  }

  const { dealRating, dealDelta, tdc } = computeDealRating(effectivePrice, imv, deliveryCost);
  const buyerScore = computeBuyerScore(input, dealRating);

  const valConfidence: string =
    compTier === 1 ? "high" :
    compTier === 2 ? "medium" :
    "low";

  return {
    cartiq_estimated_value: imv,
    deal_rating: dealRating,
    deal_delta: dealDelta,
    buyer_score: buyerScore,
    price_confidence: priceConfidence,
    valuation_confidence: valConfidence,
    estimated_delivery_cost: offersDelivery ? deliveryCost : null,
    total_delivered_cost: offersDelivery ? tdc : null,
  };
}

// =============================================================================
// calculateCartIQValue — Legacy single-listing API (Deal Checker)
// Now uses the same IMV engine but with no comp data (pure formula fallback)
// =============================================================================
export function calculateCartIQValue(input: PricingInput): PricingResult {
  const redFlags: string[] = [];
  const questionsToAsk: string[] = [];

  const effectivePrice = input.salePrice ?? input.askingPrice ?? input.regularPrice ?? 0;

  // Delivery
  const deliveryIncluded = input.deliveryIncluded === true;
  const deliveryKnown = deliveryIncluded || (typeof input.deliveryCost === "number" && input.deliveryCost >= 0);
  let estimatedDeliveryCost = 0;
  if (deliveryIncluded) {
    estimatedDeliveryCost = 0;
  } else if (typeof input.deliveryCost === "number" && input.deliveryCost >= 0) {
    estimatedDeliveryCost = input.deliveryCost;
  } else {
    estimatedDeliveryCost = 350; // conservative unknown estimate
  }
  const totalDeliveredCost = effectivePrice + estimatedDeliveryCost;

  // IMV — no comps available in Deal Checker, use formula
  const { imv: cartiqMarketValue, priceConfidence } = computeIMV(input, []);
  const { dealRating, dealDelta } = computeDealRating(effectivePrice, cartiqMarketValue, estimatedDeliveryCost);
  const dealDeltaPercent = cartiqMarketValue > 0 ? dealDelta / cartiqMarketValue : 0;
  const buyerScore = computeBuyerScore(input, dealRating);

  // Battery risk
  const batteryType = (input.batteryType || "unknown").toLowerCase();
  const powerType   = (input.powerType || "unknown").toLowerCase();
  const batteryAgeMonths = input.batteryAgeMonths;
  const chargerIncluded  = toBoolStr(input.chargerIncluded);
  const lifted = toBool(input.lifted) ?? false;
  const seating = input.seating || 4;
  const ah = input.batteryAh || 0;

  let batteryRisk = "unknown";
  if (powerType !== "gas") {
    if (batteryType === "lead_acid" && (batteryAgeMonths == null || batteryAgeMonths > 48)) {
      batteryRisk = "high";
      redFlags.push("Lead-acid battery age is unknown or over 4 years. Factor in replacement cost (~$800–$1,500).");
    } else if (batteryType === "unknown") {
      batteryRisk = "high";
      redFlags.push("Battery type is unknown. Verify before purchasing.");
    } else if (batteryType === "lithium" && (ah === 0 || batteryAgeMonths == null)) {
      batteryRisk = "medium";
    } else if (batteryType === "lead_acid" && batteryAgeMonths != null && batteryAgeMonths <= 48) {
      batteryRisk = "medium";
    } else if (batteryType === "lithium" && ah > 0) {
      batteryRisk = "low";
    }
    if (ah > 0 && ah <= 105 && (seating >= 6 || lifted)) {
      redFlags.push(`Battery size (${ah}Ah) may be light for this setup.`);
    }
  }

  // Charger
  let chargerWarning: string | null = null;
  if (chargerIncluded === "no") {
    chargerWarning = "Charger not included. Confirm compatible charger cost before buying.";
    redFlags.push(chargerWarning);
  } else if (chargerIncluded === "unknown") {
    chargerWarning = "Charger inclusion unknown.";
    questionsToAsk.push("Is the correct charger included and matched to the battery type and voltage?");
  }

  // Warranty
  const warrantyIncluded = toBoolStr(input.warrantyIncluded);
  let warrantySignal: string | null = null;
  if (warrantyIncluded === "yes") {
    warrantySignal = "warranty_included";
  } else if (warrantyIncluded === "no") {
    warrantySignal = "no_warranty";
    if (input.sellerType === "dealer" || input.sellerType === "retail") {
      redFlags.push("No warranty listed for a dealer cart. Treat as as-is unless confirmed in writing.");
    } else {
      redFlags.push("No warranty listed. Treat as as-is unless the seller confirms in writing.");
    }
  } else {
    warrantySignal = "warranty_unknown";
    questionsToAsk.push("Is any dealer, manufacturer, battery, or third-party warranty included?");
  }

  if (batteryType === "lithium" && (input.batteryWarrantyIncluded === "unknown" || input.batteryWarrantyIncluded == null)) {
    questionsToAsk.push("Is there a separate lithium battery warranty, and is it transferable?");
  }

  // Street legal
  const streetLegalClaimed = toBool(input.streetLegalClaimed) ?? false;
  let streetLegalConfidence = "low";
  if (streetLegalClaimed) {
    redFlags.push("Seller claims street legal, but title/VIN/registration are not confirmed.");
    questionsToAsk.push("Is there a title and VIN for this cart?");
    questionsToAsk.push("Is it registered as a Low-Speed Vehicle (LSV)?");
    questionsToAsk.push("Does it have a plate?");
    questionsToAsk.push("Are seat belts, mirrors, turn signals, brake lights, and windshield all present?");
  }

  // Negotiation range
  const negotiationHigh = Math.round(cartiqMarketValue * 1.02);
  const negotiationLow  = Math.round(cartiqMarketValue * 0.88);

  // Price to improve
  const fairCeil  = Math.round(cartiqMarketValue * 1.05);
  const goodCeil  = Math.round(cartiqMarketValue * 0.95);
  const greatCeil = Math.round(cartiqMarketValue * 0.85);
  const priceToImprove: PriceToImprove = {
    toFairPrice:  totalDeliveredCost > fairCeil  ? totalDeliveredCost - fairCeil  : null,
    toGoodDeal:   totalDeliveredCost > goodCeil  ? totalDeliveredCost - goodCeil  : null,
    toGreatDeal:  totalDeliveredCost > greatCeil ? totalDeliveredCost - greatCeil : null,
  };

  return {
    cartiqMarketValue,
    cartiqEstimatedValue: cartiqMarketValue,
    effectivePrice,
    estimatedDeliveryCost: deliveryKnown ? estimatedDeliveryCost : -1,
    totalDeliveredCost: deliveryKnown ? totalDeliveredCost : -1,
    dealDelta,
    dealDeltaPercent,
    dealRating,
    buyerScore,
    priceConfidence,
    batteryRisk,
    chargerWarning,
    warrantySignal,
    streetLegalConfidence,
    redFlags,
    questionsToAsk,
    negotiationLow,
    negotiationHigh,
    priceToImprove,
  };
}

// =============================================================================
// Helpers
// =============================================================================
function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function toBool(val: string | boolean | null | undefined): boolean | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val;
  const v = val.toString().toLowerCase();
  if (["yes", "true", "1"].includes(v)) return true;
  if (["no", "false", "0"].includes(v)) return false;
  return null;
}

function toBoolStr(val: string | boolean | null | undefined): "yes" | "no" | "unknown" {
  const b = toBool(val);
  if (b === true) return "yes";
  if (b === false) return "no";
  return "unknown";
}

function listingToInput(listing: Record<string, any>): PricingInput {
  return {
    askingPrice:           listing.asking_price,
    salePrice:             listing.sale_price,
    regularPrice:          listing.regular_price,
    deliveryCost:          listing.estimated_delivery_cost,
    deliveryIncluded:      listing.delivery_included,
    deliveryAvailable:     listing.delivery_available,
    year:                  listing.year,
    brand:                 listing.brand,
    model:                 listing.model,
    powerType:             listing.power_type,
    batteryType:           listing.battery_type,
    batteryAh:             listing.battery_ah,
    batteryAgeMonths:      listing.battery_age_months,
    seating:               listing.seating,
    lifted:                listing.lifted,
    streetLegalClaimed:    listing.street_legal_claimed,
    chargerIncluded:       listing.charger_included,
    warrantyIncluded:      listing.warranty_included,
    warrantyProvider:      listing.warranty_provider,
    warrantyMonths:        listing.warranty_months,
    batteryWarrantyIncluded: listing.battery_warranty_included,
    sellerType:            listing.seller_type,
    state:                 listing.state,
    condition:             listing.condition,
  };
}
