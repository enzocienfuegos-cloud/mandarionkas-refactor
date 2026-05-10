CREATE INDEX IF NOT EXISTS impression_events_stitch_ip_idx
  ON impression_events (workspace_id, ip_fingerprint, timestamp)
  WHERE ip_fingerprint IS NOT NULL
    AND device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS impression_events_stitch_soft_idx
  ON impression_events (workspace_id, soft_fingerprint, timestamp)
  WHERE soft_fingerprint IS NOT NULL
    AND device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS identity_edges_workspace_alias_updated_idx
  ON identity_edges (workspace_id, aliased_id, updated_at DESC);
