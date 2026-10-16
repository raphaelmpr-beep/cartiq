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
// Battery-aware comps (only when enough like comps exist, else previous behaviour):
//   capacity known (kWh, or V×Ah) -> same kWh bucket (and same chemistry if known)
//   chemistry only (e.g. "lithium") -> same chemistry
//   unknown -> all comps
export function matchBatteryComps<T extends Record<string, any>>(subject: Record<string, any>, comps: T[], min = 3): T[] {
  if (comps.length < min) return comps;
  const chem = effChemistry(subject);
  const b = kwhBucket(effKwh(subject));
  if (b) {
    const sameK = comps.filter(c => kwhBucket(effKwh(c)) === b && (!chem || !effChemistry(c) || effChemistry(c) === chem));
    if (sameK.length >= min) return sameK;
  }
  if (chem) {
    const same = comps.filter(c => effChemistry(c) === chem);
    if (same.length >= min) return same;
  }
  return comps;
}
export function safeChemParam(v: unknown): string | null {
  const s = String(v ?? "").toLowerCase();
  return /^[a-z_]{2,20}$/.test(s) ? s : null;
}
