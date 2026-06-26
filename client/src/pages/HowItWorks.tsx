import { useEffect } from "react";
import { setSEO } from "@/lib/seo";
import { Link } from "wouter";
import {
  Star, Zap, ShieldCheck, Plug, Truck, TrendingDown,
  ChevronRight, Info, BadgeCheck, AlertTriangle,
} from "lucide-react";

const SECTIONS = [
  { id: "buyer-score",    label: "IQ Score" },
  { id: "deal-rating",    label: "GolfCartIQ Deal Rating" },
  { id: "battery",        label: "Battery" },
  { id: "warranty",       label: "Warranty" },
  { id: "charger",        label: "Charger" },
  { id: "delivery",       label: "Delivery" },
];

function JumpNav() {
  return (
    <nav className="flex flex-wrap gap-2 mt-6" aria-label="Page sections">
      {SECTIONS.map(({ id, label }) => (
        <a
          key={id}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
          }}
          href={`#${id}`}
          className="inline-flex items-center px-3 py-1 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-green-200 transition-colors cursor-pointer"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

interface SectionProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}
function Section({ id, icon, title, subtitle, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-24 space-y-5">
      <div className="flex items-start gap-3 pb-3 border-b border-border">
        <span className="mt-0.5 text-green-600 shrink-0">{icon}</span>
        <div>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-foreground align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GreenBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
      <p className="font-semibold text-green-800 mb-1">{label}</p>
      <p className="text-green-900 leading-relaxed">{children}</p>
    </div>
  );
}

function AmberBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm flex gap-3">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-amber-800 mb-1">{label}</p>
        <p className="text-amber-900 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

// ── Score bar visual ──────────────────────────────────────────────────────────
function ScoreBar({ score, label }: { score: number; label: string }) {
  const color =
    score >= 75 ? "bg-green-500" :
    score >= 55 ? "bg-amber-400" :
    "bg-red-400";
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 bg-muted rounded-full h-2 overflow-hidden shrink-0">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-semibold w-10 shrink-0">{score}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function HowItWorks() {
  useEffect(() => {
    setSEO({
      title: "How GolfCartIQ Scores Golf Cart Listings | IQ Score, GolfCartIQ Deal Rating & More",
      description:
        "Understand how GolfCartIQ calculates IQ Score, GolfCartIQ Deal Rating, battery quality, warranty value, charger inclusion, and delivery to help you find the best golf cart deal in Florida and Georgia.",
      canonical: "https://golfcartiq.com/how-it-works",
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Info className="h-4 w-4 text-green-600" />
            <span>GolfCartIQ Scoring Guide</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">How GolfCartIQ Scores Listings</h1>
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            Every golf cart listing on GolfCartIQ gets a set of signals to help you compare deals quickly.
            This page explains exactly what each score and badge means — and how to use them.
          </p>
          <JumpNav />
        </div>

        <div className="space-y-14">

          {/* ── BUYER SCORE ── */}
          <Section
            id="buyer-score"
            icon={<Star className="h-5 w-5" />}
            title="IQ Score (0–100)"
            subtitle="A single composite number that captures price, battery, warranty, charger, and delivery in one view."
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              The IQ Score is GolfCartIQ's overall value signal. It combines five independent factors into
              a score from 0 to 100. A score of 75+ means the listing is a strong buy on all dimensions —
              well-priced, lithium battery, warranty included, charger included, and delivery available.
              A low score doesn't necessarily mean a bad cart — it often just means data is missing or
              the price is above market.
            </p>

            <div className="space-y-2.5 py-2">
              <ScoreBar score={90} label="Excellent — great deal, lithium, full warranty, charger, delivery" />
              <ScoreBar score={75} label="Good — fair price or better, lithium, warranty confirmed" />
              <ScoreBar score={58} label="Average — some unknowns or above-market price" />
              <ScoreBar score={35} label="Below average — high price and/or missing data" />
            </div>

            <Table
              headers={["Component", "Max Points", "How Points Are Earned"]}
              rows={[
                ["GolfCartIQ Deal Rating", "50 pts", "great_deal=50, good_deal=40, fair_price=30, high_price=15, over_market=5, unknown=22"],
                ["Battery", "20 pts", "Lithium <12 months=20, Lithium unknown age=15, Gas=10, Lead-acid new=8, Unknown=6"],
                ["Warranty", "15 pts", "Included + 36 months=15, Included <36 months=10, Unknown=5, No warranty=0"],
                ["Charger", "10 pts", "Included=10, Unknown=5, Not included=0"],
                ["Delivery", "5 pts", "Delivery available=5, Not available=2"],
              ]}
            />

            <GreenBox label="How to maximize your score">
              Dealers who confirm battery type, warranty length, charger inclusion, and offer delivery can
              reach 85–100. If a listing shows a low score but the deal looks right, ask the dealer
              directly — often the data just hasn't been confirmed yet and the score will update.
            </GreenBox>
          </Section>

          {/* ── DEAL RATING ── */}
          <Section
            id="deal-rating"
            icon={<TrendingDown className="h-5 w-5" />}
            title="GolfCartIQ Deal Rating"
            subtitle="How the asking price compares to GolfCartIQ's estimated market value for that cart."
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              GolfCartIQ calculates a GolfCartIQ Value (IMV — Implied Market Value) for each listing based on
              comparable carts currently in the database: same brand, model, year, condition, and region.
              The GolfCartIQ Deal Rating reflects how the asking price sits relative to that estimate.
            </p>

            <Table
              headers={["Rating", "What It Means", "IQ Score Points"]}
              rows={[
                [<span className="inline-flex items-center gap-1.5 font-semibold text-green-700"><BadgeCheck className="h-3.5 w-3.5" />Great Deal</span>, "Asking price is meaningfully below market value — strong buy signal", "50"],
                [<span className="font-semibold text-emerald-600">Good Deal</span>, "Priced below market — solid value, worth acting on", "40"],
                [<span className="font-semibold text-blue-600">Fair Price</span>, "Priced at or near market — no red flags, competitive listing", "30"],
                [<span className="font-semibold text-amber-600">Slightly High</span>, "Marginally above market — negotiate or compare alternatives", "20"],
                [<span className="font-semibold text-orange-600">High Price</span>, "Noticeably above market — proceed with caution", "15"],
                [<span className="font-semibold text-red-600">Over Market</span>, "Significantly above comparable listings", "5"],
                [<span className="font-semibold text-muted-foreground">Unknown</span>, "Not enough comparable listings to rate — new brand or rare model", "22"],
              ]}
            />

            <AmberBox label="GolfCartIQ Value is an estimate, not an appraisal">
              Deal ratings are based on listings in our database at the time of scoring. Niche brands,
              limited-production models, and very new releases may show "Unknown" until enough comps exist.
              Always confirm pricing directly with the dealer.
            </AmberBox>
          </Section>

          {/* ── BATTERY ── */}
          <Section
            id="battery"
            icon={<Zap className="h-5 w-5" />}
            title="Battery Type & Age"
            subtitle="The single biggest factor in long-term ownership cost and resale value."
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              Battery technology is the most important spec on a used golf cart — and often the least
              clearly disclosed. GolfCartIQ surfaces battery type, chemistry, and age wherever confirmed
              by the dealer or manufacturer spec sheet.
            </p>

            <Table
              headers={["Battery Type", "Score Points", "What to Know"]}
              rows={[
                [<span className="font-semibold text-green-700">Lithium — New / Unknown age</span>, "15–20 pts", "LiFePO4 (lithium iron phosphate) is the gold standard. No maintenance, 2–3× longer life, faster charge, lighter weight. 8–10 year typical lifespan."],
                [<span className="font-semibold text-amber-600">Lead-Acid — Under 2 years</span>, "8 pts", "Traditional flooded or AGM batteries. Require watering, heavier, shorter lifespan (3–5 years). Lower upfront cost but higher replacement cost."],
                [<span className="font-semibold text-orange-500">Lead-Acid — Over 2 years</span>, "4 pts", "May be approaching end of life. Budget for replacement ($800–$1,500 for a full lead-acid bank)."],
                [<span className="font-semibold text-slate-500">Gas</span>, "10 pts", "Internal combustion engine. Good for hilly terrain and high-load use. No battery replacement cycle — engine maintenance instead."],
                [<span className="font-semibold text-muted-foreground">Unknown</span>, "6 pts", "Dealer hasn't confirmed battery type. Ask before buying — it directly affects the total cost of ownership."],
              ]}
            />

            <div className="bg-muted/30 rounded-xl border border-border p-4 text-sm space-y-2">
              <p className="font-semibold text-foreground">Battery Ah (amp-hours) — what it means</p>
              <p className="text-muted-foreground leading-relaxed">
                Ah measures capacity — how far the cart will travel on a charge. A 105Ah lithium pack
                (standard on brands like Venom EV and many others) gives approximately 25–35 miles of
                range per charge. A 160Ah pack extends that to 40–50 miles. For community and
                neighborhood use, 105Ah is sufficient. For longer routes or hilly terrain, 160Ah+
                is worth the upgrade.
              </p>
            </div>
          </Section>

          {/* ── WARRANTY ── */}
          <Section
            id="warranty"
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Warranty"
            subtitle="Confirmed warranty coverage is one of the clearest signals of dealer confidence in a listing."
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              Warranty terms vary significantly between dealers and brands. GolfCartIQ records whether a
              warranty is included, the length in months, and the provider — whether that's the dealer,
              the manufacturer, or a third-party warranty company.
            </p>

            <Table
              headers={["Warranty Status", "Score Points", "What to Know"]}
              rows={[
                ["Included — 36 months or more", "15 pts", "Best case. Typical for new carts from authorized dealers. Manufacturer warranties on lithium batteries often run 5–8 years separately."],
                ["Included — Under 36 months", "10 pts", "Common on used carts or shorter dealer guarantees. Still meaningful — ask what's covered (drivetrain, battery, electronics)."],
                ["Unknown", "5 pts", "Dealer hasn't confirmed. Ask directly — many dealers offer coverage they don't explicitly list online."],
                ["No warranty", "0 pts", "As-is sale. Common on older used carts or private sales. Factor repair risk into your offer price."],
              ]}
            />

            <div className="bg-muted/30 rounded-xl border border-border p-4 text-sm space-y-2">
              <p className="font-semibold text-foreground">Battery warranty vs. cart warranty</p>
              <p className="text-muted-foreground leading-relaxed">
                These are separate. A cart warranty typically covers the frame, motor, controller, and
                electronics. A battery warranty covers the cells themselves. On lithium carts, the
                battery warranty is often more valuable — Venom EV, for example, offers an 8-year
                Eco Battery warranty on qualifying purchases from authorized dealers.
                Always ask for both terms in writing.
              </p>
            </div>
          </Section>

          {/* ── CHARGER ── */}
          <Section
            id="charger"
            icon={<Plug className="h-5 w-5" />}
            title="Charger Included"
            subtitle="A seemingly small detail that can add $150–$400 to the true cost if missing."
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              Lithium golf cart chargers are not universal. A lithium cart requires a lithium-compatible
              charger — plugging a lead-acid charger into a lithium pack can damage the battery management
              system and void the warranty. When a charger is not included, budget for a replacement.
            </p>

            <Table
              headers={["Status", "Score Points", "What to Know"]}
              rows={[
                ["Included", "10 pts", "Charger comes with the cart. Verify it's the correct charger for the battery chemistry (lithium vs. lead-acid)."],
                ["Unknown", "5 pts", "Not confirmed. Ask the dealer — many include it by default but don't list it. If buying used, inspect the charger."],
                ["Not included", "0 pts", "Budget $150–$400 for a replacement. For lithium carts, use only a lithium-compatible charger. Never use a lead-acid charger on a lithium pack."],
              ]}
            />
          </Section>

          {/* ── DELIVERY ── */}
          <Section
            id="delivery"
            icon={<Truck className="h-5 w-5" />}
            title="Delivery"
            subtitle="Delivery cost is part of the true price — GolfCartIQ factors it into the total delivered cost where available."
          >
            <p className="text-sm text-muted-foreground leading-relaxed">
              A $10,500 cart from a dealer 150 miles away may cost more delivered than an $11,000 cart
              nearby. GolfCartIQ calculates an estimated delivery cost based on distance and shows a
              Total Delivered Cost where dealer delivery information is available.
            </p>

            <Table
              headers={["Status", "Score Points", "What to Know"]}
              rows={[
                ["Delivery available", "5 pts", "Dealer offers delivery. Actual cost depends on distance — confirm with the dealer before purchase."],
                ["Delivery included", "5 pts", "Free delivery within dealer's service area. One of the strongest value signals on a listing."],
                ["Not available / pickup only", "2 pts", "You'll need to arrange transport. A golf cart transport service typically costs $1–$2 per mile."],
              ]}
            />

            <GreenBox label="Delivery-adjusted pricing">
              When delivery information is available, GolfCartIQ's Deal Checker adds the estimated delivery
              cost to the asking price to show a Total Delivered Cost. Use this to compare listings
              from dealers at different distances — the closer dealer may be the better deal even at a
              higher sticker price.
            </GreenBox>
          </Section>

        </div>

        {/* CTA */}
        <div className="mt-14 rounded-2xl border border-border bg-white p-6 text-center space-y-3">
          <p className="font-bold text-foreground">Ready to find your cart?</p>
          <p className="text-sm text-muted-foreground">
            Use GolfCartIQ's filters to search by GolfCartIQ Deal Rating, battery type, warranty, and more across
            Florida and Georgia.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <Link href="/search">
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
                Search Listings <ChevronRight className="h-4 w-4" />
              </button>
            </Link>
            <Link href="/deal-checker">
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors">
                Check a Deal
              </button>
            </Link>
          </div>
        </div>

        {/* Bottom nav */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} GolfCartIQ · Florida &amp; Georgia Golf Cart Price Intelligence
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/buyer-guide" className="hover:text-foreground transition-colors">Buyer Guide</Link>
            <Link href="/deal-checker" className="hover:text-foreground transition-colors">Deal Checker</Link>
            <Link href="/disclosure" className="hover:text-foreground transition-colors">Disclosure</Link>
          </div>
        </div>

      </div>
    </div>
  );
}
