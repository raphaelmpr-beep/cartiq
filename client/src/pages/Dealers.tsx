import { useEffect } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setSEO } from "@/lib/seo";

const PLANS = [
  { id: "featured", name: "Featured Dealer", price: 199, features: [
    "Claimed & verified dealer badge",
    "Enhanced dealer profile: logo, hours, brands, description",
    "Highlighted placement in your area",
    "Metrics teaser: your profile views and listing views",
  ] },
  { id: "insights", name: "Dealer Insights", price: 499, features: [
    "Everything in Featured Dealer",
    "Full metrics dashboard: profile views, listing views, lead clicks (7 / 30 days)",
    "Area demand: listing views and searches by brand in your state",
    "Your share of area listing views, and top brands vs. what you stock",
  ] },
] as const;

export default function Dealers() {
  useEffect(() => {
    // noindex until the page is approved for nav/sitemap.
    setSEO({ title: "For Dealers", description: "Claim your dealership on GolfCartIQ. Featured Dealer and Dealer Insights plans.", canonical: "https://golfcartiq.com/dealers", noindex: true });
  }, []);
  const cancelled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("checkout") === "cancelled";
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-2">For Dealers</h1>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        Claim your dealership, keep your profile accurate, and see how shoppers in your area engage with your inventory.
        Every number we show you is counted from real visits. We never show estimates or sample data.
      </p>
      {cancelled && <p className="mb-6 text-sm text-amber-700">Checkout was cancelled. You have not been charged.</p>}
      <div className="grid md:grid-cols-2 gap-6">
        {PLANS.map((p) => (
          <div key={p.id} className={`rounded-xl border p-6 bg-white flex flex-col ${p.id === "insights" ? "border-green-600 shadow-md" : "border-border"}`} data-testid={`plan-${p.id}`}>
            <h2 className="text-xl font-semibold">{p.name}</h2>
            <p className="mt-2"><span className="text-3xl font-bold">${p.price}</span><span className="text-muted-foreground">/mo</span></p>
            <ul className="mt-4 space-y-2 text-sm flex-1">
              {p.features.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="text-green-600 shrink-0 mt-0.5" />{f}</li>)}
            </ul>
            <a href={`/portal?plan=${p.id}`} className="mt-6"><Button className="w-full">Get started</Button></a>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-6">
        Billed monthly, cancel anytime from the billing portal. Your dealer claim is verified by our team (we check your email
        domain or call your listed phone) before your profile changes and featured placement go live.
      </p>
    </div>
  );
}
