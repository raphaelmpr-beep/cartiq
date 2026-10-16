/**
 * Owner of the scheduled new-listing ingest job and its stall alert.
 * Owner: Raphael Martinez (GitHub: raphaelmpr-beep). Alerts go to OWNER_ALERT_EMAIL.
 * The address lives in env only, never in code or logs.
 */
export const INGEST_OWNER = {
  name: "Raphael Martinez",
  github: "raphaelmpr-beep",
  alertEmailEnv: "OWNER_ALERT_EMAIL",
} as const;
