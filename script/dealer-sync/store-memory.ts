/** In-memory RunStore for tests. Mirrors the finish() guards DE's function enforces. */
import { BLOCKED_CAUSES, type DealerRow, type RunFinishArgs, type RunStartArgs, type RunStore, type RunUrlRow } from "./types";

export interface MemRun extends RunStartArgs { id: number; finished?: RunFinishArgs; urls: RunUrlRow[] }

export class MemoryRunStore implements RunStore {
  runs: MemRun[] = [];
  constructor(private readonly dealers: DealerRow[] = [], private readonly tablesPresent = true) {}
  async probeTables() {
    return this.tablesPresent ? { present: true, missing: [] } : { present: false, missing: ["dealer_sync_runs"] };
  }
  async listDealers() { return this.dealers.filter((d) => d.sync_enabled === true); }
  async sweep() { return 0; }
  async start(a: RunStartArgs) { const id = this.runs.length + 1; this.runs.push({ ...a, id, urls: [] }); return id; }
  async writeUrls(id: number, rows: RunUrlRow[]) { this.get(id).urls.push(...rows); }
  async finish(id: number, f: RunFinishArgs) {
    const r = this.get(id);
    if (r.finished) throw new Error("already finished");
    if (f.outcome === "success" && f.errorCause) throw new Error("success with error_cause");
    if (f.outcome !== "success" && !f.errorCause) throw new Error("non-success without error_cause");
    if (f.outcome === "blocked" && !BLOCKED_CAUSES.has(f.errorCause!)) throw new Error("blocked needs blocked cause");
    if (f.outcome === "failed" && f.errorCause && BLOCKED_CAUSES.has(f.errorCause)) throw new Error("blocked cause as failed");
    r.finished = f;
  }
  private get(id: number) { const r = this.runs.find((x) => x.id === id); if (!r) throw new Error("no run " + id); return r; }
}
