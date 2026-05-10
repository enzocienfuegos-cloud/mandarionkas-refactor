CREATE SCHEMA IF NOT EXISTS __PG_SCHEMA__;

CREATE TABLE IF NOT EXISTS __PG_SCHEMA__.users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  role text NOT NULL
);

CREATE TABLE IF NOT EXISTS __PG_SCHEMA__.clients (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  brand_color text,
  owner_user_id text NOT NULL,
  member_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  members jsonb NOT NULL DEFAULT '[]'::jsonb,
  invites jsonb NOT NULL DEFAULT '[]'::jsonb,
  brands jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS __PG_SCHEMA__.projects (
  id text PRIMARY KEY,
  name text NOT NULL,
  updated_at timestamptz,
  client_id text NOT NULL,
  owner_user_id text NOT NULL,
  owner_name text NOT NULL,
  brand_id text,
  brand_name text,
  campaign_name text,
  access_scope text NOT NULL DEFAULT 'client',
  canvas_preset_id text,
  scene_count integer NOT NULL DEFAULT 0,
  widget_count integer NOT NULL DEFAULT 0,
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS __PG_SCHEMA__.project_states (
  project_id text PRIMARY KEY REFERENCES __PG_SCHEMA__.projects(id) ON DELETE CASCADE,
  state jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS __PG_SCHEMA__.project_versions (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES __PG_SCHEMA__.projects(id) ON DELETE CASCADE,
  project_name text NOT NULL,
  version_number integer NOT NULL,
  saved_at timestamptz,
  note text
);

CREATE TABLE IF NOT EXISTS __PG_SCHEMA__.project_version_states (
  version_id text PRIMARY KEY REFERENCES __PG_SCHEMA__.project_versions(id) ON DELETE CASCADE,
  state jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS __PG_SCHEMA__.document_slots (
  id text PRIMARY KEY,
  scope text NOT NULL,
  client_id text NOT NULL,
  user_id text NOT NULL,
  project_id text,
  updated_at timestamptz,
  state jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS __PG_SCHEMA__.asset_folders (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  owner_user_id text NOT NULL,
  parent_id text,
  name text NOT NULL,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS __PG_SCHEMA__.assets (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  owner_user_id text NOT NULL,
  folder_id text,
  name text NOT NULL,
  kind text NOT NULL,
  src text NOT NULL DEFAULT '',
  mime_type text,
  source_type text,
  storage_mode text,
  storage_key text,
  public_url text,
  origin_url text,
  poster_src text,
  access_scope text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  size_bytes integer,
  width integer,
  height integer,
  duration_ms integer,
  fingerprint text,
  font_family text,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS __PG_SCHEMA__.sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  active_client_id text,
  issued_at timestamptz,
  expires_at timestamptz,
  persistence_mode text NOT NULL DEFAULT 'session'
);

CREATE TABLE IF NOT EXISTS __PG_SCHEMA__.audit_events (
  id text PRIMARY KEY,
  action text NOT NULL,
  target text NOT NULL,
  actor_user_id text,
  actor_name text,
  client_id text,
  target_id text,
  summary text NOT NULL,
  at timestamptz NOT NULL,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS __PG_SCHEMA__.rate_limit_buckets (
  scope text NOT NULL,
  subject text NOT NULL,
  window_start timestamptz NOT NULL,
  reset_at timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  limit_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (scope, subject, window_start)
);

CREATE TABLE IF NOT EXISTS __PG_SCHEMA__.observability_totals (
  id text PRIMARY KEY,
  started_at timestamptz NOT NULL,
  requests bigint NOT NULL DEFAULT 0,
  errors_4xx bigint NOT NULL DEFAULT 0,
  errors_5xx bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS __PG_SCHEMA__.observability_routes (
  route_key text PRIMARY KEY,
  requests bigint NOT NULL DEFAULT 0,
  errors_4xx bigint NOT NULL DEFAULT 0,
  errors_5xx bigint NOT NULL DEFAULT 0,
  total_duration_ms double precision NOT NULL DEFAULT 0,
  avg_duration_ms double precision NOT NULL DEFAULT 0,
  last_status integer NOT NULL DEFAULT 0,
  last_request_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_clients_owner_user_id ON __PG_SCHEMA__.clients(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON __PG_SCHEMA__.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner_user_id ON __PG_SCHEMA__.projects(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON __PG_SCHEMA__.project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_document_slots_lookup ON __PG_SCHEMA__.document_slots(user_id, client_id, scope);
CREATE INDEX IF NOT EXISTS idx_assets_client_id ON __PG_SCHEMA__.assets(client_id);
CREATE INDEX IF NOT EXISTS idx_asset_folders_client_id ON __PG_SCHEMA__.asset_folders(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON __PG_SCHEMA__.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_at ON __PG_SCHEMA__.audit_events(at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_client_id ON __PG_SCHEMA__.audit_events(client_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_reset_at ON __PG_SCHEMA__.rate_limit_buckets(reset_at);
