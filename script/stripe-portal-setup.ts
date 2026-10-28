/**
 * Creates (or updates) the Stripe Customer Portal configuration for dealers.
 *   STRIPE_SECRET_KEY=sk_test_... STRIPE_PRICE_FEATURED=... STRIPE_PRICE_INSIGHTS=... \
 *   [PORTAL_RETURN_URL=https://golfcartiq.com/portal] [STRIPE_PORTAL_CONFIG_ID=bpc_...] npx tsx script/stripe-portal-setup.ts
 * - Dealers may switch between Featured and Insights (prorated), update payment method, view invoices.
 * - Cancel at period end only.
 * - ZIP add-on quantities are NOT editable in the portal (kept in sync by /api/portal/zip-billing),
 *   so the portal only lists the base-plan prices and quantity changes are disabled.
 * Set the printed id as STRIPE_PORTAL_CONFIG_ID so /api/billing-portal uses it.
 * Refuses live keys unless STRIPE_ALLOW_LIVE=1. Prints only ids.
 */
import Stripe from "stripe";
import { STRIPE_API_VERSION } from "../server/dealer-billing";

async function main() {
  const key = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY required");
  if (/^(sk|rk)_live_/.test(key) && process.env.STRIPE_ALLOW_LIVE !== "1") throw new Error("live key refused");
  const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION as any });
  const priceIds = [process.env.STRIPE_PRICE_FEATURED, process.env.STRIPE_PRICE_INSIGHTS].filter(Boolean) as string[];
  if (priceIds.length !== 2) throw new Error("STRIPE_PRICE_FEATURED and STRIPE_PRICE_INSIGHTS required");
  const byProduct = new Map<string, string[]>();
  for (const id of priceIds) {
    const p = await stripe.prices.retrieve(id);
    const prod = typeof p.product === "string" ? p.product : p.product.id;
    byProduct.set(prod, [...(byProduct.get(prod) || []), id]);
  }
  const params: Stripe.BillingPortal.ConfigurationCreateParams = {
    name: "GolfCartIQ dealers",
    business_profile: { headline: "Manage your GolfCartIQ dealer plan" },
    default_return_url: process.env.PORTAL_RETURN_URL || "https://golfcartiq.com/portal",
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "address", "name"] },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "unused", "switched_service", "other"] } },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"], // no "quantity": ZIP counts change only via the app
        proration_behavior: "create_prorations",
        products: [...byProduct].map(([product, prices]) => ({ product, prices })),
      },
    },
  } as any;
  const existing = (process.env.STRIPE_PORTAL_CONFIG_ID || "").trim();
  const cfg = existing
    ? await stripe.billingPortal.configurations.update(existing, params as any)
    : await stripe.billingPortal.configurations.create(params as any);
  console.log(JSON.stringify({ portal_configuration: cfg.id, livemode: cfg.livemode }));
}
main().catch((e) => { console.error("portal setup failed:", e.message); process.exit(1); });
