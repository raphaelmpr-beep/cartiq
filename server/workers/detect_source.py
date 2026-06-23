#!/usr/bin/env python3
"""
CartIQ Detect Source Worker
Polls detect_source_jobs for queued jobs, uses crawl4ai to detect platform type
and generate a CSS extraction schema for the dealer's inventory page.

Env vars required:
  SUPABASE_URL
  SUPABASE_SERVICE_KEY  (service role key for RLS bypass)
  OPENAI_API_KEY        (for generate_schema LLM call)
"""

import asyncio, json, os, re, sys
from datetime import datetime, timezone
from dotenv import load_dotenv
import httpx
from crawl4ai import AsyncWebCrawler
from crawl4ai.extraction_strategy import JsonCssExtractionStrategy

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

async def fetch_queued_job(client: httpx.AsyncClient) -> dict | None:
    r = await client.get(
        f"{SUPABASE_URL}/rest/v1/detect_source_jobs",
        params={"status": "eq.queued", "order": "created_at.asc", "limit": "1"},
        headers=HEADERS,
    )
    rows = r.json()
    return rows[0] if rows else None

async def update_job(client: httpx.AsyncClient, job_id: str, updates: dict):
    await client.patch(
        f"{SUPABASE_URL}/rest/v1/detect_source_jobs?id=eq.{job_id}",
        json=updates, headers=HEADERS,
    )

async def fetch_dealer(client: httpx.AsyncClient, slug: str) -> dict | None:
    r = await client.get(
        f"{SUPABASE_URL}/rest/v1/dealers",
        params={"slug": f"eq.{slug}", "limit": "1"},
        headers=HEADERS,
    )
    rows = r.json()
    return rows[0] if rows else None

async def update_dealer(client: httpx.AsyncClient, slug: str, updates: dict):
    await client.patch(
        f"{SUPABASE_URL}/rest/v1/dealers?slug=eq.{slug}",
        json=updates, headers=HEADERS,
    )

def detect_platform(html: str, url: str) -> tuple[str, str, str]:
    """
    Heuristic platform detection from HTML content and URL.
    Returns (adapter_key, platform_type, discovery_strategy)
    """
    # GCR / DX1 WordPress detection
    if any(x in html for x in ["dx1.com", "gcr.com/wp-content", "dx1framework", "/inventory/"]) or \
       re.search(r'"@type"\s*:\s*"Product"', html):
        return ("gcr_wordpress", "gcr_wordpress", "json_ld")

    # Dealerspike detection
    if any(x in html for x in ["dealerspike.com", "xinventorypageslist", "/inventory/v1/"]):
        return ("dealerspike", "dealerspike", "browser_inventory")

    # EasyDealersite / generic WordPress inventory
    if "easydealersite" in html or "/wp-content/plugins/dealer" in html:
        return ("generic_wordpress", "generic_wordpress", "css_extraction")

    # Generic JS-rendered (fallback — will use crawl4ai CSS extraction)
    return ("generic_css", "generic_css", "css_extraction")

async def process_job(job: dict):
    async with httpx.AsyncClient(timeout=30) as client:
        job_id = job["id"]
        slug = job["dealer_slug"]

        # Mark as running
        await update_job(client, job_id, {
            "status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
        })

        dealer = await fetch_dealer(client, slug)
        if not dealer:
            await update_job(client, job_id, {
                "status": "failed",
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "error_msg": f"Dealer not found: {slug}",
            })
            return

        # Determine target URL: inventory_source_url preferred, else website_url
        target_url = dealer.get("inventory_source_url") or dealer.get("website_url")
        if not target_url:
            await update_job(client, job_id, {
                "status": "failed",
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "error_msg": "No website_url or inventory_source_url on dealer",
            })
            return

        print(f"[detect-source] Processing {slug} → {target_url}")

        try:
            async with AsyncWebCrawler(verbose=False) as crawler:
                result = await crawler.arun(url=target_url)
                html = result.html or ""

            # Step 1: Heuristic platform detection
            adapter_key, platform_type, discovery_strategy = detect_platform(html, target_url)
            print(f"[detect-source] {slug}: detected platform={platform_type}")

            # Step 2: Generate CSS schema (only for css_extraction platforms)
            inventory_schema = None
            if discovery_strategy == "css_extraction" and html:
                try:
                    strategy = JsonCssExtractionStrategy(schema={})
                    inventory_schema = strategy.generate_schema(
                        html=html,
                        query="golf cart listing cards showing brand, model, year, price, condition"
                    )
                    print(f"[detect-source] {slug}: generated CSS schema with {len(inventory_schema.get('fields', []))} fields")
                except Exception as e:
                    print(f"[detect-source] {slug}: generate_schema failed: {e}")

            # Step 3: Update dealer
            dealer_updates = {
                "adapter_key": adapter_key,
                "platform_type": platform_type,
                "discovery_strategy": discovery_strategy,
                "last_discovery_status": "detected",
                "last_discovery_message": f"Platform detected: {platform_type}",
                "last_discovery_at": datetime.now(timezone.utc).isoformat(),
            }
            if inventory_schema:
                dealer_updates["inventory_schema"] = json.dumps(inventory_schema)

            await update_dealer(client, slug, dealer_updates)

            # Step 4: Mark job done
            await update_job(client, job_id, {
                "status": "done",
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "result_json": json.dumps({
                    "adapter_key": adapter_key,
                    "platform_type": platform_type,
                    "discovery_strategy": discovery_strategy,
                    "has_css_schema": inventory_schema is not None,
                }),
            })
            print(f"[detect-source] {slug}: done ✓")

        except Exception as e:
            print(f"[detect-source] {slug}: ERROR: {e}")
            await update_job(client, job_id, {
                "status": "failed",
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "error_msg": str(e),
            })

async def main():
    print("[detect-source] Worker starting — polling for queued jobs...")
    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            job = await fetch_queued_job(client)
            if job:
                await process_job(job)
            else:
                print("[detect-source] No queued jobs. Sleeping 30s...")
                await asyncio.sleep(30)

if __name__ == "__main__":
    asyncio.run(main())
