create table if not exists video_analytics_events (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  actor_user_id text references users(id) on delete set null,
  project_id text references projects(id) on delete set null,
  scene_id text,
  widget_id text,
  event_name text not null,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists video_analytics_events_workspace_created_idx
  on video_analytics_events(workspace_id, created_at desc);

create index if not exists video_analytics_events_project_created_idx
  on video_analytics_events(project_id, created_at desc);

create index if not exists video_analytics_events_widget_created_idx
  on video_analytics_events(widget_id, created_at desc);
