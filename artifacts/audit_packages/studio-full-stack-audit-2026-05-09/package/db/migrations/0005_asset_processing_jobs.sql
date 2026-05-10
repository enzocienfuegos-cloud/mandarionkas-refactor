create table if not exists asset_processing_jobs (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  owner_user_id text references users(id),
  asset_id text not null references assets(id) on delete cascade,
  job_type text not null check (job_type in ('video-transcode')),
  status text not null check (status in ('pending', 'processing', 'completed', 'failed', 'skipped')) default 'pending',
  priority integer not null default 100,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  input jsonb,
  output jsonb,
  error_message text,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists asset_processing_jobs_workspace_id_idx on asset_processing_jobs(workspace_id, created_at desc);
create index if not exists asset_processing_jobs_asset_id_idx on asset_processing_jobs(asset_id);
create index if not exists asset_processing_jobs_claim_idx on asset_processing_jobs(job_type, status, priority, created_at);

