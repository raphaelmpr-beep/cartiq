/**
 * Pre-flight gates, evaluated BEFORE any client is created or any request is made.
 * Pure function so the decision table is unit-tested.
 */
export type PreflightDecision =
  | { kind: "DISABLED"; exitCode: 0; reason: string }
  | { kind: "BLOCKED_G2"; exitCode: 1; reason: string }
  | { kind: "MISSING_ENV"; exitCode: 1; reason: string; missing: string[] }
  | { kind: "PROCEED"; exitCode: 0 };

export const REQUIRED_SECRET_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

export function preflight(env: NodeJS.ProcessEnv): PreflightDecision {
  if (env.SYNC_SCHEDULER_ENABLED !== "true") {
    return { kind: "DISABLED", exitCode: 0, reason: "SYNC_SCHEDULER_ENABLED is not 'true'; nothing to do" };
  }
  if (env.GCQ_G2_ROTATION_CONFIRMED !== "true") {
    // Enabled without the G2 acknowledgement is a misconfiguration: fail loud.
    return {
      kind: "BLOCKED_G2", exitCode: 1,
      reason: "G2: service-role key / ADMIN_PASSWORD / DB password rotation not confirmed (GCQ_G2_ROTATION_CONFIRMED != 'true')",
    };
  }
  const missing = REQUIRED_SECRET_ENV.filter((n) => !env[n] || env[n]!.trim() === "");
  if (missing.length) {
    // Names only. Values are never logged.
    return { kind: "MISSING_ENV", exitCode: 1, reason: "required secret env missing", missing: [...missing] };
  }
  return { kind: "PROCEED", exitCode: 0 };
}
