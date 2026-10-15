# Eco Golf Carts inventory adapter

Prepared and tested September 22, 2026. Production activation is blocked, not completed. Tracking: https://github.com/raphaelmpr-beep/cartiq/issues/29.

## Verified source and scope

- Dealer: Eco Golf Carts, 65 Hudson Way, Ponte Vedra, FL 32081; 904-834-6446. Use the visible [official contact address](https://ecogolfcarts.com/contact-golf-cart-dealership/), not stale structured metadata or directions parameters. Suite and coordinates remain unverified.
- Inventory: https://ecogolfcarts.com/inventory/
- Sitemap: https://ecogolfcarts.com/glc_listing-sitemap.xml
- Crawl policy: https://ecogolfcarts.com/robots.txt
- Live read-only adapter run at 2026-09-22T22:13:51.548Z: 118 sitemap detail URLs, six available carts, one pending card excluded, zero additional detail-status exclusions. Sitemap totals include sold history, not available inventory.

This adapter only discovers verified available units into `pending_imports` for review. It never publishes public listings. Unknown warranty and battery chemistry are not inferred. Source power terminology is preserved in specifications.

## Safeguards

- Exact dealer slug, adapter key, HTTPS host, listing path, canonical URL, source ID, and location checks.
- Live robots check; restrictive or malformed policies stop discovery. An unresolved crawl block also stops discovery.
- Only explicit missing-table errors permit fallback from the optional `dealer_block_log` table to the mandatory robots check. Permission and other database errors stop discovery.
- Active-section boundary is required. Missing boundary, unexpected pagination/layout, conflicting prices, and incomplete required fields fail closed.
- Sold, pending, reserved, and unavailable units excluded. Crossed-out prices and related-item carousels cannot contaminate primary listing fields.
- Every candidate must appear in the sitemap; complete parsing precedes queue writes.
- Canonical URL deduplication against existing listings and pending rows, plus conflict-safe inserts. Repeated discovery does not requeue known units.
- Dry runs perform no database writes, including telemetry. Non-dry runs write only pending rows and discovery telemetry.
- HTTP timeouts, redirect refusal, response-size limits, and candidate-count limits.

## Verification

On Node 22:

```sh
node --import tsx --test tests/eco-golf-carts.test.ts tests/warranty.test.ts
npx tsc --noEmit --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --esModuleInterop server/sync/eco-golf-carts.ts
npm run build
```

Results: 57 tests passed, zero failed or skipped; isolated adapter typecheck passed; production build passed. The full repository typecheck still has 38 pre-existing diagnostics, identical to the base after normalizing line offsets. It is not a clean full-repository typecheck.

Fixtures are trimmed from official pages fetched September 22, 2026. Tests cover parser edge cases, status changes, malformed pages, robots restrictions, dry-run behavior, all-dealer dispatch, queue writes, database failures, and repeat-run deduplication. Database integration tests are mocked; no production writes were made.

## Activation runbook

Current blockers: the Supabase connector is read-only; the Eco dealer record is absent; Vercel CLI access fails certificate validation. Do not disable TLS validation or set sync eligibility before the deployed build is verified.

1. Deploy the reviewed adapter build to the intended GolfCartIQ production project. Verify the deployed commit and authenticated sync route. Do not assume a preview or a similarly named project is production.
2. Through authorized writable administration, recheck dealer slug/domain duplicates. Insert or reconcile one dealer with these routing values:
   - `slug`: `eco-golf-carts-ponte-vedra`
   - `adapter_key`: `eco_golf_carts`
   - `canonical_domain`: `ecogolfcarts.com`
   - `inventory_source_url`: `https://ecogolfcarts.com/inventory/`
   - `sync_enabled`: `false` initially
   - `browser_required`: `false`
   - Contact details as verified above; unknown delivery/warranty terms null. Do not populate Google-verified fields from website evidence.
3. Run authenticated `POST /api/admin/sync` with:

```json
{
  "mode": "discover_sitemap",
  "dealer": "eco-golf-carts-ponte-vedra",
  "limit": 10,
  "dry_run": true
}
```

4. Require zero errors and inspect current candidates. Six was the test snapshot, not a permanent expected count. Confirm no writes occurred.
5. Under the user's conditional sync authorization, set `sync_enabled=true` and run the same scoped request with `dry_run=false`. Verify pending rows and telemetry, zero public listing changes, and a repeat run with zero new duplicates.
6. Verify that the existing scheduled all-dealer Lambda discovery includes Eco. This PR does not create or alter a scheduler. Do not call automatic sync operational until that scheduled path is verified.
7. If the canary fails, set `sync_enabled=false` immediately and investigate. Preserve evidence and pending rows for review rather than deleting records automatically.

Public publication remains a separate review step. Existing pending rows are deduplicated, not refreshed or revalidated by discovery; confirm availability again before approving publication.
