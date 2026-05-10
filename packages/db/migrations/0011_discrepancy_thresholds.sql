CREATE TABLE IF NOT EXISTS discrepancy_thresholds (
  workspace_id   TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  warning_pct    NUMERIC(8,2) NOT NULL DEFAULT 5,
  critical_pct   NUMERIC(8,2) NOT NULL DEFAULT 15,
  updated_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
