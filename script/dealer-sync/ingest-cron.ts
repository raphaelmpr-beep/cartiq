/**
 * Scheduled new-listing ingest (Vercel cron -> GET /api/cron/ingest). DRAFT.
 * Owner: Raphael Martinez (raphaelmpr-beep) — see owner.ts.
 *
 * Off by default: unless SYNC_SCHEDULER_ENABLED === 'true' the handler returns DISABLED
 * before any network call, DB read or write. When enabled it:
 *   1. calls the EXISTING ingest path runLambdaSync({ mode: 'discover_sitemap', dealer: 'all' })
 *      (inserts new URLs into pending_imports for review; it does not publish, archive or touch SEO);
 *   2. reads the newest ingest timestamp (read-only) and evaluates the stall rule;
 *   3. emails the owner if no new listing in > STALL_DAYS days, or the run failed.
 */
import { INGEST_OWNER } from "./owner";
import type { AlertMessage, AlertResult } from "./owner-alert";

export const STALL_DAYS = 6;
const DAY_MS = 86_400_000;

export type StallInput = { now: Date; lastNewListingAt: Date | null; runOk: boolean; runError?: string };
export type StallDecision = { alert: boolean; reasons: string[]; daysSinceNew: number | null };

export function evaluateStall(i: StallInput): StallDecision {
  const reasons: string[] = [];
  const days = i.lastNewListingAt ? (i.now.getTime() - i.lastNewListingAt.getTime()) / DAY_MS : null;
  if (!i.runOk) reasons.push(`last ingest run failed${i.runError ? `: ${i.runError.slice(0, 200)}` : ""}`);
  if (days === null) reasons.push("no ingested listing timestamp found");
  else if (days > STALL_DAYS) reasons.push(`no new listing ingested in ${days.toFixed(1)} days (> ${STALL_DAYS})`);
  return { alert: reasons.length > 0, reasons, daysSinceNew: days === null ? null : Math.round(days * 10) / 10 };
}

export function stallMessage(d: StallDecision): AlertMessage {
  return {
    subject: `[GolfCartIQ] New-listing ingest stalled`,
    text: [
      `Owner: ${INGEST_OWNER.name}`,
      ...d.reasons.map((r) => `- ${r}`),
      `Days since last new listing: ${d.daysSinceNew ?? "unknown"}`,
      `Job: /api/cron/ingest (script/dealer-sync/ingest-cron.ts)`,
    ].join("\n"),
  };
}

export type IngestDeps = {
  env: NodeJS.ProcessEnv;
  now: () => Date;
  runSync: () => Promise<{ new_queued?: number; errors?: number }>;
  latestNewListingAt: () => Promise<Date | null>;
  sendAlert: (m: AlertMessage) => Promise<AlertResult>;
};

export type IngestCronResult =
  | { status: "UNAUTHORIZED" }
  | { status: "DISABLED" }
  | { status: "RAN"; runOk: boolean; stall: StallDecision; alert: AlertResult | null };

export async function runIngestCron(authHeader: string | undefined, deps: IngestDeps): Promise<IngestCronResult> {
  const secret = deps.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) return { status: "UNAUTHORIZED" };
  if (deps.env.SYNC_SCHEDULER_ENABLED !== "true") return { status: "DISABLED" };

  let runOk = true;
  let runError: string | undefined;
  try {
    const r = await deps.runSync();
    if (r.errors && r.errors > 0) { runOk = false; runError = `${r.errors} error(s) in runLambdaSync`; }
  } catch (e) {
    runOk = false;
    runError = e instanceof Error ? e.message : String(e);
  }
  let last: Date | null = null;
  try { last = await deps.latestNewListingAt(); } catch { last = null; }
  const stall = evaluateStall({ now: deps.now(), lastNewListingAt: last, runOk, runError });
  const alert = stall.alert ? await deps.sendAlert(stallMessage(stall)) : null;
  return { status: "RAN", runOk, stall, alert };
}
