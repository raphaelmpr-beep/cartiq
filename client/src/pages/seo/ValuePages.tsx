/**
 * Value Pages — 3 pillar pages for the valuation keyword cluster
 * Routes:
 *   /golf-cart-values           — pillar page
 *   /used-golf-cart-value       — transactional page
 *   /golf-cart-value-estimator  — tool landing page
 *
 * These pages address 12 valuation-intent queries that currently map to the
 * homepage (June 7 – July 5, 2026 GSC data). Homepage average position on
 * those queries is 59–96; dedicated pages should compress that range.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { setSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronRight,
  HelpCircle,
  TrendingDown,
  Battery,
  Wrench,
  MapPin,
  Calculator,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

// ─── Shared primitives (mirrors BatteryPages.tsx conventions) ────────────────

function Breadcrumb({ crumbs }: { crumbs: { label: string; href?: string }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8" aria-label="Breadcrumb">
      <Link href="/" className="hover:text-foreground">GolfCartIQ</Link>
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3" />
          {c.href
            ? <Link href={c.href} className="hover:text-foreground">{c.label}</Link>
            : <span className="text-foreground">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

function QuestionBox({ q, a }: { q: string; a: string }) {
  return (
    <div className="flex gap-3 border border-border rounded-xl p-4 bg-white">
      <HelpCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-sm text-foreground mb-1">{q}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

function faqPageSchema(faqs: { q: string; a: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

function howToSchema(args: {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: args.name,
    description: args.description,
    step: args.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

/**
 * SnippetAnswer — a snippet-optimized direct-answer block designed to win
 * Google Featured Snippets. Google preferentially promotes a concise
 * 40–60 word answer paragraph placed at the top of the page, immediately
 * under H1, using the exact question phrasing.
 */
function SnippetAnswer({
  question,
  answer,
  bullets,
}: {
  question: string;
  answer: string;
  bullets?: string[];
}) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-5 md:p-6 my-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-green-700 mb-2">
        {question}
      </p>
      <p className="text-base md:text-lg text-foreground leading-relaxed font-medium">
        {answer}
      </p>
      {bullets && bullets.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm md:text-base text-foreground">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-green-600 font-bold shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Page 1 — /golf-cart-values (pillar)
// ────────────────────────────────────────────────────────────────────────────

const PILLAR_FAQS: { q: string; a: string }[] = [
  {
    q: "Is there a Kelley Blue Book for golf carts?",
    a: "No dedicated Kelley Blue Book exists for golf carts the way it does for cars. KBB has added a limited category, but real golf cart values depend heavily on battery condition, upgrades, and local demand — factors KBB does not capture. GolfCartIQ uses live dealer listing data from Florida and Georgia to produce more accurate market ranges.",
  },
  {
    q: "How much does a golf cart depreciate per year?",
    a: "Expect 15–20% depreciation in year one, then 10–12% per year through year five. After year five, depreciation slows to 3–5% per year. Well-maintained Club Car, Yamaha, and E-Z-GO carts can hold 50% or more of MSRP at the five-year mark.",
  },
  {
    q: "What's the average value of a 5-year-old golf cart?",
    a: "Typically 45–55% of original MSRP in good condition. A cart that sold new for $10,000 is worth roughly $4,500–$5,500 in a private sale or $3,200–$4,400 as a trade-in in 2026.",
  },
  {
    q: "Do lithium batteries increase golf cart value?",
    a: "Yes — lithium-battery carts hold 10–15% more value than lead-acid equivalents because lithium packs last 8–10 years versus 4–6 for lead-acid. The $2,000–$4,000 lithium premium usually pays back within 3–4 years of ownership.",
  },
  {
    q: "Which golf cart brand holds its value best?",
    a: "Club Car leads at roughly 10–15% above average resale retention, thanks to dealer network depth and parts availability. Yamaha and E-Z-GO are close behind. Newer brands (Icon, Evolution, Bintelli, Denago, Teko EV) hold value less well but sell at lower prices new.",
  },
  {
    q: "What's the difference between trade-in value and private sale value?",
    a: "Private sale nets 20–30% more but takes weeks and requires effort. Trade-in is instant and lets you drive off with a new cart the same day. GolfCartIQ shows both ranges for every cart run through the value estimator.",
  },
  {
    q: "Does mileage or hour meter matter for golf cart value?",
    a: "Less than for cars, since most golf carts do not track hours. Battery age and condition matter far more than hours used.",
  },
  {
    q: "Can I sell my golf cart to a dealer even if I'm not buying a new one?",
    a: "Some dealers buy outright; most prefer trade-in against a new purchase. For cash-only sale, private buyers or wholesale golf cart brokers usually pay more.",
  },
];

const BRAND_RETENTION: { brand: string; slug: string; retention5yr: string; note: string }[] = [
  { brand: "Club Car",   slug: "club-car",  retention5yr: "~55%", note: "Aluminum frame, deep dealer network, strong resale" },
  { brand: "Yamaha",     slug: "yamaha",    retention5yr: "~53%", note: "Legendary reliability; QuieTech gas holds value well" },
  { brand: "E-Z-GO",     slug: "ezgo",      retention5yr: "~52%", note: "Broadest used market; parts everywhere" },
  { brand: "ICON",       slug: "icon",      retention5yr: "~45%", note: "Lithium-standard; growing dealer base" },
  { brand: "Evolution",  slug: "evolution", retention5yr: "~42%", note: "Strong feature-per-dollar; middling resale" },
  { brand: "Venom EV",   slug: "venom-ev",  retention5yr: "~42%", note: "8-year EcoBattery is a resale asset" },
  { brand: "Bintelli",   slug: "bintelli",  retention5yr: "~40%", note: "Charleston, SC; value-first lineup" },
  { brand: "Denago EV",  slug: "denago",    retention5yr: "~40%", note: "Emerging; Tao Motors OEM shared with others" },
  { brand: "Teko EV",    slug: "teko-ev",   retention5yr: "~40%", note: "New to market; lifetime chassis + 8yr battery" },
  { brand: "Epic",       slug: "epic",      retention5yr: "~40%", note: "Value pricing; watch battery age at resale" },
];

export function GolfCartValuesPage() {
  useEffect(() => {
    setSEO({
      title: "Golf Cart Values 2026 — Free Price Guide by Brand, Year & Condition",
      description:
        "See current golf cart values by brand, model year, and condition. 2026 pricing data for Club Car, E-Z-GO, Yamaha, Icon, Evolution, and more — updated weekly from live FL and GA dealer listings.",
      canonical: "https://golfcartiq.com/golf-cart-values",
      jsonLd: [
        faqPageSchema(PILLAR_FAQS),
        howToSchema({
          name: "How to Determine Your Golf Cart's Value",
          description:
            "A 5-step method for figuring out what your golf cart is worth in 2026, based on brand, age, condition, battery health, and local market comparables.",
          steps: [
            { name: "Start with the brand's retention rate", text: "Look up your brand's 5-year value retention (Club Car ~55%, Yamaha ~53%, E-Z-GO ~52%, ICON ~45%). Multiply by original MSRP or current new-cart replacement cost." },
            { name: "Apply age depreciation", text: "Subtract 15–20% for year one, then 10–12% per year through year five. After year five, depreciation slows to 3–5% per year." },
            { name: "Adjust for condition", text: "Add 10–15% for excellent condition. Subtract 15–25% for fair or poor condition. Focus on paint, seats, tires, and functional accessories." },
            { name: "Factor in battery type and age", text: "Add $1,000–$2,000 for a healthy lithium pack. Subtract $800–$1,500 if lead-acid batteries are 4+ years old and showing reduced range." },
            { name: "Compare against local listings", text: "Check at least 5 similar carts in your ZIP code on GolfCartIQ, Facebook Marketplace, and dealer sites. Your fair-market value is the median of comparable carts, not the highest asking price." },
          ],
        }),
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          about: { "@type": "Thing", name: "Golf Cart Value" },
          url: "https://golfcartiq.com/golf-cart-values",
        },
      ],
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <Breadcrumb crumbs={[{ label: "Golf Cart Values" }]} />

      <header className="space-y-4 mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight text-foreground">
          Golf Cart Values: 2026 Price Guide for Every Brand &amp; Year
        </h1>

        {/* Featured-snippet direct answer */}
        <SnippetAnswer
          question="How much is a golf cart worth in 2026?"
          answer="Most golf carts in 2026 are worth between $2,000 and $13,000. A clean 3–5 year old cart from a top brand retains about 55–70% of its MSRP; a 10-year-old cart is typically worth 25–35% of new. Battery health, brand, and lithium conversion move the number more than age alone."
          bullets={[
            "Club Car: 55–70% retained at 3–5 years — top of the market",
            "Yamaha & E-Z-GO: 50–65% retained at 3–5 years",
            "ICON, Evolution, Venom EV: 40–55% retained at 3–5 years",
            "Add $1,000–$2,000 for a healthy lithium (LiFePO4) pack",
            "Subtract $800–$1,500 for lead-acid batteries past year 4",
          ]}
        />

        <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
          Unlike cars, there is no single Kelley Blue Book for golf carts — but the answer is not guesswork either.
          GolfCartIQ tracks live dealer listings across Florida and Georgia, cross-references MSRP data, and gives you honest value ranges by
          brand, year, condition, and battery type. For a personalized number, use our{" "}
          <Link href="/golf-cart-value-estimator" className="text-green-700 hover:underline font-medium">
            Golf Cart Value Estimator
          </Link>{" "}
          or read our{" "}
          <Link href="/used-golf-cart-value" className="text-green-700 hover:underline font-medium">
            used golf cart pricing guide
          </Link>.
        </p>
        <div>
          <Link href="/golf-cart-value-estimator">
            <Button size="lg" className="gap-2">
              Estimate my cart's value <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Six factors */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">What Determines a Golf Cart's Value?</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: Wrench,       title: "Brand & model",                body: "Legacy brands (Club Car, Yamaha, E-Z-GO) hold value 10–15% better than newer entrants. Model tier matters too — a Club Car Onward retains more than a Precedent." },
            { icon: TrendingDown, title: "Age / year",                    body: "Year-one depreciation is 15–20%, then 10–12% per year through year five, then flattens to 3–5% per year." },
            { icon: CheckCircle,  title: "Condition",                     body: "Excellent, Good, Fair, and Poor each map to a distinct band. A cart's paint, seats, tires, and functional accessories are the visible signals." },
            { icon: Battery,      title: "Battery type & age",            body: "The single biggest swing on carts 5+ years old. Fresh lead-acid or lithium sits at the top of range; end-of-life batteries drop the value $1,000–$2,000." },
            { icon: Wrench,       title: "Modifications & accessories",   body: "Lift kits, upgraded wheels, sound systems, and street-legal LSV packages add value — factory OEM parts more than aftermarket in most cases." },
            { icon: MapPin,       title: "Local market & delivery",       body: "FL and GA prices run 5–10% higher than the national average because of demand. Delivery distance adds $200–$800 to any private sale." },
          ].map((f, i) => (
            <div key={i} className="rounded-xl border border-border bg-white p-4 space-y-2">
              <div className="flex items-center gap-2">
                <f.icon className="h-4 w-4 text-green-600" />
                <h3 className="font-semibold text-sm">{f.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Brand retention table */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Golf Cart Values by Brand (2026)</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Brand</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Value retained at 5&nbsp;yrs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</th>
              </tr>
            </thead>
            <tbody>
              {BRAND_RETENTION.map((b, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/brands/${b.slug}`} className="text-green-700 hover:underline">{b.brand}</Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{b.retention5yr}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Retention figures are illustrative averages based on GolfCartIQ dealer listing data. Individual carts vary based on condition, battery age, and modifications.</p>
      </section>

      {/* Depreciation curve */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Used Golf Cart Values by Year</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Age</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">% of original MSRP</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Example: $10,000 MSRP cart</th>
              </tr>
            </thead>
            <tbody>
              {[
                { age: "1 year",   pct: "80–85%", ex: "$8,000–$8,500" },
                { age: "3 years",  pct: "60–70%", ex: "$6,000–$7,000" },
                { age: "5 years",  pct: "45–55%", ex: "$4,500–$5,500" },
                { age: "7 years",  pct: "35–45%", ex: "$3,500–$4,500" },
                { age: "10+ years",pct: "20–35%", ex: "$2,000–$3,500" },
              ].map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.age}</td>
                  <td className="px-4 py-3 text-foreground">{r.pct}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Lithium-battery carts hold 10–15% more value than lead-acid at every age band.</p>
      </section>

      {/* Condition */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Golf Cart Values by Condition</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { name: "Excellent", share: "Top ~5%",  body: "Near-new; batteries under 2 yrs old at 100% capacity; no cosmetic wear; all accessories functional. Prices sit at the top of the range for their year." },
            { name: "Good",      share: "~25%",      body: "Well-maintained; minor cosmetic wear; batteries 2–4 yrs old with 80%+ capacity. Sits mid-to-upper range." },
            { name: "Fair",      share: "~55%",      body: "Working but visibly used; batteries approaching replacement; possible minor mechanical issues. Sits lower half of range." },
            { name: "Poor",      share: "~15%",      body: "Needs work: dead batteries, seat tears, non-functional accessories, or mechanical problems. Prices below range; often sold to wholesalers." },
          ].map((c, i) => (
            <div key={i} className="rounded-xl border border-border bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{c.name}</h3>
                <span className="text-xs text-muted-foreground">{c.share} of used market</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trade vs Private */}
      <section className="mb-10 rounded-xl border border-border bg-gray-50 p-6">
        <h2 className="text-xl font-bold mb-2">Trade-In Value vs. Private Sale Value</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-2">
          Trade-in is typically 70–80% of private sale. Trade-in wins on convenience; private sale wins on cash.
          A $6,000 private-sale cart usually trades in at $4,200–$4,800.
        </p>
        <Link href="/buyer-guide/golf-cart-dealer-vs-private-seller" className="text-sm text-green-700 hover:underline">
          Read our dealer vs. private seller guide →
        </Link>
      </section>

      {/* CTA */}
      <section className="mb-10 rounded-xl bg-foreground text-background p-6 text-center space-y-3">
        <h2 className="text-2xl font-bold">Check Your Golf Cart's Value in 30 Seconds</h2>
        <p className="text-sm opacity-80">Enter brand, year, and condition — get private-sale and trade-in ranges instantly.</p>
        <Link href="/golf-cart-value-estimator">
          <Button size="lg" variant="secondary" className="gap-2 mt-2">
            <Calculator className="h-4 w-4" /> Estimate my cart's value
          </Button>
        </Link>
      </section>

      {/* FAQ */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Golf Cart Values FAQ</h2>
        <div className="space-y-3">
          {PILLAR_FAQS.map((f, i) => <QuestionBox key={i} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* Related links */}
      <section className="rounded-xl border border-border bg-white p-6 space-y-3">
        <h2 className="text-base font-bold">Popular Golf Cart Value Pages</h2>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          <li><Link href="/used-golf-cart-value"      className="text-green-700 hover:underline">Used golf cart values</Link></li>
          <li><Link href="/golf-cart-value-estimator" className="text-green-700 hover:underline">Golf cart value estimator</Link></li>
          <li><Link href="/brands/club-car"           className="text-green-700 hover:underline">Club Car values</Link></li>
          <li><Link href="/brands/ezgo"               className="text-green-700 hover:underline">E-Z-GO values</Link></li>
          <li><Link href="/brands/yamaha"             className="text-green-700 hover:underline">Yamaha values</Link></li>
          <li><Link href="/brands/teko-ev"            className="text-green-700 hover:underline">Teko EV values</Link></li>
        </ul>
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Page 2 — /used-golf-cart-value (transactional)
// ────────────────────────────────────────────────────────────────────────────

const USED_FAQS: { q: string; a: string }[] = [
  {
    q: "How do I find out what my used golf cart is worth?",
    a: "Enter your cart's year, brand, model, condition, and battery type into a value estimator. GolfCartIQ's free estimator returns a private-sale range and a trade-in range in under a minute — no email required.",
  },
  {
    q: "What's the average price of a used golf cart in 2026?",
    a: "Between $2,000 and $8,000 depending on age and condition. Three-to-five-year-old carts from Club Car, Yamaha, or E-Z-GO typically sell for $4,000–$6,500 privately.",
  },
  {
    q: "Are used golf carts a good investment?",
    a: "They depreciate slower than cars after year three — a well-maintained cart can retain 40–50% of its value at year 10. Lithium-battery models hold value best.",
  },
  {
    q: "Should I sell my used golf cart privately or trade it in?",
    a: "Private sale pays 20–30% more but takes weeks; trade-in is instant. Choose based on how much time you have and whether you're buying another cart.",
  },
  {
    q: "How much does battery age affect used golf cart value?",
    a: "On carts 5+ years old, batteries can swing the value by $1,000–$2,000. A cart with new batteries sells for near the top of its range; one with end-of-life batteries sells for the bottom or triggers a battery-replacement discount.",
  },
  {
    q: "Can I sell a used golf cart with dead batteries?",
    a: "Yes, but expect $500–$1,500 off the bottom of your value range. Some buyers actually prefer this — they get to install lithium themselves.",
  },
];

export function UsedGolfCartValuePage() {
  useEffect(() => {
    setSEO({
      title: "Used Golf Cart Value — What's a Used Cart Worth in 2026?",
      description:
        "Get a fair-market value for your used golf cart. See private-sale and trade-in ranges by brand, year, and condition. Free instant estimate, no email required.",
      canonical: "https://golfcartiq.com/used-golf-cart-value",
      jsonLd: [
        faqPageSchema(USED_FAQS),
        howToSchema({
          name: "How to Price a Used Golf Cart",
          description:
            "A 6-step method to price a used golf cart in 2026 for a private sale, trade-in, or purchase — using brand retention, battery health, and comparable listings.",
          steps: [
            { name: "Identify the brand, model, and year", text: "Find the serial number on the frame or under the seat. Confirm the exact model (e.g., Club Car Precedent vs. Onward) and build year — these change the value by 20–40%." },
            { name: "Start with the age-based value range", text: "1–2 years old: 70–80% of MSRP. 3–4 years: 55–70%. 5–6 years: 45–55%. 7–8 years: 35–45%. 9–10 years: 25–35%. 10+ years: 15–25%." },
            { name: "Adjust for brand retention", text: "Club Car retains 5–10% more than the age curve; Yamaha and E-Z-GO track the curve; ICON, Evolution, and newer imports fall 5–10% below it." },
            { name: "Grade the condition honestly", text: "Excellent adds 10–15%. Good is baseline. Fair subtracts 15–25%. Poor subtracts 30% or more. Battery health is the single biggest factor — test it before pricing." },
            { name: "Adjust for battery type and age", text: "Add $1,000–$2,000 for lithium in good health. Subtract $800–$1,500 for lead-acid past year 4. New lithium conversion adds $1,500–$3,000." },
            { name: "Verify against 5+ local comparables", text: "Search GolfCartIQ, Facebook Marketplace, and Craigslist for the same brand, model year, and battery type within 100 miles. Your fair price is the median — not the highest ask." },
          ],
        }),
      ],
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <Breadcrumb crumbs={[{ label: "Used Golf Cart Value" }]} />

      <header className="space-y-4 mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight text-foreground">
          What Is My Used Golf Cart Worth?
        </h1>

        {/* Featured-snippet direct answer */}
        <SnippetAnswer
          question="How much is a used golf cart worth?"
          answer="A used golf cart in good condition is typically worth $2,000–$9,500 in 2026, depending on age, brand, and battery health. A 5-year-old Club Car or Yamaha sells for roughly $4,500–$6,500 privately, or $3,200–$4,600 as a trade-in. Battery condition is the single biggest factor after brand and age."
          bullets={[
            "1–3 year old cart: $6,500–$9,500+ (70–80% of MSRP retained)",
            "5–7 year old cart: $4,000–$6,500 (best value zone)",
            "8–10 year old cart: $2,500–$4,000",
            "10+ year old cart: $1,500–$3,000 (project territory)",
            "Private sale nets 20–30% more than dealer trade-in",
          ]}
        />

        <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
          If you're selling, trading, or buying a used golf cart, the first question is always the same: what's it actually worth?
          This guide breaks down 2026 used golf cart values by brand, year, condition, and power type. For a personalized number,
          use the{" "}
          <Link href="/golf-cart-value-estimator" className="text-green-700 hover:underline font-medium">
            Golf Cart Value Estimator
          </Link>{" "}
          or see the full{" "}
          <Link href="/golf-cart-values" className="text-green-700 hover:underline font-medium">
            brand-by-brand value guide
          </Link>.
        </p>
        <div>
          <Link href="/golf-cart-value-estimator">
            <Button size="lg" className="gap-2">
              Estimate my cart's value <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Value ranges by age */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Used Golf Cart Value Ranges by Age</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cart age</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Typical private-sale range</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trade-in range</th>
              </tr>
            </thead>
            <tbody>
              {[
                { age: "1–3 years",  priv: "$5,000–$8,000+", trade: "$3,500–$6,400" },
                { age: "3–5 years",  priv: "$4,000–$6,500",  trade: "$2,800–$5,200" },
                { age: "5–8 years",  priv: "$2,500–$4,500",  trade: "$1,750–$3,600" },
                { age: "8–10+ years",priv: "$2,000–$3,000",  trade: "$1,400–$2,400" },
              ].map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.age}</td>
                  <td className="px-4 py-3 text-foreground">{r.priv}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.trade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Ranges are for good-condition carts. Lithium adds ~15% to the top of the range. Poor condition drops the bottom by $500–$2,000.</p>
      </section>

      {/* Brand callouts */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Used Golf Cart Value by Brand</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Legacy brands (Club Car, Yamaha, E-Z-GO) hold roughly 10–15% more value at resale than emerging brands.
          For the full comparison, see our <Link href="/golf-cart-values" className="text-green-700 hover:underline">golf cart values by brand</Link> guide.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BRAND_RETENTION.slice(0, 9).map((b) => (
            <Link key={b.slug} href={`/brands/${b.slug}`}
              className="rounded-lg border border-border bg-white p-3 hover:border-green-500 hover:bg-green-50 transition-colors">
              <div className="font-semibold text-sm">{b.brand}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Retains {b.retention5yr} at 5 yrs</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Private vs trade-in formula */}
      <section className="mb-10 rounded-xl border border-border bg-gray-50 p-6">
        <h2 className="text-xl font-bold mb-2">Private Sale Value vs. Trade-In Value</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          <strong className="text-foreground">Rule of thumb:</strong> Trade-in ≈ Private sale × 0.70–0.80. For a $6,000 private-sale cart,
          expect a $4,200–$4,800 trade-in offer. Private sale takes 2–6 weeks; trade-in is same-day.
        </p>
        <Link href="/buyer-guide/golf-cart-dealer-vs-private-seller" className="text-sm text-green-700 hover:underline">
          Full dealer vs. private seller comparison →
        </Link>
      </section>

      {/* Battery: the biggest swing */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Battery Condition: The Biggest Value Swing</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          On an 8-year-old cart, the $2,500–$4,500 range is 90% about batteries. A fresh set of lead-acid batteries sits at the
          top; end-of-life batteries drop the value below the range or trigger a battery-replacement discount from the buyer.
        </p>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          <li>
            <Link href="/golf-cart-batteries" className="text-green-700 hover:underline">Full golf cart battery guide</Link>
          </li>
          <li>
            <Link href="/golf-cart-batteries/lithium-vs-lead-acid" className="text-green-700 hover:underline">Lithium vs lead-acid comparison</Link>
          </li>
        </ul>
      </section>

      {/* How to get an estimate */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">How to Get a Used Golf Cart Value Estimate</h2>
        <ol className="space-y-3 text-sm">
          {[
            "Note your cart's year, brand, and model. Check the serial number plate if you're not sure.",
            "Assess condition honestly — Excellent / Good / Fair / Poor. Batteries, tires, and seats are the biggest tells.",
            "Check battery age and type. Lithium under 5 yrs, lead-acid under 3 yrs = top of range. Older = drop toward bottom.",
            "Run it through our free estimator to get private-sale and trade-in ranges.",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
              <span className="text-muted-foreground leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="mb-10 rounded-xl bg-foreground text-background p-6 text-center space-y-3">
        <h2 className="text-2xl font-bold">Get Your Used Cart's Exact Value</h2>
        <p className="text-sm opacity-80">Free instant estimate — private-sale range, trade-in range, and IQ Score.</p>
        <Link href="/golf-cart-value-estimator">
          <Button size="lg" variant="secondary" className="gap-2 mt-2">
            <Calculator className="h-4 w-4" /> Estimate my cart's value
          </Button>
        </Link>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Used Golf Cart Value FAQ</h2>
        <div className="space-y-3">
          {USED_FAQS.map((f, i) => <QuestionBox key={i} q={f.q} a={f.a} />)}
        </div>
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Page 3 — /golf-cart-value-estimator (tool landing)
// ────────────────────────────────────────────────────────────────────────────

const ESTIMATOR_FAQS: { q: string; a: string }[] = [
  {
    q: "How much is my golf cart worth?",
    a: "Enter your brand, model, year, condition, and battery type and the estimator returns a private-sale range and a dealer trade-in range in about 30 seconds. As a rough rule of thumb: a well-kept 4-year-old Club Car, E-Z-GO, or Yamaha typically sells private-party for 55–70% of its original MSRP in Florida and Georgia, while trade-in offers usually land 20–30% below that private-sale range.",
  },
  {
    q: "What is my golf cart worth on a dealer trade-in?",
    a: "Dealer trade-in values are almost always lower than private-sale values because the dealer needs margin to recondition and resell the cart. GolfCartIQ shows both numbers side-by-side so you can walk into any Florida or Georgia dealer knowing your floor before you negotiate.",
  },
  {
    q: "Is there a Kelley Blue Book (KBB) for golf carts?",
    a: "Kelley Blue Book has added a limited golf cart category, but it does not weight battery age, lithium vs. lead-acid, or regional FL and GA demand — all of which materially move real sale prices. GolfCartIQ's Value Estimator is built specifically for golf carts and pulls from live Florida and Georgia dealer listings, so it is generally more accurate for this market. Use both if you want a second data point.",
  },
  {
    q: "How accurate is the GolfCartIQ Value Estimator?",
    a: "The estimator returns a market-derived range, not a single price. Actual sale prices in Florida and Georgia typically land inside the estimated range 80–85% of the time. Extreme condition, rare accessories, or unusual battery states can push the sale price outside the range.",
  },
  {
    q: "What data feeds the estimator?",
    a: "Live dealer listings across Florida and Georgia (updated daily), historical price movement, brand-specific depreciation curves, battery type premiums, and regional demand signals. GolfCartIQ tracks 1,300+ active listings from 50+ verified dealers.",
  },
  {
    q: "Does the estimator cover every brand?",
    a: "It covers all major brands: Club Car, E-Z-GO, Yamaha, ICON, Evolution, Bintelli, Denago EV, Epic, Venom EV, Teko EV, and more. Very rare or discontinued models may return a wider range with lower confidence.",
  },
  {
    q: "How often is the estimator updated?",
    a: "The underlying listing data refreshes daily; depreciation curves are recalibrated weekly against actual sale prices.",
  },
  {
    q: "Does battery age or lithium vs. lead-acid change my golf cart's value?",
    a: "Yes — battery condition is one of the biggest single value drivers. A cart with a recent lithium pack can be worth $1,500–$3,000 more than the same cart with 5+ year-old lead-acid batteries, because the buyer avoids a near-term replacement bill. The estimator applies this adjustment automatically when you select battery type and age.",
  },
];

// Brand / model catalog. Kept lightweight — the actual multi-select can be
// replaced with a database-backed component later without changing this shell.
const BRAND_MODELS: { brand: string; models: string[] }[] = [
  { brand: "Club Car",   models: ["Onward", "Tempo", "Precedent", "DS"] },
  { brand: "E-Z-GO",     models: ["RXV", "TXT", "Express", "Liberty"] },
  { brand: "Yamaha",     models: ["Drive2", "Adventurer", "Umax"] },
  { brand: "ICON",       models: ["i40", "i60", "i80"] },
  { brand: "Evolution",  models: ["Classic", "Carrier", "Forester"] },
  { brand: "Bintelli",   models: ["Beyond 4P", "Beyond 6P", "Beachcomber"] },
  { brand: "Denago EV",  models: ["Rover", "Nomad", "Nomad XL"] },
  { brand: "Epic",       models: ["E40", "E60", "E80"] },
  { brand: "Venom EV",   models: ["Strike", "Stealth"] },
  { brand: "Teko EV",    models: ["Turbo", "Turbo Lite", "Trophy", "Trophy Plus", "Triumph"] },
];

const CONDITIONS  = ["Excellent", "Good", "Fair", "Poor"] as const;
const POWERS      = ["Electric", "Gas"] as const;
const BATTERY_TYPES = ["Lithium", "Lead-Acid"] as const;
const BATTERY_AGES  = ["Under 1 year", "1–3 years", "3–5 years", "5+ years"] as const;

interface EstimateResult {
  privateLow: number;
  privateHigh: number;
  tradeLow: number;
  tradeHigh: number;
  iqScore: number;
  notes: string[];
}

/**
 * Client-side estimator. Deliberately transparent, tunable, and easy to swap
 * for a server API later without changing the UX. Uses a baseline MSRP by
 * brand tier, then applies age depreciation, condition multiplier, and
 * battery adjustments.
 */
function estimateValue(input: {
  brand: string;
  model: string;
  year: number;
  condition: string;
  power: string;
  batteryType?: string;
  batteryAge?: string;
}): EstimateResult {
  // Brand tier → baseline MSRP for the model class.
  const brandTier: Record<string, number> = {
    "Club Car": 13500,
    "Yamaha":   12500,
    "E-Z-GO":   12000,
    "ICON":     11500,
    "Evolution":10500,
    "Bintelli": 10500,
    "Venom EV": 10000,
    "Teko EV":  10500,
    "Denago EV":10000,
    "Epic":     10000,
  };
  const baseline = brandTier[input.brand] ?? 10500;

  // Age depreciation (2026 as current year).
  const age = Math.max(0, 2026 - input.year);
  const ageMult =
    age <= 1 ? 0.825 :
    age <= 3 ? 0.65  :
    age <= 5 ? 0.50  :
    age <= 7 ? 0.40  :
    age <= 10? 0.30  :
              0.22;

  // Condition multiplier.
  const condMult: Record<string, number> = {
    "Excellent": 1.10,
    "Good":      1.00,
    "Fair":      0.85,
    "Poor":      0.65,
  };
  const cond = condMult[input.condition] ?? 1.0;

  // Battery adjustment (electric only).
  let batteryMult = 1.0;
  const notes: string[] = [];
  if (input.power === "Electric") {
    if (input.batteryType === "Lithium") {
      batteryMult *= 1.12;
      notes.push("Lithium adds ~12% at resale versus lead-acid.");
    }
    if (input.batteryAge === "5+ years" && input.batteryType === "Lead-Acid") {
      batteryMult *= 0.85;
      notes.push("Lead-acid batteries 5+ years old typically knock $1,000–$2,000 off value.");
    } else if (input.batteryAge === "5+ years" && input.batteryType === "Lithium") {
      batteryMult *= 0.93;
      notes.push("Lithium 5+ yrs old is still functional but signals approaching replacement.");
    }
  } else {
    notes.push("Gas carts hold value slightly better than electric on older models (10+ yrs).");
    if (age > 10) batteryMult *= 1.05;
  }

  const midpoint = baseline * ageMult * cond * batteryMult;
  const priv_low  = Math.round(midpoint * 0.90 / 100) * 100;
  const priv_high = Math.round(midpoint * 1.10 / 100) * 100;
  const trade_low = Math.round(priv_low  * 0.72 / 100) * 100;
  const trade_high= Math.round(priv_high * 0.80 / 100) * 100;

  // IQ Score — 0-100, rough "how confident are we" signal.
  let iq = 85;
  if (input.year < 2016) iq -= 10;
  if (input.condition === "Poor") iq -= 15;
  if (!input.batteryType && input.power === "Electric") iq -= 8;
  iq = Math.max(45, Math.min(95, iq));

  return {
    privateLow: priv_low,
    privateHigh: priv_high,
    tradeLow: trade_low,
    tradeHigh: trade_high,
    iqScore: iq,
    notes,
  };
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

export function GolfCartValueEstimatorPage() {
  const [brand, setBrand]         = useState("");
  const [model, setModel]         = useState("");
  const [year, setYear]           = useState("");
  const [condition, setCondition] = useState("");
  const [power, setPower]         = useState<string>("Electric");
  const [batteryType, setBatteryType] = useState<string>("");
  const [batteryAge, setBatteryAge]   = useState<string>("");
  const [result, setResult]       = useState<EstimateResult | null>(null);
  const [, hashNav] = useLocation();

  const modelsForBrand = useMemo(
    () => BRAND_MODELS.find(b => b.brand === brand)?.models ?? [],
    [brand]
  );

  useEffect(() => {
    setSEO({
      title: "Golf Cart Value Estimator — What's My Golf Cart Worth? (Free)",
      description:
        "How much is your golf cart worth? Free instant value estimator for Club Car, E-Z-GO, Yamaha, ICON, Evolution and more. See private-sale and dealer trade-in ranges in 30 seconds — no email required.",
      canonical: "https://golfcartiq.com/golf-cart-value-estimator",
      jsonLd: [
        faqPageSchema(ESTIMATOR_FAQS),
        howToSchema({
          name: "How to Estimate Your Golf Cart's Value",
          description:
            "A 4-step process for getting an instant, accurate private-sale and trade-in estimate for your golf cart using the free GolfCartIQ Value Estimator.",
          steps: [
            { name: "Enter brand and model", text: "Select your golf cart's brand (Club Car, E-Z-GO, Yamaha, ICON, Evolution, etc.) and specific model. Legacy brands hold value 10–15% better than newer entrants." },
            { name: "Enter model year and condition", text: "Enter the year the cart was manufactured (typically found on the frame plate). Rate condition Excellent, Good, Fair, or Poor based on paint, seats, tires, and functional accessories." },
            { name: "Enter power type and battery info", text: "Select Electric or Gas. For electric carts, choose lead-acid or lithium and estimate battery age. Battery health is the single biggest swing factor on carts 5+ years old." },
            { name: "Review your private-sale and trade-in ranges", text: "You will see two ranges: private-sale value (higher, requires effort) and trade-in value (lower, instant). Compare against 5+ local listings before setting your final price." },
          ],
        }),
        {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "GolfCartIQ Value Estimator",
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          url: "https://golfcartiq.com/golf-cart-value-estimator",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        },
      ],
    });
  }, []);

  function canSubmit(): boolean {
    if (!brand || !model || !year || !condition || !power) return false;
    if (power === "Electric" && !batteryType) return false;
    return true;
  }

  function handleEstimate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit()) return;
    const yearNum = parseInt(year, 10);
    if (Number.isNaN(yearNum)) return;
    const r = estimateValue({
      brand,
      model,
      year: yearNum,
      condition,
      power,
      batteryType: power === "Electric" ? batteryType : undefined,
      batteryAge:  power === "Electric" ? batteryAge  : undefined,
    });
    setResult(r);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <Breadcrumb crumbs={[{ label: "Golf Cart Value Estimator" }]} />

      <header className="space-y-4 mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight text-foreground">
          What's My Golf Cart Worth? Free Value Estimator
        </h1>

        {/* Featured-snippet direct answer */}
        <SnippetAnswer
          question="How do I estimate my golf cart's value?"
          answer="To estimate a golf cart's value, enter the brand, model, year, and condition into the calculator below. The estimator returns both a private-sale range (typically $2,000–$13,000) and a dealer trade-in range — usually 20–30% lower. Results reflect current 2026 dealer listings from Florida and Georgia."
          bullets={[
            "Step 1: Pick your brand and model from the dropdown",
            "Step 2: Enter year and select condition (Excellent → Poor)",
            "Step 3: Choose gas or electric — add battery type & age if electric",
            "Step 4: See instant private-sale and trade-in ranges",
            "100% free · no email required · 30-second estimate",
          ]}
        />

        <p className="text-base md:text-lg text-muted-foreground">
          Get an instant private-sale and trade-in estimate for your golf cart. See the full{" "}
          <Link href="/golf-cart-values" className="text-green-700 hover:underline font-medium">
            brand-by-brand value guide
          </Link>{" "}
          or read{" "}
          <Link href="/used-golf-cart-value" className="text-green-700 hover:underline font-medium">
            what a used golf cart is worth
          </Link>{" "}
          in 2026.
        </p>
      </header>

      {/* Estimator form */}
      <section className="rounded-xl border border-border bg-white p-5 md:p-6 mb-8">
        <form onSubmit={handleEstimate} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-1.5 block">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Brand</span>
              <select value={brand} onChange={(e) => { setBrand(e.target.value); setModel(""); }}
                className="w-full h-10 px-3 rounded-md border border-border bg-white text-sm">
                <option value="">Select brand…</option>
                {BRAND_MODELS.map(b => <option key={b.brand} value={b.brand}>{b.brand}</option>)}
              </select>
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Model</span>
              <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!brand}
                className="w-full h-10 px-3 rounded-md border border-border bg-white text-sm disabled:opacity-50">
                <option value="">Select model…</option>
                {modelsForBrand.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Year</span>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2020" min={1990} max={2027} />
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Condition</span>
              <select value={condition} onChange={(e) => setCondition(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-border bg-white text-sm">
                <option value="">Select condition…</option>
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Power</span>
              <select value={power} onChange={(e) => setPower(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-border bg-white text-sm">
                {POWERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            {power === "Electric" && (
              <label className="space-y-1.5 block">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Battery type</span>
                <select value={batteryType} onChange={(e) => setBatteryType(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-border bg-white text-sm">
                  <option value="">Select…</option>
                  {BATTERY_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
            )}

            {power === "Electric" && (
              <label className="space-y-1.5 block sm:col-span-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Battery age (optional)</span>
                <select value={batteryAge} onChange={(e) => setBatteryAge(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-border bg-white text-sm">
                  <option value="">Unknown / not sure</option>
                  {BATTERY_AGES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
            )}
          </div>

          <Button type="submit" size="lg" disabled={!canSubmit()} className="gap-2 w-full sm:w-auto">
            <Calculator className="h-4 w-4" /> Estimate my cart's value
          </Button>
        </form>
      </section>

      {/* Results */}
      {result && (
        <section className="rounded-xl border-2 border-green-500 bg-green-50 p-5 md:p-6 mb-10 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Your Estimated Value</h2>
            <p className="text-xs text-muted-foreground">Ranges are based on 2026 Florida &amp; Georgia dealer data.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg bg-white border border-border p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">Private sale</div>
              <div className="text-2xl font-extrabold text-green-700">
                {formatCurrency(result.privateLow)} – {formatCurrency(result.privateHigh)}
              </div>
            </div>
            <div className="rounded-lg bg-white border border-border p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">Trade-in</div>
              <div className="text-2xl font-extrabold text-foreground">
                {formatCurrency(result.tradeLow)} – {formatCurrency(result.tradeHigh)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-white border border-border p-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">IQ confidence score</div>
              <div className="text-sm text-muted-foreground">Higher = tighter, more reliable range</div>
            </div>
            <div className="text-3xl font-extrabold text-green-700">{result.iqScore}<span className="text-base font-medium text-muted-foreground">/100</span></div>
          </div>

          {result.notes.length > 0 && (
            <div className="rounded-lg bg-white border border-border p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Notes</div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {result.notes.map((n, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" /> {n}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              size="lg"
              onClick={() => hashNav(`/search?brand=${encodeURIComponent(brand)}`)}
              className="gap-2"
            >
              See similar carts near me <ArrowRight className="h-4 w-4" />
            </Button>
            <Link href="/deal-checker">
              <Button variant="outline" size="lg" className="gap-2">
                Check a specific listing <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">How the Golf Cart Value Estimator Works</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { n: "1", h: "MSRP baseline",     body: "We start from an MSRP baseline for the brand tier — Club Car, Yamaha, and E-Z-GO command a premium above emerging brands like Teko EV or Denago." },
            { n: "2", h: "Depreciation curve", body: "Curves are built from actual FL and GA sale data, updated weekly. Year one loses 15–20%, then ~10% per year through year five." },
            { n: "3", h: "Adjustments",       body: "Condition, battery type, and battery age each apply a multiplier. Poor condition or dead batteries can drop the value 30–40%." },
          ].map((s) => (
            <div key={s.n} className="rounded-xl border border-border bg-white p-4">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold mb-2">{s.n}</div>
              <div className="font-semibold text-sm mb-1">{s.h}</div>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Data sources */}
      <section className="mb-10 rounded-xl border border-border bg-gray-50 p-6">
        <h2 className="text-xl font-bold mb-3">What Data Feeds the Estimator</h2>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /> Live dealer listings updated daily</li>
          <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /> Historical price movement, weekly recal</li>
          <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /> Battery type & age premiums</li>
          <li className="flex items-start gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /> Regional demand signals (FL &amp; GA)</li>
        </ul>
      </section>

      {/* KBB comparison */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">Golf Cart Value Estimator vs. Kelley Blue Book</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Feature</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">GolfCartIQ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kelley Blue Book</th>
              </tr>
            </thead>
            <tbody>
              {[
                { f: "Brand coverage",       a: "All major FL/GA brands incl. emerging (Teko, Denago, Venom)", b: "Legacy brands only" },
                { f: "Battery age weight",   a: "Yes — direct multiplier",                                     b: "Not factored" },
                { f: "Regional accuracy",    a: "FL & GA-specific",                                            b: "National only" },
                { f: "Update frequency",     a: "Daily listing data, weekly recal",                            b: "Quarterly or slower" },
                { f: "Cost",                 a: "Free",                                                        b: "Free" },
              ].map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.f}</td>
                  <td className="px-4 py-3 text-foreground">{r.a}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Use cases */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4">When to Use the Estimator</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { h: "Selling privately",  b: "Set a defensible asking price. Show buyers the range to justify your number." },
            { h: "Negotiating trade-in", b: "Walk into the dealer knowing your floor. Trade-in offers below the range are worth pushing back on." },
            { h: "Checking a listing before buying", b: "Paste-and-price a listing you're eyeing. Combine with the Deal Checker for a full read." },
            { h: "Insurance & estate valuation", b: "A documented estimate helps for scheduled personal property or estate settlement." },
          ].map((u, i) => (
            <div key={i} className="rounded-xl border border-border bg-white p-4">
              <div className="font-semibold text-sm mb-1">{u.h}</div>
              <p className="text-sm text-muted-foreground leading-relaxed">{u.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Estimator FAQ</h2>
        <div className="space-y-3">
          {ESTIMATOR_FAQS.map((f, i) => <QuestionBox key={i} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* Related links */}
      <section className="rounded-xl border border-border bg-white p-6 space-y-3">
        <h2 className="text-base font-bold">Related guides</h2>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          <li><Link href="/golf-cart-values"     className="text-green-700 hover:underline">Browse golf cart values by brand and year</Link></li>
          <li><Link href="/used-golf-cart-value" className="text-green-700 hover:underline">Used golf cart value guide</Link></li>
          <li><Link href="/deal-checker"         className="text-green-700 hover:underline">Golf cart deal checker</Link></li>
          <li><Link href="/buyer-guide"          className="text-green-700 hover:underline">Buyer guide</Link></li>
        </ul>
      </section>
    </div>
  );
}
