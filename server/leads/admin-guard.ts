// Admin sign-in guard (DRAFT). Applied ONLY when LEAD_TRACKING_ENABLED is on, at registration
// time in server/routes.ts. With the flag off nothing here runs and admin auth is exactly main's.
// FINAL scoping (Director ruling, 2026-10-18): BOTH guards apply ONLY to lead admin routes
// (/api/admin/leads*, paused, paused/clear, event-volume) and the admin-token path of
// /api/cron/lead-retention. verify, daily-price-refresh and all other main admin routes are
// untouched even with the flag on.
//  - 16-char ADMIN_PASSWORD minimum → 503 + rate-limited LEAD_CONFIG_ERROR (no value).
//  - Failed-sign-in cap: scope admin_fail_ip, 10 / 15 min per hashed IP (lead_rate_limit_hit).
//    Over the cap → 429 BEFORE the token is compared; only failures count. Limiter error →
//    503 (fail closed).
//  - Each failure logs ADMIN_AUTH_FAIL {ip_hash, route} — never the token.
// The wrapped original check still makes the actual auth decision.
import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export const ADMIN_FAIL = { scope: "admin_fail_ip", windowMs: 15 * 60_000, limit: 10 } as const;
export const MIN_ADMIN_PASSWORD_LEN = 16;

export interface AdminLimiter {
  peekRateLimit(scope: string, key: string, windowMs: number, now: number): Promise<number>;
  hitRateLimit(scope: string, key: string, windowMs: number, limit: number, now: number): Promise<boolean>;
}

export interface AdminGuardOptions {
  adminPassword: string | undefined;
  limiter: () => AdminLimiter;   // lazy: no DB client until a request arrives
  salt: () => string;            // LEAD_IP_SALT (may be "" if missing; hashing still avoids raw IPs in logs)
  now?: () => number;
  logError?: (line: string) => void;
  logWarn?: (line: string) => void;
}

function clientIp(req: any): string {
  const xff = req.headers["x-forwarded-for"];
  const first = (Array.isArray(xff) ? xff[0] : xff ?? "").split(",")[0].trim();
  return first || req.socket?.remoteAddress || "unknown";
}

export function makeAdminGuard(o: AdminGuardOptions) {
  const now = o.now ?? Date.now;
  const logError = o.logError ?? ((l: string) => console.error(l));
  const logWarn = o.logWarn ?? ((l: string) => console.warn(l));
  const pw = o.adminPassword;
  const pwOk = typeof pw === "string" && pw.length >= MIN_ADMIN_PASSWORD_LEN;
  let lastCfg = -Infinity;

  /** 16-char minimum — lead routes only. */
  const minLen: RequestHandler = (_req, res, next) => {
    if (pwOk) return next();
    if (now() - lastCfg >= 60_000) {
      lastCfg = now();
      logError(`LEAD_CONFIG_ERROR ${JSON.stringify({ problem: "ADMIN_PASSWORD shorter than 16 chars", effect: "lead admin routes disabled while lead tracking is on" })}`);
    }
    res.status(503).json({ error: "config_error" });
  };

  /** Failed-sign-in cap. failOpen: limiter error → continue to the existing check. */
  const cap = (failOpen: boolean): RequestHandler => async (req, res, next) => {
    const ipHash = createHash("sha256").update(`${o.salt()}|admin|${clientIp(req)}`).digest("hex").slice(0, 32);
    try {
      const lim = o.limiter();
      if ((await lim.peekRateLimit(ADMIN_FAIL.scope, ipHash, ADMIN_FAIL.windowMs, now())) >= ADMIN_FAIL.limit) {
        return res.status(429).json({ error: "too_many_failed_sign_ins" });
      }
      const token = req.headers["x-admin-token"];
      const good = typeof pw === "string" && pw.length > 0 && typeof token === "string" &&
        token.length === pw.length && timingSafeEqual(Buffer.from(token), Buffer.from(pw));
      if (!good) {
        await lim.hitRateLimit(ADMIN_FAIL.scope, ipHash, ADMIN_FAIL.windowMs, ADMIN_FAIL.limit, now());
        logWarn(`ADMIN_AUTH_FAIL ${JSON.stringify({ ip_hash: ipHash, route: req.path })}`);
      }
    } catch {
      logError(`ADMIN_GUARD_ERROR ${JSON.stringify({ problem: "admin_fail limiter unavailable", effect: failOpen ? "fail open (existing check decides)" : "fail closed (503)" })}`);
      if (!failOpen) return res.status(503).json({ error: "temporarily_unavailable" });
    }
    next();
  };
  const capClosed = cap(false);

  const chain = (...hs: RequestHandler[]): RequestHandler => (req, res, next) => {
    const run = (i: number): void => { if (i === hs.length) return next(); hs[i](req, res, () => run(i + 1)); };
    run(0);
  };

  return {
    /** lead routes: 16-char minimum + cap (fail closed), then the original decides. */
    wrapLead: (base: RequestHandler) => chain(minLen, capClosed, base),
  };
}
