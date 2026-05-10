alter table sessions
  add column if not exists active_workspace_id text references workspaces(id) on delete set null;

create index if not exists sessions_active_workspace_id_idx on sessions(active_workspace_id);
