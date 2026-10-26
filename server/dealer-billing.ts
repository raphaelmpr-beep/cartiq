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
  /** Re-derive dealer_zip_placements.status from the stored quantities + subscription status. */
  syncZipPlacements(dealerId: number): Promise<void>;
}

export type ZipProduct = "featured_dealer" | "featured_listings";
export function zipPriceFor(product: ZipProduct, env = process.env): string | null {
  return (product === "featured_dealer" ? env.STRIPE_PRICE_ZIP_FEATURED : env.STRIPE_PRICE_ZIP_LISTINGS) || null;
}
export function priceToZipProduct(priceId: string | undefined | null, env = process.env): ZipProduct | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_ZIP_FEATURED) return "featured_dealer";
  if (priceId === env.STRIPE_PRICE_ZIP_LISTINGS) return "featured_listings";
  return null;
}

/** Minimal shape of a Stripe Price we need (tiers expanded). */
export interface PriceLike {
  billing_scheme?: string | null; unit_amount?: number | null; tiers_mode?: string | null;
  tiers?: { up_to: number | null; unit_amount: number | null; flat_amount: number | null }[] | null;
}
/** Monthly total in cents for `qty` units, following Stripe's per_unit / graduated / volume rules. */
export function priceForQuantity(price: PriceLike, qty: number): number {
  qty = Math.max(0, Math.floor(qty));
  if (qty === 0) return 0;
  if (price.billing_scheme !== "tiered" || !price.tiers?.length) return (price.unit_amount ?? 0) * qty;
  const tiers = price.tiers;
  if (price.tiers_mode === "volume") {
    const t = tiers.find((t) => t.up_to === null || qty <= t.up_to)!;
    return (t.unit_amount ?? 0) * qty + (t.flat_amount ?? 0);
  }
  let total = 0, prev = 0;
  for (const t of tiers) {
    const cap = t.up_to ?? Infinity;
    const n = Math.min(qty, cap) - prev;
    if (n <= 0) break;
    total += (t.unit_amount ?? 0) * n + (t.flat_amount ?? 0);
    prev = Math.min(qty, cap);
    if (qty <= cap) break;
  }
  return total;
}

export interface SubscriptionRow {
  dealer_id: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  plan: Plan | null;
  zip_featured_quantity: number;
  zip_listings_quantity: number;
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

export function subToRow(sub: Stripe.Subscription, dealerId: number): SubscriptionRow {
  const items: any[] = sub.items?.data ?? [];
  const item: any = items.find((i) => priceToPlan(i?.price?.id)) ?? items[0];
  const qty = (p: ZipProduct) => items.filter((i) => priceToZipProduct(i?.price?.id) === p).reduce((a, i) => a + (i.quantity ?? 0), 0);
  const periodEnd: number | undefined = (sub as any).current_period_end ?? items[0]?.current_period_end;
  return {
    dealer_id: dealerId,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
    stripe_subscription_id: sub.id,
    plan: priceToPlan(item?.price?.id),
    zip_featured_quantity: qty("featured_dealer"),
    zip_listings_quantity: qty("featured_listings"),
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
      await db.syncZipPlacements(dealerId);
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
      await db.syncZipPlacements(dealerId);
      result = "processed";
    }
  }

  await db.recordEvent(event.id);
  return result;
}
