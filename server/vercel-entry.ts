/**
 * Vercel Lambda entry point.
 *
 * @vercel/node expects a file that exports the Express app (or a handler function).
 * It wraps it with serverless-http internally to bridge Lambda ↔ Express.
 *
 * This file:
 *  1. Initialises the sql.js database (async, awaited at module level via top-level await trick)
 *  2. Registers all routes
 *  3. Exports the Express app as module.exports (default export for CJS)
 *
 * The local dev server (server/index.ts) still uses httpServer.listen() normally.
 */

import "dotenv/config";
import express, { Response, NextFunction } from "express";
import type { Request } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { initStorage } from "./storage";
import { createServer } from "node:http";

const app = express();
const httpServer = createServer(app);

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// Rate limiting — public deal-check form: 30 requests per 15 min per IP
const dealCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many deal-check requests. Please try again in 15 minutes." },
});
app.use("/api/deal-checks", dealCheckLimiter);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

// Initialise DB + routes — returns a promise we export so @vercel/node can await it
const ready: Promise<typeof app> = (async () => {
  await initStorage();

  try {
    const { seedDatabase } = await import("./seed");
    await seedDatabase();
  } catch (e) {
    console.error("Seed error:", e);
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  return app;
})();

// @vercel/node supports exporting either:
//   1. The Express app directly (it wraps with serverless-http)
//   2. A function (req, res) => void
//   3. A Promise that resolves to one of the above
//
// Export the promise — @vercel/node will await it before routing requests.
export default ready;
module.exports = ready;
