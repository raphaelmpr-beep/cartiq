import { storage } from "./storage";
import { calculateCartIQValue } from "./pricing";
import type { InsertListing, InsertSeoArticle } from "@shared/schema";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 80);
}

function makeListing(data: Partial<InsertListing> & { title: string; brand: string; model: string; city: string; state: string }): InsertListing {
  const pricing = calculateCartIQValue({
    askingPrice: data.askingPrice,
    salePrice: data.salePrice,
    regularPrice: data.regularPrice,
    deliveryCost: data.estimatedDeliveryCost,
    deliveryIncluded: data.deliveryIncluded ?? false,
    deliveryAvailable: data.deliveryAvailable ? "yes" : "no",
    year: data.year,
    brand: data.brand,
    model: data.model,
    powerType: data.powerType,
    batteryType: data.batteryType,
    batteryAh: data.batteryAh,
    batteryAgeMonths: data.batteryAgeMonths,
    seating: data.seating,
    lifted: data.lifted,
    streetLegalClaimed: data.streetLegalClaimed,
    chargerIncluded: data.chargerIncluded,
    warrantyIncluded: data.warrantyIncluded,
    warrantyProvider: data.warrantyProvider,
    warrantyMonths: data.warrantyMonths,
    batteryWarrantyIncluded: data.batteryWarrantyIncluded,
    sellerType: data.sellerType,
    state: data.state,
  });

  const slug = `${slugify(data.brand)}-${slugify(data.model)}-${slugify(data.city)}-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

  return {
    title: data.title,
    slug,
    description: data.description,
    sourceType: data.sourceType || "admin_manual",
    sourceUrl: data.sourceUrl,
    publicListing: data.publicListing ?? true,
    sellerType: data.sellerType || "private",
    status: "active",
    dealerId: data.dealerId,
    retailSourceId: data.retailSourceId,
    retailerName: data.retailerName,
    retailerSku: data.retailerSku,
    retailerProductUrl: data.retailerProductUrl,
    retailEventName: data.retailEventName,
    availabilityStatus: data.availabilityStatus,
    shipToStates: data.shipToStates,
    lastVerifiedAt: data.lastVerifiedAt,
    askingPrice: data.askingPrice,
    regularPrice: data.regularPrice,
    salePrice: data.salePrice,
    cartiqEstimatedValue: pricing.cartiqEstimatedValue,
    estimatedDeliveryCost: pricing.estimatedDeliveryCost >= 0 ? pricing.estimatedDeliveryCost : data.estimatedDeliveryCost,
    totalDeliveredCost: pricing.totalDeliveredCost >= 0 ? pricing.totalDeliveredCost : undefined,
    dealDelta: pricing.dealDelta,
    dealRating: pricing.dealRating,
    buyerScore: pricing.buyerScore,
    year: data.year,
    brand: data.brand,
    model: data.model,
    condition: data.condition || "used",
    powerType: data.powerType || "electric",
    batteryType: data.batteryType || "unknown",
    batteryAh: data.batteryAh,
    batteryAgeMonths: data.batteryAgeMonths,
    seating: data.seating || 4,
    lifted: data.lifted ?? false,
    streetLegalClaimed: data.streetLegalClaimed ?? false,
    streetLegalConfidence: pricing.streetLegalConfidence as any,
    chargerIncluded: data.chargerIncluded || "unknown",
    warrantyIncluded: data.warrantyIncluded || "unknown",
    warrantyProvider: data.warrantyProvider || "unknown",
    warrantyMonths: data.warrantyMonths,
    batteryWarrantyIncluded: data.batteryWarrantyIncluded || "unknown",
    warrantyNotes: data.warrantyNotes,
    city: data.city,
    state: data.state,
    zip: data.zip,
    deliveryAvailable: data.deliveryAvailable ?? false,
    deliveryIncluded: data.deliveryIncluded ?? false,
    deliveryNotes: data.deliveryNotes,
    imageUrl: data.imageUrl,
    sellerName: data.sellerName,
    sellerPhone: data.sellerPhone,
    sellerEmail: data.sellerEmail,
  };
}

export async function seedDatabase() {
  // Check if already seeded
  const existing = storage.getListings({});
  if (existing.length >= 16) {
    console.log("Database already seeded.");
    return;
  }

  console.log("Seeding database...");

  // ─── Dealers ─────────────────────────────────────────────────────────────
  if (!storage.hasDealer("sunshine-golf-carts-jacksonville")) {
    storage.createDealer({
      name: "Sunshine Golf Carts",
      slug: "sunshine-golf-carts-jacksonville",
      websiteUrl: "https://example-dealer.com",
      phone: "904-555-0100",
      email: "sales@sunshinegolfcarts.com",
      city: "Jacksonville",
      state: "FL",
      zip: "32202",
      serviceAreaMiles: 75,
      deliveryAvailable: true,
      deliveryIncluded: false,
      deliveryBaseFee: 199,
      deliveryPerMileFee: 1.5,
      deliveryFreeRadiusMiles: 25,
      defaultWarrantyIncluded: true,
      defaultWarrantyMonths: 12,
      defaultWarrantyNotes: "1-year dealer warranty on parts and labor.",
    });
  }

  if (!storage.hasDealer("peachtree-golf-carts-atlanta")) {
    storage.createDealer({
      name: "Peachtree Golf Carts",
      slug: "peachtree-golf-carts-atlanta",
      websiteUrl: "https://example-dealer-ga.com",
      phone: "404-555-0200",
      email: "sales@peachtreegolfcarts.com",
      city: "Atlanta",
      state: "GA",
      zip: "30301",
      serviceAreaMiles: 60,
      deliveryAvailable: true,
      deliveryIncluded: false,
      deliveryBaseFee: 249,
      deliveryPerMileFee: 2.0,
      deliveryFreeRadiusMiles: 20,
      defaultWarrantyIncluded: true,
      defaultWarrantyMonths: 12,
      defaultWarrantyNotes: "1-year dealer warranty.",
    });
  }

  // ─── Retail Source (Costco Placeholder) ──────────────────────────────────
  if (!storage.hasDealer("costco-wholesale")) {
    storage.createRetailSource({
      name: "Costco Wholesale",
      slug: "costco-wholesale",
      websiteUrl: "https://www.costco.com",
      sourceType: "costco",
      authorizedMode: "manual",
      allowedUseNotes: "Manual entry only. Data entered by admin. No automated scraping.",
    });
  }

  // ─── Inventory Sources ──────────────────────────────────────────────────
  if (!storage.hasInventorySource("Manual Admin Entry")) {
    storage.createInventorySource({ name: "Manual Admin Entry", sourceType: "manual", status: "active" });
  }
  if (!storage.hasInventorySource("CSV Import")) {
    storage.createInventorySource({ name: "CSV Import", sourceType: "csv", status: "active" });
  }
  if (!storage.hasInventorySource("Meta Marketplace API (Placeholder)")) {
    storage.createInventorySource({
      name: "Meta Marketplace API (Placeholder)",
      sourceType: "official_meta_api",
      status: "not_configured",
      apiProvider: "Meta",
      allowedUseNotes: "Official Meta API only. No scraping. Disabled until approved access obtained.",
    });
  }
  if (!storage.hasInventorySource("Costco Retail API (Placeholder)")) {
    storage.createInventorySource({
      name: "Costco Retail API (Placeholder)",
      sourceType: "approved_retail_api",
      status: "not_configured",
      apiProvider: "Costco",
      allowedUseNotes: "Approved retail API only. No scraping. Manual/CSV allowed. Disabled until approved.",
    });
  }

  // ─── Listings ─────────────────────────────────────────────────────────────
  const listingsData: Parameters<typeof makeListing>[0][] = [
    // 1. Jacksonville FL - Club Car Lithium 105Ah - Dealer - Below Market
    {
      title: "2022 Club Car Onward Lithium 4-Passenger – Jacksonville",
      brand: "Club Car", model: "Onward", year: 2022,
      city: "Jacksonville", state: "FL", zip: "32202",
      askingPrice: 10499, estimatedDeliveryCost: 199,
      batteryType: "lithium", batteryAh: 105, batteryAgeMonths: 12,
      seating: 4, lifted: false, streetLegalClaimed: false,
      chargerIncluded: "yes", warrantyIncluded: "yes",
      warrantyProvider: "dealer", warrantyMonths: 12,
      batteryWarrantyIncluded: "yes",
      deliveryAvailable: true, deliveryIncluded: false,
      sellerType: "dealer", sourceType: "dealer_direct",
      condition: "used", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&auto=format&fit=crop",
      sellerName: 'Sun Country Golf Cars',
      sellerPhone: '(904) 555-0182',
      sellerEmail: 'sales@suncountrygolfcars.com',
      description: "2022 Club Car Onward with 48V lithium battery. 105Ah, charger included. Dealer warranty.",
    },
    // 2. St. Augustine FL - EZGO Lead-Acid Old Battery - Private - High Price
    {
      title: "2017 E-Z-GO RXV Electric 4-Seat – St. Augustine",
      brand: "E-Z-GO", model: "RXV", year: 2017,
      city: "St. Augustine", state: "FL", zip: "32084",
      askingPrice: 7900, estimatedDeliveryCost: 350,
      batteryType: "lead_acid", batteryAgeMonths: 72,
      seating: 4, lifted: false, streetLegalClaimed: false,
      chargerIncluded: "yes", warrantyIncluded: "no",
      deliveryAvailable: false, deliveryIncluded: false,
      sellerType: "private", sourceType: "private_direct",
      condition: "used", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop",
      sellerName: 'Private Seller',
      sellerPhone: '(904) 555-0247',
      sellerEmail: 'staugustine2@owner.local',
      description: "2017 EZGO RXV. Lead-acid batteries at 6 years. Charger included. Selling as-is.",
    },
    // 3. Ponte Vedra FL - Yamaha Drive2 Lithium 150Ah Lifted Street Legal - Dealer
    {
      title: "2023 Yamaha Drive2 QuieTech Lithium 150Ah Lifted LSV – Ponte Vedra",
      brand: "Yamaha", model: "Drive2 QuieTech", year: 2023,
      city: "Ponte Vedra", state: "FL", zip: "32082",
      askingPrice: 14999, estimatedDeliveryCost: 0,
      batteryType: "lithium", batteryAh: 150, batteryAgeMonths: 8,
      seating: 4, lifted: true, streetLegalClaimed: true,
      chargerIncluded: "yes", warrantyIncluded: "yes",
      warrantyProvider: "manufacturer", warrantyMonths: 24,
      batteryWarrantyIncluded: "yes",
      deliveryAvailable: true, deliveryIncluded: true,
      sellerType: "dealer", sourceType: "dealer_direct",
      condition: "used", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop",
      sellerName: 'Coastal Cart Company',
      sellerPhone: '(904) 555-0391',
      sellerEmail: 'info@coastalcartco.com',
      description: "Lifted LSV-ready 2023 Yamaha Drive2 with 150Ah lithium, full street equipment. Delivery included.",
    },
    // 4. Orlando FL - Star EV 6-Seat Lithium 105Ah - Dealer - Fair Price
    {
      title: "2021 Star EV Sirius 6-Passenger Lithium – Orlando",
      brand: "Star EV", model: "Sirius", year: 2021,
      city: "Orlando", state: "FL", zip: "32801",
      askingPrice: 12200, estimatedDeliveryCost: 299,
      batteryType: "lithium", batteryAh: 105, batteryAgeMonths: 24,
      seating: 6, lifted: false, streetLegalClaimed: false,
      chargerIncluded: "yes", warrantyIncluded: "yes",
      warrantyProvider: "dealer", warrantyMonths: 12,
      batteryWarrantyIncluded: "unknown",
      deliveryAvailable: true, deliveryIncluded: false,
      sellerType: "dealer", sourceType: "dealer_direct",
      condition: "used", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
      sellerName: 'Central Florida Cart Depot',
      sellerPhone: '(407) 555-0114',
      sellerEmail: 'sales@cfcartdepot.com',
      description: "2021 Star EV 6-passenger. Lithium 105Ah. Note: battery size may be light for 6-seat with passengers.",
    },
    // 5. Tampa FL - Gas Club Car - Private - Unknown Charger - Great Deal
    {
      title: "2019 Club Car DS Gas – Tampa",
      brand: "Club Car", model: "DS", year: 2019,
      city: "Tampa", state: "FL", zip: "33601",
      askingPrice: 4200, estimatedDeliveryCost: 350,
      batteryType: "gas",
      seating: 4, lifted: false, streetLegalClaimed: false,
      chargerIncluded: "unknown", warrantyIncluded: "no",
      deliveryAvailable: false, deliveryIncluded: false,
      sellerType: "private", sourceType: "private_direct",
      condition: "used", powerType: "gas",
      imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop",
      sellerName: 'Private Seller',
      sellerPhone: '(813) 555-0578',
      sellerEmail: 'tampa5@owner.local',
      description: "Gas-powered 2019 Club Car DS. Runs great. No warranty. Buyer inspects and arranges transport.",
    },
    // 6. Ocala FL - ICON i60L Lithium 150Ah 6-Seat Lifted - Dealer - Warranty
    {
      title: "2023 ICON i60L Lithium 150Ah 6-Seat Lifted – Ocala",
      brand: "ICON", model: "i60L", year: 2023,
      city: "Ocala", state: "FL", zip: "34470",
      askingPrice: 15899, estimatedDeliveryCost: 399,
      batteryType: "lithium", batteryAh: 150, batteryAgeMonths: 6,
      seating: 6, lifted: true, streetLegalClaimed: false,
      chargerIncluded: "yes", warrantyIncluded: "yes",
      warrantyProvider: "manufacturer", warrantyMonths: 24,
      batteryWarrantyIncluded: "yes",
      deliveryAvailable: true, deliveryIncluded: false,
      sellerType: "dealer", sourceType: "dealer_direct",
      condition: "new", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop",
      sellerName: 'Sunshine State Golf Carts',
      sellerPhone: '(352) 555-0663',
      sellerEmail: 'sales@sunshinestategolfcarts.com',
      description: "New 2023 ICON i60L. 150Ah lithium, 6-passenger, lifted. 2-year manufacturer warranty.",
    },
    // 7. The Villages FL - Yamaha Drive Lead-Acid Unknown Battery Age - Private
    {
      title: "2015 Yamaha Drive Electric 4-Seat – The Villages",
      brand: "Yamaha", model: "Drive", year: 2015,
      city: "The Villages", state: "FL", zip: "32159",
      askingPrice: 5800,
      batteryType: "lead_acid", batteryAgeMonths: undefined,
      seating: 4, lifted: false, streetLegalClaimed: false,
      chargerIncluded: "yes", warrantyIncluded: "no",
      deliveryAvailable: false, deliveryIncluded: false,
      sellerType: "private", sourceType: "private_direct",
      condition: "used", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=800&auto=format&fit=crop",
      sellerName: 'Private Seller',
      sellerPhone: '(352) 555-0721',
      sellerEmail: 'villages7@owner.local',
      description: "2015 Yamaha Drive. Lead-acid batteries, age unknown. Charger included. Selling as-is.",
    },
    // 8. Atlanta GA - Club Car Precedent Lithium 65Ah - Dealer - Below Market
    {
      title: "2020 Club Car Precedent Lithium 65Ah – Atlanta",
      brand: "Club Car", model: "Precedent", year: 2020,
      city: "Atlanta", state: "GA", zip: "30301",
      askingPrice: 8900, estimatedDeliveryCost: 249,
      batteryType: "lithium", batteryAh: 65, batteryAgeMonths: 36,
      seating: 4, lifted: false, streetLegalClaimed: false,
      chargerIncluded: "yes", warrantyIncluded: "yes",
      warrantyProvider: "dealer", warrantyMonths: 12,
      batteryWarrantyIncluded: "no",
      deliveryAvailable: true, deliveryIncluded: false,
      sellerType: "dealer", sourceType: "dealer_direct",
      condition: "used", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800&auto=format&fit=crop",
      sellerName: 'Peach State Carts',
      sellerPhone: '(404) 555-0882',
      sellerEmail: 'sales@peachstatecarts.com',
      description: "2020 Club Car Precedent with 65Ah lithium. Good for 2-4 passenger neighborhood use. Dealer warranty.",
    },
    // 9. Peachtree City GA - EZGO Liberty LSV Street Legal - Dealer
    {
      title: "2022 E-Z-GO Liberty ELiTE LSV Street Legal – Peachtree City",
      brand: "E-Z-GO", model: "Liberty ELiTE", year: 2022,
      city: "Peachtree City", state: "GA", zip: "30269",
      askingPrice: 13500, estimatedDeliveryCost: 0,
      batteryType: "lithium", batteryAh: 105, batteryAgeMonths: 18,
      seating: 4, lifted: false, streetLegalClaimed: true,
      chargerIncluded: "yes", warrantyIncluded: "yes",
      warrantyProvider: "manufacturer", warrantyMonths: 24,
      batteryWarrantyIncluded: "yes",
      deliveryAvailable: true, deliveryIncluded: true,
      sellerType: "dealer", sourceType: "dealer_direct",
      condition: "used", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&auto=format&fit=crop",
      sellerName: 'PTC Golf Car Center',
      sellerPhone: '(770) 555-0934',
      sellerEmail: 'contact@ptcgolfcar.com',
      description: "LSV-titled 2022 EZGO Liberty ELiTE. Fully street legal. Seat belts, turn signals, brake lights, windshield, VIN. Delivery included.",
    },
    // 10. Savannah GA - Yamaha Drive2 Gas Private No Warranty
    {
      title: "2018 Yamaha Drive2 Gas 4-Seat – Savannah",
      brand: "Yamaha", model: "Drive2", year: 2018,
      city: "Savannah", state: "GA", zip: "31401",
      askingPrice: 5499, estimatedDeliveryCost: 350,
      batteryType: "gas",
      seating: 4, lifted: false, streetLegalClaimed: false,
      chargerIncluded: "unknown", warrantyIncluded: "no",
      deliveryAvailable: false, deliveryIncluded: false,
      sellerType: "private", sourceType: "private_direct",
      condition: "used", powerType: "gas",
      imageUrl: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&auto=format&fit=crop",
      sellerName: 'Private Seller',
      sellerPhone: '(912) 555-1042',
      sellerEmail: 'savannah10@owner.local',
      description: "2018 Yamaha Drive2 gas. Good condition. No warranty. Buyer arranges transport.",
    },
    // 11. Newnan GA - Advanced EV 4-Seat Lifted Lithium 105Ah - Dealer
    {
      title: "2023 Advanced EV 4PR Lifted Lithium 105Ah – Newnan",
      brand: "Advanced EV", model: "4PR", year: 2023,
      city: "Newnan", state: "GA", zip: "30263",
      askingPrice: 11750, estimatedDeliveryCost: 299,
      batteryType: "lithium", batteryAh: 105, batteryAgeMonths: 10,
      seating: 4, lifted: true, streetLegalClaimed: false,
      chargerIncluded: "yes", warrantyIncluded: "yes",
      warrantyProvider: "manufacturer", warrantyMonths: 18,
      batteryWarrantyIncluded: "yes",
      deliveryAvailable: true, deliveryIncluded: false,
      sellerType: "dealer", sourceType: "dealer_direct",
      condition: "used", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop",
      sellerName: 'Georgia Cart Pros',
      sellerPhone: '(770) 555-1156',
      sellerEmail: 'sales@georgiacartpros.com',
      description: "2023 Advanced EV 4PR with 3-inch lift. 105Ah lithium. Good for off-path use. Note: battery may be light for hills under load.",
    },
    // 12. Costco Retail - Bintelli Journey Lithium - Retail/National
    {
      title: "Bintelli Journey 4-Passenger Lithium 150Ah – Retail / Costco",
      brand: "Bintelli", model: "Journey", year: 2024,
      city: "Jacksonville", state: "FL", zip: "32202",
      askingPrice: undefined, regularPrice: 12499, salePrice: 10999,
      estimatedDeliveryCost: 499,
      batteryType: "lithium", batteryAh: 150,
      seating: 4, lifted: false, streetLegalClaimed: false,
      chargerIncluded: "yes", warrantyIncluded: "yes",
      warrantyProvider: "retailer", warrantyMonths: 12,
      batteryWarrantyIncluded: "yes",
      deliveryAvailable: true, deliveryIncluded: false,
      sellerType: "retail", sourceType: "retail_manual",
      retailerName: "Costco Wholesale",
      retailerProductUrl: "https://www.costco.com",
      availabilityStatus: "In Stock – Limited",
      shipToStates: JSON.stringify(["FL", "GA"]),
      lastVerifiedAt: new Date().toISOString().split("T")[0],
      condition: "new", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop",
      sellerName: 'Costco (via Bintelli)',
      sellerPhone: '(800) 774-2678',
      sellerEmail: 'customerservice@costco.com',
      description: "Bintelli Journey 150Ah lithium from Costco. 4-passenger, charger included, retailer warranty.",
    },
    // 13. Fayetteville GA - Star EV Unknown Battery Age Private - Over Market
    {
      title: "2016 Star EV 4-Seat Electric – Fayetteville",
      brand: "Star EV", model: "Classic", year: 2016,
      city: "Fayetteville", state: "GA", zip: "30214",
      askingPrice: 7200, estimatedDeliveryCost: 350,
      batteryType: "lead_acid", batteryAgeMonths: undefined,
      seating: 4, lifted: false, streetLegalClaimed: false,
      chargerIncluded: "unknown", warrantyIncluded: "no",
      deliveryAvailable: false, deliveryIncluded: false,
      sellerType: "private", sourceType: "private_direct",
      condition: "used", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop",
      sellerName: 'Private Seller',
      sellerPhone: '(770) 555-1308',
      sellerEmail: 'fayetteville13@owner.local',
      description: "2016 Star EV. Battery age unknown. Selling as-is. Buyer responsible for transport.",
    },
    // 14. Gainesville FL - Club Car Onward Lithium 105Ah - GREAT DEAL (asking well below market)
    {
      title: "2021 Club Car Onward 48V Lithium – Gainesville (Estate Sale)",
      brand: "Club Car", model: "Onward", year: 2021,
      city: "Gainesville", state: "FL", zip: "32601",
      askingPrice: 5400, estimatedDeliveryCost: 199,
      batteryType: "lithium", batteryAh: 105, batteryAgeMonths: 24,
      seating: 4, lifted: false, streetLegalClaimed: false,
      chargerIncluded: "yes", warrantyIncluded: "no",
      deliveryAvailable: true, deliveryIncluded: false,
      sellerType: "private", sourceType: "private_direct",
      condition: "used", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop",
      sellerName: 'Private Seller',
      sellerPhone: '(352) 555-1421',
      sellerEmail: 'gainesville14@owner.local',
      description: "Estate sale. 2021 Club Car Onward with 105Ah lithium pack. Low hours, charger included. Priced to move quickly.",
    },
    // 15. Daytona Beach FL - EZGO RXV Lithium 105Ah - GOOD DEAL (5-10% below market)
    {
      title: "2020 E-Z-GO RXV Lithium 105Ah – Daytona Beach",
      brand: "E-Z-GO", model: "RXV", year: 2020,
      city: "Daytona Beach", state: "FL", zip: "32114",
      askingPrice: 5000, estimatedDeliveryCost: 249,
      batteryType: "lithium", batteryAh: 105, batteryAgeMonths: 36,
      seating: 4, lifted: false, streetLegalClaimed: false,
      chargerIncluded: "yes", warrantyIncluded: "no",
      deliveryAvailable: true, deliveryIncluded: false,
      sellerType: "private", sourceType: "private_direct",
      condition: "used", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop",
      sellerName: "Private Seller",
      sellerPhone: "(386) 555-1537",
      sellerEmail: "seller15@cartiq.local",
      sellerName: 'Private Seller',
      sellerPhone: '(386) 555-1537',
      sellerEmail: 'daytona15@owner.local',
      description: "2020 EZGO RXV with lithium retrofit. 105Ah pack installed 3 years ago. Charger included. Clean cart, motivated seller.",
    },
    // 17. Nocatee FL (St. Johns County) - Club Car Onward Lithium 105Ah - Private - Good Deal
    {
      title: "2022 Club Car Onward Lithium 105Ah 4-Seat – Nocatee",
      brand: "Club Car", model: "Onward", year: 2022,
      city: "Nocatee", state: "FL", zip: "32081",
      askingPrice: 7200, estimatedDeliveryCost: 199,
      batteryType: "lithium", batteryAh: 105, batteryAgeMonths: 18,
      seating: 4, lifted: false, streetLegalClaimed: false,
      chargerIncluded: "yes", warrantyIncluded: "no",
      deliveryAvailable: true, deliveryIncluded: false,
      sellerType: "private", sourceType: "private_direct",
      condition: "used", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=800&auto=format&fit=crop",
      sellerName: "Private Seller",
      sellerPhone: "(352) 555-1421",
      sellerEmail: "seller14@cartiq.local",
      sellerName: "Private Seller",
      sellerPhone: "(904) 555-1762",
      sellerEmail: "seller17@cartiq.local",
      sellerName: 'Private Seller',
      sellerPhone: '(904) 555-1762',
      sellerEmail: 'nocatee17@owner.local',
      description: "2022 Club Car Onward with 105Ah lithium pack. Used in Nocatee community for neighborhood errands and trail paths. Low hours, charger included. Relocating, priced to sell.",
    },
    // 18. The Villages FL (senior community) - EZGO RXV Lithium 105Ah - Private - Fair Price
    {
      title: "2021 E-Z-GO RXV Lithium 105Ah 4-Seat – The Villages",
      brand: "E-Z-GO", model: "RXV", year: 2021,
      city: "The Villages", state: "FL", zip: "32162",
      askingPrice: 6200, estimatedDeliveryCost: 350,
      batteryType: "lithium", batteryAh: 105, batteryAgeMonths: 24,
      seating: 4, lifted: false, streetLegalClaimed: false,
      chargerIncluded: "yes", warrantyIncluded: "no",
      deliveryAvailable: false, deliveryIncluded: false,
      sellerType: "private", sourceType: "private_direct",
      condition: "used", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800&auto=format&fit=crop",
      sellerName: "Private Seller",
      sellerPhone: "(352) 555-1873",
      sellerEmail: "villages18@owner.local",
      description: "2021 EZGO RXV with lithium retrofit. Used exclusively on The Villages cart paths. Very low mileage. Charger included. Owner upgrading to 6-passenger.",
    },
    // 16. Augusta GA - Yamaha Drive2 Lithium 105Ah - FAIR PRICE (within 5% of market)
    {
      title: "2020 Yamaha Drive2 QuieTech Lithium 105Ah – Augusta",
      brand: "Yamaha", model: "Drive2 QuieTech", year: 2020,
      city: "Augusta", state: "GA", zip: "30901",
      askingPrice: 5600, estimatedDeliveryCost: 249,
      batteryType: "lithium", batteryAh: 105, batteryAgeMonths: 30,
      seating: 4, lifted: false, streetLegalClaimed: false,
      chargerIncluded: "yes", warrantyIncluded: "no",
      deliveryAvailable: true, deliveryIncluded: false,
      sellerType: "private", sourceType: "private_direct",
      condition: "used", powerType: "electric",
      imageUrl: "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&auto=format&fit=crop",
      sellerName: 'Private Seller',
      sellerPhone: '(706) 555-1649',
      sellerEmail: 'augusta16@owner.local',
      description: "2020 Yamaha Drive2 QuieTech with lithium pack. 105Ah, charger included. Well maintained, recent tune-up.",
    },
  ];

  for (const data of listingsData) {
    if (!storage.hasListing(slugify(`${data.brand}-${data.model}-${data.city}`))) {
      try {
        storage.createListing(makeListing(data) as any);
      } catch (e) {
        // Slug collision — just continue
      }
    }
  }

  // ─── SEO Articles ──────────────────────────────────────────────────────────
  const articles: InsertSeoArticle[] = [
    {
      title: "Lithium vs Lead-Acid Golf Cart Batteries: Which Is Better?",
      slug: "lithium-vs-lead-acid-golf-cart-batteries",
      metaDescription: "Compare lithium and lead-acid golf cart batteries. Learn which is better for Florida and Georgia buyers in terms of range, lifespan, cost, and resale value.",
      canonicalPath: "/buyer-guide/lithium-vs-lead-acid-golf-cart-batteries",
      primaryKeyword: "lithium vs lead-acid golf cart batteries",
      secondaryKeywords: JSON.stringify(["golf cart battery comparison", "best golf cart battery Florida", "lithium golf cart battery 2024"]),
      h1: "Lithium vs Lead-Acid Golf Cart Batteries: A Buyer's Guide",
      shortAnswer: "Lithium batteries last 3–5x longer than lead-acid, require no maintenance, and hold voltage better under load. For most Florida and Georgia buyers, lithium is worth the premium — especially for 4+ seat carts, lifted carts, or carts used daily.",
      body: `## The Short Answer\n\nIf you are comparing a lithium golf cart to a lead-acid golf cart at similar prices, lithium is almost always the better long-term value — especially in Florida and Georgia where carts are used year-round.\n\n## What Is a Lead-Acid Golf Cart Battery?\n\nLead-acid batteries are the traditional power source for electric golf carts. A set of 6 or 8 batteries (6V each) is wired together to produce 36V or 48V. They are heavy, require periodic water refilling (wet cell), and degrade over 3–5 years.\n\n**Average lifespan:** 3–5 years with proper maintenance.\n\n**Replacement cost in Florida/Georgia:** $800–$1,500 for a full set.\n\n## What Is a Lithium Golf Cart Battery?\n\nLithium iron phosphate (LiFePO4) batteries are a modern replacement. A single lithium pack replaces the full set of lead-acid batteries. They are lighter, maintenance-free, charge faster, and last 8–12+ years.\n\n**Average lifespan:** 8–12 years.\n\n**Replacement cost:** $2,000–$4,000 for a premium lithium pack.\n\n## Comparison Table\n\n| Feature | Lithium | Lead-Acid |\n|---|---|---|\n| Lifespan | 8–12+ years | 3–5 years |\n| Weight | 60–90 lbs | 200–350 lbs |\n| Maintenance | None | Monthly watering |\n| Charge time | 2–4 hours | 8–12 hours |\n| Voltage consistency | High | Drops under load |\n| Range per charge | Longer | Shorter |\n| Upfront cost | Higher | Lower |\n| Long-term value | Better | Lower |\n\n## CartIQ Buyer Tip\n\nIf you see a used cart priced the same with lithium vs lead-acid, strongly prefer the lithium — unless the lead-acid batteries are brand new (under 12 months). Old lead-acid batteries on a used cart can easily cost $1,000+ to replace.\n\n## Questions to Ask the Seller\n\n- How old are the batteries?\n- Is the charger included and matched to the battery type?\n- Is there a battery warranty?\n- Has the cart ever had battery problems or slow charging?`,
      faqJson: JSON.stringify([
        { q: "Is lithium better than lead-acid for a golf cart?", a: "Yes, in most cases. Lithium lasts 8–12 years vs 3–5 for lead-acid, is maintenance-free, lighter, and holds voltage better under load. The higher upfront cost is typically offset by savings on replacement and maintenance." },
        { q: "How long do lead-acid golf cart batteries last?", a: "Lead-acid golf cart batteries typically last 3–5 years with proper maintenance. In hot climates like Florida and Georgia, lifespan can be shorter if the cart is used heavily or the batteries are not watered regularly." },
        { q: "How much does it cost to replace golf cart batteries in Florida?", a: "A full set of lead-acid batteries costs $800–$1,500 installed in Florida. A lithium replacement pack runs $2,000–$4,000 installed." },
      ]),
      published: true,
    },
    {
      title: "105Ah vs 150Ah Golf Cart Battery: Which Size Is Right for You?",
      slug: "105ah-vs-150ah-golf-cart-battery",
      metaDescription: "Understand the difference between 105Ah and 150Ah golf cart batteries. Learn which size is right for your setup in Florida and Georgia.",
      canonicalPath: "/buyer-guide/105ah-vs-150ah-golf-cart-battery",
      primaryKeyword: "105Ah vs 150Ah golf cart battery",
      secondaryKeywords: JSON.stringify(["golf cart battery size", "lithium golf cart 150Ah", "golf cart range comparison"]),
      h1: "105Ah vs 150Ah Golf Cart Battery: A Buyer's Size Guide",
      shortAnswer: "105Ah is fine for standard 2–4 passenger neighborhood use. Choose 150Ah if you have a 6-seat cart, a lifted cart, ride on hills, carry heavy loads, or want extra range.",
      body: `## What Does Ah Mean?\n\nAh stands for Ampere-hours — it measures how much energy the battery can store and deliver. A higher Ah means more range per charge and better performance under load.\n\n## When 105Ah Is Enough\n\n- 2 or 4 passenger cart\n- Flat neighborhood or community use\n- Rides under 15–20 miles per charge\n- No heavy accessories (stereo, LED lights, cooler)\n- Standard (non-lifted) cart\n\n## When 150Ah Is Better\n\n- 6-passenger carts\n- Lifted carts (lift kits increase power draw)\n- Hilly terrain\n- Longer rides (20+ miles per charge)\n- Heavy accessory loads\n- Buyers with range anxiety\n\n## Comparison Table\n\n| Feature | 105Ah | 150Ah |\n|---|---|---|\n| Range (approx.) | 25–35 miles | 40–55 miles |\n| Best for | 2–4 seat, flat, neighborhood | 6-seat, lifted, hills, long rides |\n| Typical price premium | — | $500–$1,500 more |\n| Weight difference | Lighter | Heavier |\n\n## CartIQ Red Flag\n\nIf a listing shows a 6-seat or lifted cart with 105Ah, CartIQ will flag it: *Battery size may be light for this setup.* This is not a deal-breaker, but confirm real-world range with full passengers before buying.\n\n## Questions to Ask the Seller\n\n- What is the exact battery Ah rating?\n- How far can you realistically ride on one charge with 4–6 passengers?\n- Has range decreased since you bought it?`,
      faqJson: JSON.stringify([
        { q: "What does 105Ah mean on a golf cart battery?", a: "105Ah means the battery can deliver 105 ampere-hours of energy. In practice, this translates to roughly 25–35 miles of range for a standard 4-passenger cart on flat terrain." },
        { q: "Is 150Ah worth it for a golf cart?", a: "Yes, if you have a 6-seat cart, a lifted cart, ride on hills, or want longer range. 150Ah adds roughly 15–20 miles of range vs 105Ah and handles heavier power loads better. The premium is usually $500–$1,500." },
        { q: "Can I upgrade from 105Ah to 150Ah?", a: "Yes, most lithium pack systems can be swapped. Confirm the new pack is compatible with your cart's voltage and motor system before purchasing." },
      ]),
      published: true,
    },
    {
      title: "Does a Used Golf Cart Include a Charger? What Buyers Should Know",
      slug: "does-a-used-golf-cart-include-a-charger",
      metaDescription: "Find out if used golf carts typically include a charger and how much it costs if they don't. Essential reading for Florida and Georgia cart buyers.",
      canonicalPath: "/buyer-guide/does-a-used-golf-cart-include-a-charger",
      primaryKeyword: "does used golf cart include charger",
      secondaryKeywords: JSON.stringify(["golf cart charger cost", "golf cart charger compatible", "buying a golf cart Florida"]),
      h1: "Does a Used Golf Cart Include a Charger?",
      shortAnswer: "Not always. Many private sellers include the original charger, but some do not — especially if they lost it, sold it separately, or converted to lithium without getting a new charger. Always confirm before buying.",
      body: `## Why the Charger Matters\n\nA golf cart charger is not universal. Chargers must match the cart's voltage (36V or 48V) and battery type (lead-acid vs lithium). Using the wrong charger can damage the battery.\n\n## What Happens If It Is Not Included?\n\nYou will need to buy a compatible replacement. Budget:\n\n- Lead-acid charger: $100–$250\n- Basic lithium charger: $200–$400\n- Premium lithium smart charger: $400–$700\n\n## CartIQ Buyer Tip\n\nIf the listing says charger is unknown or not included, CartIQ adds this to your buyer score calculation. Subtract $150–$400 from the asking price in your negotiation to account for charger replacement.\n\n## Questions to Ask the Seller\n\n- Is the original charger included?\n- What brand and model is the charger?\n- Is it matched to the battery type (lithium vs lead-acid)?\n- Does it fully charge the cart in a reasonable time?\n- Is there any issue with charging currently?`,
      faqJson: JSON.stringify([
        { q: "Should a used golf cart include a charger?", a: "Ideally yes, but many private sellers sell without the charger. Always ask before buying. A missing charger can cost $150–$700 to replace." },
        { q: "How much should I deduct if the charger is missing?", a: "Budget $150–$400 for a lead-acid charger, or $200–$700 for a lithium charger. Deduct this from your negotiation. CartIQ factors charger inclusion into the buyer score." },
        { q: "Can I use any charger on a golf cart?", a: "No. Chargers must match the cart's voltage (36V or 48V) and battery type (lithium or lead-acid). Using the wrong charger can permanently damage the battery." },
      ]),
      published: true,
    },
    {
      title: "How to Know If a Golf Cart Is Street Legal",
      slug: "how-to-know-if-a-golf-cart-is-street-legal",
      metaDescription: "Learn what makes a golf cart street legal in Florida and Georgia. What equipment is required, how to verify LSV registration, and what to ask the seller.",
      canonicalPath: "/buyer-guide/how-to-know-if-a-golf-cart-is-street-legal",
      primaryKeyword: "is golf cart street legal Florida",
      secondaryKeywords: JSON.stringify(["LSV golf cart Florida", "street legal golf cart Georgia", "golf cart VIN title"]),
      h1: "Is This Golf Cart Street Legal? A Florida and Georgia Buyer's Guide",
      shortAnswer: "A golf cart is only truly street legal if it is titled and registered as a Low-Speed Vehicle (LSV), has a VIN, and meets all equipment requirements. Lights and mirrors alone do not make it street legal.",
      body: `## Golf Cart vs Low-Speed Vehicle\n\nA standard golf cart is not street legal. A Low-Speed Vehicle (LSV) is a federally regulated vehicle class with a maximum speed of 20–25 mph that can be driven on roads with a 35 mph or lower speed limit.\n\nTo be street legal, the cart must be:\n\n1. Titled as an LSV\n2. Registered with the state (FL or GA)\n3. Equipped with required safety equipment\n4. Driven only on roads where LSVs are permitted\n\n## Required Equipment for LSV in Florida/Georgia\n\n- Seat belts\n- Side and rear-view mirrors\n- Turn signals\n- Brake lights\n- Headlights and taillights\n- Windshield\n- VIN (vehicle identification number)\n- License plate\n\n## CartIQ Warning\n\nIf a seller claims the cart is street legal but cannot provide a title, VIN, or registration, CartIQ flags it: *Seller claims street legal, but title/VIN/registration are not confirmed.*\n\n## Questions to Ask the Seller\n\n- Do you have a title for this cart as an LSV?\n- Is there a VIN?\n- Is it currently registered?\n- Does it have a plate?\n- Does it have seat belts, turn signals, brake lights, mirrors, and a windshield?\n- What roads can you legally drive it on?`,
      faqJson: JSON.stringify([
        { q: "What does street legal mean for a golf cart?", a: "Street legal means the cart is titled and registered as a Low-Speed Vehicle (LSV), has a VIN, and meets all required safety equipment: seat belts, mirrors, turn signals, brake lights, headlights, and a windshield." },
        { q: "Is a lifted golf cart worth more?", a: "A lift kit adds value — typically $400–$800 — but only if combined with the right battery size and condition. A lifted cart with small/old batteries may actually cost more to own." },
        { q: "Can I make my golf cart street legal in Florida?", a: "Yes, but it requires a VIN, professional conversion, full safety equipment, and LSV title registration. Not all carts can be converted. Work with a licensed dealer." },
      ]),
      published: true,
    },
    {
      title: "Used Golf Cart Warranty Guide: What to Expect and Ask For",
      slug: "used-golf-cart-warranty-guide",
      metaDescription: "Understand golf cart warranty types — dealer, manufacturer, third-party, and battery warranties. Know what to expect and what questions to ask before buying in Florida or Georgia.",
      canonicalPath: "/buyer-guide/used-golf-cart-warranty-guide",
      primaryKeyword: "golf cart warranty guide",
      secondaryKeywords: JSON.stringify(["golf cart dealer warranty Florida", "lithium battery warranty golf cart", "used golf cart warranty"]),
      h1: "Golf Cart Warranties: A Buyer's Guide to What Matters",
      shortAnswer: "A dealer warranty is a meaningful buyer confidence factor. A battery warranty — especially for lithium — is equally important. Always ask what the warranty covers, for how long, and whether it is transferable.",
      body: `## Types of Golf Cart Warranties\n\n**Dealer Warranty**\nProvided by the dealer. Typically covers parts and labor for 1–2 years. Ask exactly what is covered — drivetrain, electronics, battery, frame.\n\n**Manufacturer Warranty**\nIssued by the brand. Newer carts often include factory warranties. Confirm if it is transferable to a second owner.\n\n**Battery Warranty**\nSeparate from the cart warranty. Lithium batteries often come with 2–5 year manufacturer warranties. Confirm if it transfers.\n\n**Third-Party Warranty**\nAvailable from warranty companies. Varies widely in quality. Read the contract before relying on it.\n\n**No Warranty (Private / As-Is)**\nMost private sellers sell as-is. Budget for repairs.\n\n## CartIQ Buyer Tip\n\nA warranty improves buyer confidence — but it does not automatically make an overpriced cart a good deal. CartIQ adds warranty points to the buyer score but still shows the deal delta based on total delivered cost vs market value.\n\n## Questions to Ask the Seller\n\n- What exactly does the warranty cover?\n- How long does it last?\n- Is it from the dealer, manufacturer, or third party?\n- Is it transferable to a new buyer?\n- Is there a separate battery warranty?\n- Is the battery warranty transferable?`,
      faqJson: JSON.stringify([
        { q: "Does a dealer warranty make a cart worth more?", a: "Yes — a dealer warranty is a meaningful buyer confidence factor and adds value. CartIQ adds buyer score points for warranty inclusion. However, a warranty alone does not justify an over-market price." },
        { q: "Is a used golf cart warranty transferable?", a: "Sometimes. Dealer warranties often transfer; manufacturer warranties may not. Always ask before buying." },
        { q: "Should I buy a used golf cart with no warranty?", a: "Private sellers rarely offer warranties. Price in potential repair costs ($500–$2,000 for common issues). Budget accordingly and inspect the cart carefully — or hire an inspector." },
      ]),
      published: true,
    },
    {
      title: "10 Questions to Ask Before Buying a Used Golf Cart from Facebook Marketplace",
      slug: "questions-to-ask-before-buying-a-used-golf-cart",
      metaDescription: "Find out what questions to ask when buying a used golf cart on Facebook Marketplace in Florida or Georgia. Protect yourself from bad deals.",
      canonicalPath: "/buyer-guide/questions-to-ask-before-buying-a-used-golf-cart",
      primaryKeyword: "questions to ask buying used golf cart Facebook Marketplace",
      secondaryKeywords: JSON.stringify(["used golf cart buyer checklist", "golf cart Facebook Marketplace Florida", "avoid bad golf cart deal"]),
      h1: "10 Questions to Ask Before Buying a Used Golf Cart on Facebook Marketplace",
      shortAnswer: "Before paying for any used golf cart, ask about battery type and age, charger inclusion, street legal status, warranty, delivery, and any red flags. Use CartIQ's Deal Checker to analyze the deal before you meet the seller.",
      body: `## Why Facebook Marketplace Golf Cart Deals Carry Risk\n\nFacebook Marketplace is full of golf cart deals — but also full of overpriced, misrepresented, or problematic carts. Sellers sometimes inflate asking prices, hide battery age, or claim street legal status without proper registration.\n\n## Use CartIQ First\n\nBefore you message the seller, open CartIQ's Deal Checker, paste the listing URL, enter the details, and get a private deal analysis — including fair market value, buyer score, red flags, and questions to ask.\n\n## 10 Must-Ask Questions\n\n1. What type and brand are the batteries (lithium or lead-acid)?\n2. How old are the batteries?\n3. Is the charger included and matched to the battery type?\n4. Is this cart titled and registered as an LSV (street legal)?\n5. Does it have a VIN?\n6. Does it have all required street equipment (seat belts, mirrors, turn signals, brake lights, windshield)?\n7. Is there any dealer, manufacturer, or battery warranty still active?\n8. Can I see maintenance records?\n9. What is your delivery situation (can you deliver, is there a fee)?\n10. Why are you selling?\n\n## CartIQ Buyer Tip\n\nAlways check CartIQ's Deal Checker before making an offer. Enter the listing details and get your deal rating, buyer score, and a list of questions to ask — tailored to the specific cart.`,
      faqJson: JSON.stringify([
        { q: "What should I ask before buying a used golf cart from Facebook Marketplace?", a: "Ask about battery type, age, charger inclusion, street legal status, VIN, warranty, delivery, and why the seller is selling. Use CartIQ's Deal Checker to analyze fair value before you visit." },
        { q: "How do I know if a Facebook Marketplace golf cart deal is good?", a: "Use CartIQ's Deal Checker. Paste the listing URL, enter the details, and get a private report showing fair market value, delivery-adjusted total cost, buyer score, and red flags." },
        { q: "Are used golf carts on Facebook Marketplace reliable?", a: "Some are, some are not. The key risks are old or unknown batteries, no charger, inflated prices, and misrepresented street legal status. CartIQ helps you identify these risks before you buy." },
      ]),
      published: true,
    },
    {
      title: "Costco Golf Carts vs Dealer Golf Carts: Which Is the Better Deal?",
      slug: "costco-golf-carts-vs-dealer-golf-carts",
      metaDescription: "Compare Costco golf cart deals vs buying from a local dealer in Florida or Georgia. See which offers better value, warranty, and delivery.",
      canonicalPath: "/buyer-guide/costco-golf-carts-vs-dealer-golf-carts",
      primaryKeyword: "Costco golf carts vs dealer",
      secondaryKeywords: JSON.stringify(["Costco golf cart Florida", "buy golf cart Costco vs dealer", "best place to buy golf cart Florida"]),
      h1: "Costco Golf Carts vs Dealer Golf Carts: A Florida & Georgia Buyer's Comparison",
      shortAnswer: "Costco often offers competitive sale prices on new carts, but local dealers offer local delivery, test drives, trade-ins, service, and often warranty service. Use CartIQ to compare the total delivered cost of both options.",
      body: `## What Costco Offers\n\nCostco periodically offers golf carts — typically Bintelli or similar brands — at member-only prices during sale events. These are usually new carts with warranty, delivered to your home.\n\n**Costco advantages:**\n- Competitive sale pricing\n- Retailer warranty\n- Member satisfaction policy\n\n**Costco limitations:**\n- Limited model selection\n- No trade-in\n- No local dealer service\n- Availability varies by warehouse and state\n- Prices and availability change frequently\n\n## What a Local Dealer Offers\n\n**Dealer advantages:**\n- Wide model selection (new and used)\n- Test drive before buying\n- Trade-in value for your old cart\n- Local delivery and setup\n- On-site service and parts\n- Warranty service nearby\n- Negotiation possible\n\n**Dealer limitations:**\n- Pricing may be higher than Costco promotions\n- Warranty terms vary\n\n## CartIQ Comparison Tip\n\nAlways compare using total delivered cost — not just asking price. A $10,999 Costco cart with $499 delivery vs a $10,499 dealer cart with $199 delivery = $400 difference in total cost. CartIQ calculates this for you.\n\n## What to Compare\n\n| Factor | Costco/Retail | Local Dealer |\n|---|---|---|\n| Price | Often lower (sale events) | Negotiable |\n| Selection | Limited | Wide |\n| Delivery | Included or flat fee | Local, often available |\n| Warranty | Retailer warranty | Dealer + manufacturer |\n| Service | Manufacturer/third party | Local dealer |\n| Trade-in | No | Usually yes |\n\n## Questions to Ask Both\n\n- What is the all-in delivered price to my zip code?\n- What exactly does the warranty cover and for how long?\n- Is the battery warranty separate?\n- Is the charger included?\n- What happens if I need service?`,
      faqJson: JSON.stringify([
        { q: "Are Costco golf carts a good deal?", a: "During sale events, Costco often offers competitive new cart prices with retailer warranty. The key is comparing total delivered cost vs a local dealer — factor in delivery, warranty service location, and what's included." },
        { q: "What should I compare between Costco/retail golf carts and dealer golf carts?", a: "Compare: total delivered cost, warranty coverage and service location, battery type and Ah, charger inclusion, trade-in option, and available service nearby. CartIQ can run this comparison for you." },
        { q: "Does Costco offer golf cart delivery to Florida and Georgia?", a: "Costco golf cart availability and delivery varies by warehouse, state, and time of year. Always verify on Costco's site. CartIQ shows last-verified date for any Costco listing." },
      ]),
      published: true,
    },
  ];

  for (const article of articles) {
    if (!storage.hasSeoArticle(article.slug)) {
      storage.createSeoArticle(article);
    }
  }

  console.log("Seeding complete.");
}
