// run_migration.js — applies dealer registry migration to Supabase via direct Postgres connection
const { Pool } = require('pg');

const pool = new Pool({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.aagwrcdvhuuzwrglamrt',
  password: '4mmeXsTzVUIWIVuM',
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
});

async function run() {
  const client = await pool.connect();
  
  try {
    console.log('Connected to Supabase Postgres');
    
    // Step 1: Add columns
    console.log('\n=== Step 1: Adding sync columns to dealers table ===');
    await client.query(`
      ALTER TABLE dealers ADD COLUMN IF NOT EXISTS dealer_group_slug TEXT;
      ALTER TABLE dealers ADD COLUMN IF NOT EXISTS inventory_source_url TEXT;
      ALTER TABLE dealers ADD COLUMN IF NOT EXISTS platform_type TEXT;
      ALTER TABLE dealers ADD COLUMN IF NOT EXISTS fetch_strategy TEXT DEFAULT 'fetch_url_first';
      ALTER TABLE dealers ADD COLUMN IF NOT EXISTS browser_required BOOLEAN DEFAULT false;
      ALTER TABLE dealers ADD COLUMN IF NOT EXISTS inventory_status TEXT DEFAULT 'pending';
      ALTER TABLE dealers ADD COLUMN IF NOT EXISTS source_priority TEXT DEFAULT 'tier2';
      ALTER TABLE dealers ADD COLUMN IF NOT EXISTS last_probed_at TIMESTAMPTZ;
      ALTER TABLE dealers ADD COLUMN IF NOT EXISTS probe_result TEXT;
      ALTER TABLE dealers ADD COLUMN IF NOT EXISTS probe_notes TEXT;
    `);
    console.log('Columns added OK');

    // Step 2: Upsert Tier 1 FL dealers
    console.log('\n=== Step 2: Upserting Tier 1 FL dealers ===');

    // Botero FL locations (Peachtree City and Cumming GA already exist; FL locations are new)
    const tier1Dealers = [
      {
        name: 'Botero Carts — Clearwater',
        slug: 'botero-carts-clearwater',
        dealer_group_slug: 'botero',
        website_url: 'https://boterocarts.com',
        inventory_source_url: 'https://boterocarts.com/inventory/',
        city: 'Clearwater', state: 'FL',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'active', source_priority: 'tier1',
        notes: 'Botero FL Clearwater location. Custom site with structured inventory.'
      },
      {
        name: 'Botero Carts — Jacksonville',
        slug: 'botero-carts-jacksonville',
        dealer_group_slug: 'botero',
        website_url: 'https://boterocarts.com/location/jacksonville-fl/',
        inventory_source_url: 'https://boterocarts.com/inventory/',
        city: 'Jacksonville', state: 'FL',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'active', source_priority: 'tier1',
        notes: 'Botero FL Jacksonville location.'
      },
      {
        name: 'Botero Carts — Melbourne',
        slug: 'botero-carts-melbourne',
        dealer_group_slug: 'botero',
        website_url: 'https://boterocarts.com/location/melbourne-fl/',
        inventory_source_url: 'https://boterocarts.com/inventory/',
        city: 'Melbourne', state: 'FL',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'active', source_priority: 'tier1',
        notes: 'Botero FL Melbourne location.'
      },
      {
        name: 'Botero Carts — Ocala',
        slug: 'botero-carts-ocala',
        dealer_group_slug: 'botero',
        website_url: 'https://boterocarts.com/location/ocala-fl/',
        inventory_source_url: 'https://boterocarts.com/inventory/',
        city: 'Ocala', state: 'FL',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'active', source_priority: 'tier1',
        notes: 'Botero FL Ocala location.'
      },
      {
        name: 'Botero Carts — Pensacola',
        slug: 'botero-carts-pensacola',
        dealer_group_slug: 'botero',
        website_url: 'https://boterocarts.com/location/pensacola-fl/',
        inventory_source_url: 'https://boterocarts.com/inventory/',
        city: 'Pensacola', state: 'FL',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'active', source_priority: 'tier1',
        notes: 'Botero FL Pensacola location.'
      },
      // Update existing GA Botero locations
      {
        name: 'Botero Carts — Peachtree City',
        slug: 'botero-carts-peachtree-city',
        dealer_group_slug: 'botero',
        website_url: 'https://boterocarts.com',
        inventory_source_url: 'https://boterocarts.com/inventory/',
        city: 'Peachtree City', state: 'GA',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'active', source_priority: 'tier1',
        notes: 'Botero GA Peachtree City (main/parent). Already ingested 87 listings.'
      },
      {
        name: 'Botero Carts — Cumming',
        slug: 'botero-carts-cumming',
        dealer_group_slug: 'botero',
        website_url: 'https://boterocarts.com/location/cumming-ga/',
        inventory_source_url: 'https://boterocarts.com/inventory/',
        city: 'Cumming', state: 'GA',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'active', source_priority: 'tier1',
        notes: 'Botero GA Cumming location.'
      },
      // Discovery Golf Cars
      {
        name: 'Discovery Golf Cars — Clearwater',
        slug: 'discovery-golf-cars-clearwater',
        dealer_group_slug: 'discovery',
        website_url: 'https://discoverygolfcars.com',
        inventory_source_url: 'https://discoverygolfcars.com/inventory/',
        city: 'Clearwater', state: 'FL',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'active', source_priority: 'tier1',
        notes: 'Strong structured inventory. fetch_url_first confirmed accessible.'
      },
      {
        name: 'Discovery Golf Cars — Land O Lakes',
        slug: 'discovery-golf-cars-land-o-lakes',
        dealer_group_slug: 'discovery',
        website_url: 'https://discoverygolfcars.com/land-o-lakes/',
        inventory_source_url: 'https://discoverygolfcars.com/inventory/',
        city: 'Land O Lakes', state: 'FL',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'active', source_priority: 'tier1',
        notes: 'Second Discovery location.'
      },
      // Coastal Golf Carts
      {
        name: 'Coastal Golf Carts — Port Orange',
        slug: 'coastal-golf-carts-port-orange',
        dealer_group_slug: null,
        website_url: 'https://coastalgolfcarts.com',
        inventory_source_url: 'https://coastalgolfcarts.com/inventory/',
        city: 'Port Orange', state: 'FL',
        platform_type: 'wix_custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'pending', source_priority: 'tier1',
        notes: 'Wix/custom static. Needs probe to confirm inventory URL.'
      },
      // DealerSpike Tier 1
      {
        name: 'Advantage Golf Cars',
        slug: 'advantage-golf-cars',
        dealer_group_slug: 'advantage',
        website_url: 'https://www.advantagegolfcars.com',
        inventory_source_url: 'https://www.advantagegolfcars.com/inventory/',
        city: 'FL', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier1',
        notes: 'DealerSpike. Multiple FL locations (Miami, West Palm, Orlando, Gainesville, Daytona).'
      },
      {
        name: 'Golf Carts of St. Augustine',
        slug: 'golf-carts-st-augustine',
        dealer_group_slug: null,
        website_url: 'https://www.golfcartsofstaugustine.com',
        inventory_source_url: 'https://www.golfcartsofstaugustine.com/inventory/',
        city: 'St. Augustine', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier1',
        notes: 'DealerSpike platform.'
      },
      {
        name: 'Revel Golf Cars — Jacksonville',
        slug: 'revel-golf-cars-jacksonville',
        dealer_group_slug: null,
        website_url: 'https://www.revelgolfcars.com',
        inventory_source_url: 'https://www.revelgolfcars.com/inventory/',
        city: 'Jacksonville', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier1',
        notes: 'DealerSpike platform.'
      },
      {
        name: 'Golf Carts of Vero Beach',
        slug: 'golf-carts-vero-beach',
        dealer_group_slug: null,
        website_url: 'https://www.golfcartsofverobeach.com',
        inventory_source_url: 'https://www.golfcartsofverobeach.com/inventory/',
        city: 'Vero Beach', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier1',
        notes: 'DealerSpike platform.'
      },
      {
        name: 'Orlando Golf Cars',
        slug: 'orlando-golf-cars',
        dealer_group_slug: null,
        website_url: 'https://www.orlandogolfcars.com',
        inventory_source_url: 'https://www.orlandogolfcars.com/inventory/',
        city: 'Orlando', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier1',
        notes: 'DealerSpike platform.'
      },
      {
        name: 'The Golf Cart Company — Clermont',
        slug: 'the-golf-cart-company-clermont',
        dealer_group_slug: null,
        website_url: 'https://www.thegolfcartcompany.com',
        inventory_source_url: 'https://www.thegolfcartcompany.com/inventory/',
        city: 'Clermont', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier1',
        notes: 'DealerSpike platform.'
      },
    ];

    const tier2Dealers = [
      {
        name: 'Affordable Carts — Bonita Springs',
        slug: 'affordable-carts-bonita-springs',
        dealer_group_slug: null,
        website_url: 'https://www.affordablecarts.com',
        inventory_source_url: 'https://www.affordablecarts.com/inventory/',
        city: 'Bonita Springs', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'DealerSpike platform.'
      },
      {
        name: 'Golf Cart Megastore — Sarasota',
        slug: 'golf-cart-megastore-sarasota',
        dealer_group_slug: 'golf-cart-megastore',
        website_url: 'https://golfcartmegastore.com',
        inventory_source_url: 'https://golfcartmegastore.com/inventory/',
        city: 'Sarasota', state: 'FL',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'Custom Carts brand under Golf Cart Megastore group. Authorized Club Car, Yamaha, Star EV, Evolution.'
      },
      {
        name: 'Golf Cart Megastore — Sun City Carts',
        slug: 'golf-cart-megastore-sun-city',
        dealer_group_slug: 'golf-cart-megastore',
        website_url: 'https://suncitycarts.com',
        inventory_source_url: 'https://suncitycarts.com/inventory/',
        city: 'Sun City Center', state: 'FL',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'Sun City Carts brand under Golf Cart Megastore group.'
      },
      {
        name: 'Golf Cart Megastore — Capital Carts',
        slug: 'golf-cart-megastore-capital-carts',
        dealer_group_slug: 'golf-cart-megastore',
        website_url: 'https://capitalcarts.com',
        inventory_source_url: 'https://capitalcarts.com/inventory/',
        city: 'St. Petersburg', state: 'FL',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'Capital Carts brand under Golf Cart Megastore group.'
      },
      {
        name: 'Wholesale Golf Carts — Summerfield',
        slug: 'wholesale-golf-carts-summerfield',
        dealer_group_slug: null,
        website_url: 'https://wholesalegolfcarts.com',
        inventory_source_url: 'https://wholesalegolfcarts.com/inventory/',
        city: 'Summerfield', state: 'FL',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'Serves The Villages market. fetch_url_first.'
      },
      {
        name: 'Golf Cart Center — Rockledge',
        slug: 'golf-cart-center-rockledge',
        dealer_group_slug: null,
        website_url: 'https://golfcartcenter.com',
        inventory_source_url: 'https://golfcartcenter.com/inventory/',
        city: 'Rockledge', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'DealerSpike platform.'
      },
      {
        name: 'Total Golf Cart — Vero Beach',
        slug: 'total-golf-cart-vero-beach',
        dealer_group_slug: null,
        website_url: 'https://totalgolfcart.com',
        inventory_source_url: 'https://totalgolfcart.com/inventory/',
        city: 'Vero Beach', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'DealerSpike platform.'
      },
      {
        name: 'Love ESports — Homosassa',
        slug: 'love-esports-homosassa',
        dealer_group_slug: null,
        website_url: 'https://loveesports.com',
        inventory_source_url: 'https://loveesports.com/inventory/',
        city: 'Homosassa', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'DealerSpike platform.'
      },
      {
        name: 'Paradise Powersports — New Smyrna Beach',
        slug: 'paradise-powersports-nsb',
        dealer_group_slug: null,
        website_url: 'https://paradisepowersports.com',
        inventory_source_url: 'https://paradisepowersports.com/inventory/',
        city: 'New Smyrna Beach', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'DealerSpike platform.'
      },
      {
        name: 'Golf Carts Unlimited — Melbourne',
        slug: 'golf-carts-unlimited-melbourne',
        dealer_group_slug: null,
        website_url: 'https://golfcartsunlimited.com',
        inventory_source_url: 'https://golfcartsunlimited.com/inventory/',
        city: 'Melbourne', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'DealerSpike platform.'
      },
      {
        name: 'G Five Motorsports — Plant City',
        slug: 'g-five-motorsports-plant-city',
        dealer_group_slug: null,
        website_url: 'https://gfivemotorsports.com',
        inventory_source_url: 'https://gfivemotorsports.com/inventory/',
        city: 'Plant City', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'DealerSpike platform.'
      },
      {
        name: 'North Florida Golf Carts — Lake City',
        slug: 'north-florida-golf-carts-lake-city',
        dealer_group_slug: null,
        website_url: 'https://northfloridagolfcarts.com',
        inventory_source_url: 'https://northfloridagolfcarts.com/inventory/',
        city: 'Lake City', state: 'FL',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'Custom static site. fetch_url_first.'
      },
      {
        name: 'Gator Golf Cars — Naples',
        slug: 'gator-golf-cars-naples',
        dealer_group_slug: null,
        website_url: 'https://gatorgolfcars.com',
        inventory_source_url: 'https://gatorgolfcars.com/inventory/',
        city: 'Naples', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'DealerSpike platform.'
      },
      {
        name: 'South Florida Golf Carts',
        slug: 'south-florida-golf-carts',
        dealer_group_slug: null,
        website_url: 'https://southfloridagolfcarts.com',
        inventory_source_url: null,
        city: 'FL', state: 'FL',
        platform_type: 'unknown', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'discovery_needed', source_priority: 'tier2',
        notes: 'Discovery needed — inventory URL unknown.'
      },
      {
        name: 'Sunshine Golf Car',
        slug: 'sunshine-golf-car',
        dealer_group_slug: null,
        website_url: 'https://sunshinegolfcar.com',
        inventory_source_url: 'https://sunshinegolfcar.com/inventory/',
        city: 'FL', state: 'FL',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'Inventory URL confirmed accessible. fetch_url_first.'
      },
      {
        name: 'Hidden Creek Golf Carts — Brooksville',
        slug: 'hidden-creek-golf-carts-brooksville',
        dealer_group_slug: null,
        website_url: 'https://hiddencreekgolfcarts.com',
        inventory_source_url: 'https://hiddencreekgolfcarts.com/inventory/',
        city: 'Brooksville', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'DealerSpike platform.'
      },
      {
        name: 'Budget Golf Carts — Yulee',
        slug: 'budget-golf-carts-yulee',
        dealer_group_slug: null,
        website_url: 'https://budgetgolfcarts.com',
        inventory_source_url: 'https://budgetgolfcarts.com/inventory/',
        city: 'Yulee', state: 'FL',
        platform_type: 'custom', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'pending', source_priority: 'tier2',
        notes: 'Custom static. Exposes price/specs. fetch_url_first.'
      },
    ];

    const tier3Dealers = [
      {
        name: 'Panama City Golf Carts',
        slug: 'panama-city-golf-carts',
        dealer_group_slug: null,
        website_url: 'https://panamacitygolfcarts.com',
        inventory_source_url: null,
        city: 'Panama City', state: 'FL',
        platform_type: 'unknown', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'discovery_needed', source_priority: 'tier3',
        notes: 'Discovery needed.'
      },
      {
        name: 'Electric Cart Company — Santa Rosa Beach',
        slug: 'electric-cart-company-santa-rosa',
        dealer_group_slug: null,
        website_url: 'https://www.electriccartcompany.com',
        inventory_source_url: 'https://www.electriccartcompany.com/inventory/',
        city: 'Santa Rosa Beach', state: 'FL',
        platform_type: 'dealerspike', fetch_strategy: 'browser_required', browser_required: true,
        inventory_status: 'pending', source_priority: 'tier3',
        notes: 'DealerSpike platform.'
      },
      {
        name: 'Electric Cart Watersound — Inlet Beach',
        slug: 'electric-cart-watersound-inlet-beach',
        dealer_group_slug: null,
        website_url: 'https://electriccartwatersound.com',
        inventory_source_url: null,
        city: 'Inlet Beach', state: 'FL',
        platform_type: 'unknown', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'discovery_needed', source_priority: 'tier3',
        notes: 'Discovery needed.'
      },
      {
        name: 'Hole In One Golf Carts — Naples',
        slug: 'hole-in-one-golf-carts-naples',
        dealer_group_slug: null,
        website_url: 'https://holeinonegolfcarts.com',
        inventory_source_url: null,
        city: 'Naples', state: 'FL',
        platform_type: 'unknown', fetch_strategy: 'fetch_url_first', browser_required: false,
        inventory_status: 'discovery_needed', source_priority: 'tier3',
        notes: 'Discovery needed.'
      },
    ];

    const allDealers = [...tier1Dealers, ...tier2Dealers, ...tier3Dealers];
    let inserted = 0, updated = 0, errors = 0;

    for (const d of allDealers) {
      try {
        const res = await client.query(`
          INSERT INTO dealers (
            name, slug, dealer_group_slug, website_url, inventory_source_url,
            city, state, platform_type, fetch_strategy, browser_required,
            inventory_status, source_priority, notes
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (slug) DO UPDATE SET
            dealer_group_slug = EXCLUDED.dealer_group_slug,
            inventory_source_url = COALESCE(EXCLUDED.inventory_source_url, dealers.inventory_source_url),
            platform_type = EXCLUDED.platform_type,
            fetch_strategy = EXCLUDED.fetch_strategy,
            browser_required = EXCLUDED.browser_required,
            inventory_status = EXCLUDED.inventory_status,
            source_priority = EXCLUDED.source_priority,
            notes = EXCLUDED.notes,
            updated_at = now()
          RETURNING (xmax = 0) AS inserted
        `, [
          d.name, d.slug, d.dealer_group_slug, d.website_url, d.inventory_source_url,
          d.city, d.state, d.platform_type, d.fetch_strategy, d.browser_required,
          d.inventory_status, d.source_priority, d.notes
        ]);
        const wasInserted = res.rows[0]?.inserted;
        if (wasInserted) { inserted++; console.log(`  + INSERT: ${d.slug}`); }
        else { updated++; console.log(`  ~ UPDATE: ${d.slug}`); }
      } catch (err) {
        errors++;
        console.error(`  ✗ ERROR ${d.slug}: ${err.message}`);
      }
    }

    // Update Jenkins records with sync fields
    const jenkinsUpdate = await client.query(`
      UPDATE dealers SET
        dealer_group_slug = 'jenkins',
        platform_type = 'dealerspike',
        fetch_strategy = 'browser_required',
        browser_required = true,
        source_priority = 'tier2',
        inventory_status = 'active',
        updated_at = now()
      WHERE slug LIKE 'jenkins-motorsports-%'
      RETURNING slug
    `);
    console.log(`\nUpdated ${jenkinsUpdate.rowCount} Jenkins records with sync fields`);

    // Update Jeffrey Allen records
    const jeffreyUpdate = await client.query(`
      UPDATE dealers SET
        dealer_group_slug = 'jeffrey-allen',
        platform_type = 'custom',
        fetch_strategy = 'fetch_url_first',
        browser_required = false,
        source_priority = 'tier2',
        inventory_status = 'pending',
        updated_at = now()
      WHERE slug LIKE 'jeffrey-allen-%'
      RETURNING slug
    `);
    console.log(`Updated ${jeffreyUpdate.rowCount} Jeffrey Allen records with sync fields`);

    // Summary
    const countRes = await client.query('SELECT count(*) FROM dealers');
    const tier1Count = await client.query("SELECT count(*) FROM dealers WHERE source_priority = 'tier1'");
    const tier2Count = await client.query("SELECT count(*) FROM dealers WHERE source_priority = 'tier2'");
    const tier3Count = await client.query("SELECT count(*) FROM dealers WHERE source_priority = 'tier3'");
    const browserCount = await client.query("SELECT count(*) FROM dealers WHERE browser_required = true");
    const fetchCount = await client.query("SELECT count(*) FROM dealers WHERE browser_required = false AND platform_type IS NOT NULL");

    console.log('\n=== MIGRATION COMPLETE ===');
    console.log(`Total dealers in DB: ${countRes.rows[0].count}`);
    console.log(`New inserts: ${inserted}`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors}`);
    console.log(`\nBy tier:`);
    console.log(`  Tier 1: ${tier1Count.rows[0].count}`);
    console.log(`  Tier 2: ${tier2Count.rows[0].count}`);
    console.log(`  Tier 3: ${tier3Count.rows[0].count}`);
    console.log(`\nBy fetch strategy:`);
    console.log(`  Browser required: ${browserCount.rows[0].count}`);
    console.log(`  fetch_url_first: ${fetchCount.rows[0].count}`);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
