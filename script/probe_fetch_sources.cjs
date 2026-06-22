// probe_fetch_sources.cjs
// Probes all fetch_url_first dealers to:
//   1. Confirm the site is reachable
//   2. Find the inventory URL (try known patterns)
//   3. Check if inventory data is visible in static HTML (not JS-rendered)
//   4. Extract sample listings if possible

const https = require('https');
const http = require('http');

const SUPABASE_URL = 'https://aagwrcdvhuuzwrglamrt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AMYcEYmVFC7zSGT_c1GTaw_IlWrtbyU';

// fetch_url_first dealers with their candidate inventory URLs
const PROBE_TARGETS = [
  // Tier 1
  { slug: 'discovery-golf-cars-clearwater',  name: 'Discovery Golf Cars — Clearwater',  urls: ['https://discoverygolfcars.com/inventory/', 'https://discoverygolfcars.com/used-golf-carts/', 'https://discoverygolfcars.com/golf-carts-for-sale/'] },
  { slug: 'discovery-golf-cars-land-o-lakes', name: 'Discovery Golf Cars — Land O Lakes', urls: ['https://discoverygolfcars.com/land-o-lakes/', 'https://discoverygolfcars.com/inventory/'] },
  { slug: 'coastal-golf-carts-port-orange',  name: 'Coastal Golf Carts — Port Orange',   urls: ['https://coastalgolfcarts.com/inventory/', 'https://coastalgolfcarts.com/for-sale/', 'https://coastalgolfcarts.com/golf-carts-for-sale/'] },
  // Botero FL — all share the main botero inventory
  { slug: 'botero-carts-clearwater',  name: 'Botero — Clearwater',  urls: ['https://boterocarts.com/inventory/', 'https://boterocarts.com/used-golf-carts/', 'https://boterocarts.com/new-golf-carts/'] },
  { slug: 'botero-carts-jacksonville', name: 'Botero — Jacksonville', urls: ['https://boterocarts.com/inventory/'] },
  { slug: 'botero-carts-melbourne',   name: 'Botero — Melbourne',   urls: ['https://boterocarts.com/inventory/'] },
  { slug: 'botero-carts-ocala',       name: 'Botero — Ocala',       urls: ['https://boterocarts.com/inventory/'] },
  { slug: 'botero-carts-pensacola',   name: 'Botero — Pensacola',   urls: ['https://boterocarts.com/inventory/'] },
  // Tier 2 fetch_url_first
  { slug: 'golf-cart-megastore-sarasota',    name: 'Golf Cart Megastore — Sarasota',    urls: ['https://golfcartmegastore.com/inventory/', 'https://golfcartmegastore.com/used-golf-carts/', 'https://golfcartmegastore.com/new-golf-carts/'] },
  { slug: 'golf-cart-megastore-sun-city',    name: 'Golf Cart Megastore — Sun City',    urls: ['https://suncitycarts.com/inventory/', 'https://suncitycarts.com/golf-carts/'] },
  { slug: 'golf-cart-megastore-capital-carts', name: 'Capital Carts — St. Pete',        urls: ['https://capitalcarts.com/inventory/', 'https://capitalcarts.com/golf-carts/'] },
  { slug: 'wholesale-golf-carts-summerfield', name: 'Wholesale Golf Carts',             urls: ['https://wholesalegolfcarts.com/inventory/', 'https://wholesalegolfcarts.com/golf-carts/'] },
  { slug: 'north-florida-golf-carts-lake-city', name: 'North FL Golf Carts',            urls: ['https://northfloridagolfcarts.com/inventory/', 'https://northfloridagolfcarts.com/for-sale/'] },
  { slug: 'sunshine-golf-car',               name: 'Sunshine Golf Car',                 urls: ['https://sunshinegolfcar.com/inventory/', 'https://sunshinegolfcar.com/used-golf-carts/'] },
  { slug: 'budget-golf-carts-yulee',         name: 'Budget Golf Carts — Yulee',         urls: ['https://budgetgolfcarts.com/inventory/', 'https://budgetgolfcarts.com/golf-carts/'] },
  { slug: 'south-florida-golf-carts',        name: 'South FL Golf Carts',               urls: ['https://southfloridagolfcarts.com/', 'https://southfloridagolfcarts.com/inventory/'] },
  // Discovery for Tier 3
  { slug: 'panama-city-golf-carts',          name: 'Panama City Golf Carts',            urls: ['https://panamacitygolfcarts.com/', 'https://panamacitygolfcarts.com/inventory/'] },
  { slug: 'electric-cart-watersound-inlet-beach', name: 'Electric Cart Watersound',     urls: ['https://electriccartwatersound.com/', 'https://electriccartwatersound.com/inventory/'] },
  { slug: 'hole-in-one-golf-carts-naples',   name: 'Hole In One Golf Carts',            urls: ['https://holeinonegolfcarts.com/', 'https://holeinonegolfcarts.com/inventory/'] },
];

function fetchUrl(url, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const timer = setTimeout(() => resolve({ ok: false, status: 0, body: '', error: 'TIMEOUT' }), timeoutMs);
    try {
      const req = lib.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CartIQ/1.0)',
          'Accept': 'text/html,application/xhtml+xml,*/*',
        },
        timeout: timeoutMs,
      }, (res) => {
        clearTimeout(timer);
        // Follow one redirect
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redir = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
          fetchUrl(redir, timeoutMs).then(resolve);
          return;
        }
        let body = '';
        res.on('data', chunk => { if (body.length < 60000) body += chunk; });
        res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, body, error: null }));
      });
      req.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, status: 0, body: '', error: e.message }); });
    } catch(e) { clearTimeout(timer); resolve({ ok: false, status: 0, body: '', error: e.message }); }
  });
}

function detectInventorySignals(body) {
  const lower = body.toLowerCase();
  const signals = {
    hasPrice: /\$[\d,]+/.test(body),
    hasYear: /\b(20\d{2}|19\d{2})\b/.test(body),
    hasBrand: /(club\s*car|ezgo|e-z-go|yamaha|icon|bintelli|evolution|star\s*ev|madjax|cushman)/i.test(body),
    hasCondition: /(new|used|refurbished|reconditioned)/i.test(body),
    hasCartListing: /(golf\s*cart|golf cart|electric cart)/i.test(body),
    jsRendered: /(window\.__INITIAL_STATE__|__NEXT_DATA__|dealerspike|dx1\.com|gcrentalinventory)/i.test(body),
    hasSitemap: body.includes('sitemap'),
    bodyLength: body.length,
  };
  signals.score = [signals.hasPrice, signals.hasYear, signals.hasBrand, signals.hasCondition].filter(Boolean).length;
  signals.viable = signals.score >= 2 && !signals.jsRendered;
  return signals;
}

async function probeDealer(dealer) {
  console.log(`\nProbing: ${dealer.name}`);
  const results = [];
  const seen = new Set();
  
  for (const url of dealer.urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    
    const r = await fetchUrl(url);
    const signals = r.ok ? detectInventorySignals(r.body) : null;
    
    results.push({
      url,
      status: r.status,
      ok: r.ok,
      error: r.error,
      signals,
    });
    
    if (r.ok && signals) {
      const icon = signals.viable ? '✓' : (signals.jsRendered ? '⚡' : '~');
      console.log(`  ${icon} ${url} [${r.status}] score=${signals.score} jsRender=${signals.jsRendered} len=${signals.bodyLength}`);
      if (signals.viable) break; // found a good one, stop
    } else {
      console.log(`  ✗ ${url} [${r.status || r.error}]`);
    }
  }
  
  // Determine best result
  const viable = results.find(r => r.ok && r.signals?.viable);
  const reachable = results.find(r => r.ok);
  const jsOnly = results.find(r => r.ok && r.signals?.jsRendered);
  
  let probeResult, probeNotes, bestUrl;
  if (viable) {
    probeResult = 'viable_static';
    bestUrl = viable.url;
    probeNotes = `Static HTML has inventory signals. score=${viable.signals.score}. price=${viable.signals.hasPrice} brand=${viable.signals.hasBrand} year=${viable.signals.hasYear}`;
  } else if (jsOnly) {
    probeResult = 'js_rendered';
    bestUrl = jsOnly.url;
    probeNotes = `Site reached but inventory is JS-rendered (DealerSpike/DX1). Needs browser.`;
  } else if (reachable) {
    probeResult = 'reachable_no_inventory';
    bestUrl = reachable.url;
    probeNotes = `Site reachable (${reachable.status}) but no inventory signals found. score=${reachable.signals?.score||0}`;
  } else {
    probeResult = 'unreachable';
    bestUrl = null;
    probeNotes = results.map(r => `${r.url}: ${r.error||r.status}`).join('; ');
  }
  
  console.log(`  → ${probeResult}: ${bestUrl || 'N/A'}`);
  return { slug: dealer.slug, probeResult, bestUrl, probeNotes };
}

async function updateDealerProbe(slug, probeResult, inventoryUrl, probeNotes) {
  // Update notes JSON with probe result (since sync columns don't exist yet)
  // Also set inventory_source_url via notes update
  const patchBody = {
    notes: JSON.stringify({ probe_result: probeResult, inventory_source_url: inventoryUrl, probe_notes: probeNotes, probed_at: new Date().toISOString() }),
  };
  
  return new Promise((resolve) => {
    const payload = JSON.stringify(patchBody);
    const req = https.request({
      hostname: 'aagwrcdvhuuzwrglamrt.supabase.co',
      path: `/rest/v1/dealers?slug=eq.${encodeURIComponent(slug)}`,
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(payload),
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', resolve);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const results = { viable: [], js_rendered: [], unreachable: [], no_inventory: [] };
  
  // Run probes in batches of 5 (parallel)
  const BATCH = 5;
  for (let i = 0; i < PROBE_TARGETS.length; i += BATCH) {
    const batch = PROBE_TARGETS.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(probeDealer));
    
    for (const r of batchResults) {
      // Update DB with probe result
      await updateDealerProbe(r.slug, r.probeResult, r.bestUrl, r.probeNotes);
      
      if (r.probeResult === 'viable_static') results.viable.push(r);
      else if (r.probeResult === 'js_rendered') results.js_rendered.push(r);
      else if (r.probeResult === 'unreachable') results.unreachable.push(r);
      else results.no_inventory.push(r);
    }
  }
  
  console.log('\n\n=== PROBE SUMMARY ===');
  console.log(`\n✓ VIABLE (static HTML inventory — ready to import): ${results.viable.length}`);
  results.viable.forEach(r => console.log(`  ${r.slug}: ${r.bestUrl}`));
  
  console.log(`\n⚡ JS-RENDERED (need browser): ${results.js_rendered.length}`);
  results.js_rendered.forEach(r => console.log(`  ${r.slug}: ${r.bestUrl}`));
  
  console.log(`\n~ NO INVENTORY FOUND: ${results.no_inventory.length}`);
  results.no_inventory.forEach(r => console.log(`  ${r.slug}: ${r.probeNotes}`));
  
  console.log(`\n✗ UNREACHABLE: ${results.unreachable.length}`);
  results.unreachable.forEach(r => console.log(`  ${r.slug}: ${r.probeNotes}`));
  
  // Write results to file for next step
  const fs = require('fs');
  fs.writeFileSync('/home/user/workspace/cartiq/script/probe_results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to script/probe_results.json');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
