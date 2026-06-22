// CartIQ Market Value Algorithm (MVP)
// Rules-based pricing engine. No machine learning.
// Based on comparable golf cart attributes and market adjustments for FL/GA.

export interface PricingInput {
  askingPrice?: number | null;
  regularPrice?: number | null;
  salePrice?: number | null;
  deliveryCost?: number | null;
  deliveryIncluded?: boolean;
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
  chargerIncluded?: string | null;
  warrantyIncluded?: string | null;
  warrantyProvider?: string | null;
  warrantyMonths?: number | null;
  batteryWarrantyIncluded?: string | null;
  sellerType?: string | null;
  state?: string | null;
  city?: string | null;
  lastVerifiedAt?: string | null;
  condition?: string | null;
}

export interface PriceToImprove {
  // Dollar reduction from current total delivered cost needed to reach each rating.
  // null means the listing already meets or beats that threshold.
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
  batteryRisk: string;
  chargerWarning: string | null;
  warrantySignal: string | null;
  streetLegalConfidence: string;
  redFlags: string[];
  questionsToAsk: string[];
  /** Negotiation range anchored to CartIQ Market Value */
  negotiationLow: number;
  negotiationHigh: number;
  /**
   * For listings rated High Price or Over Market: how much the buyer would need
   * to reduce the total delivered cost to reach each better rating.
   * null entries mean that rating is already achieved.
   */
  priceToImprove: PriceToImprove;
}

// ── Base market value estimator ──────────────────────────────────────────────
// Derives CartIQ Market Value from cart attributes.
// This is NOT the asking price — it is an independent estimate of fair market value.
function estimateBaseValue(input: PricingInput): number {
  const year = input.year || 2018;
  const age = new Date().getFullYear() - year;
  const isNew = (input.condition as string | undefined) === "new";

  // New dealer carts: MSRP is the market. Estimate = asking price.
  if (isNew && input.sellerType === "dealer") {
    const effectivePrice = input.salePrice ?? input.askingPrice ?? input.regularPrice ?? 0;
    if (effectivePrice > 0) return effectivePrice;
  }

  // Brand tier multipliers
  const premiumBrands = [
    "club car", "yamaha", "e-z-go", "ezgo", "star ev", "evolution",
    "teko", "venom", "dach", "verdi", "kandi", "whisper",
  ];
  const midBrands = ["icon", "advanced ev", "tomberlin", "bintelli"];
  const budgetBrands = ["crickett", "barefoot", "jakes"];

  const brandLower = (input.brand || "").toLowerCase();
  let brandMultiplier = 1.0;
  if (premiumBrands.some((b) => brandLower.includes(b))) brandMultiplier = 1.15;
  else if (midBrands.some((b) => brandLower.includes(b))) brandMultiplier = 1.05;
  else if (budgetBrands.some((b) => brandLower.includes(b))) brandMultiplier = 0.9;

  // Base value by power type
  const powerType = (input.powerType || "electric").toLowerCase();
  let baseValue = powerType === "gas" ? 6500 : 7500;

  // Battery type adjustment
  const batteryType = (input.batteryType || "unknown").toLowerCase();
  if (batteryType === "lithium") baseValue += 2000;
  else if (batteryType === "lead_acid") baseValue -= 500;

  // Battery Ah adjustment
  const ah = input.batteryAh || 0;
  if (ah >= 150) baseValue += 800;
  else if (ah >= 105) baseValue += 300;
  else if (ah > 0 && ah < 75) baseValue -= 400;

  // Age depreciation: ~8% per year, floor at 30% of base
  const depreciationFactor = isNew ? 1.0 : Math.max(0.3, 1 - age * 0.08);
  baseValue *= depreciationFactor;

  // Seating
  const seating = input.seating || 4;
  if (seating >= 6) baseValue += 1200;
  else if (seating <= 2) baseValue -= 300;

  // Lifted
  const lifted = input.lifted === true || input.lifted === "yes";
  if (lifted) baseValue += 600;

  // Street legal
  const streetLegal = input.streetLegalClaimed === true || input.streetLegalClaimed === "yes";
  if (streetLegal) baseValue += 500;

  return Math.round(brandMultiplier * baseValue);
}

function toBool(val: string | boolean | null | undefined, trueVals = ["yes", "true"]): boolean | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val;
  return trueVals.includes(val.toLowerCase());
}

// ── Deal rating thresholds ────────────────────────────────────────────────────
// Anchored to CartIQ Market Value, based on total delivered cost.
const THRESHOLDS = {
  GREAT_DEAL: -0.15,   // 15%+ below market
  GOOD_DEAL:  -0.05,   // 5–15% below market
  FAIR_PRICE:  0.05,   // within 5% of market
  HIGH_PRICE:  0.15,   // 5–15% above market
  // over_market: > 15% above
} as const;

// ── Price-to-improve calculator ───────────────────────────────────────────────
// Returns the dollar reduction in total delivered cost needed to reach each rating.
// null = already at or better than that threshold.
function calcPriceToImprove(
  totalDeliveredCost: number,
  cartiqMarketValue: number
): PriceToImprove {
  if (cartiqMarketValue <= 0) {
    return { toFairPrice: null, toGoodDeal: null, toGreatDeal: null };
  }

  // Price ceilings for each rating (total delivered cost must not exceed these)
  const fairPriceCeiling  = Math.round(cartiqMarketValue * (1 + THRESHOLDS.FAIR_PRICE));
  const goodDealCeiling   = Math.round(cartiqMarketValue * (1 + THRESHOLDS.GOOD_DEAL));
  const greatDealCeiling  = Math.round(cartiqMarketValue * (1 + THRESHOLDS.GREAT_DEAL));

  const toFairPrice  = totalDeliveredCost > fairPriceCeiling  ? totalDeliveredCost - fairPriceCeiling  : null;
  const toGoodDeal   = totalDeliveredCost > goodDealCeiling   ? totalDeliveredCost - goodDealCeiling   : null;
  const toGreatDeal  = totalDeliveredCost > greatDealCeiling  ? totalDeliveredCost - greatDealCeiling  : null;

  return { toFairPrice, toGoodDeal, toGreatDeal };
}

// ── Main export ───────────────────────────────────────────────────────────────
export function calculateCartIQValue(input: PricingInput): PricingResult {
  const redFlags: string[] = [];
  const questionsToAsk: string[] = [];

  // ── Effective price ─────────────────────────────────────────────────────────
  const effectivePrice = input.salePrice ?? input.askingPrice ?? input.regularPrice ?? 0;

  // ── Delivery cost ───────────────────────────────────────────────────────────
  // Important: delivery cost can reduce or eliminate a deal advantage.
  // If delivery is unknown, we use a conservative estimate for scoring but flag it.
  const deliveryIncluded = input.deliveryIncluded === true;
  const deliveryKnown =
    deliveryIncluded ||
    (typeof input.deliveryCost === "number" && input.deliveryCost >= 0);

  let estimatedDeliveryCost = 0;
  if (deliveryIncluded) {
    estimatedDeliveryCost = 0;
  } else if (typeof input.deliveryCost === "number" && input.deliveryCost >= 0) {
    estimatedDeliveryCost = input.deliveryCost;
  } else {
    // Unknown — conservative estimate used only for internal scoring
    estimatedDeliveryCost = 350;
  }

  // totalDeliveredCost is the true cost to the buyer and the basis for ALL ratings.
  const totalDeliveredCost = effectivePrice + estimatedDeliveryCost;

  // ── CartIQ Market Value ─────────────────────────────────────────────────────
  const cartiqMarketValue = estimateBaseValue(input);

  // ── Deal delta ──────────────────────────────────────────────────────────────
  // Positive = over market (buyer is paying more than market value).
  // Negative = below market (good for buyer).
  const dealDelta = totalDeliveredCost - cartiqMarketValue;
  const dealDeltaPercent = cartiqMarketValue > 0 ? dealDelta / cartiqMarketValue : 0;

  // ── Deal rating ─────────────────────────────────────────────────────────────
  let dealRating = "unknown";
  if (effectivePrice === 0) {
    dealRating = "unknown";
  } else if (dealDeltaPercent <= THRESHOLDS.GREAT_DEAL) {
    dealRating = "great_deal";
  } else if (dealDeltaPercent <= THRESHOLDS.GOOD_DEAL) {
    dealRating = "good_deal";
  } else if (dealDeltaPercent <= THRESHOLDS.FAIR_PRICE) {
    dealRating = "fair_price";
  } else if (dealDeltaPercent <= THRESHOLDS.HIGH_PRICE) {
    dealRating = "high_price";
  } else {
    dealRating = "over_market";
  }

  // ── Battery logic ───────────────────────────────────────────────────────────
  // Old or unknown lead-acid batteries reduce buyer score and are flagged.
  // Battery condition does NOT change CartIQ Market Value (it's an attribute of the cart
  // being priced, not a comps adjustment) but it does affect buyer confidence.
  const batteryType = (input.batteryType || "unknown").toLowerCase();
  const batteryAgeMonths = input.batteryAgeMonths;
  const chargerIncluded = input.chargerIncluded || "unknown";
  const lifted = toBool(input.lifted) ?? false;
  const seating = input.seating || 4;
  const ah = input.batteryAh || 0;
  const powerType = (input.powerType || "unknown").toLowerCase();

  let batteryRisk = "unknown";
  if (powerType === "electric" || batteryType !== "gas") {
    if (batteryType === "lead_acid" && (batteryAgeMonths == null || batteryAgeMonths > 48)) {
      batteryRisk = "high";
      redFlags.push(
        "Lead-acid battery age is unknown or over 4 years. Factor in replacement cost (~$800–$1,500)."
      );
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

    // Ah caution for larger or lifted setups
    if (ah > 0 && ah <= 105 && (seating >= 6 || lifted)) {
      redFlags.push(
        `Battery size (${ah}Ah) may be light for this setup. Confirm real-world range with passengers and accessories.`
      );
    }
  }

  // ── Charger logic ────────────────────────────────────────────────────────────
  let chargerWarning: string | null = null;
  if (chargerIncluded === "no") {
    chargerWarning = "Charger not included. Confirm compatible charger cost before buying.";
    redFlags.push(chargerWarning);
  } else if (chargerIncluded === "unknown") {
    chargerWarning = "Charger inclusion unknown.";
    questionsToAsk.push(
      "Is the correct charger included and matched to the battery type and voltage?"
    );
  }

  // ── Warranty logic ──────────────────────────────────────────────────────────
  // Warranty improves buyer confidence (score) but does NOT improve the deal rating.
  // A cart with a warranty is still Over Market if the price is over market.
  const warrantyIncluded = input.warrantyIncluded || "unknown";
  const batteryWarrantyIncluded = input.batteryWarrantyIncluded || "unknown";
  let warrantySignal: string | null = null;

  if (warrantyIncluded === "yes") {
    warrantySignal = "warranty_included";
  } else if (warrantyIncluded === "no") {
    warrantySignal = "no_warranty";
    if (input.sellerType === "dealer" || input.sellerType === "retail") {
      redFlags.push(
        "No warranty listed for a dealer or retail cart. Treat as as-is unless confirmed otherwise in writing."
      );
    } else {
      redFlags.push("No warranty listed. Treat the cart as as-is unless the seller confirms otherwise in writing.");
    }
  } else {
    warrantySignal = "warranty_unknown";
    questionsToAsk.push(
      "Is any dealer, manufacturer, battery, retailer, or third-party warranty included?"
    );
  }

  if (batteryType === "lithium" && batteryWarrantyIncluded === "unknown") {
    questionsToAsk.push(
      "Is there a separate lithium battery warranty, and is it transferable?"
    );
  }

  // ── Street legal logic ───────────────────────────────────────────────────────
  const streetLegalClaimed = toBool(input.streetLegalClaimed) ?? false;
  let streetLegalConfidence = "unknown";
  if (!streetLegalClaimed) {
    streetLegalConfidence = "low";
  } else {
    streetLegalConfidence = "low"; // claimed but not verified
    redFlags.push(
      "Seller claims street legal, but title/VIN/registration are not confirmed."
    );
    questionsToAsk.push("Is there a title and VIN for this cart?");
    questionsToAsk.push("Is it registered as a Low-Speed Vehicle (LSV)?");
    questionsToAsk.push("Does it have a plate?");
    questionsToAsk.push(
      "Are seat belts, mirrors, turn signals, brake lights, and windshield all present?"
    );
  }

  // ── Buyer score ──────────────────────────────────────────────────────────────
  // 0–100. Reflects overall purchase confidence, not deal price.
  // Battery unknowns and old lead-acid are significant negatives.
  // Warranty improves confidence but does not affect deal rating.
  let score = 70;

  // Positive signals
  if (batteryType === "lithium" && ah > 0) score += 10;
  if (chargerIncluded === "yes") score += 5;
  if (streetLegalConfidence === "high") score += 5;
  if (input.sellerType === "dealer") score += 5;
  const deliveryAvailStr = typeof input.deliveryAvailable === "string" ? input.deliveryAvailable : "";
  if (input.deliveryIncluded || deliveryAvailStr === "yes" || input.deliveryAvailable === true) score += 5;
  if (dealDelta < 0 && effectivePrice > 0) score += 5;   // below market
  if (batteryAgeMonths != null) score += 5;               // age disclosed
  if (warrantyIncluded === "yes") score += 5;
  if (batteryWarrantyIncluded === "yes") score += 5;
  if (input.warrantyProvider === "manufacturer" || input.warrantyProvider === "retailer") score += 5;

  // Negative signals
  // Old/unknown lead-acid: major penalty — significant hidden cost risk
  if (batteryType === "lead_acid" && (batteryAgeMonths == null || batteryAgeMonths > 48)) score -= 15;
  // Unknown battery type
  if (batteryType === "unknown" && powerType === "electric") score -= 10;
  if (chargerIncluded === "no" || chargerIncluded === "unknown") score -= 10;
  if (streetLegalClaimed && streetLegalConfidence !== "high") score -= 10;
  if (dealRating === "over_market") score -= 10;
  if (!input.deliveryIncluded && !deliveryKnown) score -= 5;  // unknown delivery cost
  if (!ah && batteryType !== "gas") score -= 5;               // Ah unknown
  if (lifted && ah > 0 && ah <= 105) score -= 5;              // underpowered for lift
  if (warrantyIncluded === "no" && (input.sellerType === "dealer" || input.sellerType === "retail")) score -= 5;
  if (input.sellerType === "retail" && !input.lastVerifiedAt) score -= 5;

  score = Math.max(0, Math.min(100, score));

  // ── Negotiation range ────────────────────────────────────────────────────────
  // Anchored to CartIQ Market Value (not asking price).
  // negotiationHigh: the most a buyer should reasonably pay (market + 2% tolerance)
  // negotiationLow:  aggressive opening offer (12% below market)
  const negotiationHigh = Math.round(cartiqMarketValue * 1.02);
  const negotiationLow  = Math.round(cartiqMarketValue * 0.88);

  // ── Price to improve rating ──────────────────────────────────────────────────
  // Only meaningful when the listing is above market. Shows the buyer exactly how
  // much the seller needs to come down to reach each better rating.
  // Based on total delivered cost, NOT asking price alone.
  const effectiveTotalForImprove = deliveryKnown ? totalDeliveredCost : effectivePrice + estimatedDeliveryCost;
  const priceToImprove = calcPriceToImprove(effectiveTotalForImprove, cartiqMarketValue);

  return {
    cartiqMarketValue,
    cartiqEstimatedValue: cartiqMarketValue, // backward-compat alias
    effectivePrice,
    estimatedDeliveryCost: deliveryKnown ? estimatedDeliveryCost : -1,
    totalDeliveredCost: deliveryKnown ? totalDeliveredCost : -1,
    dealDelta,
    dealDeltaPercent,
    dealRating,
    buyerScore: score,
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
