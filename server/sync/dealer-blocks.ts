/**
 * dealer_block_log helpers (server-only, secret-key client).
 * A row with resolved=false and (paused_until IS NULL or paused_until > now) = dealer auto-paused:
 * sync/re-check must not fetch it. A human clears it from Admin → Dealer Health ("Resume").
 * Before migration 20261015b_dealer_block_log.sql is applied these helpers are no-ops.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlockKind } from "./polite-fetch";

export interface HostBlock { host: string; dealers: string[]; kind: BlockKind; httpStatus: number; url: string; pausedUntil?: string | null }
export interface ActiveBlock { dealer_slug: string; block_reason: string; http_status: number | null; host: string | null;
  attempted_at: string; paused_until: string | null; failure_count: number; inventory_url: string }

const missing = (e: any) => !!e && (e.code === "PGRST205" || e.code === "42P01" || /dealer_block_log/.test(String(e.message || "")));

/** Map of dealer_slug → active block. Empty when the table does not exist yet. */
export async function loadActiveBlocks(db: SupabaseClient, now = new Date()): Promise<Map<string, ActiveBlock>> {
  const out = new Map<string, ActiveBlock>();
  const { data, error } = await db.from("dealer_block_log")
    .select("dealer_slug,block_reason,http_status,host,attempted_at,paused_until,failure_count,inventory_url").eq("resolved", false);
  if (error) { if (!missing(error)) console.warn(`[dealer-blocks] load failed: ${error.message}`); return out; }
  for (const r of (data ?? []) as ActiveBlock[]) {
    if (r.paused_until && new Date(r.paused_until) <= now) continue; // Retry-After window elapsed → resume automatically
    out.set(r.dealer_slug, r);
  }
  return out;
}

const bare = (h: string) => h.toLowerCase().replace(/^www\./, "");

/** Auto-pause every dealer that shares the blocked host (e.g. all 7 Botero locations). */
export async function recordHostBlock(db: SupabaseClient, b: HostBlock): Promise<void> {
  const slugs = new Set(b.dealers);
  const { data: ds } = await db.from("dealers").select("slug,name,website_url");
  for (const d of (ds ?? []) as any[]) {
    try { if (d.website_url && bare(new URL(d.website_url).host) === bare(b.host)) slugs.add(d.slug); } catch {}
  }
  const names = new Map(((ds ?? []) as any[]).map(d => [d.slug, d.name]));
  const now = new Date().toISOString();
  for (const slug of Array.from(slugs)) {
    const { data: prev, error: pe } = await db.from("dealer_block_log").select("failure_count").eq("dealer_slug", slug).maybeSingle();
    if (missing(pe)) return;
    const row = {
      dealer_slug: slug, dealer_name: names.get(slug) ?? null, inventory_url: b.url, host: bare(b.host),
      block_reason: b.kind, http_status: b.httpStatus || null, attempted_at: now, updated_at: now,
      paused_until: b.pausedUntil ?? null, failure_count: Number((prev as any)?.failure_count ?? 0) + 1,
      resolved: false, resolved_at: null, source: "recheck",
    };
    const { error } = await db.from("dealer_block_log").upsert(row, { onConflict: "dealer_slug" });
    if (error && !missing(error)) console.warn(`[dealer-blocks] upsert ${slug} failed: ${error.message}`);
  }
}

/** Human "Resume" from admin. */
export async function resolveBlock(db: SupabaseClient, slug: string, notes: string) {
  return db.from("dealer_block_log").update({ resolved: true, resolved_at: new Date().toISOString(), resolved_notes: notes.slice(0, 500),
    updated_at: new Date().toISOString() }).eq("dealer_slug", slug);
}
