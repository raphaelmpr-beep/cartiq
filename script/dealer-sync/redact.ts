/**
 * Log/message hygiene. Nothing the scheduler logs or writes to `message` may contain a secret.
 * - Known secret env values are replaced verbatim.
 * - JWT-shaped tokens (Supabase keys are JWTs) and sb_secret_/sb_publishable_ keys are masked.
 * - Query strings are dropped from URLs (dealer APIs sometimes carry keys in the query).
 */
const SECRET_ENV_NAMES = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"] as const;

export function redact(text: string, env: NodeJS.ProcessEnv = process.env): string {
  let out = text;
  for (const name of SECRET_ENV_NAMES) {
    const v = env[name];
    if (v && v.length >= 8) out = out.split(v).join(`[${name}]`);
  }
  out = out.replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[jwt]");
  out = out.replace(/\bsb_(secret|publishable)_[A-Za-z0-9_-]+/g, "[sb_key]");
  out = out.replace(/(https?:\/\/[^\s?#]+)\?[^\s#]*/g, "$1?[query]");
  return out.length > 4000 ? out.slice(0, 3990) + "…[cut]" : out;
}

export function log(event: string, fields: Record<string, unknown> = {}): void {
  // One JSON line per event; values pass through redact().
  console.log(redact(JSON.stringify({ event, ...fields })));
}
