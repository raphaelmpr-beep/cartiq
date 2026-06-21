import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

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

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
