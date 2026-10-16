/**
 * "run-all" dealer selection fix (sync map §6 P0-2), as a pure function.
 *
 * Today pipeline-lambda.ts (dealer=all) selects only `sync_enabled AND adapter_key NOT NULL`
 * and dedupes by adapter_key, running only the FIRST sibling. That records status for one
 * sibling and silently skips the rest. Here instead:
 *   - adapter_key NULL is kept (it goes to the "generic" adapter, alone);
 *   - dealers sharing an adapter_key form ONE fetch group: one fetch, one run row per sibling
 *     (DE §5: "For a shared feed, set fetch_group and write one run row per sibling").
 *
 * TODO(Spec 1): confirm adapter_key is the right grouping key for every shared feed
 * (Botero x7, Advantage x5, Jenkins x4, Shiver x2) vs. inventory_source_url.
 */
import type { DealerRow, FetchGroup } from "./types";

export const GENERIC_ADAPTER = "generic";

export function planFetchGroups(dealers: DealerRow[]): FetchGroup[] {
  const enabled = dealers.filter((d) => d.sync_enabled === true);
  const byAdapter = new Map<string, DealerRow[]>();
  const solo: FetchGroup[] = [];
  for (const d of enabled) {
    if (!d.adapter_key) {
      solo.push({ adapterKey: GENERIC_ADAPTER, fetchGroup: null, dealers: [d] });
      continue;
    }
    const list = byAdapter.get(d.adapter_key) ?? [];
    list.push(d);
    byAdapter.set(d.adapter_key, list);
  }
  const groups: FetchGroup[] = [];
  for (const [adapterKey, list] of Array.from(byAdapter.entries())) {
    list.sort((a, b) => a.id - b.id);
    groups.push({ adapterKey, fetchGroup: list.length > 1 ? adapterKey : null, dealers: list });
  }
  groups.push(...solo);
  return groups.sort((a, b) => a.dealers[0].id - b.dealers[0].id);
}
