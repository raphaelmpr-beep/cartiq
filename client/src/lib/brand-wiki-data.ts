// ─── GolfCartIQ Brand Wiki Data ────────────────────────────────────────────
// Static wiki content for all 12 tracked brands.
// Last updated: June 2026

export type VerificationLevel = 'verified' | 'dealer_dependent' | 'limited_public' | 'not_verified';

export interface BrandWikiModel {
  name: string;
  type: string;
  topSpeed: string;
  range: string;
  msrp: string;
  notes?: string;
}

export interface BrandWiki {
  slug: string;
  dbBrand: string;
  name: string;
  tagline: string;
  badges: string[];
  summary: string;
  snapshot: {
    founded?: string;
    headquarters?: string;
    parentCompany?: string;
    assemblyLocation?: string;
    primaryMarket?: string;
    priceRange?: string;
    powerTypes?: string[];
    warrantyHighlight?: string;
  };
  manufacturerVerification: {
    level: VerificationLevel;
    notes: string;
  };
  commonModels: BrandWikiModel[];
  whatMakesDifferent: string[];
  buyerConfidenceNotes: string[];
  buyerChecklist: string[];
  similarBrands: string[];
  sources: Array<{ label: string; url: string }>;
  lastVerified: string;
}

const STANDARD_CHECKLIST = [
  'Confirm seller/dealer is authorized by the brand for warranty.',
  'Verify battery type (Lead Acid vs Lithium) and age.',
  'Ask for full warranty documentation before purchase.',
  'Confirm seating capacity matches your needs.',
  'Check if the cart is LSV-certified (street-legal) if needed.',
  'Test drive before committing.',
  'Verify charging equipment is included.',
  'Ask about service history and any prior damage.',
  'Confirm parts availability with your local dealer.',
  'Check that title and registration are clear.',
  'Ask about dealer service hours and turnaround time.',
];

export const BRAND_WIKI: BrandWiki[] = [
  // ─── 1. Club Car ──────────────────────────────────────────────────────────
  {
    slug: 'club-car',
    dbBrand: 'Club Car',
    name: 'Club Car',
    tagline: 'The aluminum-frame legacy brand built for coastal durability.',
    badges: ['Legacy Brand', 'Strong Parts Support'],
    summary:
      'Club Car is one of the three original golf cart manufacturers. Its signature aluminum unibody chassis resists rust better than steel-frame competitors — a meaningful advantage in Florida\'s coastal markets. The brand was acquired by Platinum Equity in 2021 and continues to manufacture in Augusta, GA.',
    snapshot: {
      founded: '1958',
      headquarters: 'Peachtree City, GA',
      parentCompany: 'Platinum Equity (since 2021; formerly Ingersoll Rand)',
      assemblyLocation: 'Augusta, GA (verified)',
      primaryMarket: 'Golf courses, retirement communities, personal/neighborhood use',
      priceRange: '$7,000–$18,000 new; $3,500–$11,000 used',
      powerTypes: ['Electric', 'Gas'],
      warrantyHighlight: '2-year limited factory warranty (gas/electric); lithium battery warranty varies by model',
    },
    manufacturerVerification: {
      level: 'verified',
      notes: 'Club Car is a well-documented legacy brand with publicly available manufacturing information. Assembly in Augusta, GA is confirmed via press releases, SEC filings (Ingersoll Rand era), and dealer documentation.',
    },
    commonModels: [
      { name: 'Onward 4', type: 'Personal Use / LSV', topSpeed: '19–25 mph', range: '30–50 mi (lithium)', msrp: '$10,500–$15,500', notes: 'Flagship consumer model; most customization options' },
      { name: 'Onward 2', type: 'Personal Use / LSV', topSpeed: '19–25 mph', range: '30–50 mi (lithium)', msrp: '$9,000–$13,000', notes: '2-passenger version' },
      { name: 'Precedent i2', type: 'Golf / Personal Use', topSpeed: '15–19 mph', range: '25–40 mi', msrp: '$7,500–$11,000', notes: 'Most common used inventory model' },
      { name: 'Tempo', type: 'Personal Use', topSpeed: '19 mph', range: '30–40 mi', msrp: '$8,500–$12,000', notes: 'Mid-range between Precedent and Onward' },
    ],
    whatMakesDifferent: [
      'Aluminum unibody frame — does not rust, critical advantage for Florida coastal buyers.',
      'One of the oldest and most supported parts networks in the industry.',
      'Lithium factory option available (Onward L series) — not just an aftermarket conversion.',
      'Acquired by Platinum Equity in 2021; manufacturing and quality standards maintained post-acquisition.',
      'Strong resale value — Onward models hold value well in the used market.',
    ],
    buyerConfidenceNotes: [
      'Parts are widely available across Florida and Georgia — most golf cart service shops stock Club Car components.',
      'Factory lithium models come with manufacturer warranty on the battery pack — confirm terms with dealer.',
      'Used Precedent models are the most common second-hand Club Car — battery age is the key inspection point.',
      'Club Car has 60+ years of service documentation — historical repair data is available for most models.',
    ],
    buyerChecklist: STANDARD_CHECKLIST,
    similarBrands: ['e-z-go', 'yamaha', 'icon'],
    sources: [
      { label: 'Club Car Official Site', url: 'https://www.clubcar.com' },
      { label: 'Platinum Equity Acquisition (2021)', url: 'https://www.platinumequity.com/news/platinum-equity-completes-acquisition-of-club-car-from-ingersoll-rand' },
    ],
    lastVerified: 'June 2026',
  },

  // ─── 2. E-Z-GO ────────────────────────────────────────────────────────────
  {
    slug: 'e-z-go',
    dbBrand: 'E-Z-GO',
    name: 'E-Z-GO',
    tagline: 'The world\'s largest golf cart brand by installed base.',
    badges: ['Legacy Brand', 'Strong Parts Support'],
    summary:
      'E-Z-GO is a division of Textron Inc. and holds the largest installed base of any golf cart brand globally. Founded in 1954 in Augusta, GA, the brand is known for its AC-motor RXV series and widespread parts availability across the U.S. The RXV features regenerative braking — a technology advantage over many competitors.',
    snapshot: {
      founded: '1954',
      headquarters: 'Augusta, GA',
      parentCompany: 'Textron Inc.',
      assemblyLocation: 'Augusta, GA (verified)',
      primaryMarket: 'Golf courses, fleet, retirement communities, personal use',
      priceRange: '$6,000–$16,000 new; $3,000–$10,000 used',
      powerTypes: ['Electric', 'Gas'],
      warrantyHighlight: '2-year limited factory warranty standard',
    },
    manufacturerVerification: {
      level: 'verified',
      notes: 'E-Z-GO is a publicly traded subsidiary of Textron Inc. (NYSE: TXT). Manufacturing location and corporate structure are fully documented in SEC filings and press materials.',
    },
    commonModels: [
      { name: 'RXV Elite', type: 'Personal / LSV', topSpeed: '19.5 mph', range: '40–55 mi (ELiTE lithium)', msrp: '$9,500–$14,500', notes: 'AC motor with regenerative braking; ELiTE lithium option' },
      { name: 'TXT Fleet', type: 'Fleet / Golf', topSpeed: '15 mph', range: '25–36 mi', msrp: '$6,500–$9,000', notes: 'Most-produced model in history; DC motor' },
      { name: 'Freedom RXV', type: 'Personal Use', topSpeed: '19 mph', range: '35–50 mi', msrp: '$8,500–$12,000', notes: 'Consumer variant of the RXV' },
      { name: 'Express L6', type: 'Personal / LSV (6-passenger)', topSpeed: '19–25 mph', range: '30–45 mi', msrp: '$12,000–$16,000', notes: 'Street-legal 6-passenger platform' },
    ],
    whatMakesDifferent: [
      'Largest installed base globally — more parts, more service shops, more used inventory.',
      'RXV uses an AC motor with regenerative braking — extends battery life and range.',
      'ELiTE lithium option is factory-installed with a 5-year battery warranty.',
      'Strong fleet and golf course heritage — well-tested durability at scale.',
      'Parts are available at virtually every golf cart dealer in FL and GA.',
    ],
    buyerConfidenceNotes: [
      'The TXT is the most common used model — verify battery age and motor controller condition.',
      'RXV AC motor is more efficient and longer-lasting than older DC-motor designs.',
      'E-Z-GO ELiTE lithium factory packs come with a 5-year limited battery warranty.',
      'Very high resale liquidity — E-Z-GO TXT and RXV models are the easiest to sell in the used market.',
    ],
    buyerChecklist: STANDARD_CHECKLIST,
    similarBrands: ['club-car', 'yamaha', 'icon'],
    sources: [
      { label: 'E-Z-GO Official Site', url: 'https://www.ezgo.com' },
      { label: 'Textron Inc. (NYSE: TXT)', url: 'https://www.textron.com' },
    ],
    lastVerified: 'June 2026',
  },

  // ─── 3. Yamaha ────────────────────────────────────────────────────────────
  {
    slug: 'yamaha',
    dbBrand: 'Yamaha',
    name: 'Yamaha',
    tagline: 'Japanese engineering reliability, assembled in the American South.',
    badges: ['Legacy Brand', 'Strong Parts Support'],
    summary:
      'Yamaha Motor Co. has manufactured golf cars since 1979. Yamaha\'s U.S. golf car division assembles vehicles in Newnan, GA, making it one of the few major brands with verifiable domestic assembly. The QuieTech gas models are among the quietest gas-powered carts on the market, and the Drive2 platform is well-regarded for build quality.',
    snapshot: {
      founded: '1979 (golf cars)',
      headquarters: 'Kennesaw, GA (U.S. golf car division)',
      parentCompany: 'Yamaha Motor Co. Ltd. (Japan)',
      assemblyLocation: 'Newnan, GA (verified)',
      primaryMarket: 'Golf courses, personal/community use, resort fleets',
      priceRange: '$6,500–$16,000 new; $3,000–$10,000 used',
      powerTypes: ['Electric', 'Gas'],
      warrantyHighlight: '2-year limited factory warranty; QuieTech EFI gas engine has separate drivetrain coverage',
    },
    manufacturerVerification: {
      level: 'verified',
      notes: 'Yamaha Motor Co. is a publicly listed company (Tokyo Stock Exchange). U.S. assembly at Newnan, GA is confirmed by Yamaha corporate press materials and dealer documentation.',
    },
    commonModels: [
      { name: 'Drive2 QuieTech EFI', type: 'Gas / Personal', topSpeed: '19 mph', range: 'N/A (gas)', msrp: '$8,000–$12,000', notes: 'Quietest gas cart; fuel-injected' },
      { name: 'Drive2 PTV', type: 'Electric / Personal', topSpeed: '19 mph', range: '30–40 mi', msrp: '$7,500–$11,000', notes: 'Electric personal transport vehicle' },
      { name: 'Umax Rally', type: 'Utility / Personal (2-passenger)', topSpeed: '16 mph', range: '25–35 mi', msrp: '$7,000–$10,000' },
      { name: 'Concierge 6', type: 'Personal (6-passenger)', topSpeed: '19 mph', range: '30–40 mi', msrp: '$11,000–$15,000', notes: '6-passenger personal transport' },
    ],
    whatMakesDifferent: [
      'QuieTech gas models are the quietest gas-powered carts available — notable for neighborhood and resort use.',
      'Japanese brand heritage with Newnan, GA assembly — strong quality control reputation.',
      'Drive2 platform is widely praised for smooth ride quality and long-term reliability.',
      'Strong golf course heritage ensures service familiarity across most FL and GA golf facilities.',
      'Fuel injection on EFI models improves cold-start performance and fuel economy vs carburetor models.',
    ],
    buyerConfidenceNotes: [
      'Yamaha\'s brand reputation is well-established — parts are available from most major golf cart dealers.',
      'Used Drive2 models are widely available and well-documented for service.',
      'Gas QuieTech models are worth a premium if noise is a concern in your community.',
      'Yamaha\'s factory warranty is comparable to Club Car and E-Z-GO — standard 2-year limited coverage.',
    ],
    buyerChecklist: STANDARD_CHECKLIST,
    similarBrands: ['club-car', 'e-z-go', 'icon'],
    sources: [
      { label: 'Yamaha Golf Car Official Site', url: 'https://www.yamahacarriers.com' },
      { label: 'Yamaha Motor Co. Ltd.', url: 'https://www.yamaha-motor.com' },
    ],
    lastVerified: 'June 2026',
  },

  // ─── 4. Evolution ─────────────────────────────────────────────────────────
  {
    slug: 'evolution',
    dbBrand: 'Evolution',
    name: 'Evolution',
    tagline: 'Lithium-first value with a Pompano Beach, FL pedigree.',
    badges: ['Modern EV Brand', 'LSV Focused'],
    summary:
      'Evolution Electric Vehicles is headquartered in Pompano Beach, FL and has grown rapidly by offering lithium-equipped carts at below-premium price points. The Classic, Carrier, and Forester series cover most buyer needs — from neighborhood commuters to outdoor utility builds — with lithium as standard across the lineup.',
    snapshot: {
      headquarters: 'Pompano Beach, FL',
      parentCompany: 'Evolution Electric Vehicles (independent)',
      assemblyLocation: 'Not publicly disclosed (dealer-dependent verification)',
      primaryMarket: 'Personal use, neighborhood/community, outdoor utility',
      priceRange: '$8,000–$16,000 new',
      powerTypes: ['Electric (Lithium standard)'],
      warrantyHighlight: 'Warranty terms vary by dealer — confirm in writing before purchase',
    },
    manufacturerVerification: {
      level: 'dealer_dependent',
      notes: 'Evolution EV\'s assembly location and manufacturing partners are not publicly disclosed in detail. Corporate headquarters is confirmed at Pompano Beach, FL. Warranty terms are dealer-administered and vary — request documentation before purchase.',
    },
    commonModels: [
      { name: 'D5 Maverick', type: 'Personal / LSV (4-passenger)', topSpeed: '25 mph', range: '35–50 mi', msrp: '$9,500–$13,000', notes: 'Base LSV model; lithium standard' },
      { name: 'D5 Ranger', type: 'Personal / LSV (4-passenger)', topSpeed: '25 mph', range: '35–50 mi', msrp: '$10,500–$14,000', notes: 'Mid-tier; upgraded features' },
      { name: 'D6 Maverick', type: 'Personal / LSV (6-passenger)', topSpeed: '25 mph', range: '30–45 mi', msrp: '$13,000–$16,000', notes: '6-passenger LSV' },
      { name: 'D5 Maverick Plus', type: 'Personal / LSV (4-passenger)', topSpeed: '25 mph', range: '40–55 mi', msrp: '$11,000–$14,500', notes: 'Larger battery option' },
    ],
    whatMakesDifferent: [
      'Florida-based headquarters — dealer support network is strongest in the Southeast.',
      'Lithium as standard across entire lineup — not an upgrade option.',
      'Competitive pricing vs Club Car and E-Z-GO lithium models at similar specs.',
      'Forester series adds outdoor ruggedness without the premium price of traditional brands.',
      'Growing dealer footprint — more Evolution dealers opening across FL and GA annually.',
    ],
    buyerConfidenceNotes: [
      'Verify the specific lithium battery brand and warranty terms at the dealer level — not all Evolution lithium packs are identical.',
      'Evolution is not affiliated with a major legacy manufacturer — service is dealer-dependent.',
      'Parts availability varies by dealer — confirm your local dealer stocks Evolution parts before purchasing.',
      'Strong value-for-money reputation in Florida buyer communities.',
    ],
    buyerChecklist: STANDARD_CHECKLIST,
    similarBrands: ['icon', 'bintelli', 'club-car'],
    sources: [
      { label: 'Evolution Electric Vehicles', url: 'https://evolutionelectricvehicle.com' },
    ],
    lastVerified: 'June 2026',
  },

  // ─── 5. ICON ──────────────────────────────────────────────────────────────
  {
    slug: 'icon',
    dbBrand: 'ICON',
    name: 'ICON',
    tagline: 'Jacksonville-assembled, lithium-standard, and growing fast.',
    badges: ['Modern EV Brand', 'LSV Focused'],
    summary:
      'ICON EV is headquartered and assembles its carts in Jacksonville, FL — making it one of the few modern EV brands with verified U.S. assembly. The brand has captured significant market share by including lithium batteries as standard across most models, with pricing that competes directly with Club Car and E-Z-GO at similar spec levels.',
    snapshot: {
      founded: '2016',
      headquarters: 'Jacksonville, FL',
      parentCompany: 'ICON EV (independent)',
      assemblyLocation: 'Jacksonville, FL (verified)',
      primaryMarket: 'Personal use, neighborhood/LSV, community',
      priceRange: '$9,500–$18,000 new',
      powerTypes: ['Electric (Lithium standard)'],
      warrantyHighlight: '2-year limited manufacturer warranty; battery warranty varies by model',
    },
    manufacturerVerification: {
      level: 'verified',
      notes: 'ICON EV\'s Jacksonville, FL assembly facility is confirmed via corporate press materials, dealer documentation, and multiple third-party reviews. The company is independent (not a subsidiary of a legacy manufacturer).',
    },
    commonModels: [
      { name: 'i40', type: 'Personal / LSV (4-passenger)', topSpeed: '25 mph', range: '40–60 mi', msrp: '$11,000–$14,500', notes: 'Best-selling ICON model; lithium standard' },
      { name: 'i40L', type: 'Personal / LSV (4-passenger, lifted)', topSpeed: '25 mph', range: '40–60 mi', msrp: '$12,000–$15,500', notes: 'Lifted variant with more ground clearance' },
      { name: 'i60', type: 'Personal / LSV (6-passenger)', topSpeed: '25 mph', range: '35–50 mi', msrp: '$14,000–$18,000', notes: '6-passenger platform' },
      { name: 'i20', type: 'Personal (2-passenger)', topSpeed: '19–25 mph', range: '40–55 mi', msrp: '$9,500–$12,000', notes: 'Entry model' },
    ],
    whatMakesDifferent: [
      'Jacksonville, FL assembly is confirmed — one of few modern EV brands with verified U.S. manufacturing.',
      'Lithium standard across most models — buyers are not paying extra for what should be included.',
      'Growing dealer network with particularly strong Florida coverage.',
      'The "L" suffix (i40L, i60L) denotes lifted models with increased ground clearance for outdoor use.',
      'Strong resale value in FL market due to brand recognition and parts availability.',
    ],
    buyerConfidenceNotes: [
      'ICON is one of the most actively serviced modern EV brands in Florida — parts and warranty service are available at most authorized dealers.',
      'Do not pay extra for lithium as an "upgrade" — it should be standard on most ICON models.',
      'Compare ICON i40 pricing directly against Club Car Onward and Evolution D5 Maverick at similar spec levels.',
      'ICON\'s independent status means service is dealer-administered — confirm your dealer is authorized.',
    ],
    buyerChecklist: STANDARD_CHECKLIST,
    similarBrands: ['evolution', 'bintelli', 'club-car'],
    sources: [
      { label: 'ICON EV Official Site', url: 'https://iconev.com' },
    ],
    lastVerified: 'June 2026',
  },

  // ─── 6. Bintelli ──────────────────────────────────────────────────────────
  {
    slug: 'bintelli',
    dbBrand: 'Bintelli',
    name: 'Bintelli',
    tagline: '8-year EcoBattery warranty and Charleston-rooted value.',
    badges: ['Modern EV Brand', 'LSV Focused'],
    summary:
      'Bintelli is a Charleston, SC-based golf cart brand that has differentiated itself through an 8-year EcoBattery warranty — one of the longest battery warranties in the segment. The Beyond series is the flagship platform, covering 2-, 4-, and 6-passenger configurations with lithium standard.',
    snapshot: {
      headquarters: 'Charleston, SC',
      parentCompany: 'Bintelli (independent)',
      assemblyLocation: 'Not publicly disclosed',
      primaryMarket: 'Personal use, neighborhood/LSV, coastal communities',
      priceRange: '$7,500–$14,000 new',
      powerTypes: ['Electric (Lithium / EcoBattery)'],
      warrantyHighlight: '8-year EcoBattery warranty through authorized dealers',
    },
    manufacturerVerification: {
      level: 'dealer_dependent',
      notes: 'Bintelli\'s assembly location is not publicly confirmed. Corporate headquarters is confirmed in Charleston, SC. The 8-year EcoBattery warranty is a defining brand claim — verify authorized dealer status before purchase to ensure warranty is valid.',
    },
    commonModels: [
      { name: 'Beyond 4L', type: 'Personal / LSV (4-passenger)', topSpeed: '25 mph', range: '40–60 mi', msrp: '$9,500–$13,000', notes: 'Flagship 4-passenger; EcoBattery standard' },
      { name: 'Beyond 6L', type: 'Personal / LSV (6-passenger)', topSpeed: '25 mph', range: '35–50 mi', msrp: '$12,000–$15,000', notes: '6-passenger platform' },
      { name: 'Beyond 2L', type: 'Personal (2-passenger)', topSpeed: '25 mph', range: '40–55 mi', msrp: '$8,000–$11,000', notes: 'Entry 2-passenger' },
    ],
    whatMakesDifferent: [
      '8-year EcoBattery warranty is among the longest battery warranties in the golf cart segment.',
      'Parent brand of Sivo — demonstrating manufacturing scale and diversification.',
      'Charleston, SC base with growing dealer presence in FL and GA coastal markets.',
      'Beyond series is LSV-ready out of the box on most configurations.',
      'Competitive pricing on lithium models relative to ICON and Club Car.',
    ],
    buyerConfidenceNotes: [
      'The 8-year EcoBattery warranty is only valid through authorized Bintelli dealers — confirm dealer authorization before purchase.',
      'Dealer network is growing in FL and GA but not yet as dense as ICON or legacy brands — confirm local service availability.',
      'Bintelli also manufactures the Sivo sub-brand — the two share engineering heritage.',
    ],
    buyerChecklist: STANDARD_CHECKLIST,
    similarBrands: ['icon', 'evolution', 'sivo'],
    sources: [
      { label: 'Bintelli Official Site', url: 'https://bintelli.com' },
    ],
    lastVerified: 'June 2026',
  },

  // ─── 7. Denago EV ─────────────────────────────────────────────────────────
  {
    slug: 'denago-ev',
    dbBrand: 'Denago EV',
    name: 'Denago EV',
    tagline: 'Emerging lithium brand with value-driven pricing.',
    badges: ['Emerging Brand', 'Dealer-Dependent Support', 'Manufacturing Not Clearly Verified'],
    summary:
      'Denago EV is an emerging electric golf cart brand offering lithium-equipped models at value-oriented price points. Third-party sources note a connection to TAO Motors, though Denago EV operates under its own branding. Manufacturing location and corporate structure are not clearly disclosed publicly.',
    snapshot: {
      headquarters: 'United States (exact location not publicly confirmed)',
      parentCompany: 'Not publicly disclosed; TAO Motors connection noted by 3rd-party sources',
      assemblyLocation: 'Not verified',
      primaryMarket: 'Personal use, neighborhood, value-oriented buyers',
      priceRange: '$8,000–$15,000 new',
      powerTypes: ['Electric (Lithium)'],
      warrantyHighlight: 'Warranty terms not uniformly disclosed — confirm with dealer',
    },
    manufacturerVerification: {
      level: 'limited_public',
      notes: 'Denago EV\'s manufacturing origin and corporate structure are not clearly disclosed in public materials. A TAO Motors connection has been noted by third-party reviewers. Warranty terms vary by dealer — request full documentation before purchase.',
    },
    commonModels: [
      { name: 'Com-Pac 4', type: 'Personal / LSV (4-passenger)', topSpeed: '25 mph', range: '35–50 mi', msrp: '$9,000–$13,000' },
      { name: 'Com-Pac 6', type: 'Personal / LSV (6-passenger)', topSpeed: '25 mph', range: '30–45 mi', msrp: '$12,000–$15,000' },
    ],
    whatMakesDifferent: [
      'Value pricing on lithium-equipped models — targets buyers priced out of ICON and Club Car.',
      'Growing dealer network in FL and GA.',
      'Modern styling with LSV-ready configurations.',
    ],
    buyerConfidenceNotes: [
      'Manufacturing origin is not clearly verified — ask the dealer directly about the factory of origin.',
      'Warranty coverage varies significantly by dealer — get all terms in writing.',
      'Parts availability is not yet well-documented — confirm service capability at your local dealer before committing.',
      'As an emerging brand, resale value is less established than ICON or legacy brands.',
    ],
    buyerChecklist: STANDARD_CHECKLIST,
    similarBrands: ['evolution', 'icon', 'venom-ev'],
    sources: [
      { label: 'Denago EV Official Site', url: 'https://denagobikes.com/golf-carts' },
    ],
    lastVerified: 'June 2026',
  },

  // ─── 8. DACH Vehicles ─────────────────────────────────────────────────────
  {
    slug: 'dach-vehicles',
    dbBrand: 'DACH',
    name: 'DACH Vehicles',
    tagline: 'Orlando-assembled modern EVs through Jeffrey Allen dealers.',
    badges: ['Modern EV Brand', 'Dealer-Dependent Support'],
    summary:
      'DACH Vehicles performs final assembly at 2001 Directors Row in Orlando, FL. The brand is distributed primarily through Jeffrey Allen Inc., which operates three Florida locations. Third-party sources note that chassis components are sourced from China, with final assembly and quality inspection conducted domestically.',
    snapshot: {
      headquarters: 'Orlando, FL',
      parentCompany: 'DACH Vehicles (independent)',
      assemblyLocation: 'Orlando, FL — 2001 Directors Row (final assembly confirmed; chassis sourced externally per 3rd-party sources)',
      primaryMarket: 'Personal use, neighborhood, LSV-ready buyers',
      priceRange: '$9,000–$16,000 new',
      powerTypes: ['Electric (Lithium)'],
      warrantyHighlight: 'Warranty administered through Jeffrey Allen dealers — confirm coverage in writing',
    },
    manufacturerVerification: {
      level: 'dealer_dependent',
      notes: 'Final assembly at 2001 Directors Row, Orlando FL is confirmed. Chassis sourcing from China noted by third-party sources. Warranty and service are administered exclusively through Jeffrey Allen dealer network — not available at general golf cart shops.',
    },
    commonModels: [
      { name: 'DACH 4-Passenger', type: 'Personal / LSV', topSpeed: '25 mph', range: '35–50 mi', msrp: '$10,000–$14,000', notes: 'Primary 4-seat model' },
      { name: 'DACH 6-Passenger', type: 'Personal / LSV', topSpeed: '25 mph', range: '30–45 mi', msrp: '$13,000–$16,000', notes: '6-seat platform' },
    ],
    whatMakesDifferent: [
      'Orlando, FL final assembly — one of the few brands with domestic finishing.',
      'Distributed through Jeffrey Allen Inc. — a well-established Florida dealer with 3 locations.',
      'Lithium-equipped models at competitive price points.',
    ],
    buyerConfidenceNotes: [
      'Service and warranty are tied to the Jeffrey Allen dealer network — confirm proximity to a Jeffrey Allen location before purchasing.',
      'Chassis sourcing is not fully disclosed — ask the dealer about parts availability outside the Jeffrey Allen network.',
      'DACH is a newer brand with a limited service footprint outside of Jeffrey Allen dealers.',
    ],
    buyerChecklist: STANDARD_CHECKLIST,
    similarBrands: ['evolution', 'icon', 'bintelli'],
    sources: [
      { label: 'Jeffrey Allen Inc.', url: 'https://jeffreyalleninc.com' },
    ],
    lastVerified: 'June 2026',
  },

  // ─── 9. Sivo ──────────────────────────────────────────────────────────────
  {
    slug: 'sivo',
    dbBrand: 'Sivo',
    name: 'Sivo',
    tagline: 'Bintelli\'s newest sub-brand, launched January 2026.',
    badges: ['Modern EV Brand', 'Emerging Brand', 'LSV Focused'],
    summary:
      'Sivo is a sub-brand of Bintelli, launched in January 2026. It shares the EcoBattery 8-year warranty heritage of its parent brand and is positioned as a slightly differentiated product line targeting buyers who want Bintelli engineering with distinct styling. As of mid-2026, Sivo is very new — dealer network and resale data are still limited.',
    snapshot: {
      founded: 'January 2026',
      headquarters: 'Charleston, SC (via Bintelli parent)',
      parentCompany: 'Bintelli',
      assemblyLocation: 'Not publicly disclosed (same supply chain as Bintelli)',
      primaryMarket: 'Personal use, neighborhood/LSV, coastal communities',
      priceRange: '$8,000–$14,000 new',
      powerTypes: ['Electric (Lithium / EcoBattery)'],
      warrantyHighlight: '8-year EcoBattery warranty (via Bintelli authorized dealers)',
    },
    manufacturerVerification: {
      level: 'dealer_dependent',
      notes: 'Sivo is a Bintelli sub-brand confirmed by Bintelli corporate. Launched January 2026 — extremely new. Assembly location follows Bintelli supply chain (not publicly disclosed). Warranty is backed by Bintelli\'s EcoBattery program.',
    },
    commonModels: [
      { name: 'Sivo 4L', type: 'Personal / LSV (4-passenger)', topSpeed: '25 mph', range: '40–60 mi', msrp: '$9,000–$12,500', notes: 'Primary 4-seat model' },
      { name: 'Sivo 6L', type: 'Personal / LSV (6-passenger)', topSpeed: '25 mph', range: '35–50 mi', msrp: '$11,500–$14,000', notes: '6-seat platform' },
    ],
    whatMakesDifferent: [
      'Backed by Bintelli\'s 8-year EcoBattery warranty — inherited from parent brand.',
      'Brand-new for 2026 — among the newest entries in the FL/GA market.',
      'Bintelli engineering heritage with distinct Sivo styling.',
    ],
    buyerConfidenceNotes: [
      'Very new brand — resale data does not yet exist. Treat as a long-hold purchase.',
      'Warranty is backed by Bintelli\'s EcoBattery program — verify the selling dealer is authorized by Bintelli.',
      'Dealer network is nascent — confirm service options before purchasing.',
      'Given Bintelli\'s established track record, the sub-brand is more credible than a fully unknown startup.',
    ],
    buyerChecklist: STANDARD_CHECKLIST,
    similarBrands: ['bintelli', 'icon', 'evolution'],
    sources: [
      { label: 'Bintelli (Parent Brand)', url: 'https://bintelli.com' },
    ],
    lastVerified: 'June 2026',
  },

  // ─── 10. Teko EV ──────────────────────────────────────────────────────────
  {
    slug: 'teko-ev',
    dbBrand: 'Teko EV',
    name: 'Teko EV',
    tagline: '#1 by listing count in FL/GA — with a lifetime chassis warranty.',
    badges: ['Modern EV Brand', 'LSV Focused', 'Warranty Details Needed'],
    summary:
      'Teko EV has the highest listing count of any emerging brand on GolfCartIQ in Florida and Georgia. The brand markets a lifetime chassis warranty alongside an 8-year LiFePO4 battery warranty (personal use only) and a 2-year parts warranty. Corporate and manufacturing details are not fully disclosed — verification is limited to dealer and brand website sources.',
    snapshot: {
      headquarters: 'Not publicly confirmed',
      parentCompany: 'Not publicly disclosed',
      assemblyLocation: 'Not verified',
      primaryMarket: 'Personal use, neighborhood, LSV-ready buyers',
      priceRange: '$9,000–$16,000 new',
      powerTypes: ['Electric (LiFePO4 Lithium)'],
      warrantyHighlight: 'Lifetime chassis + 8yr LiFePO4 battery (personal use only) + 2yr parts — full terms at tekoev.com/warranty',
    },
    manufacturerVerification: {
      level: 'limited_public',
      notes: 'Teko EV\'s manufacturing origin and corporate structure are not clearly disclosed in public materials. High listing count in FL/GA is confirmed by GolfCartIQ database. Warranty claims are sourced from tekoev.com — independent verification of warranty fulfillment is not available.',
    },
    commonModels: [
      { name: 'Teko 4-Passenger', type: 'Personal / LSV', topSpeed: '25 mph', range: '40–55 mi', msrp: '$10,000–$14,000', notes: 'Most common configuration in GolfCartIQ listings' },
      { name: 'Teko 6-Passenger', type: 'Personal / LSV', topSpeed: '25 mph', range: '35–50 mi', msrp: '$13,000–$16,000' },
    ],
    whatMakesDifferent: [
      '#1 emerging brand by listing count in FL and GA on GolfCartIQ — significant market presence.',
      'Lifetime chassis warranty is a bold claim — verify terms at tekoev.com/warranty before purchase.',
      '8-year LiFePO4 battery warranty for personal use — among the longest in the segment if honored.',
      'LiFePO4 chemistry is preferred for longevity and safety over standard lithium-ion.',
    ],
    buyerConfidenceNotes: [
      'High listing count indicates dealer enthusiasm — but verify the brand\'s warranty fulfillment history before relying on long-term warranty claims.',
      'The "personal use only" restriction on the battery warranty is important — commercial or rental use may void coverage.',
      'Ask the dealer for the full Teko EV warranty document (not just verbal confirmation).',
      'Manufacturing transparency is limited — ask the dealer directly about factory of origin and parts sourcing.',
    ],
    buyerChecklist: STANDARD_CHECKLIST,
    similarBrands: ['venom-ev', 'evolution', 'icon'],
    sources: [
      { label: 'Teko EV Warranty Page', url: 'https://tekoev.com/warranty' },
      { label: 'Teko EV Official Site', url: 'https://tekoev.com' },
    ],
    lastVerified: 'June 2026',
  },

  // ─── 11. Verdi ────────────────────────────────────────────────────────────
  {
    slug: 'verdi',
    dbBrand: 'Verdi',
    name: 'Verdi',
    tagline: 'Oversized 150Ah battery pack — more range out of the box.',
    badges: ['Emerging Brand', 'Dealer-Dependent Support', 'Manufacturing Not Clearly Verified'],
    summary:
      'Verdi is an emerging electric golf cart brand notable for shipping with a 51.7V 150Ah battery pack as standard — meaningfully larger than the 105Ah found on most competitors. The primary Florida dealer is Discovery Golf Cars, serving the Tampa Bay area. Manufacturing headquarters and assembly location are not publicly disclosed.',
    snapshot: {
      headquarters: 'Not publicly confirmed',
      parentCompany: 'Not publicly disclosed',
      assemblyLocation: 'Not verified',
      primaryMarket: 'Personal use, neighborhood/LSV',
      priceRange: '$12,000–$19,000 new',
      powerTypes: ['Electric (51.7V 150Ah Lithium)'],
      warrantyHighlight: 'Warranty administered through Discovery Golf Cars (Tampa Bay) — confirm coverage in writing',
    },
    manufacturerVerification: {
      level: 'not_verified',
      notes: 'Verdi\'s manufacturing origin and headquarters are not publicly disclosed. The brand operates primarily through Discovery Golf Cars in Tampa Bay, FL. Warranty and service are dealer-administered with no independent third-party verification available.',
    },
    commonModels: [
      { name: 'Verdi 4-Passenger', type: 'Personal / LSV', topSpeed: '25 mph', range: '50–70 mi', msrp: '$12,500–$16,000', notes: '150Ah battery standard — extended range' },
      { name: 'Verdi 6-Passenger', type: 'Personal / LSV', topSpeed: '25 mph', range: '45–60 mi', msrp: '$15,000–$19,000' },
    ],
    whatMakesDifferent: [
      '150Ah battery is a genuine advantage over the 105Ah standard on most competitors — more range per charge.',
      '51.7V system is less common — confirm charger compatibility before purchasing.',
      'Primary FL dealer is Discovery Golf Cars (Tampa Bay) — established dealer with local service capability.',
    ],
    buyerConfidenceNotes: [
      'Manufacturing and headquarters are not publicly disclosed — ask the dealer directly.',
      'Parts availability is very limited outside the Discovery Golf Cars network — confirm service capability for your location.',
      'The 150Ah battery advantage is real — but warranty terms and long-term support are unclear.',
      'Discovery Golf Cars is an established FL dealer with a track record — provides more confidence than an unknown pop-up operation.',
    ],
    buyerChecklist: STANDARD_CHECKLIST,
    similarBrands: ['teko-ev', 'venom-ev', 'evolution'],
    sources: [
      { label: 'Discovery Golf Cars Tampa Bay', url: 'https://discoverygolfcars.com' },
    ],
    lastVerified: 'June 2026',
  },

  // ─── 12. Venom EV ─────────────────────────────────────────────────────────
  {
    slug: 'venom-ev',
    dbBrand: 'Venom EV',
    name: 'Venom EV',
    tagline: '105Ah LiFePO4 standard, 8-year Eco Battery warranty at authorized dealers.',
    badges: ['Modern EV Brand', 'LSV Focused'],
    summary:
      'Venom EV ships all models with a 105Ah LiFePO4 Eco Battery as standard, with a 160Ah upgrade option. The brand offers an 8-year Eco Battery warranty through authorized dealers — one of the longest in the segment. GolfCartIQ has 56 verified Venom EV listings in Florida, including inventory from Let\'s Go Carting in Clearwater, FL.',
    snapshot: {
      headquarters: 'United States',
      parentCompany: 'Venom EV (independent)',
      assemblyLocation: 'Not publicly confirmed',
      primaryMarket: 'Personal use, neighborhood/LSV, Florida coastal buyers',
      priceRange: '$10,900–$17,500 new',
      powerTypes: ['Electric (LiFePO4 105Ah standard; 160Ah optional)'],
      warrantyHighlight: '8-year Eco Battery warranty through authorized dealers only',
    },
    manufacturerVerification: {
      level: 'dealer_dependent',
      notes: 'Venom EV\'s assembly location is not publicly confirmed. The 8-year Eco Battery warranty is only valid through authorized Venom EV dealers — purchasing from an unauthorized reseller may void the warranty. Let\'s Go Carting (Clearwater, FL) is a confirmed authorized dealer.',
    },
    commonModels: [
      { name: 'Venom 4-Passenger (105Ah)', type: 'Personal / LSV', topSpeed: '25 mph', range: '30–40 mi', msrp: '$11,500–$14,500', notes: 'Standard 105Ah LiFePO4 Eco Battery' },
      { name: 'Venom 4-Passenger (160Ah)', type: 'Personal / LSV', topSpeed: '25 mph', range: '45–60 mi', msrp: '$13,500–$16,500', notes: 'Extended range 160Ah upgrade' },
      { name: 'Venom 6-Passenger', type: 'Personal / LSV', topSpeed: '25 mph', range: '30–45 mi', msrp: '$14,500–$17,500', notes: '6-passenger configuration' },
    ],
    whatMakesDifferent: [
      '105Ah LiFePO4 (lithium iron phosphate) as standard — safer chemistry than standard Li-ion, with longer cycle life.',
      '8-year Eco Battery warranty is among the longest in the segment — but requires authorized dealer purchase.',
      '160Ah upgrade option offers one of the largest standard battery packs available in this price range.',
      'GolfCartIQ has 56+ verified Venom EV listings across Florida — one of the better-covered emerging brands on the platform.',
    ],
    buyerConfidenceNotes: [
      'Only purchase from an authorized Venom EV dealer to qualify for the 8-year Eco Battery warranty.',
      'LiFePO4 chemistry is considered the safest and most thermally stable lithium variant — a genuine benefit.',
      'Let\'s Go Carting in Clearwater, FL is a confirmed authorized Venom EV dealer.',
      'Confirm the specific model\'s street-legal (LSV) configuration with the dealer — not all builds are LSV-certified.',
    ],
    buyerChecklist: STANDARD_CHECKLIST,
    similarBrands: ['teko-ev', 'bintelli', 'evolution'],
    sources: [
      { label: 'Venom EV Official Site', url: 'https://venomdirtbike.com/golf-carts' },
      { label: 'Let\'s Go Carting (Clearwater, FL)', url: 'https://letsgocarting.com' },
    ],
    lastVerified: 'June 2026',
  },
];

// Lookup helpers
export function getBrandWiki(slug: string): BrandWiki | undefined {
  return BRAND_WIKI.find(b => b.slug === slug);
}

export function getBrandWikiByDbName(dbBrand: string): BrandWiki | undefined {
  return BRAND_WIKI.find(b => b.dbBrand === dbBrand);
}
