/**
 * Owner email path for the ingest stall alert.
 * The repo had no outbound email code (README: "Email delivery ... (SendGrid / Resend)" is an open TODO),
 * so this is a minimal Resend HTTP call. If RESEND_API_KEY or OWNER_ALERT_EMAIL is unset it sends nothing
 * and reports `skipped`, so an unconfigured environment never errors. Secret values are never logged.
 */
import { INGEST_OWNER } from "./owner";

export type AlertMessage = { subject: string; text: string };
export type AlertResult = { sent: boolean; skipped?: string; status?: number };
export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

export async function sendOwnerAlert(
  msg: AlertMessage,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: Fetch = fetch as unknown as Fetch,
): Promise<AlertResult> {
  const key = env.RESEND_API_KEY;
  const to = env[INGEST_OWNER.alertEmailEnv];
  if (!key || !to) return { sent: false, skipped: "RESEND_API_KEY or OWNER_ALERT_EMAIL not set" };
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
  return { sent: res.ok, status: res.status };
}
