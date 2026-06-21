import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "cors",
  "csv-parse",
  "csv-parse/sync",
  "date-fns",
  "dotenv",
  "drizzle-orm",
  "drizzle-orm/sql-js",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "helmet",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "sql.js",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Copy sql-wasm.wasm alongside the bundle so __dirname resolves it at runtime
  const wasmSrc = resolve("node_modules/sql.js/dist/sql-wasm.wasm");
  const wasmDest = resolve("dist/sql-wasm.wasm");
  if (existsSync(wasmSrc)) {
    await copyFile(wasmSrc, wasmDest);
    console.log("copied sql-wasm.wasm → dist/sql-wasm.wasm");
  } else {
    console.warn("WARNING: sql-wasm.wasm not found at", wasmSrc);
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
