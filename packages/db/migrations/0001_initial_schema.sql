create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  display_name text not null,
  global_role text not null check (global_role in ('admin', 'editor', 'designer', 'ad_ops', 'reviewer')),
  platform_role text not null check (platform_role in ('admin', 'designer', 'ad_ops', 'reviewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ip_address inet,
  user_agent text
);
create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists sessions_expires_at_idx on sessions(expires_at);

create table if not exists workspaces (
  id text primary key,
  slug text not null unique,
  name text not null,
  brand_color text,
  owner_user_id text not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists workspace_members (
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer', 'editor', 'reviewer')),
  added_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_id_idx on workspace_members(user_id);

create table if not exists workspace_invites (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer', 'editor', 'reviewer')),
  status text not null check (status in ('pending', 'accepted', 'revoked')),
  invited_by_user_id text references users(id),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);
create index if not exists workspace_invites_workspace_id_idx on workspace_invites(workspace_id);

create table if not exists brands (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  primary_color text,
  secondary_color text,
  accent_color text,
  logo_url text,
  font_family text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brands_workspace_id_idx on brands(workspace_id);

create table if not exists projects (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  owner_user_id text not null references users(id),
  name text not null,
  brand_id text references brands(id),
  campaign_name text,
  access_scope text not null default 'client' check (access_scope in ('private', 'client', 'reviewers')),
  canvas_preset_id text,
  scene_count integer not null default 0,
  widget_count integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_workspace_id_idx on projects(workspace_id);
create index if not exists projects_owner_user_id_idx on projects(owner_user_id);
create index if not exists projects_updated_at_idx on projects(updated_at desc);

create table if not exists project_documents (
  project_id text primary key references projects(id) on delete cascade,
  revision integer not null default 0,
  document_state jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by_user_id text references users(id)
);

create table if not exists project_versions (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  version_number integer not null,
  note text,
  snapshot_state jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by_user_id text references users(id),
  unique (project_id, version_number)
);
create index if not exists project_versions_project_id_idx on project_versions(project_id, saved_at desc);

create table if not exists asset_folders (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  owner_user_id text not null references users(id),
  parent_id text references asset_folders(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists asset_folders_workspace_id_idx on asset_folders(workspace_id);
create index if not exists asset_folders_parent_id_idx on asset_folders(parent_id);

create table if not exists asset_upload_sessions (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  owner_user_id text not null references users(id),
  storage_key text not null unique,
  filename text not null,
  mime_type text,
  kind text not null check (kind in ('image', 'video', 'font', 'other')),
  status text not null check (status in ('pending', 'ready', 'failed', 'expired')),
  requested_name text,
  folder_id text references asset_folders(id) on delete set null,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null
);
create index if not exists asset_upload_sessions_workspace_id_idx on asset_upload_sessions(workspace_id);
create index if not exists asset_upload_sessions_status_idx on asset_upload_sessions(status);

create table if not exists assets (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  owner_user_id text not null references users(id),
  folder_id text references asset_folders(id) on delete set null,
  upload_session_id text references asset_upload_sessions(id) on delete set null,
  name text not null,
  kind text not null check (kind in ('image', 'video', 'font', 'other')),
  mime_type text,
  source_type text not null default 'upload' check (source_type in ('upload', 'url')),
  storage_mode text not null default 'object-storage' check (storage_mode in ('object-storage', 'remote-url')),
  storage_key text,
  public_url text,
  origin_url text,
  poster_src text,
  thumbnail_url text,
  access_scope text not null default 'client' check (access_scope in ('private', 'client')),
  tags text[] not null default '{}',
  size_bytes bigint,
  width integer,
  height integer,
  duration_ms integer,
  fingerprint text,
  font_family text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, storage_key)
);
create index if not exists assets_workspace_id_idx on assets(workspace_id);
create index if not exists assets_folder_id_idx on assets(folder_id);
create index if not exists assets_kind_idx on assets(kind);

create table if not exists audit_events (
  id text primary key,
  workspace_id text references workspaces(id) on delete cascade,
  actor_user_id text references users(id),
  action text not null,
  target_type text not null,
  target_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_workspace_id_idx on audit_events(workspace_id, created_at desc);
create index if not exists audit_events_actor_user_id_idx on audit_events(actor_user_id, created_at desc);
