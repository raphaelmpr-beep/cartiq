// Effective battery facts: page-stated new columns first, legacy battery_type fallback.
export type Chem = "lithium" | "lead_acid" | "agm";
const CHEMS = new Set(["lithium", "lead_acid", "agm"]);
export function effChemistry(l: Record<string, any>): Chem | null {
  const c = String(l.battery_chemistry ?? l.batteryChemistry ?? l.battery_type ?? l.batteryType ?? "").toLowerCase();
  return CHEMS.has(c) ? (c as Chem) : null;
}
export function effKwh(l: Record<string, any>): number | null {
  const k = Number(l.battery_kwh ?? l.batteryKwh);
  if (k > 0) return k;
  const v = Number(l.battery_voltage ?? l.batteryVoltage), ah = Number(l.battery_ah ?? l.batteryAh);
  return v > 0 && ah > 0 ? Math.round(v * ah / 100) / 10 : null;
}
// kWh buckets (48V105Ah ≈ 5 kWh sits in "4-6")
export function kwhBucket(k: number | null): string | null {
  if (!k) return null;
  return k < 4 ? "<4" : k <= 6 ? "4-6" : ">6";
}
// Group comps by battery only when the subject's battery is known and enough like-for-like comps exist.
export function matchBatteryComps<T extends Record<string, any>>(subject: Record<string, any>, comps: T[], min = 3): T[] {
  const chem = effChemistry(subject);
  if (!chem || comps.length < min) return comps;
  const same = comps.filter(c => effChemistry(c) === chem);
  if (same.length < min) return comps;
  const b = kwhBucket(effKwh(subject));
  if (!b) return same;
  const sameK = same.filter(c => kwhBucket(effKwh(c)) === b);
  return sameK.length >= min ? sameK : same;
}
export function safeChemParam(v: unknown): string | null {
  const s = String(v ?? "").toLowerCase();
  return /^[a-z_]{2,20}$/.test(s) ? s : null;
}
