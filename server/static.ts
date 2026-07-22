import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";
import { getRouteMeta, getRouteMetaAsync } from "./seo-meta";

/**
 * Inject per-route SEO meta tags into index.html before serving.
 *
 * Google's crawler does not execute JavaScript before recording the initial
 * response. This means a React SPA that sets <title> and <link rel="canonical">
 * via document.title / DOM manipulation will always look identical to Googlebot —
 * every page appears to have the same canonical (https://golfcartiq.com/) and
 * same title.
 *
 * Solution: read index.html on each SPA request, do fast string replacements
 * to inject per-route values, and write the modified HTML to the response.
 * No React SSR needed — the page still hydrates normally on the client.
 */

/** HTML-escape a string for safe injection into attribute values */
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Build a JSON-LD <script> block.
 * Returns empty string if jsonLd is null.
 */
function buildJsonLdScript(jsonLd: object | null): string {
  if (!jsonLd) return "";
  return `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    // On Vercel, static files are served from CDN — the Lambda only handles API routes.
    // Skip static serving gracefully instead of crashing.
    if (process.env.VERCEL) {
      app.use("/{*path}", (_req, res) => {
        res.status(404).json({ error: "Static files are served from CDN on Vercel" });
      });
      return;
    }
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const indexPath = path.resolve(distPath, "index.html");

  // Serve static assets (JS, CSS, images, fonts, etc.) normally
  app.use(express.static(distPath, {
    // Don't serve index.html automatically — we handle that below with meta injection
    index: false,
  }));

  // SPA catch-all: inject per-route meta then serve modified index.html
  app.use("/{*path}", async (req, res) => {
    // Parse pathname from originalUrl. With `app.use("/{*path}")`, req.path
    // may be "/" because Express strips the mount; originalUrl preserves
    // the real request path.
    const { pathname } = new URL(req.originalUrl || req.url || "/", "https://golfcartiq.com");

    // Skip requests that look like files (has extension) — serve 404 rather than SPA
    const ext = path.extname(pathname);
    if (ext && ext !== ".html") {
      return res.status(404).json({ error: "Not found" });
    }

    let html: string;
    try {
      html = fs.readFileSync(indexPath, "utf-8");
    } catch {
      return res.status(500).send("Server error: could not read index.html");
    }

    // Derive route meta from request path.
    // Async variant fetches per-listing data for /listing/:slug so Google sees
    // unique title/description/JSON-LD in the initial response.
    let meta;
    try {
      meta = await getRouteMetaAsync(pathname);
    } catch {
      meta = getRouteMeta(pathname);
    }

    // ── Replace <title> ───────────────────────────────────────────────────
    html = html.replace(
      /<title>[^<]*<\/title>/,
      `<title>${esc(meta.title)}</title>`
    );

    // ── Replace <meta name="description"> ────────────────────────────────
    html = html.replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${esc(meta.description)}" />`
    );

    // ── Replace <link rel="canonical"> ────────────────────────────────────
    html = html.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${esc(meta.canonical)}" />`
    );

    // ── Replace OG tags ───────────────────────────────────────────────────
    html = html.replace(
      /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
      `$1${esc(meta.ogTitle)}$2`
    );
    html = html.replace(
      /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
      `$1${esc(meta.ogDescription)}$2`
    );
    html = html.replace(
      /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
      `$1${esc(meta.ogUrl)}$2`
    );
    html = html.replace(
      /(<meta\s+property="og:image"\s+content=")[^"]*(")/,
      `$1${esc(meta.ogImage)}$2`
    );

    // ── Replace Twitter title/description ────────────────────────────────
    html = html.replace(
      /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
      `$1${esc(meta.ogTitle)}$2`
    );
    html = html.replace(
      /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
      `$1${esc(meta.ogDescription)}$2`
    );

    // ── Inject JSON-LD before </head> ─────────────────────────────────────
    const jsonLdScript = buildJsonLdScript(meta.jsonLd);
    if (jsonLdScript) {
      // Remove any existing server-injected JSON-LD to avoid duplicates on re-requests
      html = html.replace(/<script type="application\/ld\+json" data-server-injected>[^<]*<\/script>/g, "");
      const taggedScript = jsonLdScript.replace(
        '<script type="application/ld+json">',
        '<script type="application/ld+json" data-server-injected>'
      );
      html = html.replace("</head>", `${taggedScript}\n</head>`);
    }

    // ── Inject noindex robots meta when listing is non-indexable ─────────
    if (meta.noindex) {
      // Replace existing robots meta if present, otherwise inject before </head>.
      const noindexTag = `<meta name="robots" content="noindex,follow" data-server-injected />`;
      if (/<meta\s+name="robots"[^>]*>/i.test(html)) {
        html = html.replace(/<meta\s+name="robots"[^>]*>/i, noindexTag);
      } else {
        html = html.replace("</head>", `${noindexTag}\n</head>`);
      }
    }

    // ── Inject server-rendered body content just after <div id="root"> ──
    // This block is hidden from the user (`hidden` attribute) but visible to
    // Googlebot in the initial DOM. React re-renders inside #root on hydrate.
    if (meta.bodyContent) {
      // Remove any prior server-injected block first (safety on re-request).
      html = html.replace(/<div id="__seo_ssr__"[\s\S]*?<\/div>/, "");
      html = html.replace(
        /(<div id="root"[^>]*>)/,
        `$1${meta.bodyContent}`
      );
    }

    res
      .set("Content-Type", "text/html; charset=utf-8")
      .set("Cache-Control", "public, max-age=0, must-revalidate")
      .send(html);
  });
}
