CREATE TABLE IF NOT EXISTS identity_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canonical_type   TEXT NOT NULL,
  canonical_value  TEXT NOT NULL,
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_country     CHAR(2),
  last_region      TEXT,
  last_city        TEXT,
  confidence       NUMERIC(5,4) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, canonical_type, canonical_value)
);

CREATE INDEX IF NOT EXISTS identity_profiles_workspace_idx
  ON identity_profiles(workspace_id);

CREATE INDEX IF NOT EXISTS identity_profiles_last_seen_idx
  ON identity_profiles(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS identity_profile_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_profile_id UUID NOT NULL REFERENCES identity_profiles(id) ON DELETE CASCADE,
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key_type         TEXT NOT NULL,
  key_value        TEXT NOT NULL,
  source           TEXT,
  is_first_party   BOOLEAN NOT NULL DEFAULT FALSE,
  consent_status   TEXT NOT NULL DEFAULT 'unknown',
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(identity_profile_id, key_type, key_value)
);

CREATE INDEX IF NOT EXISTS identity_profile_keys_lookup_idx
  ON identity_profile_keys(workspace_id, key_type, key_value);

ALTER TABLE event_identity_keys
  ADD COLUMN IF NOT EXISTS identity_profile_id UUID REFERENCES identity_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_identity_keys_profile_idx
  ON event_identity_keys(identity_profile_id);
