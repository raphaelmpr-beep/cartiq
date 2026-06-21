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
    // Initialize sql.js database (pure WASM — no native binary)
    await initStorage();

    // Seed database on startup
    try {
      const { seedDatabase } = await import("./seed");
      await seedDatabase();
    } catch (e) {
      console.error("Seed error:", e);
    }

    await registerRoutes(httpServer, app);
  } catch (e: any) {
    initError = e;
    console.error("[INIT ERROR]", e?.message, e?.stack);
    // Register a catch-all that surfaces the real error — Lambda won't crash silently
    app.use((_req: Request, res: Response) => {
      res.status(500).json({
        error: "init_failed",
        message: initError?.message ?? "Unknown init error",
        stack: initError?.stack?.split("\n").slice(0, 6),
        env: {
          VERCEL: process.env.VERCEL,
          NODE_ENV: process.env.NODE_ENV,
          cwd: process.cwd(),
        },
      });
    });
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (!initError) {
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
