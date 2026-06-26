/**
 * Vercel Lambda entry point.
 *
 * @vercel/node expects a module that exports a Node.js HTTP handler
 * (req, res) => void  OR  an Express app.
 * It does NOT call listen() — it proxies requests directly.
 *
 * This file is the Vercel-specific entry. The normal index.ts still
 * calls listen() for pplx.app / local use.
 */
import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
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

// ── Async init ──────────────────────────────────────────────────────────────
// We must run this BEFORE exporting the handler so that the db is ready
// when the first Lambda request arrives.  We store any init error and
// surface it as a 500 JSON response so we can read it in logs/browser.

let initError: Error | null = null;
let ready = false;

const initPromise = (async () => {
  try {
    await initStorage();

    await registerRoutes(httpServer, app);
    ready = true;
    console.log("[vercel-handler] init complete");
  } catch (e: any) {
    initError = e;
    console.error("[vercel-handler] INIT ERROR:", e?.message, e?.stack);
  }
})();

// ── Request handler exported to @vercel/node ────────────────────────────────
// Vercel calls this for every request. We await init first so the db
// is guaranteed to exist before we touch any route.

const handler = async (req: Request, res: Response) => {
  // Wait for async init (usually already done on warm invocations)
  await initPromise;

  if (initError) {
    return res.status(500).json({
      error: "init_failed",
      message: initError.message,
      stack: initError.stack?.split("\n").slice(0, 8),
      env: {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
        cwd: process.cwd(),
      },
    });
  }

  // Delegate to the Express app
  return app(req, res);
};

// Global error handler (must have 4 args)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("[vercel-handler] express error:", err);
  if (!res.headersSent) {
    res.status(status).json({ message });
  }
});

// @vercel/node picks up the default export from CJS bundles
export default handler;

// ── SPA catch-all: inject per-route SEO meta then serve index.html ──────────
// This runs AFTER all API/static routes are registered by registerRoutes().
// On Vercel, this handler is the one that serves HTML pages — the CDN static
// route in vercel.json has been replaced so all non-asset requests come here.
import fs from "node:fs";
import path from "node:path";
import { getRouteMeta } from "./seo-meta";

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

app.use("/{*path}", (req: Request, res: Response) => {
  // Skip requests that look like static file extensions we don't handle
  const ext = path.extname(req.path);
  if (ext && ext !== ".html") {
    return res.status(404).json({ error: "Not found" });
  }

  // index.html lives at dist/public/index.html, one level up from dist/vercel-handler.cjs
  const indexPath = path.resolve(__dirname, "public", "index.html");
  let html: string;
  try {
    html = fs.readFileSync(indexPath, "utf-8");
  } catch {
    return res.status(500).send("Server error: could not read index.html");
  }

  const meta = getRouteMeta(req.path);

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escHtml(meta.title)}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escHtml(meta.description)}" />`
  );
  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${escHtml(meta.canonical)}" />`
  );
  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/,       `$1${escHtml(meta.ogTitle)}$2`);
  html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/,  `$1${escHtml(meta.ogDescription)}$2`);
  html = html.replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/,          `$1${escHtml(meta.ogUrl)}$2`);
  html = html.replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/,        `$1${escHtml(meta.ogImage)}$2`);
  html = html.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,       `$1${escHtml(meta.ogTitle)}$2`);
  html = html.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,`$1${escHtml(meta.ogDescription)}$2`);

  if (meta.jsonLd) {
    const jsonLdScript = `<script type="application/ld+json" data-server-injected>${JSON.stringify(meta.jsonLd)}</script>`;
    html = html.replace(/<\/head>/, `${jsonLdScript}\n</head>`);
  }

  res
    .set("Content-Type", "text/html; charset=utf-8")
    .set("Cache-Control", "public, max-age=0, must-revalidate")
    .send(html);
});
