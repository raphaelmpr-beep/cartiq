# GolfCartIQ Growth Scorecard and Verified Comps

Implementation handoff, September 16, 2026. Production has not been changed. The private preview uses explicit sample inventory and simulated analytics, not live results.

## Delivered

- **Growth scorecard:** New authenticated Growth tab in the existing admin. Date-filtered Google impressions/clicks and CTR from exact-window manual Search Console snapshots; estimator visits/completions, comparable views/clicks, inventory detail views and contact clicks from new on-site events. Missing snapshots show “Not imported”; storage failures show an error rather than zeros.
- **Verified comps:** Estimator results now request up to six source-checked carts. Exact normalized brand/model, power, seats and electric battery type; model year within two years; used/refurbished inventory only; optional FL/GA restriction. Poor-condition estimates intentionally return no comps because cosmetic condition cannot be matched reliably.
- **Quality gate:** Active public listing, non-null matching dealer ID, non-conflicting sync source, branch and stock review, explicit source price equal to stored asking price, unit-specific source URL, image, and a source verification no older than seven days. Duplicate source URLs/VINs are removed. A failed or incomplete candidate scan is unavailable, never falsely presented as exhaustive.
- **Transparent pricing:** Formula ranges remain separate from dealer asking prices. Unsupported estimator accuracy and sold-price calibration claims were removed from the touched estimator copy. No warranty badge is inferred for these cards.
- **Instrumentation:** Phone, email and source-site contact actions on listing detail; source-site action on comps; estimator and inventory events. No form details, names, emails or entered cart specifications are stored in the growth event table. Tracking respects browser Do Not Track.

## Files and integration

The implementation starts from GitHub main commit `221a2090da5416de522813b73511303491ef6533`, verified at the start of this work. The source patch is intended for that baseline. Both the Express and Vercel handlers use the existing `registerRoutes` path, which now registers the growth routes.

- `shared/growth.ts`: validated API contracts.
- `server/comparables.ts`: deterministic eligibility and ranking.
- `server/growth-storage.ts`: server-only Supabase persistence; paginated candidates with a fail-closed scan cap.
- `server/growth-routes.ts`: public comps/events plus protected scorecard/import endpoints.
- `client/src/components/VerifiedComparables.tsx`: loading, success, empty, unavailable and retry states.
- `client/src/components/GrowthScorecard.tsx`: admin measurements, date selectors and manual snapshot import.
- `client/src/lib/growth.ts`: non-blocking, memory-only telemetry session.
- Existing estimator, listing detail, admin and route registration files are integrated.
- `migrations/20260916_growth_and_verified_comps.sql`: three RLS-protected tables and the aggregate RPC.
- `tests/growth.test.ts` and `tests/growth-browser.cjs`: regression and isolated UI checks.
- `preview/` and `preview.config.ts`: isolated fixture harness. Not part of the production entrypoint.

## Verification

- Production client, server and Vercel-handler builds pass.
- 29 automated regression tests pass, including source-price mismatch, bad mappings, invalid vehicle URLs, stale/future evidence, mismatched cart specifications, duplicate records, invalid dates, unauthorized admin access, missing storage and safe empty results.
- Browser checks exercise estimator submission, results clearing after edits, desktop/mobile layouts, scorecard navigation, import submission, refresh, empty/unavailable states and comparable retry. The preview import uses a mock; it is not a database persistence test.
- The repository-wide TypeScript check still reports 38 pre-existing diagnostics. No diagnostics were added in the new feature files; this is not a clean repository-wide typecheck.
- SQL migration and live Supabase relational queries have not been executed. Production authentication, event persistence, RLS and real listing-detail contact instrumentation still require a post-migration smoke test.

## Deployment sequence requiring approval

1. Review the source patch against the stated baseline and resolve any newer-main conflicts. Rebuild with `npm run build`; the repository tracks generated `dist` files, so include the resulting production build when following its deployment workflow. Do not deploy `preview-dist` as production.
2. Apply the migration through the approved database administration path. It creates `comp_verifications`, `growth_events`, `search_performance_snapshots` and `growth_scorecard`.
3. Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in the server environment. The new tables are not accessible via anonymous client keys. Never expose the service-role value through Vite or browser code.
4. Review initial unit pages and add evidence records to `comp_verifications` through trusted database administration. Record the actual listing/dealer IDs, canonical unit URL, published cash asking price, real check time, evidence excerpt, reviewer, vehicle validity, in-stock status and branch match. Do not bulk mark all current inventory verified. Do not convert ingestion timestamps or historical audits into fresh checks.
5. Deploy the production build. Verify actual eligible cards and empty states; submit one controlled estimator journey and confirm event rows and admin aggregates; test unauthenticated access fails. Confirm the chosen live source prices still match.
6. Import unfiltered Web-search property totals from `sc-domain:golfcartiq.com` for the exact scoreboard date range. The import is manual in this first implementation; no live Google credential is embedded.

If no reviewed inventory records exist, the feature truthfully shows no matches. It must not be advertised as populated with verified live comps before the initial review is completed.

## Measurement and operational limits

Google totals use Search Console’s Pacific date boundaries; on-site counts use UTC boundaries. Stages are independent counts, not a cross-source attributed funnel. A contact click is neither a confirmed lead nor revenue. Browser sessions currently reset on full reload and are not GA4 sessions; Do Not Track, blocked requests and failures undercount activity. Simple user-agent bot exclusion is not comprehensive bot detection.

An empty successful query means no events recorded in that window, not zero historical visitors. There is no retroactive event backfill. No 50,000-impression monetization eligibility claim is encoded.

Source checks expire after seven days and must be renewed by a real review or a separately validated verification pipeline. This change does not create an unattended verification job, fix historical dealer mappings/prices, update warranty data, or automatically qualify managed-inventory sales leads. Unknown battery/model/branch fields fail closed and can reduce coverage.

The verification table retains the latest reviewed record per listing, not an immutable review history. The event endpoint rate-limits writes and validates payloads, but browser analytics can still be spoofed. Operational retention/deletion policy and stronger anti-abuse controls should be reviewed before high-volume rollout.

## Rollback

Redeploy the prior application build if needed. Leave the additive tables in place initially to preserve collected evidence; do not drop them as part of an automatic rollback. No existing listing, dealer, pricing or warranty columns are modified by this migration.
