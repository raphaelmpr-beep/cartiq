import React, { useState } from "react";
import { WarrantyBadge } from "../client/src/components/Badges";
import { WarrantyDetails } from "../client/src/components/WarrantyDetails";
import { normalizeWarranty } from "../shared/warranty";

const examples = [
  { title: "Legacy string true", warrantyIncluded: "true", warrantyMonths: 12, batteryWarrantyIncluded: "yes", warrantyNotes: "Example: 1 year cart coverage; battery terms separate. Synthetic QA fixture." },
  { title: "Explicit no coverage", warrantyIncluded: "false", warrantyMonths: null, batteryWarrantyIncluded: "unknown", warrantyNotes: null },
  { title: "Unknown with reported terms", warrantyIncluded: "unknown", warrantyMonths: 12, batteryWarrantyIncluded: "unknown", warrantyNotes: 'Dealer advertises "5 Year Battery Warranty, 1 Year Cart Warranty". Provider and transferability not specified. Source: https://www.pvgolfcarts.com/inventory/665b7b20-7aac-41b7-a490-6639b777fb63' },
  { title: "Unscoped 90-day statement", warrantyIncluded: null, warrantyMonths: null, batteryWarrantyIncluded: "unknown", warrantyNotes: 'Dealer listing states "90 Day Warranty". Scope and provider not stated; coverage not inferred.' },
];
export function WarrantyPreview() {
  const [onlyIncluded, setOnlyIncluded] = useState(false);
  return <div className="max-w-4xl mx-auto p-6 space-y-5">
    <h1 className="text-xl font-bold">Warranty display checks</h1>
    <p className="text-sm text-muted-foreground">Mixed legacy representations and source-note examples. This preview makes no production writes.</p>
    <label className="flex items-center gap-2 min-h-11"><input type="checkbox" checked={onlyIncluded} onChange={e => setOnlyIncluded(e.target.checked)} />Only included warranties</label>
    {examples.filter(x => !onlyIncluded || normalizeWarranty(x.warrantyIncluded) === "yes").map(row =>
      <section key={row.title} className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold">{row.title}</h2><WarrantyBadge warrantyIncluded={row.warrantyIncluded} warrantyMonths={row.warrantyMonths} /></div>
        <WarrantyDetails {...row} />
      </section>)}
  </div>;
}
