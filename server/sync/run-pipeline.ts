/**
 * CartIQ Sync Pipeline — Standalone runner
 * Called via: tsx server/sync/run-pipeline.ts <json-options>
 * Output: JSON result to stdout
 *
 * This runs outside the main esbuild bundle to avoid bundling Playwright.
 */

import { runSync } from './pipeline.js';

async function main() {
  const optsStr = process.argv[2];
  if (!optsStr) {
    console.error(JSON.stringify({ error: 'No options provided' }));
    process.exit(1);
  }

  let opts: any;
  try {
    opts = JSON.parse(optsStr);
  } catch {
    console.error(JSON.stringify({ error: 'Invalid JSON options' }));
    process.exit(1);
  }

  try {
    const result = await runSync(opts);
    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  } catch (e: any) {
    process.stdout.write(JSON.stringify({ error: e.message }));
    process.exit(1);
  }
}

main();
