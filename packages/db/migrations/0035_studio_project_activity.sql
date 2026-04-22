CREATE TABLE IF NOT EXISTS studio_project_activity_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id     UUID NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  actor_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS studio_project_activity_workspace_idx
  ON studio_project_activity_events(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS studio_project_activity_project_idx
  ON studio_project_activity_events(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS studio_project_activity_actor_idx
  ON studio_project_activity_events(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS studio_project_activity_action_idx
  ON studio_project_activity_events(action, created_at DESC);
