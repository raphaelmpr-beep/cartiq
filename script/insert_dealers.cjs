// insert_dealers.cjs — inserts all registry dealers via Supabase REST API
// Runs as CommonJS (.cjs) to avoid ES module issues

const https = require('https');

const SUPABASE_URL = 'https://aagwrcdvhuuzwrglamrt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AMYcEYmVFC7zSGT_c1GTaw_IlWrtbyU';

async function supabaseRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation,resolution=merge-duplicates' : 'return=representation',
      },
    };
    if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// All registry dealers — using existing columns only
// fetch_strategy, browser_required, etc. stored in notes as JSON until DDL migration runs
const dealers = [
  // === TIER 1 FL — Botero locations ===
  { name: 'Botero Carts — Clearwater', slug: 'botero-carts-clearwater', website_url: 'https://boterocarts.com', city: 'Clearwater', state: 'FL', notes: JSON.stringify({tier:'tier1',group:'botero',platform:'custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://boterocarts.com/inventory/',inventory_status:'active'}) },
  { name: 'Botero Carts — Jacksonville', slug: 'botero-carts-jacksonville', website_url: 'https://boterocarts.com/location/jacksonville-fl/', city: 'Jacksonville', state: 'FL', notes: JSON.stringify({tier:'tier1',group:'botero',platform:'custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://boterocarts.com/inventory/',inventory_status:'active'}) },
  { name: 'Botero Carts — Melbourne', slug: 'botero-carts-melbourne', website_url: 'https://boterocarts.com/location/melbourne-fl/', city: 'Melbourne', state: 'FL', notes: JSON.stringify({tier:'tier1',group:'botero',platform:'custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://boterocarts.com/inventory/',inventory_status:'active'}) },
  { name: 'Botero Carts — Ocala', slug: 'botero-carts-ocala', website_url: 'https://boterocarts.com/location/ocala-fl/', city: 'Ocala', state: 'FL', notes: JSON.stringify({tier:'tier1',group:'botero',platform:'custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://boterocarts.com/inventory/',inventory_status:'active'}) },
  { name: 'Botero Carts — Pensacola', slug: 'botero-carts-pensacola', website_url: 'https://boterocarts.com/location/pensacola-fl/', city: 'Pensacola', state: 'FL', notes: JSON.stringify({tier:'tier1',group:'botero',platform:'custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://boterocarts.com/inventory/',inventory_status:'active'}) },
  // === TIER 1 FL — Discovery ===
  { name: 'Discovery Golf Cars — Clearwater', slug: 'discovery-golf-cars-clearwater', website_url: 'https://discoverygolfcars.com', city: 'Clearwater', state: 'FL', notes: JSON.stringify({tier:'tier1',group:'discovery',platform:'custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://discoverygolfcars.com/inventory/',inventory_status:'active'}) },
  { name: 'Discovery Golf Cars — Land O Lakes', slug: 'discovery-golf-cars-land-o-lakes', website_url: 'https://discoverygolfcars.com/land-o-lakes/', city: 'Land O Lakes', state: 'FL', notes: JSON.stringify({tier:'tier1',group:'discovery',platform:'custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://discoverygolfcars.com/inventory/',inventory_status:'active'}) },
  // === TIER 1 FL — Coastal ===
  { name: 'Coastal Golf Carts — Port Orange', slug: 'coastal-golf-carts-port-orange', website_url: 'https://coastalgolfcarts.com', city: 'Port Orange', state: 'FL', notes: JSON.stringify({tier:'tier1',platform:'wix_custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://coastalgolfcarts.com/inventory/',inventory_status:'pending'}) },
  // === TIER 1 FL — DealerSpike ===
  { name: 'Advantage Golf Cars — FL', slug: 'advantage-golf-cars-fl', website_url: 'https://www.advantagegolfcars.com', city: 'FL', state: 'FL', notes: JSON.stringify({tier:'tier1',group:'advantage',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_source_url:'https://www.advantagegolfcars.com/inventory/',inventory_status:'pending'}) },
  { name: 'Golf Carts of St. Augustine', slug: 'golf-carts-st-augustine', website_url: 'https://www.golfcartsofstaugustine.com', city: 'St. Augustine', state: 'FL', notes: JSON.stringify({tier:'tier1',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_source_url:'https://www.golfcartsofstaugustine.com/inventory/',inventory_status:'pending'}) },
  { name: 'Revel Golf Cars — Jacksonville', slug: 'revel-golf-cars-jacksonville', website_url: 'https://www.revelgolfcars.com', city: 'Jacksonville', state: 'FL', notes: JSON.stringify({tier:'tier1',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_source_url:'https://www.revelgolfcars.com/inventory/',inventory_status:'pending'}) },
  { name: 'Golf Carts of Vero Beach', slug: 'golf-carts-vero-beach', website_url: 'https://www.golfcartsofverobeach.com', city: 'Vero Beach', state: 'FL', notes: JSON.stringify({tier:'tier1',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_source_url:'https://www.golfcartsofverobeach.com/inventory/',inventory_status:'pending'}) },
  { name: 'Orlando Golf Cars', slug: 'orlando-golf-cars', website_url: 'https://www.orlandogolfcars.com', city: 'Orlando', state: 'FL', notes: JSON.stringify({tier:'tier1',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_source_url:'https://www.orlandogolfcars.com/inventory/',inventory_status:'pending'}) },
  { name: 'The Golf Cart Company — Clermont', slug: 'the-golf-cart-company-clermont', website_url: 'https://www.thegolfcartcompany.com', city: 'Clermont', state: 'FL', notes: JSON.stringify({tier:'tier1',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_source_url:'https://www.thegolfcartcompany.com/inventory/',inventory_status:'pending'}) },
  // === TIER 2 FL ===
  { name: 'Affordable Carts — Bonita Springs', slug: 'affordable-carts-bonita-springs', website_url: 'https://www.affordablecarts.com', city: 'Bonita Springs', state: 'FL', notes: JSON.stringify({tier:'tier2',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_source_url:'https://www.affordablecarts.com/inventory/',inventory_status:'pending'}) },
  { name: 'Golf Cart Megastore — Sarasota', slug: 'golf-cart-megastore-sarasota', website_url: 'https://golfcartmegastore.com', city: 'Sarasota', state: 'FL', notes: JSON.stringify({tier:'tier2',group:'golf-cart-megastore',platform:'custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://golfcartmegastore.com/inventory/',inventory_status:'pending',note:'Custom Carts brand. Authorized Club Car, Yamaha, Star EV.'}) },
  { name: 'Golf Cart Megastore — Sun City Carts', slug: 'golf-cart-megastore-sun-city', website_url: 'https://suncitycarts.com', city: 'Sun City Center', state: 'FL', notes: JSON.stringify({tier:'tier2',group:'golf-cart-megastore',platform:'custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://suncitycarts.com/inventory/',inventory_status:'pending'}) },
  { name: 'Golf Cart Megastore — Capital Carts', slug: 'golf-cart-megastore-capital-carts', website_url: 'https://capitalcarts.com', city: 'St. Petersburg', state: 'FL', notes: JSON.stringify({tier:'tier2',group:'golf-cart-megastore',platform:'custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://capitalcarts.com/inventory/',inventory_status:'pending'}) },
  { name: 'Wholesale Golf Carts — Summerfield', slug: 'wholesale-golf-carts-summerfield', website_url: 'https://wholesalegolfcarts.com', city: 'Summerfield', state: 'FL', notes: JSON.stringify({tier:'tier2',platform:'custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://wholesalegolfcarts.com/inventory/',inventory_status:'pending',note:'Serves The Villages market.'}) },
  { name: 'Golf Cart Center — Rockledge', slug: 'golf-cart-center-rockledge', website_url: 'https://golfcartcenter.com', city: 'Rockledge', state: 'FL', notes: JSON.stringify({tier:'tier2',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_status:'pending'}) },
  { name: 'Total Golf Cart — Vero Beach', slug: 'total-golf-cart-vero-beach', website_url: 'https://totalgolfcart.com', city: 'Vero Beach', state: 'FL', notes: JSON.stringify({tier:'tier2',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_status:'pending'}) },
  { name: 'Love ESports — Homosassa', slug: 'love-esports-homosassa', website_url: 'https://loveesports.com', city: 'Homosassa', state: 'FL', notes: JSON.stringify({tier:'tier2',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_status:'pending'}) },
  { name: 'Paradise Powersports — New Smyrna Beach', slug: 'paradise-powersports-nsb', website_url: 'https://paradisepowersports.com', city: 'New Smyrna Beach', state: 'FL', notes: JSON.stringify({tier:'tier2',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_status:'pending'}) },
  { name: 'Golf Carts Unlimited — Melbourne', slug: 'golf-carts-unlimited-melbourne', website_url: 'https://golfcartsunlimited.com', city: 'Melbourne', state: 'FL', notes: JSON.stringify({tier:'tier2',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_status:'pending'}) },
  { name: 'G Five Motorsports — Plant City', slug: 'g-five-motorsports-plant-city', website_url: 'https://gfivemotorsports.com', city: 'Plant City', state: 'FL', notes: JSON.stringify({tier:'tier2',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_status:'pending'}) },
  { name: 'North Florida Golf Carts — Lake City', slug: 'north-florida-golf-carts-lake-city', website_url: 'https://northfloridagolfcarts.com', city: 'Lake City', state: 'FL', notes: JSON.stringify({tier:'tier2',platform:'custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://northfloridagolfcarts.com/inventory/',inventory_status:'pending'}) },
  { name: 'Gator Golf Cars — Naples', slug: 'gator-golf-cars-naples', website_url: 'https://gatorgolfcars.com', city: 'Naples', state: 'FL', notes: JSON.stringify({tier:'tier2',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_status:'pending'}) },
  { name: 'South Florida Golf Carts', slug: 'south-florida-golf-carts', website_url: 'https://southfloridagolfcarts.com', city: 'FL', state: 'FL', notes: JSON.stringify({tier:'tier2',platform:'unknown',fetch_strategy:'fetch_url_first',inventory_status:'discovery_needed'}) },
  { name: 'Sunshine Golf Car', slug: 'sunshine-golf-car', website_url: 'https://sunshinegolfcar.com', city: 'FL', state: 'FL', notes: JSON.stringify({tier:'tier2',platform:'custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://sunshinegolfcar.com/inventory/',inventory_status:'pending'}) },
  { name: 'Hidden Creek Golf Carts — Brooksville', slug: 'hidden-creek-golf-carts-brooksville', website_url: 'https://hiddencreekgolfcarts.com', city: 'Brooksville', state: 'FL', notes: JSON.stringify({tier:'tier2',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_status:'pending'}) },
  { name: 'Budget Golf Carts — Yulee', slug: 'budget-golf-carts-yulee', website_url: 'https://budgetgolfcarts.com', city: 'Yulee', state: 'FL', notes: JSON.stringify({tier:'tier2',platform:'custom',fetch_strategy:'fetch_url_first',browser_required:false,inventory_source_url:'https://budgetgolfcarts.com/inventory/',inventory_status:'pending',note:'Exposes price/specs.'}) },
  // === TIER 3 FL ===
  { name: 'Panama City Golf Carts', slug: 'panama-city-golf-carts', website_url: 'https://panamacitygolfcarts.com', city: 'Panama City', state: 'FL', notes: JSON.stringify({tier:'tier3',platform:'unknown',fetch_strategy:'fetch_url_first',inventory_status:'discovery_needed'}) },
  { name: 'Electric Cart Company — Santa Rosa Beach', slug: 'electric-cart-company-santa-rosa', website_url: 'https://www.electriccartcompany.com', city: 'Santa Rosa Beach', state: 'FL', notes: JSON.stringify({tier:'tier3',platform:'dealerspike',fetch_strategy:'browser_required',browser_required:true,inventory_status:'pending'}) },
  { name: 'Electric Cart Watersound — Inlet Beach', slug: 'electric-cart-watersound-inlet-beach', website_url: 'https://electriccartwatersound.com', city: 'Inlet Beach', state: 'FL', notes: JSON.stringify({tier:'tier3',platform:'unknown',fetch_strategy:'fetch_url_first',inventory_status:'discovery_needed'}) },
  { name: 'Hole In One Golf Carts — Naples', slug: 'hole-in-one-golf-carts-naples', website_url: 'https://holeinonegolfcarts.com', city: 'Naples', state: 'FL', notes: JSON.stringify({tier:'tier3',platform:'unknown',fetch_strategy:'fetch_url_first',inventory_status:'discovery_needed'}) },
];

async function main() {
  // Get existing slugs
  const existingRes = await supabaseRequest('GET', '/rest/v1/dealers?select=slug&limit=200', null);
  const existingSlugs = new Set(existingRes.data.map(d => d.slug));
  console.log(`Existing dealers in DB: ${existingSlugs.size}`);

  let inserted = 0, skipped = 0, errors = 0;

  for (const dealer of dealers) {
    if (existingSlugs.has(dealer.slug)) {
      // Update the notes field with sync metadata
      const res = await supabaseRequest('PATCH', `/rest/v1/dealers?slug=eq.${encodeURIComponent(dealer.slug)}`, {
        notes: dealer.notes,
        website_url: dealer.website_url,
      });
      if (res.status >= 200 && res.status < 300) {
        console.log(`  ~ UPDATE notes: ${dealer.slug}`);
        skipped++;
      } else {
        console.error(`  ✗ UPDATE failed ${dealer.slug}: ${JSON.stringify(res.data)}`);
        errors++;
      }
    } else {
      const res = await supabaseRequest('POST', '/rest/v1/dealers', {
        name: dealer.name,
        slug: dealer.slug,
        website_url: dealer.website_url,
        city: dealer.city,
        state: dealer.state,
        notes: dealer.notes,
      });
      if (res.status >= 200 && res.status < 300) {
        const id = Array.isArray(res.data) ? res.data[0]?.id : '?';
        console.log(`  + INSERT id=${id}: ${dealer.slug}`);
        inserted++;
      } else {
        console.error(`  ✗ INSERT failed ${dealer.slug}: ${JSON.stringify(res.data)}`);
        errors++;
      }
    }
  }

  // Final count
  const countRes = await supabaseRequest('GET', '/rest/v1/dealers?select=id&limit=1', null);
  const totalRes = await supabaseRequest('GET', '/rest/v1/dealers?select=count', null);

  console.log(`\n=== DONE ===`);
  console.log(`New inserts: ${inserted}`);
  console.log(`Updated (sync metadata): ${skipped}`);
  console.log(`Errors: ${errors}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
