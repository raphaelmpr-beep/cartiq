// Dev-only fixture server: GCQ_FIXTURE_MODE=1 npx tsx server/fixture/index.ts
// Refuses to start when VERCEL_ENV or NODE_ENV is production.
import { createServer } from "node:http";
import { assertFixtureAllowed } from "./guard";

async function main() {
  try { assertFixtureAllowed(); } catch (e: any) { console.error(e.message); process.exit(1); }
  process.env.LEAD_TRACKING_ENABLED = "1";   // must be set before vite.config is imported
  process.env.VITE_GCQ_FIXTURE_MODE = "1";
  const { createFixtureApp } = await import("./app");
  const { app } = createFixtureApp();
  const server = createServer(app);
  const { setupVite } = await import("../vite");
  await setupVite(server, app);
  const port = Number(process.env.PORT || 5055);
  server.listen(port, "127.0.0.1", () => console.log(`[fixture] GCQ fixture mode on http://127.0.0.1:${port} (no database)`));
}
main();
