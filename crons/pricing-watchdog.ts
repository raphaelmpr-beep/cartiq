/**
 * CartIQ Pricing Watchdog — Weekly Brand Calibration Check
 *
 * What it does:
 *  1. Pulls all active public listings from Supabase
 *  2. For each brand+condition bucket with ≥5 listings, computes:
 *     - real_median_ask: actual median asking price from live data
 *     - formula_imv:     what pricing.ts predicts for that bucket
 *     - drift_pct:       (real_median_ask - formula_imv) / formula_imv
 *  3. Flags any brand where |drift_pct| > DRIFT_THRESHOLD (15%)
 *  4. Writes a row to pricing_audit_log with the full drift table
 *  5. Sends an in-app notification with a summary
 *
 * What it does NOT do:
 *  - Auto-edit pricing.ts — that stays a human decision
 *  - Re-price live listings — use /api/admin/reprice-all for that
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://aagwrcdvhuuzwrglamrt.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "sb_publishable_AMYcEYmVFC7zSGT_c1GTaw_IlWrtbyU";
const DRIFT_THRESHOLD = 0.15; // 15% — flag for human review
const MIN_LISTINGS    = 5;    // minimum sample size to trust a bucket

// Brand bases mirrored from pricing.ts — watchdog compares these to reality
// When you update pricing.ts brand bases, update this map too.
const BRAND_BASES: Record<string, number> = {
  "star ev":    26000,
  "yamaha":     20500,
  "atlas":      16500,
  "epic":       16000,
  "venom ev":   17000,
  "venom":      17000,
  "rover":      13000,
  "e-z-go":     14500,
  "ezgo":       14500,
  "club car":   14000,
  "sivo":       15000,
  "madjax":     14500,
  "dach":       14500,
  "bintelli":   14000,
  "icon":       13400,
  "cushman":    12600,
  "advanced ev":11000,
  "evolution":  16500,
  "sierra":     12000,
  "lion":       11000,
  "teko ev":    12000,
  "teko":       11500,
  "denago ev":  11000,
  "denago":     11000,
  "verdi":      10000,
  "amped":      10000,
  "honor":      10000,
  "gem":        14500,
  "royal ev":    9500,
  "blue cell":   9500,
  "tara":        9500,
  "star":       10000,
  "moxi":        9000,
  "monster":     9000,
  "whisper":     9000,
};

const YEAR_MULT: Record<number, number> = {
  2027:1.05, 2026:1.00, 2025:0.90, 2024:0.82, 2023:0.75,
  2022:0.68, 2021:0.62, 2020:0.56, 2019:0.50, 2018:0.44,
};
const COND_MULT: Record<string, number> = {
  new:1.00, demo:0.88, refurbished:0.72, used:0.56,
};

function getYearMult(y: number | null): number {
  if (!y) return 0.70;
  if (y >= 2027) return 1.05;
  if (y <= 2017) return 0.38;
  return YEAR_MULT[y] ?? 0.56;
}

function getBrandBase(brand: string | null): number | null {
  if (!brand) return null;
  const b = brand.toLowerCase().trim();
  for (const [key, val] of Object.entries(BRAND_BASES)) {
    if (b.includes(key) || key.includes(b)) return val;
  }
  return null; // unknown brand — skip
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface BrandDrift {
  brand: string;
  condition: string;
  n: number;
  real_median_ask: number;
  formula_imv: number;
  drift_pct: number;          // positive = real market higher than formula
  suggested_base: number;     // formula_base * (1 + drift_pct), rounded to nearest 500
  flagged: boolean;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function runWatchdog() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1. Fetch all active public listings with price + brand data
  const { data: listings, error } = await supabase
    .from("listings")
    .select("brand, year, condition, asking_price, sale_price, valuation_confidence, power_type, seating")
    .eq("status", "active")
    .eq("public_listing", true)
    .not("dealer_id", "is", null)
    .gt("asking_price", 500)
    .lt("asking_price", 100000);

  if (error || !listings) {
    console.error("Failed to fetch listings:", error);
    process.exit(1);
  }

  console.log(`Fetched ${listings.length} listings`);

  // 2. Group into brand+condition buckets
  const buckets: Record<string, { prices: number[]; years: number[] }> = {};

  for (const l of listings) {
    const brand = (l.brand ?? "").toLowerCase().trim();
    const condition = (l.condition ?? "new").toLowerCase();
    if (!brand || !["new", "used", "demo", "refurbished"].includes(condition)) continue;

    const effectivePrice = (l.sale_price && l.sale_price > 500) ? l.sale_price : l.asking_price;
    if (!effectivePrice || effectivePrice <= 0) continue;

    const key = `${brand}|${condition}`;
    if (!buckets[key]) buckets[key] = { prices: [], years: [] };
    buckets[key].prices.push(effectivePrice);
    if (l.year) buckets[key].years.push(l.year);
  }

  // 3. Compute drift for each bucket
  const driftRows: BrandDrift[] = [];

  for (const [key, { prices, years }] of Object.entries(buckets)) {
    const [brand, condition] = key.split("|");
    if (prices.length < MIN_LISTINGS) continue;

    const base = getBrandBase(brand);
    if (base === null) continue; // unknown brand, skip

    // Median year for the bucket (to compute a representative formula IMV)
    const medianYear = years.length ? Math.round(median(years)) : 2026;
    const yearMult = getYearMult(medianYear);
    const condMult = COND_MULT[condition] ?? 1.0;

    const formula_imv = Math.round(base * yearMult * condMult);
    const real_median_ask = Math.round(median(prices));
    const drift_pct = (real_median_ask - formula_imv) / formula_imv;

    // Suggested base: back-calculate what the base should be to hit real market
    // real = suggested_base * yearMult * condMult  =>  suggested_base = real / (yearMult * condMult)
    const raw_suggested = real_median_ask / (yearMult * condMult);
    const suggested_base = Math.round(raw_suggested / 500) * 500; // round to nearest $500

    driftRows.push({
      brand,
      condition,
      n: prices.length,
      real_median_ask,
      formula_imv,
      drift_pct,
      suggested_base,
      flagged: Math.abs(drift_pct) >= DRIFT_THRESHOLD,
    });
  }

  // Sort by |drift_pct| descending
  driftRows.sort((a, b) => Math.abs(b.drift_pct) - Math.abs(a.drift_pct));

  const flagged = driftRows.filter(r => r.flagged);
  const stable  = driftRows.filter(r => !r.flagged);

  console.log(`Drift analysis: ${flagged.length} flagged, ${stable.length} stable`);

  // 4. Write audit log row to Supabase
  const auditPayload = {
    run_at: new Date().toISOString(),
    total_listings_analyzed: listings.length,
    buckets_analyzed: driftRows.length,
    flagged_count: flagged.length,
    drift_table: driftRows,
    drift_threshold: DRIFT_THRESHOLD,
    min_sample_size: MIN_LISTINGS,
  };

  const { error: auditErr } = await supabase
    .from("pricing_audit_log")
    .insert(auditPayload);

  if (auditErr) {
    console.warn("Could not write audit log (table may not exist yet):", auditErr.message);
    // Non-fatal — continue to notification
  }

  // 5. Build notification
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (flagged.length === 0) {
    // All brands within tolerance — send a brief healthy status
    const body = [
      `✅ All ${driftRows.length} brand/condition buckets within ±${DRIFT_THRESHOLD * 100}% of formula IMV.`,
      `📊 ${listings.length} listings analyzed.`,
      `No base price adjustments needed this week.`,
    ].join("\n");

    await sendNotification(`CartIQ Pricing — ${date}`, body);
    return;
  }

  // Build a ranked drift table for the notification
  const flaggedLines = flagged.slice(0, 10).map(r => {
    const sign = r.drift_pct > 0 ? "↑" : "↓";
    const pct  = Math.abs(r.drift_pct * 100).toFixed(0);
    return `${sign}${pct}% ${r.brand} (${r.condition}) — real $${r.real_median_ask.toLocaleString()} vs formula $${r.formula_imv.toLocaleString()} · suggest base $${r.suggested_base.toLocaleString()} (n=${r.n})`;
  });

  const body = [
    `⚠️ ${flagged.length} brand/condition bucket${flagged.length > 1 ? "s" : ""} drifted >${DRIFT_THRESHOLD * 100}% from formula:`,
    "",
    flaggedLines.join("\n"),
    "",
    `✅ ${stable.length} bucket${stable.length !== 1 ? "s" : ""} stable.`,
    `📊 ${listings.length} listings analyzed across ${driftRows.length} buckets.`,
    "",
    `Update BRAND_TIERS in server/pricing.ts to fix, then run /api/admin/reprice-all.`,
  ].join("\n");

  await sendNotification(`CartIQ Pricing Drift — ${date}`, body);
}

async function sendNotification(title: string, body: string) {
  // Uses Perplexity's send_notification tool via the cron agent
  // In the cron context this will be intercepted by the runtime
  console.log("NOTIFY:", title);
  console.log(body);

  // Write to a file so the cron agent can pick it up and call send_notification
  const fs = await import("fs/promises");
  await fs.writeFile(
    "/home/user/workspace/cron_tracking/pricing-watchdog-result.json",
    JSON.stringify({ title, body, ts: new Date().toISOString() }, null, 2)
  );
}

runWatchdog().catch(err => {
  console.error("Watchdog failed:", err);
  process.exit(1);
});
