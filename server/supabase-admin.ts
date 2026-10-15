/**
 * Server-only privileged Supabase client.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY (an sb_secret_... key, or a legacy service_role
 * JWT). Never import this module from client/ code: the key bypasses RLS.
 * Fails loud when the key is missing or is a publishable/anon key, so a
 * misconfigured deploy errors instead of silently running writes as anon.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getServiceRoleKey(): string {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for server-side Supabase access");
  if (key.startsWith("sb_publishable_")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY holds a publishable key; set the secret (sb_secret_...) key");
  }
  return key;
}

export function getSupabaseUrl(): string {
  const url = (process.env.SUPABASE_URL || "").trim();
  if (!url) throw new Error("SUPABASE_URL is required");
  return url;
}

/** Fresh admin client (for scripts/lambdas that want their own instance). */
export function createSupabaseAdmin(): SupabaseClient {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let _admin: SupabaseClient | null = null;
/** Lazy shared admin client. */
export function supabaseAdmin(): SupabaseClient {
  if (!_admin) _admin = createSupabaseAdmin();
  return _admin;
}
