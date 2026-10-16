/**
 * Scheduled new-listing ingest (Vercel cron -> GET /api/cron/ingest). DRAFT.
 * Owner: Raphael Martinez (raphaelmpr-beep) — see owner.ts.
 *
 * Off by default: unless SYNC_SCHEDULER_ENABLED === 'true' the handler returns DISABLED
 * before any network call, DB read or write. When enabled it:
 *   1. calls the EXISTING ingest path runLambdaSync({ mode: 'discover_sitemap', dealer: 'all' })
 *      (inserts new URLs into pending_imports for review; it does not publish, archive or touch SEO);
 *   2. reads the newest ingest timestamp (read-only) and evaluates the stall rule;
 *   3. emails the owner if no new listing in > STALL_DAYS days, the run failed, or the oldest pending_imports
 *      item has waited > PENDING_MAX_AGE_HOURS (default 72) for review by Raphael;
 *   4. records the Resend message id (alert_message_id) in the run-log row.
 * Auto-publish gate: see autopublish.ts (INGEST_AUTOPUBLISH_ENABLED, off by default).
 */
import { INGEST_OWNER } from "./owner";
import type { AlertMessage, AlertResult } from "./owner-alert";

export const STALL_DAYS = 6;
/** Oldest-pending alert threshold (hours); override with PENDING_MAX_AGE_HOURS. */
export const DEFAULT_PENDING_MAX_AGE_HOURS = 72;
export function pendingMaxAgeHours(env: NodeJS.ProcessEnv): number {
  const n = Number(env.PENDING_MAX_AGE_HOURS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PENDING_MAX_AGE_HOURS;
}
const DAY_MS = 86_400_000;

export type StallInput = {
  now: Date; lastNewListingAt: Date | null; runOk: boolean; runError?: string;
  oldestPendingAt?: Date | null; pendingMaxAgeHours?: number;
};
export type StallDecision = { alert: boolean; reasons: string[]; daysSinceNew: number | null };

export function evaluateStall(i: StallInput): StallDecision {
  const reasons: string[] = [];
  const days = i.lastNewListingAt ? (i.now.getTime() - i.lastNewListingAt.getTime()) / DAY_MS : null;
  if (!i.runOk) reasons.push(`last ingest run failed${i.runError ? `: ${i.runError.slice(0, 200)}` : ""}`);
  if (days === null) reasons.push("no ingested listing timestamp found");
  else if (days > STALL_DAYS) reasons.push(`no new listing ingested in ${days.toFixed(1)} days (> ${STALL_DAYS})`);
  if (i.oldestPendingAt) {
    const h = (i.now.getTime() - i.oldestPendingAt.getTime()) / 3_600_000;
    const max = i.pendingMaxAgeHours ?? DEFAULT_PENDING_MAX_AGE_HOURS;
    if (h > max) reasons.push(`oldest pending_imports item awaiting review ${h.toFixed(1)} h (> ${max} h); reviewer: ${INGEST_OWNER.name}`);
  }
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
  /** Read-only: found_at of the oldest pending_imports row still awaiting review (null if none). */
  oldestPendingAt?: () => Promise<Date | null>;
  sendAlert: (m: AlertMessage) => Promise<AlertResult>;
};

export type IngestCronResult =
  | { status: "UNAUTHORIZED" }
  | { status: "DISABLED" }
  | { status: "RAN"; runOk: boolean; stall: StallDecision; alert: AlertResult | null; runLog: RunLogRow };

/** Shape of one ingest_cron_runs row (draft table). alert_message_id = Resend id of the alert, if any. */
export type RunLogRow = { run_ok: boolean; error_summary: string | null; alert_sent: boolean; alert_message_id: string | null };

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
  let oldestPending: Date | null = null;
  if (deps.oldestPendingAt) { try { oldestPending = await deps.oldestPendingAt(); } catch { oldestPending = null; } }
  const stall = evaluateStall({
    now: deps.now(), lastNewListingAt: last, runOk, runError,
    oldestPendingAt: oldestPending, pendingMaxAgeHours: pendingMaxAgeHours(deps.env),
  });
  // Awaited so the Resend message id is known before the run is logged.
  const alert = stall.alert ? await deps.sendAlert(stallMessage(stall)) : null;
  const runLog: RunLogRow = {
    run_ok: runOk,
    error_summary: runError ? runError.slice(0, 500) : null,
    alert_sent: !!alert?.sent,
    alert_message_id: alert?.messageId ?? null,
  };
  console.log(`[ingest-cron] run_ok=${runOk} alert_sent=${runLog.alert_sent} alert_message_id=${runLog.alert_message_id ?? "null"}`);
  return { status: "RAN", runOk, stall, alert, runLog };
}
