-- ============================================================
-- CartIQ: Backfill dealer_coverage_log for 8 existing sources
-- Run AFTER 20260622_coverage_audit_layer.sql has been applied.
-- ============================================================

-- Botero (87 listings, all great_deal reset to unknown, browser-required sitemap source)
INSERT INTO dealer_coverage_log (
  dealer_slug, inventory_url,
  discovered_count, pending_imports_count, public_listings_count,
  duplicate_count, skipped_count,
  pagination_detected, pages_visited, load_more_detected, scroll_required, detail_pages_visited,
  source_page_type, coverage_status,
  valuation_review_needed,
  adapter_notes, scanned_at
) VALUES (
  'botero', 'https://boterocarts.com/inventory/',
  87, 0, 87,
  0, 0,
  true, 3, false, false, 87,
  'sitemap',
  'partial_inventory',   -- sitemap-sourced; detail pages parsed but pagination not walk-tested via browser
  false,
  'Sourced from XML sitemaps (glc_listing-sitemap1-3). Bot detection on /inventory/ (403). Detail pages parsed via pipeline-lambda. Pagination and load-more not verified. Multi-location group (GA + FL).',
  NOW()
);

-- Fat Boys (13 listings)
INSERT INTO dealer_coverage_log (
  dealer_slug, inventory_url,
  discovered_count, pending_imports_count, public_listings_count,
  duplicate_count, skipped_count,
  pagination_detected, pages_visited, load_more_detected, scroll_required, detail_pages_visited,
  source_page_type, coverage_status,
  valuation_review_needed,
  adapter_notes, scanned_at
) VALUES (
  'fat_boys', 'https://www.fatboyscarts.com/used-golf-carts/',
  13, 0, 13,
  0, 0,
  false, 1, false, false, 13,
  'category_page',
  'needs_manual_review',
  false,
  'Imported via CSV/manual. Source page structure not yet probed. Pagination and load-more behavior unknown. Needs adapter probe before next sync.',
  NOW()
);

-- Golf Rider (12 listings)
INSERT INTO dealer_coverage_log (
  dealer_slug, inventory_url,
  discovered_count, pending_imports_count, public_listings_count,
  duplicate_count, skipped_count,
  pagination_detected, pages_visited, load_more_detected, scroll_required, detail_pages_visited,
  source_page_type, coverage_status,
  valuation_review_needed,
  adapter_notes, scanned_at
) VALUES (
  'golf_rider', 'https://www.golfrider.com/inventory/',
  12, 0, 12,
  0, 0,
  false, 1, false, false, 12,
  'full_inventory',
  'needs_manual_review',
  false,
  'Imported via CSV/manual. Source page structure not yet probed. Pagination and scroll behavior unknown.',
  NOW()
);

-- Shiver Carts (7 listings)
INSERT INTO dealer_coverage_log (
  dealer_slug, inventory_url,
  discovered_count, pending_imports_count, public_listings_count,
  duplicate_count, skipped_count,
  pagination_detected, pages_visited, load_more_detected, scroll_required, detail_pages_visited,
  source_page_type, coverage_status,
  valuation_review_needed,
  adapter_notes, scanned_at
) VALUES (
  'shiver_carts', 'https://www.shivercarts.com/used-golf-carts/',
  7, 0, 7,
  0, 0,
  false, 1, false, false, 7,
  'category_page',
  'needs_manual_review',
  false,
  'Imported via CSV/manual. Source page structure not yet probed. Multi-location (Tifton + Valdosta GA).',
  NOW()
);

-- Discovery Golf Cars (5 listings — Wave 1, deal_rating now reset to unknown)
INSERT INTO dealer_coverage_log (
  dealer_slug, inventory_url,
  discovered_count, pending_imports_count, public_listings_count,
  duplicate_count, skipped_count,
  pagination_detected, pages_visited, load_more_detected, scroll_required, detail_pages_visited,
  source_page_type, coverage_status,
  valuation_review_needed,
  adapter_notes, scanned_at
) VALUES (
  'discovery-golf-cars-clearwater', 'https://discoverygolfcars.com/inventory/',
  5, 0, 5,
  0, 0,
  true, 1, false, false, 5,     -- pagination exists but only 1 page visited (Wave 1 limit=5)
  'full_inventory',
  'partial_inventory',           -- browser required, pagination not fully traversed, multi-location
  false,                         -- deal_rating reset to unknown (was great_deal — valuation_review_needed cleared)
  'platform=gcr_wordpress. /inventory/ returns 403 to curl — browser required. Wave 1: 5 listings fetched (limit=5). Pagination confirmed present but not fully walked. Two locations: Clearwater + Land O Lakes. deal_rating reset to unknown post-import. Needs full pagination walk to confirm inventory depth.',
  NOW()
);

-- Jenkins Motorsports (5 listings)
INSERT INTO dealer_coverage_log (
  dealer_slug, inventory_url,
  discovered_count, pending_imports_count, public_listings_count,
  duplicate_count, skipped_count,
  pagination_detected, pages_visited, load_more_detected, scroll_required, detail_pages_visited,
  source_page_type, coverage_status,
  valuation_review_needed,
  adapter_notes, scanned_at
) VALUES (
  'jenkins', 'https://www.jenkinsmotorsports.com/golf-carts/',
  5, 0, 5,
  0, 0,
  false, 1, false, false, 5,
  'full_inventory',
  'browser_required',
  false,
  'platform=dealerspike. JS-rendered inventory. Browser required. Multi-location group (Avon Park + main). Imported via CSV/manual for now. Adapter not yet built.',
  NOW()
);

-- Mike's Golf Carts GA (3 listings)
INSERT INTO dealer_coverage_log (
  dealer_slug, inventory_url,
  discovered_count, pending_imports_count, public_listings_count,
  duplicate_count, skipped_count,
  pagination_detected, pages_visited, load_more_detected, scroll_required, detail_pages_visited,
  source_page_type, coverage_status,
  valuation_review_needed,
  adapter_notes, scanned_at
) VALUES (
  'mikes_ga', 'https://www.mikesgolfcartsga.com/used-golf-carts/',
  3, 0, 3,
  0, 0,
  false, 1, false, false, 3,
  'category_page',
  'needs_manual_review',
  false,
  'Imported via CSV/manual. Source page structure not yet probed. Perry + Douglas GA locations.',
  NOW()
);

-- Golf Cars of Woodstock (2 listings)
INSERT INTO dealer_coverage_log (
  dealer_slug, inventory_url,
  discovered_count, pending_imports_count, public_listings_count,
  duplicate_count, skipped_count,
  pagination_detected, pages_visited, load_more_detected, scroll_required, detail_pages_visited,
  source_page_type, coverage_status,
  valuation_review_needed,
  adapter_notes, scanned_at
) VALUES (
  'golf_cars_woodstock', 'https://www.golfcarsofwoodstock.com/used-golf-carts/',
  2, 0, 2,
  0, 0,
  false, 1, false, false, 2,
  'category_page',
  'needs_manual_review',
  false,
  'Imported via CSV/manual. Source page structure not yet probed. Small inventory — may be complete.',
  NOW()
);

-- ── Verify ──────────────────────────────────────────────────────────────────
SELECT
  dealer_slug,
  public_listings_count,
  coverage_status,
  valuation_review_needed,
  source_page_type,
  scanned_at::date AS scanned_date
FROM dealer_coverage_log
ORDER BY public_listings_count DESC;
