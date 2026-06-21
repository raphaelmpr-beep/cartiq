// CartIQ Rules-Based Pricing Engine (MVP)
// No ML — pure deterministic logic based on cart attributes

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
}

export interface PricingResult {
  cartiqEstimatedValue: number;
  effectivePrice: number;
  estimatedDeliveryCost: number;
  totalDeliveredCost: number;
  dealDelta: number;
  dealRating: string;
  buyerScore: number;
  batteryRisk: string;
  chargerWarning: string | null;
  warrantySignal: string | null;
  streetLegalConfidence: string;
  redFlags: string[];
  questionsToAsk: string[];
  negotiationLow: number;
  negotiationHigh: number;
}

// Base market values for golf carts by brand category and year
function estimateBaseValue(input: PricingInput): number {
  const year = input.year || 2018;
  const age = new Date().getFullYear() - year;

  // Brand tier multipliers
  const premiumBrands = ["club car", "yamaha", "e-z-go", "ezgo", "star ev", "evolution"];
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

  // Ah adjustment
  const ah = input.batteryAh || 0;
  if (ah >= 150) baseValue += 800;
  else if (ah >= 105) baseValue += 300;
  else if (ah > 0 && ah < 75) baseValue -= 400;

  // Age depreciation (~8% per year, floors at 30% of base)
  const depreciationFactor = Math.max(0.3, 1 - age * 0.08);
  baseValue *= depreciationFactor;

  // Seating adjustment
  const seating = input.seating || 4;
  if (seating >= 6) baseValue += 1200;
  else if (seating <= 2) baseValue -= 300;

  // Lifted adjustment
  const lifted = input.lifted === true || input.lifted === "yes";
  if (lifted) baseValue += 600;

  // Street legal adjustment
  const streetLegal = input.streetLegalClaimed === true || input.streetLegalClaimed === "yes";
  if (streetLegal) baseValue += 500;

  return Math.round(brandMultiplier * baseValue);
}

function toBool(val: string | boolean | null | undefined, trueVals = ["yes", "true"]): boolean | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val;
  return trueVals.includes(val.toLowerCase());
}

export function calculateCartIQValue(input: PricingInput): PricingResult {
  const redFlags: string[] = [];
  const questionsToAsk: string[] = [];

  // Effective price
  const effectivePrice = input.salePrice ?? input.askingPrice ?? input.regularPrice ?? 0;

  // Delivery
  let estimatedDeliveryCost = 0;
  const deliveryIncluded = input.deliveryIncluded === true;
  const deliveryKnown =
    deliveryIncluded ||
    (typeof input.deliveryCost === "number" && input.deliveryCost >= 0);

  if (deliveryIncluded) {
    estimatedDeliveryCost = 0;
  } else if (typeof input.deliveryCost === "number" && input.deliveryCost >= 0) {
    estimatedDeliveryCost = input.deliveryCost;
  } else {
    // Unknown — use a midrange estimate for internal scoring, but flag it
    estimatedDeliveryCost = 350; // conservative estimate
  }

  const totalDeliveredCost = effectivePrice + estimatedDeliveryCost;

  // Estimate CartIQ value
  const cartiqEstimatedValue = estimateBaseValue(input);

  // Deal delta (positive = over market, negative = below market)
  const dealDelta = totalDeliveredCost - cartiqEstimatedValue;
  const deltaPct = cartiqEstimatedValue > 0 ? dealDelta / cartiqEstimatedValue : 0;

  // Deal rating
  let dealRating = "unknown";
  if (effectivePrice === 0) {
    dealRating = "unknown";
  } else if (deltaPct <= -0.15) {
    dealRating = "great_deal";
  } else if (deltaPct <= -0.05) {
    dealRating = "good_deal";
  } else if (deltaPct <= 0.05) {
    dealRating = "fair_price";
  } else if (deltaPct <= 0.15) {
    dealRating = "high_price";
  } else {
    dealRating = "over_market";
  }

  // ── Battery Logic ──────────────────────────────────────────────────────────
  const batteryType = (input.batteryType || "unknown").toLowerCase();
  const batteryAgeMonths = input.batteryAgeMonths;
  const chargerIncluded = input.chargerIncluded || "unknown";
  const lifted = toBool(input.lifted) ?? false;
  const seating = input.seating || 4;
  const ah = input.batteryAh || 0;
  const powerType = (input.powerType || "unknown").toLowerCase();

  let batteryRisk = "unknown";
  if (powerType === "electric" || batteryType !== "gas") {
    if (
      batteryType === "lead_acid" &&
      (batteryAgeMonths == null || batteryAgeMonths > 48)
    ) {
      batteryRisk = "high";
      redFlags.push(
        "Lead-acid battery age is unknown or over 4 years. Factor in replacement cost (~$800–$1,500)."
      );
    } else if (batteryType === "unknown") {
      batteryRisk = "high";
      redFlags.push("Battery type is unknown. Verify before purchasing.");
    } else if (
      batteryType === "lithium" &&
      (ah === 0 || batteryAgeMonths == null)
    ) {
      batteryRisk = "medium";
    } else if (
      batteryType === "lead_acid" &&
      batteryAgeMonths != null &&
      batteryAgeMonths <= 48
    ) {
      batteryRisk = "medium";
    } else if (batteryType === "lithium" && ah > 0) {
      batteryRisk = "low";
    }

    // Ah caution for larger/lifted setups
    if (ah > 0 && ah <= 105) {
      if (seating >= 6 || lifted) {
        redFlags.push(
          `Battery size (${ah}Ah) may be light for this setup. Confirm real-world range with passengers and accessories.`
        );
      }
    }
  }

  // ── Charger Logic ──────────────────────────────────────────────────────────
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

  // ── Warranty Logic ─────────────────────────────────────────────────────────
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

  // ── Street Legal Logic ─────────────────────────────────────────────────────
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

  // ── Buyer Score ────────────────────────────────────────────────────────────
  let score = 70;

  // Additions
  if (batteryType === "lithium" && ah > 0) score += 10;
  if (chargerIncluded === "yes") score += 5;
  if (streetLegalConfidence === "high") score += 5;
  if (input.sellerType === "dealer") score += 5;
  const deliveryAvailStr = typeof input.deliveryAvailable === "string" ? input.deliveryAvailable : "";
  if (input.deliveryIncluded || deliveryAvailStr === "yes" || input.deliveryAvailable === true) score += 5;
  if (dealDelta < 0 && effectivePrice > 0) score += 5;
  if (batteryAgeMonths != null) score += 5;
  if (warrantyIncluded === "yes") score += 5;
  if (batteryWarrantyIncluded === "yes") score += 5;
  if (input.warrantyProvider === "manufacturer" || input.warrantyProvider === "retailer") score += 5;

  // Subtractions
  if (batteryType === "lead_acid" && (batteryAgeMonths == null || batteryAgeMonths > 48)) score -= 15;
  if (chargerIncluded === "no" || chargerIncluded === "unknown") score -= 10;
  if (streetLegalClaimed && streetLegalConfidence !== "high") score -= 10;
  if (dealRating === "over_market") score -= 10;
  if (!input.deliveryIncluded && !deliveryKnown) score -= 5;
  if (!ah && batteryType !== "gas") score -= 5;
  if (lifted && ah > 0 && ah <= 105) score -= 5;
  if (warrantyIncluded === "no" && (input.sellerType === "dealer" || input.sellerType === "retail")) score -= 5;
  if (input.sellerType === "retail" && !input.lastVerifiedAt) score -= 5;

  score = Math.max(0, Math.min(100, score));

  // ── Negotiation Range ──────────────────────────────────────────────────────
  // negotiationHigh = max a buyer should reasonably pay (CartIQ value + 2% tolerance)
  // negotiationLow  = aggressive opening offer (12% below CartIQ value)
  // Both are anchored to CartIQ value, NOT to asking price, so they never invert.
  const negotiationHigh = Math.round(cartiqEstimatedValue * 1.02);
  const negotiationLow = Math.round(cartiqEstimatedValue * 0.88);

  return {
    cartiqEstimatedValue,
    effectivePrice,
    estimatedDeliveryCost: deliveryKnown ? estimatedDeliveryCost : -1, // -1 = unknown
    totalDeliveredCost: deliveryKnown ? totalDeliveredCost : -1,
    dealDelta,
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
  };
}
