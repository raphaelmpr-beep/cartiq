// Fixture mode guard (dev only). GCQ_FIXTURE_MODE can never run in production.
// Checks VERCEL_ENV and NODE_ENV only (APP_ENV deliberately ignored).
export function fixtureModeRequested(env: NodeJS.ProcessEnv = process.env): boolean {
  return /^(1|true|on|yes)$/i.test(String(env.GCQ_FIXTURE_MODE ?? "").trim());
}
export function assertFixtureAllowed(env: NodeJS.ProcessEnv = process.env): void {
  const vercel = String(env.VERCEL_ENV ?? "").trim().toLowerCase();
  const node = String(env.NODE_ENV ?? "").trim().toLowerCase();
  if (vercel === "production" || node === "production") {
    throw new Error(`GCQ_FIXTURE_MODE refused: VERCEL_ENV=${vercel || "-"} NODE_ENV=${node || "-"} (production)`);
  }
  if (!fixtureModeRequested(env)) throw new Error("GCQ_FIXTURE_MODE is not set");
}
