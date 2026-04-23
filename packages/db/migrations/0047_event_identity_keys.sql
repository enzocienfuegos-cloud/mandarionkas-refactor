CREATE TABLE IF NOT EXISTS event_identity_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL CHECK (event_type IN ('impression', 'click', 'engagement')),
  event_id         UUID NOT NULL,
  key_type         TEXT NOT NULL,
  key_value        TEXT NOT NULL,
  source           TEXT,
  is_first_party   BOOLEAN NOT NULL DEFAULT FALSE,
  consent_status   TEXT NOT NULL DEFAULT 'unknown',
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_type, event_id, key_type, key_value)
);

CREATE INDEX IF NOT EXISTS event_identity_keys_workspace_idx
  ON event_identity_keys(workspace_id);

CREATE INDEX IF NOT EXISTS event_identity_keys_event_idx
  ON event_identity_keys(event_type, event_id);

CREATE INDEX IF NOT EXISTS event_identity_keys_lookup_idx
  ON event_identity_keys(workspace_id, key_type, key_value);
