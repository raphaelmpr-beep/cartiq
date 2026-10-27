// Admin auth helpers for lead routes (DRAFT).
// Production uses the EXISTING requireAdmin in server/routes.ts (x-admin-token header vs
// ADMIN_PASSWORD, timing-safe). makeRequireAdmin is the same logic, for fixture mode/tests.
import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export function makeRequireAdmin(password: string): RequestHandler {
  return (req, res, next) => {
    const token = req.headers["x-admin-token"];
    if (token && typeof token === "string" && token.length === password.length &&
      timingSafeEqual(Buffer.from(token), Buffer.from(password))) return next();
    res.status(401).json({ error: "Unauthorized" });
  };
}

const QUERY_SECRET_KEYS = ["token", "x-admin-token", "admin_token", "adminToken", "password", "key", "secret"];
/** Admin tokens are header-only. A token in the query string is refused (400) before auth runs. */
export const rejectQueryTokens: RequestHandler = (req, res, next) => {
  if (Object.keys(req.query ?? {}).some((k) => QUERY_SECRET_KEYS.includes(k) || QUERY_SECRET_KEYS.includes(k.toLowerCase()))) {
    return res.status(400).json({ error: "send the admin token in the x-admin-token header, not the URL" });
  }
  next();
};
