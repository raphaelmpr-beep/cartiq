import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { initStorage } from "./storage";
import { createServer } from "node:http";

const app = express();
const httpServer = createServer(app);

// ─── Security headers ─────────────────────────────────────────────────────────
// CSP intentionally disabled (SPA with inline scripts); all other helmet defaults apply:
// X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, etc.
app.use(helmet({ contentSecurityPolicy: false }));

// Prevent browsers from sniffing MIME types
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Public deal-check form: 30 req / 15 min / IP
const dealCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many deal-check requests. Please try again in 15 minutes." },
});
app.use("/api/deal-checks", dealCheckLimiter);

// General API: 300 req / 1 min / IP (blocks scrapers, not real users)
const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith("/api/admin"), // admin uses token auth
  message: { message: "Too many requests. Please slow down." },
});
app.use("/api", generalApiLimiter);

// ─── Body size limit (prevent large-payload DoS) ─────────────────────────────
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "256kb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "256kb" }));

// ─── Request logging ──────────────────────────────────────────────────────────
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  let initError: Error | null = null;

  try {
    await initStorage();
    await registerRoutes(httpServer, app);
  } catch (e: any) {
    initError = e;
    console.error("[INIT ERROR]", e?.message);
    app.use((_req: Request, res: Response) => {
      // Never expose stack traces in production
      const isProd = process.env.NODE_ENV === "production";
      res.status(500).json({
        error: "init_failed",
        message: isProd ? "Service unavailable" : (initError?.message ?? "Unknown init error"),
        ...(isProd ? {} : { stack: initError?.stack?.split("\n").slice(0, 6) }),
      });
    });
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const isProd = process.env.NODE_ENV === "production";
    console.error("Internal Server Error:", err?.message);

    if (res.headersSent) return next(err);

    // Never expose raw error details in production
    return res.status(status).json({
      message: isProd ? "Internal Server Error" : (err.message || "Internal Server Error"),
    });
  });

  if (!initError) {
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    { port, host: "0.0.0.0", reusePort: true },
    () => { log(`serving on port ${port}`); },
  );
})();
