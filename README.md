# CartIQ 🛒⚡

**Golf cart market intelligence for Florida & Georgia buyers.**

CartIQ helps buyers compare dealer, private-party, and retail golf cart listings with delivery-adjusted pricing, battery risk scoring, and a deal rating engine — so you always know whether a cart is a great deal or overpriced before you buy.

Live demo: **[cartiq.pplx.app](https://cartiq.pplx.app)**

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Pricing Engine](#pricing-engine)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Data Sources & Connectors](#data-sources--connectors)
- [Admin Portal](#admin-portal)
- [My Garage (Watch & Save)](#my-garage-watch--save)
- [CSV Import Format](#csv-import-format)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

### For Buyers
- **Deal Rating Engine** — every listing is scored against CartIQ's estimated market value (EV): `great_deal`, `good_deal`, `fair_price`, `high_price`, or `over_market`
- **Delivery-Adjusted Pricing** — total delivered cost (TDC) is used for all comparisons, not just sticker price
- **Battery Risk Score** — flags aging lead-acid packs and estimates replacement cost impact
- **Buyer Score** — composite 0–100 score weighing deal delta, battery age, charger, warranty, and delivery
- **Deal Checker** — paste any listing details and get an instant CartIQ analysis without it being in the database
- **My Garage** — save listings (heart) and watch for price drops (bell); email-based, no password required
- **Price Drop Alerts** — watches fire automatically when an admin reduces a listing price
- **Buyer Guide** — SEO content articles covering golf cart buying tips, battery types, street legal requirements, and more
- **Quick Search** — one-click city filters for Nocatee FL, The Villages FL, Jacksonville FL, Orlando FL, Atlanta GA, Peachtree City GA

### For Sellers / Dealers
- **Sell My Cart** — self-submission form for private sellers and dealers
- **CSV Bulk Import** — admin can upload a CSV of multiple listings at once

### For Admins
- **Admin Portal** — password-protected listing management (create, edit, delete, price updates)
- **Inventory Source Management** — track which data sources listings came from
- **Rate-Limited API** — deal-check endpoint is rate limited to prevent abuse

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Wouter (hash routing) |
| Styling | Tailwind CSS v3, shadcn/ui components |
| Backend | Node.js, Express, TypeScript |
| ORM | Drizzle ORM |
| Database | SQLite (via better-sqlite3) — schema compatible with PostgreSQL migration |
| Build | Vite (client), esbuild (server) |
| Deployment | Vercel (frontend + serverless), Railway (backend option), pplx.app (prototype) |
| Security | helmet.js, express-rate-limit, token-based admin auth |

---

## Architecture Overview

```
cartiq/
├── client/          # React SPA (Vite)
│   └── src/
│       ├── components/   # Reusable UI (Badges, ListingCard, Header, SaveButton, WatchButton, EmailGate...)
│       ├── pages/        # Route-level pages (Home, Search, ListingDetail, DealChecker, MyGarage, Admin...)
│       └── lib/          # Utilities (pricing, queryClient, userEmail, types)
├── server/          # Express API
│   ├── index.ts     # App entry — helmet, rate limiting, static serving
│   ├── routes.ts    # All API route handlers
│   ├── storage.ts   # SQLite via Drizzle ORM — all DB operations
│   ├── pricing.ts   # CartIQ valuation engine
│   ├── seed.ts      # 18 seed listings across FL + GA
│   └── csvParser.ts # CSV import parser with validation
├── shared/
│   └── schema.ts    # Drizzle schema (shared between client and server)
├── dist/            # Build output (gitignored)
└── data.db          # SQLite database (gitignored — auto-created on start)
```

The frontend is a single-page app using **hash-based routing** (`/#/search`, `/#/garage`, etc.) for iframe compatibility. All API calls go to `/api/*` on the same origin.

The server serves the built static frontend from `dist/public` in production, so the entire app is a single deployable Node.js process.

---

## Pricing Engine

Located in `server/pricing.ts`. The engine computes three key values for every listing:

### CartIQ Estimated Value (EV)

A market-based estimated value derived from:

| Factor | Weight |
|---|---|
| Brand tier (Club Car, E-Z-GO, Yamaha, Star EV, ICON, other) | Base |
| Model year (depreciation curve) | Age multiplier |
| Battery type (lithium vs. lead-acid) | +15–25% for lithium |
| Battery capacity (Ah) | Linear scaling |
| Battery age (months) | Depreciation factor |
| Seating (2 vs. 4 vs. 6 passenger) | Tier multiplier |
| Lifted | +$500–800 |
| Street legal claimed | +$300–500 |
| Charger included | +$150–300 |
| Warranty included | +$200–500 |
| Seller type (dealer premium vs. private discount) | ±5–8% |

### Total Delivered Cost (TDC)

```
TDC = askingPrice + estimatedDeliveryCost (if deliveryAvailable = true)
    = askingPrice (if deliveryAvailable = false or deliveryIncluded = true)
```

Delivery cost is suppressed from API responses when `deliveryAvailable = false` — the internal $350 estimate is used for scoring only.

### Deal Rating

```
deltaPct = (TDC - EV) / EV

great_deal  : deltaPct ≤ -0.15   (15%+ below market)
good_deal   : -0.15 < deltaPct ≤ -0.05
fair_price  : -0.05 < deltaPct ≤ 0.05
high_price  : 0.05 < deltaPct ≤ 0.15
over_market : deltaPct > 0.15    (15%+ above market)
```

### Negotiation Range

```
negotiationLow  = round(EV × 0.88)   // fair floor — 12% below market
negotiationHigh = round(EV × 1.02)   // fair ceiling — 2% above market
```

Both bounds are anchored entirely to the CartIQ EV — not the asking price.

---

## Project Structure

```
client/src/
├── components/
│   ├── Badges.tsx          # DealBadge, SourceBadge, BuyerScoreBadge, WarrantyBadge, BatteryRiskBadge, etc.
│   ├── EmailGate.tsx       # Email capture modal (shared by Save + Watch flows)
│   ├── Header.tsx          # Site header with mobile nav
│   ├── ListingCard.tsx     # Search result card with Save + Watch buttons
│   ├── SaveButton.tsx      # Heart toggle — saves listing to My Garage
│   └── WatchButton.tsx     # Bell toggle — watches listing for price drops
├── pages/
│   ├── Home.tsx            # Landing page with Quick Search + deal preview widget
│   ├── Search.tsx          # Filterable listing grid
│   ├── ListingDetail.tsx   # Full listing page with pricing breakdown
│   ├── DealChecker.tsx     # Manual deal analysis form
│   ├── MyGarage.tsx        # Saved carts + price alert dashboard
│   ├── BuyerGuide.tsx      # SEO article index + article detail
│   ├── SellPage.tsx        # Seller submission form
│   └── Admin.tsx           # Admin portal (password-gated)
└── lib/
    ├── queryClient.ts      # TanStack Query client + apiRequest helper
    ├── types.ts            # Shared TypeScript types
    ├── userEmail.ts        # Email localStorage helper with iframe fallback
    └── utils.ts            # formatPrice, batteryTypeLabel, etc.

server/
├── index.ts                # Express app, helmet, rate limiting, static serving
├── routes.ts               # All /api/* handlers
│   ├── /api/listings       # CRUD listing endpoints
│   ├── /api/deal-checks    # Deal analysis (rate-limited 30/15min)
│   ├── /api/watches        # Watch CRUD + status
│   ├── /api/saves          # Save CRUD + status
│   ├── /api/admin/*        # CSV import, inventory sources
│   └── /api/connectors/*   # Data source status (FB, retail — placeholder)
├── storage.ts              # SQLiteStorage class — all DB operations
├── pricing.ts              # calculateCartIQValue(), enrichListingWithPricing()
├── seed.ts                 # 18 seed listings (FL + GA, varied ratings)
└── csvParser.ts            # parseListingsCSV() with field validation

shared/
└── schema.ts               # Drizzle ORM schema
    ├── listings            # Core listing table
    ├── dealChecks          # Deal check history
    ├── seoArticles         # Buyer Guide CMS content
    ├── inventorySources    # Data source registry
    ├── listingWatches      # Price drop watch subscriptions
    └── savedListings       # User saved/bookmarked listings
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install & Run

```bash
# Clone the repo
git clone https://github.com/raphaelmpr-beep/cartiq.git
cd cartiq

# Install dependencies
npm install

# Start development server (client + server with hot reload)
npm run dev
```

The app will be available at `http://localhost:5000`.

On first start, the database (`data.db`) is created automatically and seeded with 18 sample listings across Florida and Georgia.

### Build for Production

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in any values:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Server port |
| `NODE_ENV` | `development` | Set to `production` for built app |
| `ADMIN_PASSWORD` | *(required)* | Admin API token (sent as `x-admin-token` header). Server refuses to start if unset. |
| `DATABASE_URL` | `./data.db` | SQLite path (or Postgres URL for migration) |

> **Security note:** `ADMIN_PASSWORD` is required in every environment — there is no source-code default. Generate a strong random value and set it in the hosting provider's environment (Vercel → Project Settings → Environment Variables).

---

## API Reference

All endpoints are prefixed with `/api`.

### Listings

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/listings` | — | List listings with optional filters |
| `GET` | `/api/listings/:id` | — | Get single listing by ID or slug |
| `POST` | `/api/listings` | Admin | Create listing |
| `PATCH` | `/api/listings/:id` | Admin | Update listing (triggers price-drop alerts) |
| `DELETE` | `/api/listings/:id` | Admin | Delete listing |

**Listing filters (query params):**
`city`, `state`, `brand`, `minPrice`, `maxPrice`, `streetLegal`, `lifted`, `dealRating`, `powerType`, `batteryType`, `sellerType`

### Deal Checks

| Method | Path | Auth | Rate limit | Description |
|---|---|---|---|---|
| `POST` | `/api/deal-checks` | — | 30/15min | Analyze a cart without creating a listing |

**Required body fields:** `brand`, `model`, `year`, `askingPrice`, `state`, `powerType`, `batteryType`, `batteryAgeMonths`, `seating`, `lifted`, `streetLegalClaimed`, `chargerIncluded`, `warrantyIncluded`, `deliveryAvailable`, `sellerType`, `sourceType`, `userConfirmedDisclosure`

**Boolean coercion:** `lifted` and `streetLegalClaimed` accept `true/false` (JSON boolean), `"true"/"false"`, `"yes"/"no"`, or `"unknown"`.

**`make` alias:** `make` is accepted as an alias for `brand`.

### Watches (Price Drop Alerts)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/watches` | — | Watch a listing at its current price |
| `GET` | `/api/watches?email=` | — | Get all watches + alerts for an email |
| `GET` | `/api/watches/status?email=&listingId=` | — | Check if watching |
| `DELETE` | `/api/watches/:id?email=` | — | Remove a watch |
| `POST` | `/api/watches/:id/dismiss` | — | Dismiss a fired alert (keep watching) |

### Saves

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/saves` | — | Save a listing |
| `DELETE` | `/api/saves` | — | Unsave a listing |
| `GET` | `/api/saves?email=` | — | Get all saved listings for an email |
| `GET` | `/api/saves/status?email=&listingId=` | — | Check if saved |

### Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/admin/csv-import` | Admin | Bulk import listings from CSV text |
| `GET` | `/api/admin/listings` | Admin | List all listings (including non-public) |
| `GET/POST` | `/api/inventory-sources` | Admin | Manage data sources |

**Admin auth:** Send `x-admin-token: <ADMIN_PASSWORD>` header.

---

## Data Sources & Connectors

CartIQ is built to aggregate from multiple sources. Current status:

| Source | Status | Notes |
|---|---|---|
| Private sellers (manual) | ✅ Live | Via Sell My Cart form |
| Dealer direct (manual/CSV) | ✅ Live | Admin CSV import |
| Facebook Marketplace | 🚫 Disabled | Meta's Content Library API is academic/non-profit only — not available for commercial use. Compliant path: licensed third-party data (BrightData, SociaVault) when budget allows. |
| Costco / Retail | 🚫 Disabled | No approved API/feed access. Placeholder for future licensed feed. |

The connector placeholders are intentionally disabled and gated — no automated scraping is performed.

---

## Admin Portal

Access at `/admin`. The password is whatever value is set in the `ADMIN_PASSWORD` environment variable (there is no source-code default). Generate a strong random value:

```bash
python3 -c "import secrets, string; print(''.join(secrets.choice(string.ascii_letters+string.digits+'-_') for _ in range(48)))"
```

**Capabilities:**
- Create, edit, delete listings
- Trigger price updates (automatically fires price-drop alerts to watchers)
- Bulk import via CSV
- Manage inventory sources

**Security:** The admin token is validated server-side on every admin route. The client-side gate uses a SHA-256 prefix check to avoid storing the plaintext token in the JS bundle.

---

## My Garage (Watch & Save)

Email-based, no account required. User enters email once — stored in localStorage (with in-memory fallback for iframe environments).

### Save a Cart (Heart ❤️)
- Click the heart icon on any listing card or detail page
- Listing appears in My Garage → Saved Carts tab
- Remove anytime with the trash icon

### Watch for Price Drops (Bell 🔔)
- Click the bell icon on any listing card or detail page
- CartIQ records the current asking price as the watch price
- If an admin drops the price below the watch price, an alert fires immediately
- Alerts appear in My Garage → Price Alerts tab with old price → new price and % drop badge
- Dismiss an alert without removing the watch, or remove the watch entirely

> Email delivery of alerts is on the roadmap. Currently alerts are in-app only.

---

## CSV Import Format

Upload via Admin Portal → CSV Import, or `POST /api/admin/csv-import` with `{ csvText: "..." }`.

**Required columns:** `brand`, `model`, `year`, `city`, `state`, `power_type`, `battery_type`, `price`

**Optional columns:** `sale_price`, `regular_price`, `title`, `zip`, `battery_ah`, `battery_age_months`, `seating`, `lifted`, `street_legal_claimed`, `charger_included`, `warranty_included`, `delivery_available`, `delivery_included`, `estimated_delivery_cost`, `seller_type`, `source_type`, `condition`, `image_url`, `description`, `retailer_name`, `external_url`

**Boolean fields** (`lifted`, `street_legal_claimed`, `charger_included`, `warranty_included`, `delivery_available`, `delivery_included`): accept `yes`, `no`, `true`, `false`.

**Notes:**
- Rows with no price (`price`, `sale_price`, and `regular_price` all empty) are skipped with an error
- Column count mismatches are documented behavior — extra/missing columns produce a row-level error

---

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project root
vercel --prod
```

The project includes `vercel.json` for proper routing configuration.

**Important:** Vercel deployments use the SQLite `data.db` file for persistence. For multi-region or production-grade storage, migrate to PostgreSQL (Neon, Supabase, PlanetScale). The Drizzle schema is PostgreSQL-compatible — swap the `better-sqlite3` driver for `postgres-js` and update connection strings.

### Railway

```bash
# Set env vars in Railway dashboard, then:
railway up
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
```

---

## Roadmap

### Near-term
- [ ] Email delivery for price drop alerts (SendGrid / Resend)
- [ ] PostgreSQL migration (Neon / Supabase)
- [ ] Auth system (Clerk or Supabase Auth) for proper user accounts
- [ ] More FL/GA markets (Tampa, Miami, Savannah, Macon)

### Medium-term
- [ ] Licensed third-party listing feeds (BrightData, SociaVault) for Facebook Marketplace data
- [ ] Dealer portal (dashboard for dealers to manage their own inventory)
- [ ] Mobile app (React Native)
- [ ] Multi-state expansion (SC, NC, TX, AZ)

### Long-term
- [ ] ML-based pricing model trained on transaction history
- [ ] VIN/serial number lookup for cart history
- [ ] Financing marketplace integration
- [ ] Nationwide launch

---

## Pilot Coverage

CartIQ MVP covers **Florida** and **Georgia** only. The backend schema and filtering support adding additional states — the `PILOT_STATES` constant in `server/routes.ts` controls which states are accepted.

Featured markets:
- Nocatee, FL (St. Johns County master-planned community)
- The Villages, FL (premier senior golf cart community)
- Jacksonville, FL
- Orlando, FL
- Peachtree City, GA (largest golf cart city in the US)
- Atlanta, GA
- Augusta, GA

---

## License

MIT — see [LICENSE](LICENSE).

---

## Disclaimer

CartIQ is not affiliated with Facebook, Meta, Costco, Club Car, E-Z-GO, Yamaha, or any golf cart manufacturer or retailer. Pricing estimates are for informational purposes only and do not constitute an appraisal.
