/**
 * Battery Guide Pages — 4 static pages
 * Routes: /golf-cart-batteries, /golf-cart-batteries/lithium-vs-lead-acid,
 *         /golf-cart-batteries/105ah-vs-150ah, /golf-cart-batteries/charger-included
 */
import { useEffect } from "react";
import { Link } from "wouter";
import { setSEO } from "@/lib/seo";
import { Zap, CheckCircle, XCircle, ChevronRight, HelpCircle } from "lucide-react";

// ── Shared primitives ────────────────────────────────────────────────────────

function Breadcrumb({ crumbs }: { crumbs: { label: string; href?: string }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
      <Link href="/" className="hover:text-foreground">CartIQ</Link>
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

function CheckList({ items, color = "green" }: { items: string[]; color?: "green" | "red" }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
          {color === "green"
            ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
            : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
          <span>{item}</span>
        </li>
      ))}
    </ul>
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

function CompareTable({ headers, rows }: {
  headers: string[];
  rows: { label: string; a: string; b: string; winner?: "a" | "b" | "tie" }[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
              <td className="px-4 py-3 font-medium text-foreground">{r.label}</td>
              <td className={`px-4 py-3 ${r.winner === "a" ? "text-green-700 font-semibold" : "text-muted-foreground"}`}>{r.a}</td>
              <td className={`px-4 py-3 ${r.winner === "b" ? "text-green-700 font-semibold" : "text-muted-foreground"}`}>{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CTABar() {
  return (
    <div className="rounded-2xl border border-border bg-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-10">
      <div>
        <p className="font-bold text-sm">Ready to compare listings?</p>
        <p className="text-xs text-muted-foreground mt-0.5">Search by battery type and see CartIQ's deal rating on every listing.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <a href="/#/search?batteryType=lithium"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
          Browse Lithium Carts <ChevronRight className="h-4 w-4" />
        </a>
        <a href="/#/deal-checker"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">
          Check a Deal
        </a>
      </div>
    </div>
  );
}

function InternalLinks() {
  return (
    <div className="mt-10 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Battery Guides</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/golf-cart-batteries" className="text-xs text-green-700 hover:underline">Battery Overview</Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/golf-cart-batteries/lithium-vs-lead-acid" className="text-xs text-green-700 hover:underline">Lithium vs Lead-Acid</Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/golf-cart-batteries/105ah-vs-150ah" className="text-xs text-green-700 hover:underline">105Ah vs 150Ah</Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/golf-cart-batteries/charger-included" className="text-xs text-green-700 hover:underline">Does It Include a Charger?</Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/how-it-works" className="text-xs text-green-700 hover:underline">How CartIQ Scores Listings</Link>
      </div>
    </div>
  );
}

// ── PAGE 1: Battery Overview ─────────────────────────────────────────────────

export function BatteryOverviewPage() {
  useEffect(() => {
    setSEO({
      title: "Golf Cart Battery Guide | Lithium vs Lead-Acid, Chargers & More | CartIQ",
      description: "Everything you need to know about golf cart batteries — lithium vs lead-acid, amp hours, charger compatibility, and what to ask before you buy.",
      canonical: "https://cartiq-chi.vercel.app/golf-cart-batteries",
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Breadcrumb crumbs={[{ label: "Battery Guide" }]} />

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Zap className="h-4 w-4 text-green-600" />
          <span>CartIQ Battery Guide</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-3">Golf Cart Battery Guide</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          The battery is the most important — and most misrepresented — spec on any used golf cart.
          This guide explains the differences between lithium and lead-acid, what amp hours mean for range,
          why charger compatibility matters, and what to ask before you buy.
        </p>

        {/* Quick nav cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          {[
            { href: "/golf-cart-batteries/lithium-vs-lead-acid", title: "Lithium vs Lead-Acid", desc: "Which battery type is right for you?" },
            { href: "/golf-cart-batteries/105ah-vs-150ah", title: "105Ah vs 150Ah", desc: "How far will each pack take you?" },
            { href: "/golf-cart-batteries/charger-included", title: "Charger Included?", desc: "What to check before buying used." },
          ].map(c => (
            <Link key={c.href} href={c.href}
              className="block border border-border rounded-xl p-4 bg-white hover:shadow-sm transition-shadow group">
              <p className="font-semibold text-sm group-hover:text-green-700 transition-colors">{c.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
              <span className="text-xs text-green-700 mt-2 inline-flex items-center gap-1">Read more <ChevronRight className="h-3 w-3" /></span>
            </Link>
          ))}
        </div>

        <h2 className="text-lg font-bold mb-3">Battery Types at a Glance</h2>
        <CompareTable
          headers={["Factor", "Lithium (LiFePO4)", "Lead-Acid (Flooded/AGM)"]}
          rows={[
            { label: "Lifespan", a: "8–12 years / 2,000+ cycles", b: "3–5 years / 500–800 cycles", winner: "a" },
            { label: "Weight", a: "60–80 lbs lighter", b: "Heavier — impacts range and handling", winner: "a" },
            { label: "Range", a: "25–50+ miles depending on Ah", b: "15–25 miles typical", winner: "a" },
            { label: "Maintenance", a: "Zero — sealed, no watering needed", b: "Regular watering + terminal cleaning", winner: "a" },
            { label: "Charge time", a: "2–4 hours typical", b: "8–10 hours typical", winner: "a" },
            { label: "Upfront cost", a: "Higher ($1,500–$3,500 pack)", b: "Lower ($600–$1,200 pack)", winner: "b" },
            { label: "Total cost of ownership", a: "Lower over 10 years", b: "Higher — multiple replacement cycles", winner: "a" },
            { label: "Cold weather performance", a: "Good — BMS protects cells", b: "Degraded capacity in cold", winner: "a" },
          ]}
        />

        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-bold">Questions to Ask the Seller</h2>
          <div className="space-y-3">
            {[
              { q: "What battery type is installed?", a: "Lithium, flooded lead-acid, or AGM. Never assume — ask for the battery brand and model number." },
              { q: "How old is the battery?", a: "For lead-acid: anything over 3 years is approaching replacement. For lithium: ask for cycle count if available." },
              { q: "Is the original charger included?", a: "A lithium cart requires a lithium-compatible charger. A lead-acid charger on a lithium pack can damage the battery management system and void the warranty." },
              { q: "Is the battery under warranty?", a: "Ask for the warranty document. Some lithium brands offer 5–8 year warranties through authorized dealers. Verify the dealer is authorized." },
            ].map((item, i) => (
              <QuestionBox key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        <CTABar />
        <InternalLinks />
      </div>
    </div>
  );
}

// ── PAGE 2: Lithium vs Lead-Acid ─────────────────────────────────────────────

export function LithiumVsLeadAcidPage() {
  useEffect(() => {
    setSEO({
      title: "Lithium vs Lead-Acid Golf Cart Batteries: Which Is Better? | CartIQ",
      description: "Lithium vs lead-acid golf cart batteries compared — lifespan, range, maintenance, cost, and total cost of ownership. Make the right call before buying.",
      canonical: "https://cartiq-chi.vercel.app/golf-cart-batteries/lithium-vs-lead-acid",
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Breadcrumb crumbs={[{ label: "Battery Guide", href: "/golf-cart-batteries" }, { label: "Lithium vs Lead-Acid" }]} />

        <h1 className="text-2xl font-bold tracking-tight mb-3">Lithium vs Lead-Acid Golf Cart Batteries</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          Lithium wins on almost every performance metric — longer range, longer life, zero maintenance,
          lighter weight. Lead-acid wins on upfront cost only. The right choice depends on your budget,
          daily mileage, and how long you plan to keep the cart.
        </p>

        <CompareTable
          headers={["Factor", "Lithium (LiFePO4)", "Lead-Acid"]}
          rows={[
            { label: "Lifespan", a: "8–12 years (2,000+ cycles)", b: "3–5 years (500–800 cycles)", winner: "a" },
            { label: "Range per charge", a: "25–50 miles (105–160Ah)", b: "15–25 miles typical", winner: "a" },
            { label: "Weight saved", a: "60–80 lbs lighter on average", b: "Heavy — affects performance", winner: "a" },
            { label: "Maintenance", a: "None — sealed BMS-managed pack", b: "Monthly watering + terminal cleaning", winner: "a" },
            { label: "Charge time", a: "2–4 hours", b: "8–10 hours", winner: "a" },
            { label: "Self-discharge", a: "~2% per month", b: "~5–15% per month", winner: "a" },
            { label: "Upfront battery cost", a: "$1,500–$3,500", b: "$600–$1,200", winner: "b" },
            { label: "Replacement cycle cost", a: "One pack over 10 years", b: "2–3 packs over 10 years", winner: "a" },
            { label: "Charger compatibility", a: "Requires lithium-specific charger", b: "Standard lead-acid charger", winner: "tie" },
            { label: "Cold weather", a: "BMS manages cell temperature", b: "Capacity drops significantly in cold", winner: "a" },
          ]}
        />

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h2 className="font-bold text-base text-green-700">Lithium — Best For</h2>
            <CheckList items={[
              "Daily community commuting (20+ miles/day)",
              "Coastal environments (salt air, humidity)",
              "Buyers keeping the cart 5+ years",
              "Anyone who wants zero battery maintenance",
              "Hilly terrain (lighter cart = more torque)",
              "Vacation rental / multi-user carts",
            ]} />
          </div>
          <div className="space-y-2">
            <h2 className="font-bold text-base text-amber-700">Lead-Acid — Best For</h2>
            <CheckList color="red" items={[
              "Tight budget — lowest upfront cost",
              "Occasional / seasonal use carts",
              "Buyers comfortable with maintenance",
              "Short-term ownership (under 3 years)",
              "Areas with cheap battery replacement",
            ]} />
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-bold">The Total Cost Math</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">10-Year Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Lithium</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Lead-Acid</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Battery pack (original)", "$2,500", "$900"],
                  ["Replacement packs", "$0", "$1,800 (×2 packs)"],
                  ["Maintenance cost", "$0", "$150 (watering, terminals)"],
                  ["Charger", "$250", "$150"],
                  ["Total battery cost", "$2,750", "$3,000"],
                ].map(([label, a, b], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                    <td className={`px-4 py-3 ${i === 4 ? "font-bold text-foreground" : "text-muted-foreground"}`}>{label}</td>
                    <td className={`px-4 py-3 ${i === 4 ? "font-bold text-green-700" : "text-muted-foreground"}`}>{a}</td>
                    <td className={`px-4 py-3 ${i === 4 ? "font-bold text-foreground" : "text-muted-foreground"}`}>{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">Estimates based on average FL/GA market prices. Actual costs vary by brand and usage.</p>
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-bold">Buyer Checklist — Used Lithium Cart</h2>
          <CheckList items={[
            "Ask for the battery brand and model number (not just 'lithium')",
            "Confirm the BMS (Battery Management System) is functional — ask the dealer to demonstrate",
            "Verify the lithium-compatible charger is included",
            "Ask for the battery warranty document and confirm dealer authorization",
            "Check for any error codes or warning lights on the display",
            "Test range on a full charge before completing the purchase",
          ]} />
        </div>

        <CTABar />
        <InternalLinks />
      </div>
    </div>
  );
}

// ── PAGE 3: 105Ah vs 150Ah ───────────────────────────────────────────────────

export function AhComparePage() {
  useEffect(() => {
    setSEO({
      title: "105Ah vs 150Ah Golf Cart Battery: Range & What to Choose | CartIQ",
      description: "105Ah vs 150Ah lithium golf cart battery — how far will each pack go, what does the upgrade cost, and is it worth it for your use case?",
      canonical: "https://cartiq-chi.vercel.app/golf-cart-batteries/105ah-vs-150ah",
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Breadcrumb crumbs={[{ label: "Battery Guide", href: "/golf-cart-batteries" }, { label: "105Ah vs 150Ah" }]} />

        <h1 className="text-2xl font-bold tracking-tight mb-3">105Ah vs 150Ah Golf Cart Battery: Range, Cost & What to Choose</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          105Ah gets you 25–35 miles per charge — enough for most community and neighborhood use.
          150Ah (or 160Ah) extends that to 40–50+ miles. If your daily route is under 20 miles,
          105Ah is sufficient. If you use the cart heavily or have a large community to navigate,
          the upgrade is worth considering.
        </p>

        <CompareTable
          headers={["Factor", "105Ah (Standard)", "150Ah / 160Ah (Upgrade)"]}
          rows={[
            { label: "Estimated range", a: "25–35 miles per charge", b: "40–55 miles per charge", winner: "b" },
            { label: "Weight", a: "Lighter", b: "Slightly heavier (~5–10 lbs)", winner: "a" },
            { label: "Charge time", a: "2–3 hours typical", b: "3–5 hours typical", winner: "a" },
            { label: "Upfront premium", a: "Standard — no extra cost", b: "$500–$1,500 upgrade cost", winner: "a" },
            { label: "Best use case", a: "Community, neighborhood daily use", b: "Long routes, large communities, hilly terrain", winner: "tie" },
            { label: "Warranty impact", a: "Standard warranty applies", b: "Verify warranty covers upgraded pack", winner: "tie" },
          ]}
        />

        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-bold">Range Estimator by Use Case</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Use Case</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Daily Miles</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">105Ah Verdict</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">160Ah Verdict</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Small gated community", "5–10 mi", "✓ More than enough", "Overkill"],
                  ["Nocatee / The Villages daily", "10–20 mi", "✓ Sufficient", "Comfortable buffer"],
                  ["Large community + errands", "20–30 mi", "Marginal — daily charge required", "✓ Recommended"],
                  ["Heavy use / rental property", "30–40 mi", "⚠ Risk of range anxiety", "✓ Required"],
                  ["Hilly terrain", "15–25 mi", "Range reduced ~15–20%", "✓ Recommended"],
                ].map(([use, miles, a, b], i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                    <td className="px-4 py-3 text-foreground font-medium">{use}</td>
                    <td className="px-4 py-3 text-muted-foreground">{miles}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-bold">Questions to Ask Before Upgrading</h2>
          <div className="space-y-3">
            {[
              { q: "Does the 160Ah pack fit the same battery compartment?", a: "Most golf cart platforms designed for 105Ah will accept a 160Ah pack from the same manufacturer. Confirm with the dealer that the upgraded pack is a direct-fit upgrade for your specific model." },
              { q: "Is the upgraded pack covered by the same warranty?", a: "Not always. Venom EV, for example, explicitly covers the 105Ah Eco Battery with an 8-year warranty from authorized dealers — confirm the same terms apply to the 160Ah upgrade." },
              { q: "Do I need a different charger for 160Ah?", a: "You may need a higher-amperage charger to maintain reasonable charge times with a larger pack. The original charger will still work but may take significantly longer." },
              { q: "Does the upgrade require reprogramming the controller?", a: "On some platforms, yes. The BMS and motor controller may need recalibration when a larger-capacity pack is installed. A qualified dealer should handle this." },
            ].map((item, i) => (
              <QuestionBox key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        <CTABar />
        <InternalLinks />
      </div>
    </div>
  );
}

// ── PAGE 4: Charger Included ─────────────────────────────────────────────────

export function ChargerIncludedPage() {
  useEffect(() => {
    setSEO({
      title: "Does a Golf Cart Come With a Charger? | CartIQ",
      description: "Does a used golf cart include a charger? What to look for, lithium vs lead-acid charger compatibility, and what to budget if one isn't included.",
      canonical: "https://cartiq-chi.vercel.app/golf-cart-batteries/charger-included",
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Breadcrumb crumbs={[{ label: "Battery Guide", href: "/golf-cart-batteries" }, { label: "Charger Included?" }]} />

        <h1 className="text-2xl font-bold tracking-tight mb-3">Does a Golf Cart Come With a Charger?</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          New carts almost always include a charger. Used carts often don't — or they include the wrong
          charger for the battery. Never use a lead-acid charger on a lithium pack. Always confirm
          charger inclusion and compatibility before buying.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "New carts", verdict: "Almost always included", color: "green" },
            { label: "Used from dealer", verdict: "Usually included — verify", color: "amber" },
            { label: "Used private sale", verdict: "Often not included — ask", color: "red" },
          ].map(c => (
            <div key={c.label} className={`rounded-xl border p-4 text-center ${
              c.color === "green" ? "bg-green-50 border-green-200" :
              c.color === "amber" ? "bg-amber-50 border-amber-200" :
              "bg-red-50 border-red-200"
            }`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{c.label}</p>
              <p className={`text-sm font-semibold ${
                c.color === "green" ? "text-green-800" :
                c.color === "amber" ? "text-amber-800" :
                "text-red-800"
              }`}>{c.verdict}</p>
            </div>
          ))}
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm mb-8">
          <p className="font-bold text-red-800 mb-1">⚠ Critical: Never use a lead-acid charger on a lithium battery</p>
          <p className="text-red-900 leading-relaxed">
            A lead-acid charger applies a different charge profile (higher voltage, no BMS communication)
            that can overcharge lithium cells, trigger thermal runaway, or permanently damage the battery
            management system. It can also void your warranty. Always match charger to battery chemistry.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold">Charger Compatibility by Battery Type</h2>
          <CompareTable
            headers={["Battery Type", "Compatible Charger", "Cost to Replace"]}
            rows={[
              { label: "Lithium (LiFePO4)", a: "Lithium-specific charger with BMS communication", b: "$200–$400" },
              { label: "Flooded Lead-Acid (48V)", a: "Standard 48V lead-acid charger", b: "$100–$200" },
              { label: "AGM Lead-Acid", a: "AGM-compatible charger (same voltage, lower amperage)", b: "$120–$220" },
              { label: "Gas cart", a: "No charger needed — fuel only", b: "N/A" },
            ]}
          />
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-bold">Buyer Checklist — Charger</h2>
          <CheckList items={[
            "Ask the seller if a charger is included before agreeing to price",
            "Confirm the charger matches the battery chemistry (lithium vs. lead-acid)",
            "Check the charger's voltage matches the cart's pack voltage (48V, 72V, etc.)",
            "For lithium: confirm the charger has BMS communication capability",
            "Test the charger — plug it in and verify the cart begins charging correctly",
            "If no charger is included, budget $200–$400 for a lithium replacement and negotiate accordingly",
          ]} />
        </div>

        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-bold">Questions to Ask the Seller</h2>
          <div className="space-y-3">
            {[
              { q: "Is the original charger included with this cart?", a: "If not, ask why — original chargers are typically included with new carts and missing chargers on used carts sometimes indicate the charger failed or was misplaced. This is a negotiating point." },
              { q: "What amperage is the charger?", a: "Higher amperage chargers charge faster. A 20A charger will charge a 105Ah pack in roughly 5–6 hours. A 30A charger cuts that to 3–4 hours. Match amperage to your daily routine." },
              { q: "Is the charger covered by any warranty?", a: "Some manufacturers include the charger under the cart warranty. Ask for documentation if the charger is relatively new." },
            ].map((item, i) => (
              <QuestionBox key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        <CTABar />
        <InternalLinks />
      </div>
    </div>
  );
}
