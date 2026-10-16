# Scheduled new-listing ingest + stall alert (DRAFT)

**Owner: Raphael Martinez (raphaelmpr-beep).** Stall alerts email the owner at `OWNER_ALERT_EMAIL`.

- Vercel cron `0 11 * * *` (07:00 ET in EDT) → `GET /api/cron/ingest`, auth `Authorization: Bearer $CRON_SECRET`.
- **Off unless `SYNC_SCHEDULER_ENABLED=true`.** Disabled → returns `DISABLED` before any network call or DB read/write.
- Enabled → calls the existing ingest path `runLambdaSync({ mode: "discover_sitemap", dealer: "all" })`
  (new URLs go to `pending_imports` for review; nothing is published, archived or de-indexed).
- Stall rule: alert if no new listing in **> 6 days** (newest of `pending_imports.found_at`, `listings.created_at`,
  read-only) **or** the run failed (threw or `errors > 0`) **or** no timestamp could be read.
- Email path: the repo had none, so `owner-alert.ts` adds a minimal Resend call. Missing `RESEND_API_KEY` /
  `OWNER_ALERT_EMAIL` → alert is skipped, not an error.
- No schema change. Optional run log table: `supabase/drafts/ingest_cron_runs.DRAFT.sql` (NOT applied; DE review).

## Env (names only; set only with owner approval)
`SYNC_SCHEDULER_ENABLED`, `CRON_SECRET`, `RESEND_API_KEY`, `OWNER_ALERT_EMAIL`, optional `ALERT_FROM_EMAIL`.
Uses existing `SUPABASE_URL` / `SUPABASE_KEY`.

## SEO impact
**Default = zero SEO change.** With `SYNC_SCHEDULER_ENABLED` unset the job does nothing: no listing, sitemap,
canonical, robots, status code or internal-link changes. The only deployed difference is a new auth-gated
`/api/cron/ingest` route (401 without the secret; `/api/*` is not in any sitemap).
When enabled, new URLs land in `pending_imports` only; SEO changes happen only when a human promotes them.

Tests: `npx tsx --test tests/ingest-cron.test.ts`.
