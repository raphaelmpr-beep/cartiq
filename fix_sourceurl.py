#!/usr/bin/env python3
"""
Add sourceUrl to dealer listings in seed.ts based on dealer name → website mapping.
Each replacement targets the exact sellerName pattern.
"""
import re

with open('/home/user/workspace/cartiq/server/seed.ts', 'r') as f:
    content = f.read()

# Mapping: sellerName substring → website URL
dealer_websites = {
    'Botero Carts Jacksonville':        'https://boterocarts.com',
    'Botero Carts Ocala':               'https://boterocarts.com',
    'Botero Carts Clearwater':          'https://boterocarts.com',
    'Botero Carts Pensacola':           'https://boterocarts.com',
    'Botero Carts Peachtree City':      'https://boterocarts.com',
    'Discovery Golf Cars Clearwater':   'https://www.discoverygolfcarsclearwater.com',
    "Discovery Golf Cars Land O'Lakes": 'https://www.discoverygolfcars.com',
    'Discovery Golf Cars Hudson':       'https://www.hudsondiscoverygolfcars.com',
    'Coastal Golf Carts Port Orange':   'https://www.coastalgolfcartsfl.com',
    'Coastal Carts Fort Myers':         'https://coastalcartsfl.com',
    'Jenkins Motorsports':              'https://www.jenkinsmotorsports.com',
}

count = 0
for seller_name, website_url in dealer_websites.items():
    # Find lines with this sellerName and no sourceUrl, add sourceUrl right after sellerEmail
    # Pattern: sellerEmail: "...", description: -> insert sourceUrl between email and description
    pattern = rf'(sellerName: "{re.escape(seller_name)}"[^}}]+?sellerEmail: "[^"]*")(\s*,\s*description:)'
    replacement = rf'\1, sourceUrl: "{website_url}"\2'
    new_content, n = re.subn(pattern, replacement, content, flags=re.DOTALL)
    if n > 0:
        content = new_content
        count += n
        print(f'  {n} listings updated for "{seller_name}" → {website_url}')
    else:
        print(f'  WARNING: No match for "{seller_name}"')

print(f'\nTotal listings updated: {count}')

with open('/home/user/workspace/cartiq/server/seed.ts', 'w') as f:
    f.write(content)

print('Done.')
