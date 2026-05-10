create table if not exists brand_kits (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  brand_id text references brands(id) on delete set null,
  brand_name text,
  data_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_kits_workspace_updated_at_idx
  on brand_kits(workspace_id, updated_at desc);

create index if not exists brand_kits_brand_id_idx
  on brand_kits(brand_id)
  where brand_id is not null;
