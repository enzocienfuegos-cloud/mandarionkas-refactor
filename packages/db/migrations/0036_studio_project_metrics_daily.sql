CREATE TABLE IF NOT EXISTS studio_project_metrics_daily (
  metric_date           DATE NOT NULL,
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id            UUID NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  actor_user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opens_count           INTEGER NOT NULL DEFAULT 0,
  saves_count           INTEGER NOT NULL DEFAULT 0,
  version_saves_count   INTEGER NOT NULL DEFAULT 0,
  duplicate_count       INTEGER NOT NULL DEFAULT 0,
  archive_count         INTEGER NOT NULL DEFAULT 0,
  restore_count         INTEGER NOT NULL DEFAULT 0,
  delete_count          INTEGER NOT NULL DEFAULT 0,
  owner_change_count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (metric_date, workspace_id, project_id, actor_user_id)
);

CREATE INDEX IF NOT EXISTS studio_project_metrics_daily_workspace_idx
  ON studio_project_metrics_daily(workspace_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS studio_project_metrics_daily_actor_idx
  ON studio_project_metrics_daily(actor_user_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS studio_project_metrics_daily_project_idx
  ON studio_project_metrics_daily(project_id, metric_date DESC);
