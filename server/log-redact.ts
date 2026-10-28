/** Strip credentials (session tokens, checkout/portal URLs) from JSON before it is written to request logs. */
const SECRET_KEYS = /^(access_token|refresh_token|provider_token|provider_refresh_token|token|password|session|url|client_secret)$/i;
export function redactForLog(v: unknown, depth = 0): unknown {
  if (depth > 6 || v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => redactForLog(x, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = SECRET_KEYS.test(k) ? "[redacted]" : redactForLog(x, depth + 1);
  return out;
}
