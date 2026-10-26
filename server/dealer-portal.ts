/**
 * Dealer self-serve: auth proxy, claim, Stripe checkout/billing/webhook,
 * portal profile + metrics, and site_events tracking.
 *
 * Secrets come only from env. The service-role client never leaves the server.
 * User-scoped reads/RPCs run with the caller's JWT so Postgres RLS applies.
 */
import type { Express, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin, getSupabaseUrl } from "./supabase-admin";
import { handleStripeEvent, verifyStripeEvent, planToPrice, zipPriceFor, priceForQuantity, type BillingDb, type ZipProduct } from "./dealer-billing";

let _stripe: Stripe | null = null;
export function stripeClient(): Stripe {
  const key = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) throw Object.assign(new Error("Billing is not configured yet"), { status: 503 });
  if (key.startsWith("sk_live_") && process.env.STRIPE_ALLOW_LIVE !== "1") {
    throw Object.assign(new Error("Live Stripe keys are disabled for this MVP (test mode only)"), { status: 503 });
  }
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

function anonKey(): string {
  const k = (process.env.SUPABASE_ANON_KEY || "").trim();
  if (!k) throw new Error("SUPABASE_ANON_KEY is required");
  return k;
}

function userClient(token: string): SupabaseClient {
  return createClient(getSupabaseUrl(), anonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function siteUrl(req: Request): string {
  const env = (process.env.PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (env) return env;
  const host = req.get("x-forwarded-host") || req.get("host");
  const proto = req.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

interface AuthedReq extends Request { user?: { id: string; email?: string }; token?: string }

async function requireUser(req: AuthedReq, res: Response, next: NextFunction) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "Sign in required" });
  try {
    const { data, error } = await supabaseAdmin().auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Session expired. Please sign in again." });
    req.user = { id: data.user.id, email: data.user.email ?? undefined };
    req.token = token;
    next();
  } catch (e: any) {
    res.status(503).json({ error: "Auth unavailable" });
  }
}

function fail(res: Response, e: any) {
  const status = e?.status && Number.isInteger(e.status) ? e.status : 500;
  res.status(status).json({ error: status === 500 ? "Something went wrong" : e.message });
  if (status === 500) console.error("[dealer-portal]", e?.message || e);
}

/** The caller's claim row (any status), read with their own JWT under RLS. */
async function myClaim(token: string) {
  const { data, error } = await userClient(token).from("dealer_accounts").select("*").maybeSingle();
  if (error) throw error;
  return data as null | { user_id: string; dealer_id: number | null; status: string; submitted_dealer: any; created_at: string };
}

const BOT_UA = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|python-requests|curl|wget|axios|node-fetch|go-http|java\/|scrapy|httpclient|phantom|puppeteer|playwright/i;
export function isBotUserAgent(ua: string | undefined): boolean { return !ua || BOT_UA.test(ua); }

const SITE_EVENT_TYPES = new Set(["dealer_profile_view", "listing_view", "lead_click", "search"]);
const LEAD_TYPES = new Set(["phone", "email", "website", "directions"]);
const str = (v: any, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

export function registerDealerRoutes(app: Express, requireAdmin: (req: any, res: any, next: any) => void) {
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
  const siteEventLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, message: { ok: false } });

  // ─── Auth (Supabase Auth via server; tokens kept in the browser) ───────────
  app.post("/api/dealer-auth/signup", authLimiter, async (req, res) => {
    try {
      const email = str(req.body?.email, 200), password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!email || password.length < 8) return res.status(400).json({ error: "Email and a password of 8+ characters are required" });
      const sb = createClient(getSupabaseUrl(), anonKey(), { auth: { persistSession: false } });
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${siteUrl(req)}/portal` } });
      if (error) return res.status(400).json({ error: error.message });
      res.json({ session: data.session ? pickSession(data.session) : null, needsEmailConfirm: !data.session });
    } catch (e) { fail(res, e); }
  });
  app.post("/api/dealer-auth/login", authLimiter, async (req, res) => {
    try {
      const email = str(req.body?.email, 200), password = typeof req.body?.password === "string" ? req.body.password : "";
      const sb = createClient(getSupabaseUrl(), anonKey(), { auth: { persistSession: false } });
      if (email && !password) {
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${siteUrl(req)}/portal` } });
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ magicLinkSent: true });
      }
      const { data, error } = await sb.auth.signInWithPassword({ email: email || "", password });
      if (error || !data.session) return res.status(401).json({ error: "Invalid email or password" });
      res.json({ session: pickSession(data.session) });
    } catch (e) { fail(res, e); }
  });
  app.post("/api/dealer-auth/refresh", authLimiter, async (req, res) => {
    try {
      const refresh_token = str(req.body?.refresh_token, 2000);
      if (!refresh_token) return res.status(400).json({ error: "refresh_token required" });
      const sb = createClient(getSupabaseUrl(), anonKey(), { auth: { persistSession: false } });
      const { data, error } = await sb.auth.refreshSession({ refresh_token });
      if (error || !data.session) return res.status(401).json({ error: "Session expired" });
      res.json({ session: pickSession(data.session) });
    } catch (e) { fail(res, e); }
  });

  // ─── Claim ────────────────────────────────────────────────────────────────
  app.get("/api/dealer-search", async (req, res) => {
    try {
      const q = (str(req.query.q, 80) || "").replace(/[%_,()]/g, " ").trim();
      if (q.length < 2) return res.json([]);
      const { data, error } = await supabaseAdmin().from("dealers")
        .select("id,name,city,state").or(`name.ilike.%${q}%,city.ilike.%${q}%`).is("is_duplicate_of", null)
        .order("name").limit(20);
      if (error) throw error;
      res.json(data || []);
    } catch (e) { fail(res, e); }
  });

  app.post("/api/dealer-claims", requireUser, async (req: AuthedReq, res) => {
    try {
      const existing = await myClaim(req.token!);
      if (existing) return res.status(409).json({ error: "You already have a claim", claim: existing });
      const dealerId = Number(req.body?.dealer_id);
      const row: any = { user_id: req.user!.id, claimant_email: req.user!.email ?? null };
      if (Number.isInteger(dealerId) && dealerId > 0) row.dealer_id = dealerId;
      else {
        const sd = req.body?.submitted_dealer || {};
        const name = str(sd.name, 120);
        if (!name) return res.status(400).json({ error: "Pick a dealership or enter its name" });
        row.submitted_dealer = { name, city: str(sd.city, 80), state: str(sd.state, 2), website_url: str(sd.website_url, 300), phone: str(sd.phone, 40) };
      }
      // Inserted with the user's JWT: RLS forces status='pending' and user_id = auth.uid().
      const { data, error } = await userClient(req.token!).from("dealer_accounts").insert(row).select().single();
      if (error) return res.status(400).json({ error: error.code === "23503" ? "Unknown dealer" : "Could not create claim" });
      res.json({ claim: data });
    } catch (e) { fail(res, e); }
  });

  // ─── Portal ───────────────────────────────────────────────────────────────
  app.get("/api/portal/me", requireUser, async (req: AuthedReq, res) => {
    try {
      const claim = await myClaim(req.token!);
      let dealer: any = null, subscription: any = null, listings: any[] = [];
      if (claim?.dealer_id) {
        const admin = supabaseAdmin();
        const d = await admin.from("dealers").select("id,name,slug,street_address,city,state,zip,phone,email,website_url,hours_text,logo_url,brands_carried,profile_description").eq("id", claim.dealer_id).single();
        dealer = d.data;
        // Subscription is shown to the claimant even while pending (they may pay before approval).
        const s = await admin.from("dealer_subscriptions").select("plan,status,cancel_at_period_end,current_period_end").eq("dealer_id", claim.dealer_id).maybeSingle();
        subscription = s.data;
        if (claim.status === "approved") {
          const l = await admin.from("listings").select("id,title,brand,model,year,asking_price,sale_price,status,public_listing,city,state").eq("dealer_id", claim.dealer_id).order("updated_at", { ascending: false }).limit(500);
          listings = l.data || [];
        }
      }
      res.json({ user: req.user, claim, dealer, subscription, listings });
    } catch (e) { fail(res, e); }
  });

  app.patch("/api/portal/profile", requireUser, async (req: AuthedReq, res) => {
    try {
      const allowed = ["name", "street_address", "city", "state", "zip", "hours_text", "phone", "email", "website_url", "profile_description", "brands_carried"];
      const p: Record<string, any> = {};
      for (const k of allowed) if (k in (req.body || {})) p[k] = req.body[k];
      if (p.brands_carried && !Array.isArray(p.brands_carried)) return res.status(400).json({ error: "brands_carried must be a list" });
      // RPC enforces approved claim + column whitelist in the database.
      const { error } = await userClient(req.token!).rpc("update_my_dealer_profile", { p });
      if (error) return res.status(error.code === "42501" ? 403 : 400).json({ error: error.code === "42501" ? "Your claim must be approved before you can edit your profile" : "Could not save" });
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/portal/logo", requireUser, async (req: AuthedReq, res) => {
    try {
      const claim = await myClaim(req.token!);
      if (!claim?.dealer_id || claim.status !== "approved") return res.status(403).json({ error: "Your claim must be approved first" });
      const m = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUrl || ""));
      if (!m) return res.status(400).json({ error: "PNG, JPEG or WebP image required" });
      const buf = Buffer.from(m[3], "base64");
      if (buf.length > 180 * 1024) return res.status(400).json({ error: "Logo must be under 180 KB" });
      const ext = m[2] === "jpeg" ? "jpg" : m[2];
      const path = `${claim.dealer_id}/logo-${Date.now()}.${ext}`;
      const admin = supabaseAdmin();
      const up = await admin.storage.from("dealer-logos").upload(path, buf, { contentType: m[1], upsert: false });
      if (up.error) throw up.error;
      const url = admin.storage.from("dealer-logos").getPublicUrl(path).data.publicUrl;
      const { error } = await userClient(req.token!).rpc("update_my_dealer_profile", { p: { logo_url: url } });
      if (error) throw error;
      res.json({ logo_url: url });
    } catch (e) { fail(res, e); }
  });

  app.get("/api/portal/metrics", requireUser, async (req: AuthedReq, res) => {
    try {
      const days = req.query.days === "7" ? 7 : 30;
      const sb = userClient(req.token!);
      const own = await sb.rpc("get_dealer_metrics", { days });
      if (own.error) return res.status(403).json({ error: "Metrics need an approved claim and an active plan" });
      const out: any = { own: own.data };
      if (own.data?.plan === "insights") {
        const [area, home] = await Promise.all([sb.rpc("get_area_metrics", { days }), sb.rpc("get_homepage_metrics", { days })]);
        out.area = area.error ? null : area.data;
        out.homepage = home.error ? null : home.data;
      }
      res.json(out);
    } catch (e) { fail(res, e); }
  });

  // ─── Stripe ───────────────────────────────────────────────────────────────
  app.post("/api/checkout", requireUser, async (req: AuthedReq, res) => {
    try {
      const plan = String(req.body?.plan || "");
      const price = plan ? planToPrice(plan) : null;
      if (plan && plan !== "featured" && plan !== "insights") return res.status(400).json({ error: "Unknown plan" });
      if (plan && !price) return res.status(503).json({ error: "Billing is not configured yet" });
      const claim = await myClaim(req.token!);
      if (!claim) return res.status(400).json({ error: "Claim your dealership first" });
      if (!claim.dealer_id) return res.status(400).json({ error: "We're reviewing your new-dealer submission. You can pay once it's added." });
      if (claim.status === "rejected") return res.status(403).json({ error: "This claim was not approved" });
      const stripe = stripeClient();
      const admin = supabaseAdmin();
      const { data: existing } = await admin.from("dealer_subscriptions").select("stripe_customer_id,status").eq("dealer_id", claim.dealer_id).maybeSingle();
      if (existing && ["active", "trialing", "past_due"].includes(existing.status)) {
        return res.status(409).json({ error: "You already have a plan. Use Manage billing to change it." });
      }
      let customer = existing?.stripe_customer_id as string | undefined;
      if (!customer) {
        const found = await stripe.customers.search({ query: `metadata['dealer_id']:'${claim.dealer_id}'`, limit: 1 }).catch(() => null);
        customer = found?.data?.[0]?.id;
      }
      if (!customer) {
        const c = await stripe.customers.create({ email: req.user!.email, metadata: { dealer_id: String(claim.dealer_id), user_id: req.user!.id } });
        customer = c.id;
      }
      const lineItems: { price: string; quantity: number }[] = price ? [{ price, quantity: 1 }] : [];
      if (claim.status === "approved") {
        const counts = await zipCounts(claim.dealer_id);
        for (const p of ["featured_dealer", "featured_listings"] as ZipProduct[]) {
          const zp = zipPriceFor(p);
          if (counts[p] > 0) { if (!zp) return res.status(503).json({ error: "ZIP billing is not configured yet" }); lineItems.push({ price: zp, quantity: counts[p] }); }
        }
      }
      if (!lineItems.length) return res.status(400).json({ error: "Pick a plan or reserve at least one ZIP" });
      const metadata = { user_id: req.user!.id, dealer_id: String(claim.dealer_id), plan };
      const base = siteUrl(req);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer,
        line_items: lineItems,
        client_reference_id: claim.user_id, // dealer_accounts is keyed by user_id: that is the claim id
        metadata,
        subscription_data: { metadata },
        success_url: `${base}/portal?checkout=success`,
        cancel_url: `${base}/dealers?checkout=cancelled`,
      });
      res.json({ url: session.url });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/billing-portal", requireUser, async (req: AuthedReq, res) => {
    try {
      const claim = await myClaim(req.token!);
      if (!claim?.dealer_id) return res.status(400).json({ error: "No dealership on file" });
      const { data } = await supabaseAdmin().from("dealer_subscriptions").select("stripe_customer_id").eq("dealer_id", claim.dealer_id).maybeSingle();
      if (!data?.stripe_customer_id) return res.status(400).json({ error: "No billing account yet" });
      const s = await stripeClient().billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url: `${siteUrl(req)}/portal` });
      res.json({ url: s.url });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/stripe/webhook", async (req, res) => {
    let event: Stripe.Event;
    let stripe: Stripe;
    try {
      stripe = stripeClient();
      event = verifyStripeEvent(stripe, (req as any).rawBody, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
    } catch (e: any) {
      return res.status(400).json({ error: "Invalid signature" });
    }
    try {
      const result = await handleStripeEvent(event, supabaseBillingDb(), (id) => stripe.subscriptions.retrieve(id));
      res.json({ received: true, result });
    } catch (e: any) {
      console.error("[stripe-webhook]", event.type, e?.message);
      res.status(500).json({ error: "processing failed" }); // Stripe retries; event not recorded
    }
  });

  // ─── Per-ZIP placement ─────────────────────────────────────────────────────
  const pricesCache: { at: number; data: any } = { at: 0, data: null };
  app.get("/api/zip-pricing", async (req, res) => {
    try {
      const ids = { featured_dealer: zipPriceFor("featured_dealer"), featured_listings: zipPriceFor("featured_listings") };
      if (!ids.featured_dealer && !ids.featured_listings) return res.status(503).json({ error: "ZIP pricing is not configured yet" });
      if (!pricesCache.data || Date.now() - pricesCache.at > 5 * 60_000) {
        const stripe = stripeClient(); const out: any = {};
        for (const [k, id] of Object.entries(ids)) if (id) {
          const p = await stripe.prices.retrieve(id, { expand: ["tiers"] });
          out[k] = { currency: p.currency, billing_scheme: p.billing_scheme, tiers_mode: p.tiers_mode, unit_amount: p.unit_amount,
                     tiers: (p.tiers || []).map((t) => ({ up_to: t.up_to, unit_amount: t.unit_amount, flat_amount: t.flat_amount })), interval: p.recurring?.interval };
        }
        pricesCache.data = out; pricesCache.at = Date.now();
      }
      const q = (k: string) => Math.min(500, Math.max(0, Number(req.query[k]) || 0));
      const prices = pricesCache.data;
      const totals: any = {};
      for (const k of Object.keys(prices)) totals[k] = priceForQuantity(prices[k], q(k));
      res.json({ prices, quantities: { featured_dealer: q("featured_dealer"), featured_listings: q("featured_listings") }, totals_cents: totals });
    } catch (e) { fail(res, e); }
  });

  app.get("/api/zip-availability", requireUser, async (req: AuthedReq, res) => {
    try {
      const zips = String(req.query.zips || "").split(",").map((z) => z.trim()).filter((z) => /^\d{5}$/.test(z)).slice(0, 50);
      if (!zips.length) return res.json([]);
      const { data, error } = await userClient(req.token!).rpc("get_zip_availability", { p_zips: zips });
      if (error) throw error;
      res.json(data);
    } catch (e) { fail(res, e); }
  });

  app.get("/api/portal/zips", requireUser, async (req: AuthedReq, res) => {
    try {
      const sb = userClient(req.token!);
      const { data: placements, error } = await sb.from("dealer_zip_placements").select("id,zip,product,status,created_at,activated_at").order("created_at");
      if (error) throw error;
      const { data: sel } = await sb.from("dealer_zip_listings").select("placement_id,listing_id");
      res.json({ placements: placements || [], listings: sel || [] });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/portal/zips/:action", requireUser, async (req: AuthedReq, res) => {
    try {
      const sb = userClient(req.token!);
      const zip = String(req.body?.zip || ""), product = String(req.body?.product || "");
      let r: any;
      if (req.params.action === "reserve") r = await sb.rpc("reserve_zip_placement", { p_zip: zip, p_product: product });
      else if (req.params.action === "release") r = await sb.rpc("release_zip_placement", { p_zip: zip, p_product: product });
      else if (req.params.action === "listings") {
        const ids = Array.isArray(req.body?.listing_ids) ? req.body.listing_ids.map(Number).filter(Number.isInteger) : [];
        r = await sb.rpc("set_zip_listings", { p_zip: zip, p_listing_ids: ids });
      } else return res.status(404).json({ error: "unknown action" });
      if (r.error) {
        const msg = r.error.hint === "sold_out" || /sold out/.test(r.error.message) ? "That ZIP is sold out" : r.error.code === "42501" ? "Not allowed" : r.error.message;
        return res.status(r.error.hint === "sold_out" || /sold out/.test(r.error.message) ? 409 : 400).json({ error: msg });
      }
      res.json({ ok: true, status: r.data ?? null });
    } catch (e) { fail(res, e); }
  });

  /** Sets the ZIP subscription items' quantities to the dealer's reserved+active ZIP counts. */
  app.post("/api/portal/zip-billing", requireUser, async (req: AuthedReq, res) => {
    try {
      const claim = await myClaim(req.token!);
      if (!claim?.dealer_id || claim.status !== "approved") return res.status(403).json({ error: "Your claim must be approved first" });
      const admin = supabaseAdmin();
      const { data: sub } = await admin.from("dealer_subscriptions").select("stripe_subscription_id,status").eq("dealer_id", claim.dealer_id).maybeSingle();
      if (!sub?.stripe_subscription_id || !["active", "trialing", "past_due"].includes(sub.status)) {
        return res.status(409).json({ error: "No active subscription yet", checkout: true });
      }
      const stripe = stripeClient();
      const s = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
      const counts = await zipCounts(claim.dealer_id);
      const items: Stripe.SubscriptionUpdateParams.Item[] = [];
      for (const p of ["featured_dealer", "featured_listings"] as ZipProduct[]) {
        const priceId = zipPriceFor(p);
        if (!priceId) { if (counts[p]) return res.status(503).json({ error: "ZIP billing is not configured yet" }); continue; }
        const existing = s.items.data.find((i) => i.price.id === priceId);
        if (existing && counts[p] === 0) items.push({ id: existing.id, deleted: true });
        else if (existing) items.push({ id: existing.id, quantity: counts[p] });
        else if (counts[p] > 0) items.push({ price: priceId, quantity: counts[p] });
      }
      if (items.length) await stripe.subscriptions.update(s.id, { items, proration_behavior: "create_prorations" });
      res.json({ ok: true, quantities: counts }); // webhook (customer.subscription.updated) syncs DB + activates zips
    } catch (e) { fail(res, e); }
  });

  // Placement for a searcher's ZIP: paid, live placements only, every item labelled "Featured".
  app.get("/api/featured", async (req, res) => {
    try {
      const zip = String(req.query.zip || "");
      if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: "zip must be 5 digits" });
      const { data, error } = await supabaseAdmin().rpc("get_featured_for_zip", { p_zip: zip });
      if (error) throw error;
      res.set("Cache-Control", "public, max-age=60").json(data ?? { zip, label: "Featured", dealers: [], listings: [] });
    } catch (e) { fail(res, e); }
  });

  // ─── Tracking ─────────────────────────────────────────────────────────────
  app.post("/api/track/site-event", siteEventLimiter, async (req, res) => {
    res.json({ ok: true });
    try {
      if (isBotUserAgent(req.get("user-agent"))) return;
      const b = req.body || {};
      const type = String(b.eventType || "");
      if (!SITE_EVENT_TYPES.has(type)) return;
      const admin = supabaseAdmin();
      const row: any = { event_type: type, session_id: str(b.sessionId, 128) };
      if (type === "listing_view" || type === "lead_click") {
        const listingId = Number(b.listingId);
        if (Number.isInteger(listingId) && listingId > 0) {
          // Dealer/brand/location are taken from the DB, never trusted from the client.
          const { data: l } = await admin.from("listings").select("id,dealer_id,brand,state,city").eq("id", listingId).maybeSingle();
          if (!l) return;
          Object.assign(row, { listing_id: l.id, dealer_id: l.dealer_id, brand: l.brand, state: l.state, city: l.city });
        } else if (type === "listing_view") return;
        if (type === "lead_click") {
          if (!LEAD_TYPES.has(String(b.leadType))) return;
          row.lead_type = String(b.leadType);
          if (!row.dealer_id) {
            const dealerId = Number(b.dealerId);
            if (!Number.isInteger(dealerId) || dealerId <= 0) return;
            row.dealer_id = dealerId;
          }
        }
      } else if (type === "dealer_profile_view") {
        const dealerId = Number(b.dealerId);
        if (!Number.isInteger(dealerId) || dealerId <= 0) return;
        const { data: d } = await admin.from("dealers").select("id,state,city").eq("id", dealerId).maybeSingle();
        if (!d) return;
        Object.assign(row, { dealer_id: d.id, state: d.state, city: d.city });
      } else if (type === "search") {
        Object.assign(row, { brand: str(b.brand, 80), state: str(b.state, 2)?.toUpperCase() ?? null, city: str(b.city, 80), search_query: str(b.query, 200) });
        if (!row.brand && !row.state && !row.city && !row.search_query) return;
      }
      await admin.from("site_events").insert(row);
    } catch (_) { /* telemetry never breaks the page */ }
  });

  // Public: is this dealer currently featured? (approved claim + active/trialing sub)
  app.get("/api/dealers-featured/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.json({ featured: false });
      const { data } = await supabaseAdmin().rpc("dealer_is_featured", { p_dealer_id: id });
      res.set("Cache-Control", "public, max-age=60").json({ featured: Boolean(data) });
    } catch { res.json({ featured: false }); }
  });

  // ─── Admin: claim review ───────────────────────────────────────────────────
  app.get("/api/admin/dealer-claims", requireAdmin, async (_req, res) => {
    try {
      const admin = supabaseAdmin();
      const { data, error } = await admin.from("dealer_accounts").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((c: any) => c.dealer_id).filter(Boolean)));
      const { data: dealers } = ids.length ? await admin.from("dealers").select("id,name,phone,website_url,canonical_domain").in("id", ids) : { data: [] as any[] };
      const byId = new Map((dealers || []).map((d: any) => [d.id, d]));
      res.json((data || []).map((c: any) => {
        const d: any = byId.get(c.dealer_id);
        const emailDomain = (c.claimant_email || "").split("@")[1]?.toLowerCase() || "";
        const dom = (d?.canonical_domain || (d?.website_url || "").replace(/^https?:\/\//, "").split("/")[0] || "").replace(/^www\./, "").toLowerCase();
        return { ...c, dealer: d || null, email_domain_matches: Boolean(emailDomain && dom && (emailDomain === dom || emailDomain.endsWith("." + dom))) };
      }));
    } catch (e) { fail(res, e); }
  });
  app.post("/api/admin/dealer-claims/:userId/:action", requireAdmin, async (req, res) => {
    try {
      const action = req.params.action;
      if (action !== "approve" && action !== "reject") return res.status(400).json({ error: "approve or reject" });
      const patch: any = { status: action === "approve" ? "approved" : "rejected", approved_by: str(req.body?.approved_by, 80) || "admin" };
      if (action === "approve") patch.approved_at = new Date().toISOString();
      if (req.body?.dealer_id) patch.dealer_id = Number(req.body.dealer_id); // for new-dealer submissions
      const { data, error } = await supabaseAdmin().from("dealer_accounts").update(patch).eq("user_id", req.params.userId).select().single();
      if (error) return res.status(400).json({ error: error.code === "23505" ? "That dealer already has an approved owner" : error.message });
      res.json(data);
    } catch (e) { fail(res, e); }
  });
}

/** Billable ZIPs per product = reserved (pending, fresh) + active. */
async function zipCounts(dealerId: number): Promise<Record<ZipProduct, number>> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data, error } = await supabaseAdmin().from("dealer_zip_placements").select("product,status,created_at").eq("dealer_id", dealerId);
  if (error) throw error;
  const out: Record<ZipProduct, number> = { featured_dealer: 0, featured_listings: 0 };
  for (const r of data || []) if (r.status === "active" || (r.status === "pending" && r.created_at > since)) out[r.product as ZipProduct]++;
  return out;
}

function pickSession(s: any) {
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at };
}

function supabaseBillingDb(): BillingDb {
  const admin = supabaseAdmin();
  return {
    async hasEvent(id) {
      const { data, error } = await admin.from("stripe_events").select("id").eq("id", id).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async recordEvent(id) {
      const { error } = await admin.from("stripe_events").upsert({ id }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    },
    async upsertSubscription(row) {
      const { error } = await admin.from("dealer_subscriptions").upsert(row, { onConflict: "dealer_id" });
      if (error) throw error;
    },
    async syncZipPlacements(dealerId) {
      const { error } = await admin.rpc("sync_zip_placements", { p_dealer_id: dealerId });
      if (error) throw error;
    },
    async findDealerBySubscription(subId) {
      const { data } = await admin.from("dealer_subscriptions").select("dealer_id").eq("stripe_subscription_id", subId).maybeSingle();
      return data?.dealer_id ?? null;
    },
  };
}
