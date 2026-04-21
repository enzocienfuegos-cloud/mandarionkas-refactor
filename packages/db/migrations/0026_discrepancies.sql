-- 0026_discrepancies.sql
CREATE TABLE IF NOT EXISTS discrepancy_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tag_id        UUID NOT NULL REFERENCES ad_tags(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  source        TEXT NOT NULL,
  served_imps   BIGINT NOT NULL DEFAULT 0,
  reported_imps BIGINT NOT NULL DEFAULT 0,
  delta_abs     BIGINT GENERATED ALWAYS AS (served_imps - reported_imps) STORED,
  delta_pct     NUMERIC(8,2) GENERATED ALWAYS AS (
    CASE
      WHEN served_imps = 0 THEN NULL
      ELSE ABS(served_imps - reported_imps)::NUMERIC / served_imps * 100
    END
  ) STORED,
  severity      TEXT CHECK (severity IN ('ok','warning','critical')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, tag_id, date, source)
);

CREATE TABLE IF NOT EXISTS discrepancy_thresholds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  warning_pct   NUMERIC(8,2) NOT NULL DEFAULT 10,
  critical_pct  NUMERIC(8,2) NOT NULL DEFAULT 20,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS discrepancy_reports_workspace_idx ON discrepancy_reports(workspace_id);
CREATE INDEX IF NOT EXISTS discrepancy_reports_tag_idx ON discrepancy_reports(tag_id);
CREATE INDEX IF NOT EXISTS discrepancy_reports_date_idx ON discrepancy_reports(workspace_id, date DESC);
CREATE INDEX IF NOT EXISTS discrepancy_reports_severity_idx ON discrepancy_reports(workspace_id, severity);
