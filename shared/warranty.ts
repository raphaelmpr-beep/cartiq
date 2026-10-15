export type WarrantyState = "yes" | "no" | "unknown";
// Anchored PostgREST imatch expression; never matches prose like "not true".
export const WARRANTY_YES_PATTERN = "^[[:space:]]*(yes|true|1)[[:space:]]*$";

/** Representation normalization only: terms and prose never prove inclusion. */
export function normalizeWarranty(value: unknown): WarrantyState {
  if (value === true || value === 1) return "yes";
  if (value === false || value === 0) return "no";
  if (typeof value !== "string") return "unknown";
  const text = value.trim().toLowerCase();
  if (["yes", "true", "1"].includes(text)) return "yes";
  if (["no", "false", "0"].includes(text)) return "no";
  return "unknown";
}

export function normalizeWarrantyMonths(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) return null;
  const months = Number(value);
  return Number.isSafeInteger(months) && months > 0 ? months : null;
}

export function warrantyLabel(value: unknown): string {
  return { yes: "Yes", no: "No", unknown: "Unknown" }[normalizeWarranty(value)];
}

/** Preserve omitted fields on PATCH. Never inherit dealer defaults. */
export function normalizeWarrantyFields<T extends Record<string, any>>(row: T): T {
  const out = { ...row };
  for (const key of ["warranty_included", "battery_warranty_included", "warrantyIncluded", "batteryWarrantyIncluded"]) {
    if (Object.prototype.hasOwnProperty.call(row, key)) (out as any)[key] = normalizeWarranty(row[key]);
  }
  for (const key of ["warranty_months", "warrantyMonths"]) {
    if (Object.prototype.hasOwnProperty.call(row, key)) (out as any)[key] = normalizeWarrantyMonths(row[key]);
  }
  return out;
}
