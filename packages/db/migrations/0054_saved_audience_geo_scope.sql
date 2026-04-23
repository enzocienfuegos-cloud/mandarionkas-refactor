ALTER TABLE saved_audiences
  ADD COLUMN IF NOT EXISTS site_domain TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT;

CREATE INDEX IF NOT EXISTS saved_audiences_site_domain_idx ON saved_audiences(site_domain);
CREATE INDEX IF NOT EXISTS saved_audiences_region_idx ON saved_audiences(region);
CREATE INDEX IF NOT EXISTS saved_audiences_city_idx ON saved_audiences(city);
