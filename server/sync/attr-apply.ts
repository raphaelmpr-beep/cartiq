// Turns page-stated listing attributes into a DB update. Only facts the page states are
// written; nothing is cleared or inferred. Columns from migration 20261016c are optional:
// if they don't exist yet the first failure disables attribute writes for this process.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListingAttrs } from "./attr-extract";

export function buildAttrUpdate(a: ListingAttrs, url: string, now = new Date().toISOString()): Record<string, any> {
  const u: Record<string, any> = {};
  const b = a.battery;
  if (b.chemistry) u.battery_chemistry = b.chemistry;
  if (b.voltage != null) u.battery_voltage = b.voltage;
  if (b.ah != null) u.battery_ah = b.ah;
  if (b.kwh != null) u.battery_kwh = b.kwh;
  if (b.brand) u.battery_brand = b.brand;
  if (Object.keys(u).length) u.battery_source = "listing_page";
  const w = a.warranty;
  if (w.included && w.quote) {
    u.warranty_included = w.included;
    if (w.months != null) u.warranty_months = w.months;
    u.warranty_source = "listing_page";
    u.warranty_source_url = url;
    u.warranty_source_quote = w.quote.slice(0, 500);
    u.warranty_verified_at = now;
  }
  return u;
}

let disabled = false;
export function attrWritesDisabled() { return disabled; }
export async function applyAttrUpdate(db: SupabaseClient, id: number, upd: Record<string, any>): Promise<"ok" | "skipped" | "disabled" | "error"> {
  if (disabled) return "disabled";
  if (!Object.keys(upd).length) return "skipped";
  const { error } = await db.from("listings").update(upd).eq("id", id);
  if (!error) return "ok";
  if (/column .* does not exist|Could not find the '.*' column|PGRST204/i.test(error.message + (error as any).code)) {
    disabled = true; console.warn("[attrs] new attribute columns missing; apply 20261016c migration. Attribute writes disabled.");
    return "disabled";
  }
  console.warn(`[attrs] update failed for listing ${id}: ${error.message}`);
  return "error";
}
