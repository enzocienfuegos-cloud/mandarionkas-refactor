alter table asset_processing_jobs
  add column if not exists available_at timestamptz not null default now();

update asset_processing_jobs
set available_at = coalesce(available_at, now())
where available_at is null;

alter table asset_processing_jobs
  drop constraint if exists asset_processing_jobs_job_type_check;

alter table asset_processing_jobs
  add constraint asset_processing_jobs_job_type_check
  check (job_type in ('video-transcode', 'image-derivatives'));

drop index if exists asset_processing_jobs_claim_idx;
create index if not exists asset_processing_jobs_claim_idx
  on asset_processing_jobs(job_type, status, available_at, priority, created_at);
