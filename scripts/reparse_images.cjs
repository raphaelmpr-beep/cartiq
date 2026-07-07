#!/usr/bin/env node
/**
 * Batch B image re-parse — writes directly to Supabase via PostgREST.
 * Server-side PATCH /api/listings/:id has a bug that silently 404s, so we
 * bypass it. Anon key has UPDATE permission on listings per RLS.
 *
 * Usage:
 *   node scripts/reparse_images.cjs --dealer 79 --dry --limit 5
 *   node scripts/reparse_images.cjs --dealer 79
 *   node scripts/reparse_images.cjs --dealer all
 */
const fs = require('fs');

const args = process.argv.slice(2);
const flag = (k, def=null) => {
  const i = args.indexOf('--' + k);
  if (i < 0) return def;
  const v = args[i+1];
  return (v && !v.startsWith('--')) ? v : true;
};
const DEALER_ARG = flag('dealer');
const DRY = flag('dry', false) === true;
const LIMIT = flag('limit') ? parseInt(flag('limit')) : Infinity;
const CONCURRENCY = parseInt(flag('conc', 4));
const ADMIN = process.env.ADMIN_PASSWORD;
if (!ADMIN) { console.error('Set ADMIN_PASSWORD'); process.exit(1); }
if (!DEALER_ARG) { console.error('Pass --dealer <id|all>'); process.exit(1); }

// Read Supabase creds
function envGet(k) {
  const env = fs.readFileSync('/tmp/.env.tmp','utf8');
  const l = env.split('\n').find(x => x.startsWith(k+'='));
  return l ? l.split('=').slice(1).join('=').replace(/^"|"$/g, '') : null;
}
const SB_URL = envGet('SUPABASE_URL');
const SB_KEY = envGet('SUPABASE_ANON_KEY');
if (!SB_URL || !SB_KEY) { console.error('Missing SUPABASE_URL / ANON_KEY in /tmp/.env.tmp'); process.exit(1); }

const APP = 'https://golfcartiq.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// Filter out chrome images (banners, logos, icons, tracking pixels, thumbnails).
function isChromeImage(url) {
  const u = url.toLowerCase();
  return /(banner|logo|favicon|header|footer|sprite|\bicon|placeholder|blank|spinner|loader|tracking|pixel|facebook\.com\/tr|google-analytics|\/gtm|analytics|beacon)/.test(u)
      || /\/thumbnail\//.test(u)
      || /\.svg(\?|$)/.test(u);
}

// Score an image URL: higher = more likely to be a real product photo.
function imageScore(url, tag) {
  const u = url.toLowerCase();
  let s = 0;
  // Strong positive: URL patterns that scream "product/inventory image"
  if (/\/inventory\//.test(u)) s += 100;
  if (/\/product\//.test(u)) s += 80;
  if (/\/uploads\/\d{4}\/\d{2}\//.test(u)) s += 60; // WP-style year/month
  if (/\/uploads\/(?!.*(?:banner|logo|header|footer|hero))/.test(u)) s += 30;
  if (/cdn\./.test(u)) s += 20;
  // Size hints
  if (/1000x1000|1024x|2048x|-large|-full/.test(u)) s += 15;
  // Class hints from tag
  if (tag && /(wp-image-|wp-block-image|gallery|slick|glc-|listing-|attachment-|size-large|size-full|product-image|primary-image|hero-image|main-image)/i.test(tag)) s += 25;
  // Negatives (soft — hard chrome already filtered above)
  if (/\/themes?\//.test(u)) s -= 40;
  if (/\/assets?\/(?:images?|img)\//.test(u)) s -= 20; // theme assets
  return s;
}

function extractImages(html) {
  const candidates = []; // { url, tag, score, source }

  // og:image / twitter:image — collect but score with just URL heuristics
  const metaRe = /<meta\s+[^>]*(?:property|name)\s*=\s*["'](?:og:image(?::(?:url|secure_url))?|twitter:image)["'][^>]*>/gi;
  let m;
  while ((m = metaRe.exec(html)) !== null) {
    const c = m[0].match(/content\s*=\s*["']([^"']+)["']/i);
    if (c && c[1]) {
      const url = c[1].trim();
      if (!isChromeImage(url)) candidates.push({ url, tag: '', score: imageScore(url, '') - 10, source: 'og' });
    }
  }

  // All <img> tags — no whitelist, filter via chrome-drop + score
  const imgRe = /<img\s+[^>]*>/gi;
  while ((m = imgRe.exec(html)) !== null) {
    const tag = m[0];
    const srcM = tag.match(/(?:data-src|data-lazy-src|data-srcset|srcset|src)\s*=\s*["']([^"']+)["']/i);
    if (!srcM || !srcM[1]) continue;
    let url = srcM[1].split(/\s*,\s*/)[0].split(/\s+/)[0]; // first url from srcset
    if (url.startsWith('//')) url = 'https:' + url;
    if (!url.startsWith('http')) continue;
    if (isChromeImage(url)) continue;
    candidates.push({ url, tag, score: imageScore(url, tag), source: 'img' });
  }

  // <link rel="image_src">
  const linkRe = /<link\s+[^>]*rel\s*=\s*["']image_src["'][^>]*>/gi;
  while ((m = linkRe.exec(html)) !== null) {
    const h = m[0].match(/href\s*=\s*["']([^"']+)["']/i);
    if (h && h[1] && !isChromeImage(h[1])) {
      candidates.push({ url: h[1], tag: '', score: imageScore(h[1], '') + 5, source: 'linkrel' });
    }
  }

  // Sort by score desc, dedupe by URL, cap 10
  candidates.sort((a, b) => b.score - a.score);
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    unique.push(c.url);
    if (unique.length >= 10) break;
  }
  return unique;
}

async function fetchListings() {
  const r = await fetch(`${APP}/api/admin/listings?limit=5000`, { headers: { 'x-admin-token': ADMIN } });
  const d = await r.json();
  let target;
  if (DEALER_ARG === 'all') {
    target = d.filter(l => l.status==='active' && l.publicListing===true && !l.imageUrl && l.askingPrice && l.sourceUrl);
  } else {
    const id = parseInt(DEALER_ARG);
    target = d.filter(l => l.dealerId===id && l.status==='active' && l.publicListing===true && !l.imageUrl && l.sourceUrl);
  }
  return target.slice(0, LIMIT);
}

async function repairOne(l) {
  try {
    const r = await fetch(l.sourceUrl, { headers: { 'user-agent': UA }, redirect: 'follow' });
    if (!r.ok) return { id: l.id, status: 'fetch_fail', code: r.status };
    const html = await r.text();
    const imgs = extractImages(html);
    if (imgs.length === 0) return { id: l.id, status: 'no_images_found' };
    const primary = imgs[0];
    if (DRY) return { id: l.id, status: 'dry', primary: primary.slice(0,100), count: imgs.length };
    // Verify image is real (HEAD)
    try {
      const head = await fetch(primary, { method: 'HEAD' });
      if (!head.ok || !(head.headers.get('content-type')||'').startsWith('image/')) {
        return { id: l.id, status: 'bad_image', code: head.status, ct: head.headers.get('content-type') };
      }
    } catch (e) {
      return { id: l.id, status: 'image_head_error', msg: e.message };
    }
    // Direct PostgREST update
    const patch = await fetch(`${SB_URL}/rest/v1/listings?id=eq.${l.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        image_url: primary,
        image_urls_json: JSON.stringify(imgs),
        updated_at: new Date().toISOString(),
      }),
    });
    if (!patch.ok) {
      const t = await patch.text();
      return { id: l.id, status: 'patch_fail', code: patch.status, body: t.slice(0,150) };
    }
    return { id: l.id, status: 'ok', primary: primary.slice(0,80), count: imgs.length };
  } catch (e) {
    return { id: l.id, status: 'error', msg: e.message };
  }
}

async function runPool(items, worker, concurrency) {
  const results = [];
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i]);
      if ((i+1) % 25 === 0) process.stderr.write(`  ${i+1}/${items.length}\n`);
    }
  });
  await Promise.all(workers);
  return results;
}

(async () => {
  const targets = await fetchListings();
  console.error(`Targets: ${targets.length} (dealer=${DEALER_ARG}, dry=${DRY}, limit=${LIMIT===Infinity?'none':LIMIT}, conc=${CONCURRENCY})`);
  if (targets.length === 0) { console.log('Nothing to do.'); return; }
  const t0 = Date.now();
  const results = await runPool(targets, repairOne, CONCURRENCY);
  const dt = ((Date.now()-t0)/1000).toFixed(1);
  const by = {};
  results.forEach(r => { by[r.status] = (by[r.status]||0)+1; });
  console.error(`\nDone in ${dt}s. Status counts:`);
  Object.entries(by).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.error(`  ${k}: ${v}`));
  console.error(`\nSample results (first 5):`);
  results.slice(0, 5).forEach(r => console.error(`  ${JSON.stringify(r)}`));
  const path = `/tmp/reparse_${DEALER_ARG}_${DRY?'dry':'live'}_${Date.now()}.json`;
  fs.writeFileSync(path, JSON.stringify(results, null, 2));
  console.error(`\nFull report: ${path}`);
})();
