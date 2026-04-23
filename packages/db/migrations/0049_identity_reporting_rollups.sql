CREATE TABLE IF NOT EXISTS identity_profile_daily_stats (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_profile_id  UUID NOT NULL REFERENCES identity_profiles(id) ON DELETE CASCADE,
  workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date                 DATE NOT NULL,
  impressions          BIGINT NOT NULL DEFAULT 0,
  clicks               BIGINT NOT NULL DEFAULT 0,
  engagements          BIGINT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(identity_profile_id, date)
);

CREATE INDEX IF NOT EXISTS identity_profile_daily_stats_workspace_idx
  ON identity_profile_daily_stats(workspace_id, date DESC);

CREATE INDEX IF NOT EXISTS identity_profile_daily_stats_profile_idx
  ON identity_profile_daily_stats(identity_profile_id, date DESC);
