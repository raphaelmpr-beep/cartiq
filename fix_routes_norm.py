#!/usr/bin/env python3
"""Apply norm()/normList() to all outbound res.json() calls in routes.ts"""
import re

with open('/home/user/workspace/cartiq/server/routes.ts', 'r') as f:
    content = f.read()

# Replacements: wrap outbound data with norm()/normList()
replacements = [
    # Listings list
    ('res.json(listings.map(suppressDeliveryIfUnavailable));',
     'res.json(normList(listings.map(suppressDeliveryIfUnavailable)));'),
    # Single listing
    ('res.json(suppressDeliveryIfUnavailable(listing as any));',
     'res.json(norm(suppressDeliveryIfUnavailable(listing as any)));'),
    # Create listing
    ('res.status(201).json(listing);',
     'res.status(201).json(norm(listing as any));'),
    # Update listing
    ('res.json({ ...suppressDeliveryIfUnavailable(listing as any), _alertsFired: alerts.length });',
     'res.json({ ...norm(suppressDeliveryIfUnavailable(listing as any)), _alertsFired: alerts.length });'),
    # Deal check
    ('res.status(201).json({ ...dealCheck, pilotWarning });',
     'res.status(201).json({ ...norm(dealCheck as any), pilotWarning });'),
    # Get deal check
    ('res.json(dc);',
     'res.json(norm(dc as any));'),
    # Watch create
    ('res.status(201).json(watch);',
     'res.status(201).json(norm(watch as any));'),
    # Watches list (enriched already built)
    ('res.json(enriched);\n    } catch (e: any) {\n      res.status(500).json({ error: e.message });\n    }\n  });\n\n  // DELETE /api/watches',
     'res.json(normList(enriched));\n    } catch (e: any) {\n      res.status(500).json({ error: e.message });\n    }\n  });\n\n  // DELETE /api/watches'),
    # Saves list (enriched)
    ('res.json(enriched);\n    } catch (e: any) {\n      res.status(500).json({ error: e.message });\n    }\n  });\n\n  // GET /api/saves/status',
     'res.json(normList(enriched));\n    } catch (e: any) {\n      res.status(500).json({ error: e.message });\n    }\n  });\n\n  // GET /api/saves/status'),
    # CSV import
    ('res.json({ imported: created.length, errors, listings: created });',
     'res.json({ imported: created.length, errors, listings: normList(created as any[]) });'),
    # Dealers list
    ('res.json(await storage.getDealers());',
     'res.json(normList(await storage.getDealers() as any[]));'),
    # Create dealer
    ('res.status(201).json(dealer);',
     'res.status(201).json(norm(dealer as any));'),
    # Update dealer
    ('res.json(dealer);\n    } catch (e: any) {\n      res.status(400).json({ error: e.message });\n    }\n  });\n\n  // ─── Retail Sources',
     'res.json(norm(dealer as any));\n    } catch (e: any) {\n      res.status(400).json({ error: e.message });\n    }\n  });\n\n  // ─── Retail Sources'),
    # Retail sources list
    ('res.json(await storage.getRetailSources());',
     'res.json(normList(await storage.getRetailSources() as any[]));'),
    # Create retail source
    ('res.status(201).json(rs);',
     'res.status(201).json(norm(rs as any));'),
    # Update retail source
    ('res.json(rs);\n    } catch (e: any) {\n      res.status(400).json({ error: e.message });\n    }\n  });\n\n  // ─── Inventory',
     'res.json(norm(rs as any));\n    } catch (e: any) {\n      res.status(400).json({ error: e.message });\n    }\n  });\n\n  // ─── Inventory'),
    # Inventory sources list
    ('res.json(await storage.getInventorySources());',
     'res.json(normList(await storage.getInventorySources() as any[]));'),
    # Create inventory source
    ('res.status(201).json(src);',
     'res.status(201).json(norm(src as any));'),
    # Update inventory source
    ('res.json(src);\n    } catch (e: any) {\n      res.status(400).json({ error: e.message });\n    }\n  });\n\n  // ─── Buyer Guide',
     'res.json(norm(src as any));\n    } catch (e: any) {\n      res.status(400).json({ error: e.message });\n    }\n  });\n\n  // ─── Buyer Guide'),
    # Buyer guide list
    ('res.json(await storage.getSeoArticles());',
     'res.json(normList(await storage.getSeoArticles() as any[]));'),
    # Buyer guide single
    ('res.json(article);',
     'res.json(norm(article as any));'),
    # Admin listings
    ('res.json(await storage.getListings({}));',
     'res.json(normList(await storage.getListings({}) as any[]));'),
]

count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
        print(f'  ✓ {old[:60]}...' if len(old) > 60 else f'  ✓ {old}')
    else:
        print(f'  MISS: {old[:60]}')

print(f'\nTotal replacements: {count}')

with open('/home/user/workspace/cartiq/server/routes.ts', 'w') as f:
    f.write(content)

print('Done.')
