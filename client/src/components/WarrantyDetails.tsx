import { normalizeWarranty, normalizeWarrantyMonths, warrantyLabel } from "@shared/warranty";
import { warrantyProviderLabel } from "@/lib/utils";

export function WarrantyDetails({ warrantyIncluded, warrantyProvider, warrantyMonths, batteryWarrantyIncluded, warrantyNotes }: {
  warrantyIncluded?: unknown; warrantyProvider?: string | null; warrantyMonths?: unknown;
  batteryWarrantyIncluded?: unknown; warrantyNotes?: string | null;
}) {
  const state = normalizeWarranty(warrantyIncluded);
  const months = normalizeWarrantyMonths(warrantyMonths);
  const term = months ? `${months} months${state !== "yes" ? " (reported; inclusion unconfirmed)" : ""}` : "Not specified";
  return <div className="space-y-3 text-sm">
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[
        ["Cart warranty included", warrantyLabel(state)],
        ["Warranty provider", warrantyProviderLabel(warrantyProvider)],
        ["Reported cart term", term],
        ["Battery warranty included", warrantyLabel(batteryWarrantyIncluded)],
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>)}
    </dl>
    {warrantyNotes && <div className="rounded border p-3 space-y-1">
      <p className="text-xs font-semibold">Reported terms and source notes</p>
      <p className="text-sm whitespace-pre-wrap break-words">{warrantyNotes.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all">{part}</a> : part)}</p>
    </div>}
    {state === "unknown" && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      Cart warranty inclusion is unconfirmed. Reported terms do not establish eligibility; ask the seller to confirm coverage for this unit.
    </p>}
    <p className="text-xs text-muted-foreground">Cart and battery coverage may have different providers, exclusions and transfer rules. Confirm the written terms before purchase.</p>
  </div>;
}
