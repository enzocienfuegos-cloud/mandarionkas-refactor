-- 0027_search_indexes.sql
-- Full-text search tsvector columns for ad_tags
ALTER TABLE ad_tags ADD COLUMN IF NOT EXISTS search_vec TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(format, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS ad_tags_search_idx ON ad_tags USING GIN(search_vec);

-- Full-text search tsvector columns for campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS search_vec TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(notes, '') || ' ' ||
      coalesce(status, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS campaigns_search_idx ON campaigns USING GIN(search_vec);

-- Full-text search tsvector columns for advertisers
ALTER TABLE advertisers ADD COLUMN IF NOT EXISTS search_vec TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(domain, '') || ' ' ||
      coalesce(industry, '') || ' ' ||
      coalesce(notes, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS advertisers_search_idx ON advertisers USING GIN(search_vec);

-- Full-text search tsvector columns for creatives
ALTER TABLE creatives ADD COLUMN IF NOT EXISTS search_vec TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(type, '') || ' ' ||
      coalesce(approval_status, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS creatives_search_idx ON creatives USING GIN(search_vec);
