/**
 * Pure Stripe webhook → dealer_subscriptions logic (no Express, injectable DB)
 * so signature handling and idempotency can be unit-tested without real keys.
 */
import Stripe from "stripe";

export type Plan = "featured" | "insights";

export interface BillingDb {
  hasEvent(id: string): Promise<boolean>;
  recordEvent(id: string): Promise<void>;
  upsertSubscription(row: SubscriptionRow): Promise<void>;
  findDealerBySubscription(subId: string): Promise<number | null>;
}

export interface SubscriptionRow {
  dealer_id: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  plan: Plan | null;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  updated_at: string;
}

export function priceToPlan(priceId: string | undefined | null, env = process.env): Plan | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_FEATURED) return "featured";
  if (priceId === env.STRIPE_PRICE_INSIGHTS) return "insights";
  return null;
}

export function planToPrice(plan: string, env = process.env): string | null {
  if (plan === "featured") return env.STRIPE_PRICE_FEATURED || null;
  if (plan === "insights") return env.STRIPE_PRICE_INSIGHTS || null;
  return null;
}

/** Verify signature against the raw body. Throws on any problem (caller returns 400). */
export function verifyStripeEvent(stripe: Stripe, rawBody: unknown, signature: unknown, secret: string | undefined): Stripe.Event {
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  if (!Buffer.isBuffer(rawBody) && typeof rawBody !== "string") throw new Error("raw body unavailable");
  if (typeof signature !== "string" || !signature) throw new Error("missing stripe-signature");
  return stripe.webhooks.constructEvent(rawBody as Buffer, signature, secret);
}

function subToRow(sub: Stripe.Subscription, dealerId: number): SubscriptionRow {
  const item: any = sub.items?.data?.[0];
  const periodEnd: number | undefined = (sub as any).current_period_end ?? item?.current_period_end;
  return {
    dealer_id: dealerId,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
    stripe_subscription_id: sub.id,
    plan: priceToPlan(item?.price?.id),
    status: sub.status,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
}

export type HandleResult = "processed" | "duplicate" | "ignored";

/**
 * Idempotent: an event id already in stripe_events is skipped. The id is recorded
 * only after successful processing, so a failed attempt is retried by Stripe.
 * The upsert itself is keyed on dealer_id, so a concurrent duplicate is harmless.
 */
export async function handleStripeEvent(
  event: Stripe.Event,
  db: BillingDb,
  retrieveSubscription: (id: string) => Promise<Stripe.Subscription>,
): Promise<HandleResult> {
  if (await db.hasEvent(event.id)) return "duplicate";
  let result: HandleResult = "ignored";

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const dealerId = Number(s.metadata?.dealer_id);
    if (s.mode === "subscription" && s.subscription && Number.isInteger(dealerId) && dealerId > 0) {
      const subId = typeof s.subscription === "string" ? s.subscription : s.subscription.id;
      const sub = await retrieveSubscription(subId);
      await db.upsertSubscription(subToRow(sub, dealerId));
      result = "processed";
    }
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    let dealerId = Number(sub.metadata?.dealer_id);
    if (!Number.isInteger(dealerId) || dealerId <= 0) dealerId = (await db.findDealerBySubscription(sub.id)) ?? 0;
    if (dealerId > 0) {
      const row = subToRow(sub, dealerId);
      if (event.type === "customer.subscription.deleted") row.status = "canceled";
      await db.upsertSubscription(row);
      result = "processed";
    }
  }

  await db.recordEvent(event.id);
  return result;
}
