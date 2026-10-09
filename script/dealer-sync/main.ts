/**
 * Entry point: `npx tsx script/dealer-sync/main.ts`
 *
 * Exit behavior (each prints exactly one status line; no secret values are ever printed):
 *   DISABLED            exit 0  SYNC_SCHEDULER_ENABLED != 'true'
 *   BLOCKED_G2          exit 1  enabled but G2 rotation not confirmed
 *   MISSING_ENV         exit 1  enabled but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (names only)
 *   SKIPPED_NO_TABLES   exit 0  DE's run tables not applied yet (read-only probe; NO writes)
 *   SKIPPED_NO_FETCHER  exit 0  no adapters registered (this draft; G4) — NO writes
 *   DONE                exit 0  runs written to DE's run tables only
 */
import { randomUUID } from "node:crypto";
import { FETCHERS } from "./fetchers";
import { preflight } from "./gates";
import { planFetchGroups } from "./plan";
import { log } from "./redact";
import { runAll } from "./runner";
import { SupabaseRunStore } from "./store-supabase";
import type { DealerFetcher, RunStore } from "./types";

export async function main(
  env: NodeJS.ProcessEnv = process.env,
  makeStore: (url: string, key: string) => RunStore = (u, k) => new SupabaseRunStore(u, k),
  fetchers: ReadonlyMap<string, DealerFetcher> = FETCHERS,
): Promise<number> {
  const pre = preflight(env);
  if (pre.kind !== "PROCEED") {
    log(pre.kind, { reason: pre.reason, ...("missing" in pre ? { missing: pre.missing } : {}) });
    return pre.exitCode;
  }

  const store = makeStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!);
  const probe = await store.probeTables();
  if (!probe.present) {
    log("SKIPPED_NO_TABLES", { missing: probe.missing, note: "DE tables not applied; no writes made" });
    return 0;
  }
  if (fetchers.size === 0) {
    log("SKIPPED_NO_FETCHER", { note: "no dealer adapters registered (G4); no writes made" });
    return 0;
  }

  const runId = randomUUID();
  const gitSha = env.GITHUB_SHA ?? "local000";
  const swept = await store.sweep(90);
  const groups = planFetchGroups(await store.listDealers());
  log("RUN_START", { runId, gitSha: gitSha.slice(0, 7), groups: groups.length, swept });
  const summary = await runAll(store, groups, { runId, gitSha, fetchers, concurrency: 4 });
  const counts: Record<string, number> = {};
  for (const g of summary) for (const r of g.rows) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  log("DONE", { runId, counts });
  return 0;
}

const isEntry = process.argv[1] && /dealer-sync[\\/]main\.ts$/.test(process.argv[1]);
if (isEntry) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      log("FATAL", { error: err instanceof Error ? err.message : String(err) });
      process.exit(1);
    },
  );
}
