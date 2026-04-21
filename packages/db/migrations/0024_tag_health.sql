-- 0024_tag_health.sql
CREATE TABLE IF NOT EXISTS tag_health_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id               UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status               TEXT NOT NULL CHECK (status IN ('healthy','warning','critical','unknown')),
  last_impression_at   TIMESTAMPTZ,
  impression_count_24h BIGINT NOT NULL DEFAULT 0,
  error_rate           NUMERIC(5,4) NOT NULL DEFAULT 0,
  details              JSONB NOT NULL DEFAULT '{}',
  checked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tag_health_logs_tag_idx ON tag_health_logs(tag_id);
CREATE INDEX IF NOT EXISTS tag_health_logs_workspace_idx ON tag_health_logs(workspace_id);
CREATE INDEX IF NOT EXISTS tag_health_logs_checked_at_idx ON tag_health_logs(tag_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS tag_health_logs_status_idx ON tag_health_logs(workspace_id, status);
