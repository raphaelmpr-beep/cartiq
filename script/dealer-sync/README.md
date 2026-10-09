# Dealer sync scheduler (DRAFT, code-only)

Scheduler shell + runner for GolfCartIQ dealer inventory sync. **Disabled.** Writes nothing today.

## What it does
- `planFetchGroups` (run-all fix, sync map §6 P0-2): keeps `adapter_key IS NULL` dealers (generic adapter),
  groups dealers sharing an adapter into one fetch with **one run row per sibling** (`fetch_group`).
- `runGroup`: `dealer_sync_run_start` per sibling **before** the fetch → one fetch → per-sibling seen-URL set
  into `dealer_sync_run_urls` (`url_norm` = JS mirror of `gcq_url_norm`) → `dealer_sync_run_finish` in `finally`.
- Outcome rules (DE data spec §2): 0 URLs → `failed/zero_urls` (never success / no_new); shared feed with
  untaggable items → `partial/location_split_unknown`; incomplete → `partial/pagination_incomplete`;
  401/402/403 → `blocked/blocked_antibot`; 429 → `blocked/blocked_rate_limited`; `fetched_count` per dealer after tagging;
  `site_count` only when observed (never guessed).

## Exit states (`main.ts`)
| State | Exit | Writes |
|---|---|---|
| DISABLED (`SYNC_SCHEDULER_ENABLED` != `true`) | 0 | none |
| BLOCKED_G2 (`GCQ_G2_ROTATION_CONFIRMED` != `true`) | 1 | none |
| MISSING_ENV (names only, never values) | 1 | none |
| SKIPPED_NO_TABLES (read-only HEAD probe of DE tables) | 0 | none |
| SKIPPED_NO_FETCHER (registry empty in this draft, G4) | 0 | none |
| DONE | 0 | DE run tables only |

## What it does NOT do (by design)
- No writes to `listings` / `pending_imports`. No promote, archive, sold, sitemap, canonical or 410 changes (G3). No badge changes (G5).
- No dealer-site fetching: `fetchers.ts` is empty (G4). Never uses `server/sync/stealth-fetcher.ts`.
- No secrets in code. Secrets come only from GitHub Actions env secrets, set after G2 rotation.

## TODO (pointing at specs)
- Spec 1: wrap existing adapters as `DealerFetcher` (real HTTP status, location tags, observed site_count, robots + Crawl-delay).
- Spec 2: HTML-index parser; sale vs regular vs asking price.
- Spec 3: promote with `dealer_id` set; archive only via `dealer_sync_apply_removals` (behind G3, `removal_enabled=false`).
- Spec 4: `dealer_sync_daily_snapshot()`, scorecard, alerts, dead-man switch; retire/confirm the external pplx.app cron.

Tests: `npx tsx --test tests/dealer-sync.test.ts` (no network, no DB).
