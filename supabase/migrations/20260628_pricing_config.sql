-- CartIQ Pricing Config Table
-- Stores admin-tweakable overrides for the pricing engine.
-- Each row is a named config section (thresholds, brand_bases, year_multipliers, etc.)
-- The pricing engine reads these at runtime and merges over its compiled defaults.

CREATE TABLE IF NOT EXISTS public.pricing_config (
  key         TEXT PRIMARY KEY,       -- e.g. 'thresholds', 'brand_bases', 'geo_tiers'
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT
);

-- Seed with CartIQ defaults so the table is readable on day 1
INSERT INTO public.pricing_config (key, value) VALUES
  ('thresholds', '{
    "great_deal": -0.15,
    "good_deal":  -0.05,
    "fair_price":  0.05,
    "high_price":  0.15
  }'),
  ('geo_tiers', '{
    "tier1_multiplier": 1.12,
    "tier2_multiplier": 1.00,
    "tier3_multiplier": 0.88,
    "tier1_cities": ["the villages","lady lake","wildwood","leesburg","nocatee","ponte vedra","ponte vedra beach","lakewood ranch","bradenton","sarasota","naples","bonita springs","marco island","miami","miami beach","coral gables","tampa","saint petersburg","palm beach","west palm beach","boca raton"],
    "tier3_cities": ["ocala","palatka","arcadia","sebring","avon park","lake city","crestview","defuniak springs","perry","chiefland","bronson","bushnell","inverness","crystal river","brooksville","starke","macclenny","green cove springs","douglas","tifton","valdosta","waycross","augusta","macon","covington"]
  }'),
  ('feature_adjustments', '{
    "lithium_bonus":     1200,
    "electric_bonus":     400,
    "seating_6plus":     1500,
    "seating_2":         -500,
    "lifted_bonus":       600,
    "charger_bonus":      200,
    "warranty_bonus":     300,
    "dealer_new_premium": 1.03
  }'),
  ('depreciation', '{
    "2027": 1.05,
    "2026": 1.00,
    "2025": 0.90,
    "2024": 0.82,
    "2023": 0.75,
    "2022": 0.68,
    "2021": 0.62,
    "2020": 0.56,
    "2019": 0.50,
    "2018": 0.44,
    "pre_2018": 0.38,
    "unknown": 0.70
  }'),
  ('brand_bases', '{
    "Star EV":      26000,
    "Yamaha":       20500,
    "Atlas":        16500,
    "Epic":         16000,
    "Venom EV":     17000,
    "E-Z-GO":       14500,
    "Club Car":     14000,
    "Sivo":         15000,
    "Madjax":       14500,
    "DACH":         14500,
    "Bintelli":     14000,
    "ICON":         13400,
    "Cushman":      12600,
    "Advanced EV":  11000,
    "Evolution":    11000,
    "Teko":         11500,
    "Denago":       11000,
    "Verdi":        10000,
    "Honor":        10000,
    "GEM":          10000,
    "Bad Boy":       9500,
    "__budget__":    7500,
    "__unknown__":   8000
  }'),
  ('buyer_score_weights', '{
    "great_deal":  50,
    "good_deal":   40,
    "fair_price":  30,
    "high_price":  15,
    "over_market":  5,
    "unknown":     22
  }')
ON CONFLICT (key) DO NOTHING;

-- RLS: admin-only (anon key can read, but only service role can write)
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_pricing_config"
  ON public.pricing_config FOR SELECT
  USING (true);

CREATE POLICY "service_write_pricing_config"
  ON public.pricing_config FOR ALL
  USING (true)
  WITH CHECK (true);
