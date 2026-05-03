-- Migration 0033: identity resolution graph

CREATE TABLE IF NOT EXISTS identity_edges (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canonical_id TEXT NOT NULL,
  aliased_id TEXT NOT NULL,
  alias_type TEXT NOT NULL CHECK (alias_type IN ('same_ifa', 'same_ip_fingerprint', 'same_soft_fingerprint', 'manual')),
  confidence NUMERIC(4,3) NOT NULL DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, canonical_id, aliased_id)
);

CREATE INDEX IF NOT EXISTS identity_edges_alias_lookup_idx
  ON identity_edges (workspace_id, aliased_id);

CREATE INDEX IF NOT EXISTS identity_edges_canonical_idx
  ON identity_edges (workspace_id, canonical_id);
