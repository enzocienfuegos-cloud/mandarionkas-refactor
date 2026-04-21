-- 0017_tag_formats.sql
CREATE TABLE IF NOT EXISTS tag_format_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id          UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE UNIQUE,
  vast_version    TEXT CHECK (vast_version IN ('2.0','3.0','4.0','4.1','4.2')),
  vast_wrapper    BOOLEAN NOT NULL DEFAULT FALSE,
  vast_url        TEXT,
  display_width   INT,
  display_height  INT,
  native_layout   JSONB,
  html_template   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tag_format_configs_tag_idx ON tag_format_configs(tag_id);
