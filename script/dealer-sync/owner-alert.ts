/**
 * Owner email path for the ingest stall alert.
 * The repo had no outbound email code (README: "Email delivery ... (SendGrid / Resend)" is an open TODO),
 * so this is a minimal Resend HTTP call. If GCQ_RESEND_API_KEY (GolfCartIQ's own key, not TAW's) or OWNER_ALERT_EMAIL is unset it sends nothing
 * and reports `skipped`, so an unconfigured environment never errors. Secret values are never logged.
 */
import { INGEST_OWNER } from "./owner";

export type AlertMessage = { subject: string; text: string };
export type AlertResult = { sent: boolean; skipped?: string; status?: number; messageId?: string | null };
export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json?: () => Promise<unknown> }>;
/** GolfCartIQ's OWN Resend key variable. Deliberately not TAW's RESEND_API_KEY (separate key + sending domain per product). */
export const GCQ_RESEND_KEY_ENV = "GCQ_RESEND_API_KEY";

export async function sendOwnerAlert(
  msg: AlertMessage,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: Fetch = fetch as unknown as Fetch,
): Promise<AlertResult> {
  const key = env[GCQ_RESEND_KEY_ENV];
  const to = env[INGEST_OWNER.alertEmailEnv];
  if (!key || !to) return { sent: false, skipped: `${GCQ_RESEND_KEY_ENV} or OWNER_ALERT_EMAIL not set`, messageId: null };
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.ALERT_FROM_EMAIL || "GolfCartIQ Alerts <alerts@golfcartiq.com>",
      to: [to],
      subject: msg.subject,
      text: msg.text,
    }),
  });
  // Resend returns { id } on success; record it so the run log can store alert_message_id.
  let messageId: string | null = null;
  if (res.ok && res.json) {
    try { const b = (await res.json()) as { id?: unknown }; if (typeof b?.id === "string") messageId = b.id; } catch { /* keep null */ }
  }
  return { sent: res.ok, status: res.status, messageId };
}
