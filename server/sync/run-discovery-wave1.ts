/**
 * run-discovery-wave1.ts
 *
 * Wave 1 test run: Discovery Golf Cars, limit 5 listings.
 * Confirms carts land in pending_imports before scaling up.
 *
 * Usage:
 *   npx tsx server/sync/run-discovery-wave1.ts
 *
 * Prerequisite: DDL migration must be applied first.
 *   https://supabase.com/dashboard/project/aagwrcdvhuuzwrglamrt/sql/new
 */

import { runDiscoverySync } from './discovery-sync.js';

async function main() {
  console.log('=== Discovery Wave 1 — Limit 5 ===');
  console.log('Writing to pending_imports. No direct publish.');
  console.log('');

  const result = await runDiscoverySync({
    limit: 5,
    dryRun: false,
    verbose: true,
  });

  console.log('\n=== Wave 1 Result ===');
  console.log(`Discovered: ${result.discovered}`);
  console.log(`Inserted into pending_imports: ${result.inserted}`);
  console.log(`Duplicates skipped: ${result.duplicates}`);
  console.log(`Errors: ${result.errors}`);
  console.log(`sync_log entry: ${result.syncLogId ?? 'none'}`);

  if (result.errors > 0) {
    console.error('\nErrors occurred — check output above before running wave 2.');
    process.exit(1);
  }

  if (result.inserted === 0 && result.duplicates === 0) {
    console.warn('\nNo listings inserted or found. Verify /inventory/ is accessible.');
    process.exit(1);
  }

  console.log('\nWave 1 succeeded. Review pending_imports in Supabase before running wave 2.');
  console.log('  Admin URL: https://supabase.com/dashboard/project/aagwrcdvhuuzwrglamrt/editor?table=pending_imports');
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
