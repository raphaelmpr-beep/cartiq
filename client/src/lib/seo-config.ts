// ─── GolfCartWise SEO Configuration ──────────────────────────────────────────────
// Static config for city and brand landing pages.
// No CMS — edit this file to add pages.

export interface CityConfig {
  slug: string;
  city: string;
  state: "FL" | "GA";
  radiusMiles: number;
  marketType: string;
  title: string;
  metaDescription: string;
  h1: string;
  shortAnswer: string;
  nearbySlugs: string[];
  faqs: { q: string; a: string }[];
}

export interface BrandConfig {
  slug: string;
  name: string;
  title: string;
  metaDescription: string;
  h1: string;
  shortAnswer: string;
  origin: string;
  powerTypes: string[];
  priceRange: string;
  commonModels: string[];
  buyerTips: string[];
  faqs: { q: string; a: string }[];
}

export interface BatteryPageConfig {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  shortAnswer: string;
}

// ─── CITY PAGES ────────────────────────────────────────────────────────────

export const CITY_CONFIGS: CityConfig[] = [
  {
    slug: "the-villages-fl",
    city: "The Villages",
    state: "FL",
    radiusMiles: 15,
    marketType: "retirement community",
    title: "Golf Carts For Sale in The Villages, FL | GolfCartWise",
    metaDescription: "Browse verified golf cart listings near The Villages, FL. Compare prices, battery types, and dealer warranty coverage. Updated daily.",
    h1: "Golf Carts For Sale in The Villages, FL",
    shortAnswer: "The Villages is one of the largest golf cart markets in the world — with over 100,000 residents and more than 750 miles of cart paths, demand for new and used carts is consistently high. GolfCartWise tracks verified dealer listings within 15 miles so you can compare prices and deals without driving dealership to dealership.",
    nearbySlugs: ["wildwood-fl", "lady-lake-fl", "ocala-fl"],
    faqs: [
      { q: "How much does a golf cart cost in The Villages?", a: "New golf carts near The Villages typically range from $8,000 to $20,000 depending on brand, battery type, and features. Used carts in good condition generally sell for $4,000–$12,000. Lithium models command a premium over comparable lead-acid carts." },
      { q: "Do I need a license to drive a golf cart in The Villages?", a: "Within The Villages' private cart paths, no driver's license is required. On public roads, golf carts must meet Florida street-legal requirements including lights, mirrors, seatbelts, and a valid registration." },
      { q: "What golf cart brands are popular in The Villages?", a: "E-Z-GO, Club Car, and Yamaha are the most common brands. Newer entrants like ICON, Evolution, and Venom EV offer lithium-standard options at competitive prices." },
      { q: "Is lithium worth it in The Villages?", a: "Yes — given the high daily use on cart paths, lithium's longer range, lighter weight, and zero maintenance make it the preferred choice. A quality 105Ah lithium pack will outlast most lead-acid setups by 3–5 years." },
    ],
  },
  {
    slug: "wildwood-fl",
    city: "Wildwood",
    state: "FL",
    radiusMiles: 15,
    marketType: "gateway to The Villages",
    title: "Golf Carts For Sale in Wildwood, FL | GolfCartWise",
    metaDescription: "Find golf carts for sale in Wildwood, FL. Wildwood dealers serve The Villages market — compare prices, warranties, and battery specs on GolfCartWise.",
    h1: "Golf Carts For Sale in Wildwood, FL",
    shortAnswer: "Wildwood is home to some of the highest-volume golf cart dealers in Florida, strategically located at the gateway to The Villages. Dealers here carry extensive new and used inventory across all major brands. GolfCartWise indexes listings within 15 miles so you can compare deals across Wildwood, Lady Lake, and The Villages dealers in one view.",
    nearbySlugs: ["the-villages-fl", "lady-lake-fl", "ocala-fl"],
    faqs: [
      { q: "Why are there so many golf cart dealers in Wildwood?", a: "Wildwood sits at the northern edge of The Villages, one of the largest golf cart markets in the U.S. Dealers cluster here to serve the massive retirement community demand and benefit from high-traffic road access on US-301 and I-75." },
      { q: "Can I get a golf cart delivered from a Wildwood dealer?", a: "Yes — most Wildwood dealers offer delivery throughout Central Florida, including The Villages, Leesburg, Ocala, and beyond. Confirm delivery range and cost directly with the dealer before purchasing." },
      { q: "What is the price range for golf carts in Wildwood?", a: "New carts range from $8,000–$20,000. Used carts with verified lithium batteries typically sell for $7,000–$14,000. Lead-acid used carts can be found from $4,000–$9,000." },
    ],
  },
  {
    slug: "lady-lake-fl",
    city: "Lady Lake",
    state: "FL",
    radiusMiles: 15,
    marketType: "retirement community adjacent",
    title: "Golf Carts For Sale in Lady Lake, FL | GolfCartWise",
    metaDescription: "Browse golf cart listings in Lady Lake, FL. Dealers serving The Villages corridor — compare prices, battery types, and warranty coverage on GolfCartWise.",
    h1: "Golf Carts For Sale in Lady Lake, FL",
    shortAnswer: "Lady Lake borders The Villages and shares the same high-demand golf cart market. Dealers here serve residents of both communities and offer a mix of new lithium models and certified pre-owned carts. GolfCartWise tracks listings within 15 miles across the Lady Lake–The Villages corridor.",
    nearbySlugs: ["the-villages-fl", "wildwood-fl", "ocala-fl"],
    faqs: [
      { q: "Are Lady Lake dealers the same as The Villages dealers?", a: "Some dealers operate showrooms in both areas. Lady Lake has its own independent dealers as well as authorized brand dealers. Always verify dealer location and delivery area before committing." },
      { q: "What battery types are common in Lady Lake golf cart listings?", a: "Both lithium and lead-acid carts are common. Lithium is increasingly standard on new models. When buying used, always ask about battery age — lead-acid batteries over 3 years old may need replacement soon." },
    ],
  },
  {
    slug: "nocatee-fl",
    city: "Nocatee",
    state: "FL",
    radiusMiles: 25,
    marketType: "master-planned community",
    title: "Golf Carts For Sale in Nocatee, FL | GolfCartWise",
    metaDescription: "Golf carts for sale near Nocatee, FL. Browse verified dealer listings for this master-planned community near St. Johns County. Compare prices on GolfCartWise.",
    h1: "Golf Carts For Sale Near Nocatee, FL",
    shortAnswer: "Nocatee is one of Florida's fastest-growing master-planned communities, with an extensive internal cart path network. Golf cart demand has grown alongside the community itself. GolfCartWise tracks dealer listings within 25 miles — covering dealers in St. Augustine, Jacksonville, and Ponte Vedra who serve Nocatee residents.",
    nearbySlugs: ["st-augustine-fl", "jacksonville-fl", "ponte-vedra-fl"],
    faqs: [
      { q: "Can I drive a golf cart in Nocatee?", a: "Yes — Nocatee has a dedicated golf cart and multi-use path network connecting neighborhoods, the Town Center, and amenities. Street-legal carts can also use certain public roads within the community." },
      { q: "Which dealers serve Nocatee?", a: "Dealers in Ponte Vedra Beach, St. Augustine, and Jacksonville commonly deliver to Nocatee. GolfCartWise shows estimated delivery cost from each dealer to help you find the best total delivered price." },
      { q: "What golf cart brands are popular in Nocatee?", a: "Club Car, E-Z-GO, ICON, and Venom EV are common. Many Nocatee buyers prioritize lithium batteries for reliable daily commuting within the community." },
    ],
  },
  {
    slug: "st-augustine-fl",
    city: "St. Augustine",
    state: "FL",
    radiusMiles: 25,
    marketType: "coastal and historic city",
    title: "Golf Carts For Sale in St. Augustine, FL | GolfCartWise",
    metaDescription: "Find golf carts for sale in St. Augustine, FL. Compare dealer listings with verified prices, battery types, and warranty coverage. Updated daily on GolfCartWise.",
    h1: "Golf Carts For Sale in St. Augustine, FL",
    shortAnswer: "St. Augustine and surrounding St. Johns County have a growing golf cart market driven by coastal communities, gated neighborhoods, and proximity to Nocatee. GolfCartWise indexes verified dealer listings within 25 miles, covering dealers in St. Augustine, Ponte Vedra, and the beaches area.",
    nearbySlugs: ["nocatee-fl", "jacksonville-fl", "ponte-vedra-fl"],
    faqs: [
      { q: "Are golf carts street legal in St. Augustine?", a: "Florida law allows golf carts on public roads with a posted speed limit of 30 mph or less when properly equipped with headlights, brake lights, mirrors, turn signals, and a windshield. St. Augustine Beach has designated golf cart routes." },
      { q: "How much do golf carts cost near St. Augustine?", a: "New carts from local dealers range from $8,000–$18,000. Used carts in good condition sell for $4,500–$12,000. Lithium upgrades add $2,000–$4,000 to comparable lead-acid models." },
    ],
  },
  {
    slug: "jacksonville-fl",
    city: "Jacksonville",
    state: "FL",
    radiusMiles: 25,
    marketType: "large metro",
    title: "Golf Carts For Sale in Jacksonville, FL | GolfCartWise",
    metaDescription: "Browse golf cart listings in Jacksonville, FL. Compare prices, battery types, and dealer warranties across Northeast Florida's largest city. Updated daily.",
    h1: "Golf Carts For Sale in Jacksonville, FL",
    shortAnswer: "Jacksonville is Northeast Florida's largest metro and a growing golf cart market, driven by coastal communities, gated neighborhoods in St. Johns County, and proximity to Nocatee and Ponte Vedra. GolfCartWise tracks dealer listings within 25 miles across Duval and St. Johns counties.",
    nearbySlugs: ["nocatee-fl", "st-augustine-fl", "ponte-vedra-fl"],
    faqs: [
      { q: "Where can I buy a golf cart in Jacksonville?", a: "Several dealers operate in and around Jacksonville, including Golf Carts Jacksonville and dealers in the Ponte Vedra / Nocatee corridor. GolfCartWise shows all verified listings with current prices." },
      { q: "Can I get a golf cart delivered in Jacksonville?", a: "Yes — most dealers in the area offer delivery throughout Duval, St. Johns, and Clay counties. Confirm delivery fees before purchasing, as they vary by distance." },
      { q: "What is the best golf cart brand for Jacksonville?", a: "E-Z-GO, Club Car, and ICON are popular. For frequent use on hilly terrain or longer community routes, a lithium model with 105Ah+ capacity is recommended." },
    ],
  },
  {
    slug: "clearwater-fl",
    city: "Clearwater",
    state: "FL",
    radiusMiles: 25,
    marketType: "coastal Tampa Bay metro",
    title: "Golf Carts For Sale in Clearwater, FL | GolfCartWise",
    metaDescription: "Golf carts for sale in Clearwater, FL. Browse verified listings with prices, battery types, and warranty info from Tampa Bay area dealers. Updated daily.",
    h1: "Golf Carts For Sale in Clearwater, FL",
    shortAnswer: "Clearwater and the broader Tampa Bay area is one of the highest-volume golf cart markets in Florida. GolfCartWise indexes hundreds of verified listings from Clearwater-area dealers, covering new lithium models, certified pre-owned carts, and street-legal builds.",
    nearbySlugs: ["tampa-fl", "st-pete-fl", "palm-harbor-fl"],
    faqs: [
      { q: "How much is a golf cart in Clearwater?", a: "New carts from Clearwater dealers typically range from $7,500–$20,000. Used carts in good condition sell for $3,995–$12,000. GolfCartWise's Wise Deal Rating shows how each listing compares to current market comps." },
      { q: "Are there street-legal golf carts in Clearwater?", a: "Yes — Florida allows LSVs (Low-Speed Vehicles) and street-legal golf carts on roads with 35 mph speed limits or lower. Pinellas County has several golf cart-friendly communities and beach corridors." },
      { q: "Do Clearwater dealers offer delivery?", a: "Most dealers in the Clearwater area deliver throughout Pinellas and Hillsborough counties. Some offer statewide delivery for a fee." },
    ],
  },
  {
    slug: "port-orange-fl",
    city: "Port Orange",
    state: "FL",
    radiusMiles: 25,
    marketType: "Daytona Beach corridor",
    title: "Golf Carts For Sale in Port Orange, FL | GolfCartWise",
    metaDescription: "Find golf carts for sale in Port Orange, FL. Compare dealer prices, battery types, and warranties in the Daytona Beach area on GolfCartWise.",
    h1: "Golf Carts For Sale in Port Orange, FL",
    shortAnswer: "Port Orange sits in the heart of Volusia County's golf cart corridor — between Daytona Beach and New Smyrna Beach — with a mix of retirement communities, coastal neighborhoods, and active golf cart use. GolfCartWise tracks verified dealer listings within 25 miles.",
    nearbySlugs: ["daytona-beach-fl", "new-smyrna-beach-fl", "deland-fl"],
    faqs: [
      { q: "Which dealers are near Port Orange?", a: "Coastal Golf Carts in Port Orange is a verified GolfCartWise dealer. Additional dealers in the Daytona Beach and DeLand area are indexed as well." },
      { q: "Are golf carts street legal in Port Orange?", a: "Florida law permits golf carts on roads posted at 30 mph or below when properly equipped. Some Volusia County communities have established designated cart corridors." },
    ],
  },
  {
    slug: "panama-city-beach-fl",
    city: "Panama City Beach",
    state: "FL",
    radiusMiles: 25,
    marketType: "Gulf Coast beach resort",
    title: "Golf Carts For Sale in Panama City Beach, FL | GolfCartWise",
    metaDescription: "Browse golf cart listings in Panama City Beach, FL. Find beach-area dealers with verified prices and battery specs on GolfCartWise.",
    h1: "Golf Carts For Sale in Panama City Beach, FL",
    shortAnswer: "Panama City Beach is a popular Gulf Coast golf cart destination — both for permanent residents navigating beach communities and vacation rental properties. GolfCartWise indexes verified dealer listings within 25 miles covering the PCB and Bay County area.",
    nearbySlugs: ["fort-walton-beach-fl", "destin-fl", "pensacola-fl"],
    faqs: [
      { q: "Can you drive golf carts on the beach in PCB?", a: "Golf carts are popular for beach access roads and within resort communities, but driving on the beach itself is generally restricted. Many PCB neighborhoods have golf cart-friendly streets." },
      { q: "What is the best golf cart for beach use?", a: "Lithium models are preferred for beach environments — salt air is hard on lead-acid batteries. A lifted cart with larger tires provides better ground clearance for sandy terrain." },
    ],
  },
  {
    slug: "peachtree-city-ga",
    city: "Peachtree City",
    state: "GA",
    radiusMiles: 25,
    marketType: "planned golf cart community",
    title: "Golf Carts For Sale in Peachtree City, GA | GolfCartWise",
    metaDescription: "Golf carts for sale in Peachtree City, GA — the golf cart capital of Georgia. Compare verified dealer listings with prices and specs on GolfCartWise.",
    h1: "Golf Carts For Sale in Peachtree City, GA",
    shortAnswer: "Peachtree City is nationally recognized as the golf cart capital of Georgia — with over 100 miles of dedicated cart paths connecting every neighborhood, school, and business in the city. GolfCartWise tracks verified dealer listings within 25 miles for Peachtree City and the broader Fayette County area.",
    nearbySlugs: ["atlanta-ga", "newnan-ga", "fayetteville-ga"],
    faqs: [
      { q: "Do you need a license to drive a golf cart in Peachtree City?", a: "Peachtree City allows golf cart operation on its private path network by residents 12 and older. Public road operation requires a valid driver's license, and the cart must meet Georgia street-legal requirements." },
      { q: "How much does a golf cart cost in Peachtree City?", a: "New carts from local dealers range from $8,000–$20,000. The high daily use in Peachtree City makes lithium a sound investment — reduced maintenance and longer battery life offset the upfront premium." },
      { q: "What brands are common in Peachtree City?", a: "Club Car, E-Z-GO, and Yamaha are the traditional leaders. Newer brands like ICON, Evolution, and Bintelli are gaining market share with lithium-standard models at lower price points." },
      { q: "Can I take a golf cart on Peachtree City public roads?", a: "Yes — Georgia law allows golf carts on public roads with 35 mph or lower speed limits if the cart is registered, insured, and equipped with required safety equipment." },
    ],
  },
  {
    slug: "atlanta-ga",
    city: "Atlanta",
    state: "GA",
    radiusMiles: 50,
    marketType: "large metro",
    title: "Golf Carts For Sale in Atlanta, GA | GolfCartWise",
    metaDescription: "Browse golf cart listings near Atlanta, GA. Compare prices from dealers across the metro area including Woodstock, Peachtree City, and beyond. Updated daily.",
    h1: "Golf Carts For Sale Near Atlanta, GA",
    shortAnswer: "Greater Atlanta has a growing golf cart market driven by surrounding planned communities, golf courses, and suburban neighborhoods. GolfCartWise searches within 50 miles of Atlanta to capture dealers in Woodstock, Peachtree City, Covington, and across the metro area.",
    nearbySlugs: ["peachtree-city-ga", "woodstock-ga", "covington-ga"],
    faqs: [
      { q: "Are there golf cart dealers near Atlanta?", a: "Yes — dealers operate in Woodstock, Peachtree City, Covington, and other Atlanta suburbs. GolfCartWise indexes listings within 50 miles of the city center to give you broad metro coverage." },
      { q: "What is the price range for golf carts near Atlanta?", a: "New carts from metro Atlanta dealers range from $8,000–$22,000. Used carts in good condition sell for $4,000–$14,000 depending on brand, battery type, and features." },
      { q: "What golf cart brands are available near Atlanta?", a: "E-Z-GO, Club Car, Yamaha, ICON, Bintelli, and Evolution are all available through Atlanta-area dealers. GolfCartWise's brand filter lets you narrow listings to your preferred brand." },
    ],
  },
];

// ─── BRAND PAGES ───────────────────────────────────────────────────────────

export const BRAND_CONFIGS: BrandConfig[] = [
  {
    slug: "ezgo",
    name: "E-Z-GO",
    title: "E-Z-GO Golf Carts For Sale | GolfCartWise",
    metaDescription: "Browse E-Z-GO golf cart listings in Florida and Georgia. Compare RXV, TXT, and Express models with verified prices and dealer warranties on GolfCartWise.",
    h1: "E-Z-GO Golf Carts For Sale in FL & GA",
    shortAnswer: "E-Z-GO is one of the most widely owned golf cart brands in the U.S., known for reliability, dealer network depth, and strong resale value. GolfCartWise tracks E-Z-GO listings across Florida and Georgia from verified dealers.",
    origin: "Augusta, GA (Textron Inc.)",
    powerTypes: ["Electric", "Gas"],
    priceRange: "$6,000–$16,000 new; $3,000–$10,000 used",
    commonModels: ["RXV", "TXT", "Express L6", "Express S4", "Valor", "Freedom RXV"],
    buyerTips: [
      "Ask whether the listing is a 48V or 72V system — 72V RXV models have more torque and are preferred for hilly terrain.",
      "Factory reconditioned E-Z-GOs often come with a limited warranty — worth asking about.",
      "Battery age is critical on used E-Z-GOs. A fresh set of lead-acid batteries adds $800–$1,200 to the value.",
      "E-Z-GO has a large national parts network — easier to find service anywhere in FL or GA.",
    ],
    faqs: [
      { q: "What is the difference between E-Z-GO RXV and TXT?", a: "The RXV uses an AC motor with regenerative braking and is more energy-efficient. The TXT uses a DC motor and is the most common model globally. Both are reliable — the RXV is preferred for hillier terrain and higher daily mileage." },
      { q: "How long do E-Z-GO batteries last?", a: "Lead-acid batteries typically last 4–6 years with proper maintenance. A lithium conversion or lithium-equipped new model can last 8–10 years with zero watering required." },
      { q: "Are E-Z-GO golf carts street legal?", a: "E-Z-GO makes street-legal Express models that meet Florida and Georgia LSV requirements out of the box. Older TXT and RXV models can be converted with the right equipment." },
      { q: "Where are E-Z-GO carts made?", a: "E-Z-GO is headquartered in Augusta, GA, and is a division of Textron Inc. Manufacturing is primarily in the United States." },
    ],
  },
  {
    slug: "club-car",
    name: "Club Car",
    title: "Club Car Golf Carts For Sale | GolfCartWise",
    metaDescription: "Browse Club Car golf cart listings in Florida and Georgia. Compare Onward, Tempo, and Precedent models with verified prices on GolfCartWise.",
    h1: "Club Car Golf Carts For Sale in FL & GA",
    shortAnswer: "Club Car is a premium golf cart brand known for its aluminum chassis, which resists rust better than steel-frame competitors. The brand is popular in Florida's coastal markets where corrosion resistance matters.",
    origin: "Evans, GA (Ingersoll Rand / Platinum Equity)",
    powerTypes: ["Electric", "Gas"],
    priceRange: "$7,000–$18,000 new; $3,500–$11,000 used",
    commonModels: ["Onward", "Tempo", "Precedent", "Villager", "Transporter"],
    buyerTips: [
      "Club Car's aluminum frame is a key advantage in Florida's coastal humidity — it won't rust like steel-frame competitors.",
      "The Onward is the flagship consumer model with the most customization options.",
      "Lithium Onward models come factory-equipped from Club Car — worth paying for over a lead-acid conversion.",
      "Precedent models are common used inventory — check battery age carefully as they often come with aging lead-acid packs.",
    ],
    faqs: [
      { q: "What makes Club Car different from other brands?", a: "Club Car's aluminum unibody frame is its signature differentiator — it doesn't rust, which is a significant advantage in Florida's salt air environment. The Onward is also known for its premium fit and finish compared to competitors in the same price range." },
      { q: "How much does a Club Car Onward cost?", a: "New Club Car Onward models typically range from $9,000–$16,000 depending on battery type (lithium vs. lead-acid), seating configuration, and dealer markup. Lithium models command a $2,000–$4,000 premium over comparable lead-acid builds." },
      { q: "Is Club Car worth the premium over E-Z-GO?", a: "For buyers in coastal Florida, the aluminum frame justifies the price difference if the cart will be used near salt water. For inland or community use, both brands offer comparable reliability at similar price points." },
    ],
  },
  {
    slug: "yamaha",
    name: "Yamaha",
    title: "Yamaha Golf Carts For Sale | GolfCartWise",
    metaDescription: "Browse Yamaha golf cart listings in Florida and Georgia. Compare Drive2, Adventurer, and QuieTech models with verified prices on GolfCartWise.",
    h1: "Yamaha Golf Carts For Sale in FL & GA",
    shortAnswer: "Yamaha is the third major player in the traditional golf cart market alongside E-Z-GO and Club Car. Known for quiet operation (particularly the QuieTech gas models) and reliable Japanese engineering.",
    origin: "Kennesaw, GA (Yamaha Motor Co.)",
    powerTypes: ["Electric", "Gas"],
    priceRange: "$6,500–$16,000 new; $3,000–$10,000 used",
    commonModels: ["Drive2", "Adventurer Sport", "QuieTech EFI", "The Drive"],
    buyerTips: [
      "Yamaha's QuieTech gas models run significantly quieter than other gas carts — worth considering if noise is a concern.",
      "Yamaha has strong brand recognition in golf course environments — easy to service at most golf facilities.",
      "Used Yamaha Drive models are widely available and have good parts availability.",
      "Ask about the fuel injection system on newer EFI models — it improves fuel economy and reduces cold-start issues.",
    ],
    faqs: [
      { q: "Are Yamaha golf carts good for personal use?", a: "Yes — Yamaha builds golf carts for both course and personal/community use. The Drive2 and Adventurer Sport are popular personal-use models. For community use, the electric Drive2 is quiet and efficient." },
      { q: "How does Yamaha compare to Club Car and E-Z-GO?", a: "All three are reliable. Yamaha's gas models are particularly quiet (QuieTech). E-Z-GO's RXV has a strong AC motor advantage. Club Car's aluminum frame wins on corrosion resistance. Personal preference and specific use case drive the decision." },
    ],
  },
  {
    slug: "icon",
    name: "ICON",
    title: "ICON Golf Carts For Sale in FL & GA | GolfCartWise",
    metaDescription: "Browse ICON golf cart listings in Florida and Georgia. Compare i40, i60, and i80 models — lithium-standard, street-legal builds. Updated daily on GolfCartWise.",
    h1: "ICON Golf Carts For Sale in FL & GA",
    shortAnswer: "ICON is a rapidly growing golf cart brand headquartered in Jacksonville, FL that has gained market share by offering lithium batteries as standard — not an upgrade — at competitive price points. ICON carts are assembled in the U.S. and are popular with buyers who want modern features without paying the Club Car or E-Z-GO premium.",
    origin: "Jacksonville, FL",
    powerTypes: ["Electric (Lithium standard)"],
    priceRange: "$9,500–$18,000 new",
    commonModels: ["i20", "i40", "i40L", "i60", "i60L", "i80", "i80L"],
    buyerTips: [
      "ICON includes lithium batteries as standard across most models — do not pay extra for an 'upgrade' that should already be included.",
      "The 'L' suffix (i40L, i60L) indicates a lifted model with more ground clearance.",
      "ICON is assembled in Jacksonville, FL — dealer service networks in Florida are strong.",
      "Compare ICON pricing carefully against DACH and Teko EV, which offer similar lithium-standard specs at times.",
    ],
    faqs: [
      { q: "Where is ICON golf cart made?", a: "ICON EV is headquartered in Jacksonville, FL and assembles its carts in the United States. The company was founded in 2016 and has grown quickly through a direct-to-dealer model." },
      { q: "Does ICON include lithium batteries standard?", a: "Yes — most ICON models come standard with lithium-ion batteries, which is a key differentiator versus brands like E-Z-GO and Club Car where lithium is an add-on upgrade." },
      { q: "Are ICON golf carts street legal?", a: "Many ICON models are designed to meet Florida and Georgia LSV street-legal requirements, including headlights, brake lights, mirrors, turn signals, and a windshield. Verify street-legal certification with the dealer on the specific model." },
    ],
  },
  {
    slug: "evolution",
    name: "Evolution",
    title: "Evolution Golf Carts For Sale | GolfCartWise",
    metaDescription: "Browse Evolution golf cart listings in Florida and Georgia. Lithium-standard models, Classic, Carrier, and Forester series. Compare prices on GolfCartWise.",
    h1: "Evolution Golf Carts For Sale in FL & GA",
    shortAnswer: "Evolution Electric Vehicles offers a broad lineup of lithium-standard golf carts across multiple series — Classic, Carrier, and Forester — at prices that undercut the major brands. Known for value and feature-for-feature comparisons that favor budget-conscious buyers.",
    origin: "Pompano Beach, FL",
    powerTypes: ["Electric (Lithium)"],
    priceRange: "$8,000–$16,000 new",
    commonModels: ["Classic 4", "Classic 4 Plus", "Classic 6", "Carrier 2+2", "Forester 4", "Forester 6"],
    buyerTips: [
      "Evolution is one of the best value-per-dollar lithium options currently on the market in Florida.",
      "Ask about the specific lithium battery brand — not all lithium is equal in cycle life and warranty.",
      "Evolution dealers in Florida tend to be well-stocked — compare multiple dealers on GolfCartWise for pricing.",
      "The Forester series has a more rugged build for outdoor and off-path use.",
    ],
    faqs: [
      { q: "Is Evolution a good golf cart brand?", a: "Evolution has received strong reviews for value. The lithium-standard lineup, combined with competitive pricing, makes it worth considering against Club Car and E-Z-GO at similar price points. Check dealer warranty terms carefully as they vary." },
      { q: "Where is Evolution golf cart made?", a: "Evolution Electric Vehicles is headquartered in Pompano Beach, FL. The brand has grown significantly in Florida's golf cart market since launching." },
    ],
  },
  {
    slug: "venom-ev",
    name: "Venom EV",
    title: "Venom EV Golf Carts For Sale | GolfCartWise",
    metaDescription: "Browse Venom EV golf cart listings in Florida. Strike, Stealth, and other models with 105Ah Eco Battery standard and 8-year warranty. Compare prices on GolfCartWise.",
    h1: "Venom EV Golf Carts For Sale in Florida",
    shortAnswer: "Venom EV is a premium lithium golf cart brand that ships all models with a 105Ah LiFePO4 Eco Battery as standard — with an optional 160Ah upgrade. The brand offers an 8-year Eco Battery warranty through authorized dealers, one of the longest battery warranties in the industry. GolfCartWise has verified Venom EV listings from authorized Florida dealers.",
    origin: "United States",
    powerTypes: ["Electric (LiFePO4 Lithium standard)"],
    priceRange: "$10,900–$17,500 new",
    commonModels: ["Strike 4P", "Strike 4+2", "Strike Course 2P", "Stealth 4P"],
    buyerTips: [
      "Only buy from an authorized Venom EV dealer to qualify for the 8-year Eco Battery warranty.",
      "The 105Ah Eco Battery is standard. If a dealer offers 160Ah as an upgrade, confirm it includes the extended battery warranty.",
      "Venom EV carts are JS-rendered on some dealer sites — GolfCartWise has pre-verified listings so you don't have to hunt.",
      "Compare the Strike 4+2 (6-passenger) against comparable ICON and Evolution models at similar price points.",
    ],
    faqs: [
      { q: "What battery does Venom EV use?", a: "Venom EV uses a 105Ah LiFePO4 lithium iron phosphate Eco Battery as standard across all models. An optional 160Ah Eco Battery upgrade is available for extended range. Both are backed by an 8-year warranty from authorized dealers." },
      { q: "What is the range of a Venom EV golf cart?", a: "The standard 105Ah Eco Battery provides approximately 25–35 miles of range per charge. The optional 160Ah upgrade extends range to approximately 40–50 miles — suitable for larger communities and longer daily routes." },
      { q: "Where can I buy a Venom EV in Florida?", a: "GolfCartWise has indexed Venom EV listings from authorized dealers in Delray Beach, Fort Lauderdale, Naples, and Ponte Vedra Beach, FL. Use GolfCartWise's search to find in-stock models near you." },
      { q: "Is Venom EV street legal?", a: "Some Venom EV models are configured for street-legal use. Confirm with the dealer whether the specific unit meets your state's LSV requirements, including lighting, mirrors, seatbelts, and speed capability." },
    ],
  },
  {
    slug: "bintelli",
    name: "Bintelli",
    title: "Bintelli Golf Carts For Sale | GolfCartWise",
    metaDescription: "Browse Bintelli golf cart listings in Florida and Georgia. Beyond, Beachcomber, and other lithium models — compare prices and dealer warranties on GolfCartWise.",
    h1: "Bintelli Golf Carts For Sale in FL & GA",
    shortAnswer: "Bintelli is a Charleston, SC-based golf cart brand that has grown quickly through value pricing on lithium-equipped models. The Beyond and Beachcomber series are popular with Florida buyers looking for modern features at below-premium prices.",
    origin: "Charleston, SC",
    powerTypes: ["Electric (Lithium)"],
    priceRange: "$7,500–$14,000 new",
    commonModels: ["Beyond", "Beachcomber", "B Plus", "Sprint"],
    buyerTips: [
      "Bintelli offers competitive pricing on lithium models — compare directly against ICON and Evolution.",
      "The Beyond series is street-legal configured — verify specific model meets your local requirements.",
      "Dealer network is growing in Florida — confirm service availability in your area before purchasing.",
    ],
    faqs: [
      { q: "Is Bintelli a reliable golf cart?", a: "Bintelli has built a reputation for value-for-money lithium models with modern styling. As a growing brand, dealer service network depth varies by region — confirm local service availability." },
      { q: "Where is Bintelli made?", a: "Bintelli is headquartered in Charleston, SC. The brand markets heavily in the Southeast U.S., with growing dealer presence in Florida and Georgia." },
    ],
  },
  {
    slug: "epic",
    name: "Epic",
    title: "Epic Golf Carts For Sale | GolfCartWise",
    metaDescription: "Browse Epic golf cart listings in Florida and Georgia. Compare E40, E60, and E80 models with verified prices and specs on GolfCartWise.",
    h1: "Epic Golf Carts For Sale in FL & GA",
    shortAnswer: "Epic EV is a Sarasota, FL-based electric golf cart brand offering lithium-standard models in a range of seating configurations. The brand positions itself as a premium alternative to the traditional big-three brands with Florida-focused design.",
    origin: "Sarasota, FL",
    powerTypes: ["Electric (Lithium)"],
    priceRange: "$9,000–$17,000 new",
    commonModels: ["E40", "E40L", "E60", "E60L", "E80"],
    buyerTips: [
      "Epic is headquartered in Florida — dealer support and service is strongest in the Southeast.",
      "Compare the E40 vs ICON i40 — similar spec levels at competing price points.",
      "Ask about the specific lithium chemistry and battery warranty terms before committing.",
    ],
    faqs: [
      { q: "Where is Epic golf cart made?", a: "Epic EV is based in Sarasota, FL. The brand focuses on the Florida and Southeast U.S. market with a lithium-first lineup." },
      { q: "How does Epic compare to ICON?", a: "Both brands offer lithium-standard models at competitive prices. ICON has a larger dealer footprint nationally; Epic has strong Florida dealer presence. Compare specific models side-by-side on GolfCartWise for current pricing." },
    ],
  },
  {
    slug: "denago",
    name: "Denago EV",
    title: "Denago EV Golf Carts For Sale | GolfCartWise",
    metaDescription: "Browse Denago EV golf cart listings in Florida and Georgia. Compare prices, battery specs, and dealer warranties on GolfCartWise.",
    h1: "Denago EV Golf Carts For Sale in FL & GA",
    shortAnswer: "Denago EV is an emerging electric golf cart brand offering lithium-equipped models at value price points. The brand has built a presence in Florida's dealer network and is gaining recognition among buyers seeking newer brand options with modern features.",
    origin: "United States",
    powerTypes: ["Electric (Lithium)"],
    priceRange: "$8,000–$15,000 new",
    commonModels: ["COM 2", "COM 4", "COM 4+2", "GO 2", "GO 4"],
    buyerTips: [
      "Denago is newer to the market — confirm dealer service capability before purchasing.",
      "Compare pricing against ICON and Bintelli for similar lithium-equipped builds.",
      "Ask about the manufacturer warranty specifically — terms vary between dealers.",
    ],
    faqs: [
      { q: "Is Denago EV a good brand?", a: "Denago EV offers competitive lithium models at value pricing. As an emerging brand, dealer network and parts availability are still growing — confirm local service options before purchasing." },
      { q: "Does Denago EV include lithium batteries?", a: "Yes — Denago EV models come equipped with lithium batteries as standard. Confirm battery capacity (Ah) and warranty terms with the specific dealer." },
    ],
  },
  {
    slug: "teko-ev",
    name: "Teko EV",
    title: "Teko EV Golf Carts For Sale | GolfCartWise",
    metaDescription: "Browse Teko EV golf cart listings in Florida and Georgia. LiFePO4 lithium models with lifetime chassis warranty. Compare prices on GolfCartWise.",
    h1: "Teko EV Golf Carts For Sale in FL & GA",
    shortAnswer: "Teko EV has the highest listing count of any emerging brand on GolfCartWise in Florida and Georgia. The brand offers a lifetime chassis warranty alongside an 8-year LiFePO4 battery warranty (personal use) and 2-year parts warranty.",
    origin: "United States (manufacturing not publicly confirmed)",
    powerTypes: ["Electric (LiFePO4 Lithium)"],
    priceRange: "$9,000–$16,000 new",
    commonModels: ["Teko 4-Passenger", "Teko 6-Passenger"],
    buyerTips: [
      "High listing count in FL/GA — but verify warranty fulfillment history before relying on long-term coverage.",
      "The personal-use restriction on the battery warranty is important — commercial or rental use may void it.",
      "Ask the dealer for the full Teko EV warranty document, not just verbal confirmation.",
      "Manufacturing transparency is limited — ask your dealer about factory of origin.",
    ],
    faqs: [
      { q: "What warranty does Teko EV offer?", a: "Teko EV markets a lifetime chassis warranty, an 8-year LiFePO4 battery warranty (personal use only), and a 2-year parts warranty. Full terms at tekoev.com/warranty." },
      { q: "Where is Teko EV assembled?", a: "Teko EV's manufacturing location is not publicly confirmed. The brand has significant dealer presence in FL and GA." },
    ],
  },
  {
    slug: "sivo",
    name: "Sivo",
    title: "Sivo Golf Carts For Sale | GolfCartWise",
    metaDescription: "Browse Sivo golf cart listings in Florida. Bintelli sub-brand launched January 2026 with 8-year EcoBattery warranty. Compare prices on GolfCartWise.",
    h1: "Sivo Golf Carts For Sale in FL & GA",
    shortAnswer: "Sivo is a sub-brand of Bintelli, launched in January 2026. It carries Bintelli's 8-year EcoBattery warranty and is positioned as a distinctly styled product within the same engineering family.",
    origin: "Charleston, SC (via Bintelli parent)",
    powerTypes: ["Electric (Lithium / EcoBattery)"],
    priceRange: "$8,000–$14,000 new",
    commonModels: ["Sivo 4L", "Sivo 6L"],
    buyerTips: [
      "Sivo launched January 2026 — very new. Treat as a long-hold purchase with limited resale data.",
      "Warranty is backed by Bintelli's EcoBattery program — verify the dealer is Bintelli-authorized.",
      "Bintelli's established track record gives this sub-brand more credibility than an unknown startup.",
    ],
    faqs: [
      { q: "What is Sivo?", a: "Sivo is a Bintelli sub-brand launched January 2026, sharing the 8-year EcoBattery warranty and engineering of the parent brand with distinct styling." },
      { q: "Does Sivo have a warranty?", a: "Yes — Sivo carries Bintelli's 8-year EcoBattery warranty through authorized dealers. Confirm dealer authorization before purchase." },
    ],
  },
  {
    slug: "dach-vehicles",
    name: "DACH Vehicles",
    title: "DACH Vehicles Golf Carts For Sale | GolfCartWise",
    metaDescription: "Browse DACH Vehicles golf cart listings in Florida. Orlando-assembled modern EVs distributed through Jeffrey Allen Inc. Compare prices on GolfCartWise.",
    h1: "DACH Vehicles Golf Carts For Sale in FL & GA",
    shortAnswer: "DACH Vehicles performs final assembly in Orlando, FL and distributes through Jeffrey Allen Inc. dealers. Lithium-equipped models at competitive price points.",
    origin: "Orlando, FL (final assembly; chassis sourced externally per 3rd-party sources)",
    powerTypes: ["Electric (Lithium)"],
    priceRange: "$9,000–$16,000 new",
    commonModels: ["DACH 4-Passenger", "DACH 6-Passenger"],
    buyerTips: [
      "Service and warranty are tied to Jeffrey Allen dealerships — confirm proximity before purchasing.",
      "DACH has limited footprint outside Jeffrey Allen — confirm parts availability for your area.",
      "Ask about chassis sourcing if parts availability outside the dealer network matters.",
    ],
    faqs: [
      { q: "Where is DACH assembled?", a: "DACH performs final assembly at 2001 Directors Row in Orlando, FL. Third-party sources note chassis sourced from China with domestic finishing." },
      { q: "Who sells DACH golf carts?", a: "DACH is distributed primarily through Jeffrey Allen Inc., with three Florida locations." },
    ],
  },
  {
    slug: "verdi",
    name: "Verdi",
    title: "Verdi Golf Carts For Sale | GolfCartWise",
    metaDescription: "Browse Verdi golf cart listings in Florida. 150Ah lithium battery standard — more range than most competitors. Compare prices on GolfCartWise.",
    h1: "Verdi Golf Carts For Sale in FL & GA",
    shortAnswer: "Verdi ships with a 51.7V 150Ah lithium battery as standard — meaningfully larger than the 105Ah on most competitors. Primary dealer is Discovery Golf Cars in Tampa Bay, FL.",
    origin: "Not publicly confirmed",
    powerTypes: ["Electric (51.7V 150Ah Lithium)"],
    priceRange: "$12,000–$19,000 new",
    commonModels: ["Verdi 4-Passenger", "Verdi 6-Passenger"],
    buyerTips: [
      "The 150Ah battery is a real advantage — but confirm charger compatibility with a 51.7V system.",
      "Parts availability is very limited outside the Discovery Golf Cars network.",
      "Manufacturing and headquarters are not publicly disclosed — ask the dealer directly.",
    ],
    faqs: [
      { q: "What makes Verdi different?", a: "Verdi ships with a 51.7V 150Ah battery standard — larger than the 105Ah on most competitors, providing more range per charge." },
      { q: "Where can I buy Verdi in Florida?", a: "Discovery Golf Cars in Tampa Bay is the primary Florida dealer for Verdi golf carts." },
    ],
  },
];

// ─── BATTERY GUIDE PAGES ───────────────────────────────────────────────────

export const BATTERY_PAGES: BatteryPageConfig[] = [
  {
    slug: "golf-cart-batteries",
    title: "Golf Cart Battery Guide | Lithium vs Lead-Acid, Chargers & More | GolfCartWise",
    metaDescription: "Everything you need to know about golf cart batteries — lithium vs lead-acid, amp hours, charger compatibility, and how to evaluate battery age when buying used.",
    h1: "Golf Cart Battery Guide",
    shortAnswer: "The battery is the most important — and most misrepresented — spec on any used golf cart. This guide explains the differences between lithium and lead-acid, what amp hours mean for range, why charger compatibility matters, and what to ask before you buy.",
  },
  {
    slug: "lithium-vs-lead-acid",
    title: "Lithium vs Lead-Acid Golf Cart Batteries: Which Is Better? | GolfCartWise",
    metaDescription: "Lithium vs lead-acid golf cart batteries compared: cost, lifespan, range, maintenance, and total cost of ownership. Make the right call before buying.",
    h1: "Lithium vs Lead-Acid Golf Cart Batteries",
    shortAnswer: "Lithium wins on almost every performance metric — longer range, longer life, zero maintenance, lighter weight. Lead-acid wins on upfront cost only. The right choice depends on your budget, daily mileage, and how long you plan to keep the cart.",
  },
  {
    slug: "105ah-vs-150ah",
    title: "105Ah vs 150Ah Golf Cart Battery: What's the Difference? | GolfCartWise",
    metaDescription: "105Ah vs 150Ah lithium golf cart battery comparison. How far will each pack go? Is the range upgrade worth the extra cost? GolfCartWise breaks it down.",
    h1: "105Ah vs 150Ah Golf Cart Battery: Range, Cost & What to Choose",
    shortAnswer: "105Ah gets you 25–35 miles per charge — enough for most community and neighborhood use. 150Ah (or 160Ah) extends that to 40–50 miles. If your daily route is under 20 miles, 105Ah is sufficient. If you use the cart heavily or have a large community, the upgrade is worth it.",
  },
  {
    slug: "charger-included",
    title: "Does a Used Golf Cart Come With a Charger? | GolfCartWise",
    metaDescription: "Does a golf cart come with a charger? What to look for, lithium vs lead-acid charger compatibility, and what to budget if one isn't included.",
    h1: "Does a Golf Cart Come With a Charger?",
    shortAnswer: "New carts almost always include a charger. Used carts often don't — or they include the wrong charger for the battery. Never use a lead-acid charger on a lithium pack. Always confirm charger inclusion and compatibility before buying.",
  },
];
