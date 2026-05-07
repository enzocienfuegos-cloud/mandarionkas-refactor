create table if not exists user_preferences (
  user_id text not null references users(id) on delete cascade,
  key text not null,
  value_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists user_preferences_updated_at_idx
  on user_preferences(updated_at desc);

create table if not exists saved_views (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  surface text not null,
  name text not null,
  filters_json jsonb not null default '{}'::jsonb,
  sort_json jsonb,
  columns_json jsonb,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_views_workspace_surface_idx
  on saved_views(workspace_id, surface, is_shared, updated_at desc);

create index if not exists saved_views_user_surface_idx
  on saved_views(user_id, surface, updated_at desc);
