/**
 * CartIQ Seed — PRODUCTION MODE
 *
 * Synthetic data removed. The database is now Supabase/Postgres and persists
 * across deployments. Data enters via:
 *   1. Real dealer inventory imports (CSV upload or manual entry)
 *   2. User-submitted listings (Sell My Cart form → POST /api/listings)
 *   3. Dealer website imports (to be added)
 *
 * To import a dealer's inventory, POST to /api/listings with x-admin-token header.
 * See supabase_migration.sql for the schema.
 */

export async function seedDatabase(): Promise<void> {
  console.log("[seed] Production mode — no synthetic data. Database is live.");
}
