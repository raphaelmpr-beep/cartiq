# Scheduled new-listing ingest + stall alert (DRAFT)

**Owner: Raphael Martinez (raphaelmpr-beep).** Stall alerts email the owner at `OWNER_ALERT_EMAIL`.

- Vercel cron `0 11 * * *` (07:00 ET in EDT) → `GET /api/cron/ingest`, auth `Authorization: Bearer $CRON_SECRET`.
- **Off unless `SYNC_SCHEDULER_ENABLED=true`.** Disabled → returns `DISABLED` before any network call or DB read/write.
- Enabled → calls the existing ingest path `runLambdaSync({ mode: "discover_sitemap", dealer: "all" })`
  (new URLs go to `pending_imports` for review; nothing is published, archived or de-indexed).
- Stall rule: alert if no new listing in **> 6 days** (newest of `pending_imports.found_at`, `listings.created_at`,
  read-only) **or** the run failed (threw or `errors > 0`) **or** no timestamp could be read.
- Email path: the repo had none, so `owner-alert.ts` adds a minimal Resend call. Uses GolfCartIQ's own `GCQ_RESEND_API_KEY` (not TAW's `RESEND_API_KEY`). Missing `GCQ_RESEND_API_KEY` /
  `OWNER_ALERT_EMAIL` → alert is skipped, not an error.
- No schema change. Optional run log table: `supabase/drafts/ingest_cron_runs.DRAFT.sql` (NOT applied; DE review).

## Review queue + auto-publish
- **Reviewer for `pending_imports`: Raphael Martinez.** The cron also alerts when the oldest pending item has waited
  longer than `PENDING_MAX_AGE_HOURS` (default 72 h).
- `autopublish.ts`: gate used only when `INGEST_AUTOPUBLISH_ENABLED=true`. A listing passes only if (a) the final URL
  (after redirects, including 200 redirects) is the listing itself, not the dealer homepage; (b) no sold/removed marker;
  (c) stored price == page **sale** price (never the "Original Price"); (d) year/make/model match. Anything else queues
  with the failure reasons logged. The publish write itself is not wired in this draft (no promote path exists yet,
  Spec 3), so even with the flag on, listings still queue until that lands.
- Each alert's Resend message id is returned in `runLog.alert_message_id` and logged (`ingest_cron_runs.alert_message_id`).
  SRE monitor: flag `alert_sent and alert_message_id is null`.

## Env (names only; set only with owner approval)
`SYNC_SCHEDULER_ENABLED`, `CRON_SECRET`, `GCQ_RESEND_API_KEY`, `OWNER_ALERT_EMAIL`, optional `ALERT_FROM_EMAIL`,
`INGEST_AUTOPUBLISH_ENABLED` (off), `PENDING_MAX_AGE_HOURS` (default 72).
Uses existing `SUPABASE_URL` / `SUPABASE_KEY`.

## SEO impact
**Default = zero SEO change.** With `SYNC_SCHEDULER_ENABLED` unset the job does nothing: no listing, sitemap,
canonical, robots, status code or internal-link changes. The only deployed difference is a new auth-gated
`/api/cron/ingest` route (401 without the secret; `/api/*` is not in any sitemap).
When enabled, new URLs land in `pending_imports` only; SEO changes happen only when a human promotes them.

Tests: `npx tsx --test tests/ingest-cron.test.ts`.
