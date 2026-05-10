create table if not exists webhooks (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  url text not null,
  events text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'inactive')),
  secret text,
  created_by_user_id text references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists webhooks_workspace_id_idx on webhooks(workspace_id, created_at desc);

create table if not exists webhook_deliveries (
  id text primary key,
  webhook_id text not null references webhooks(id) on delete cascade,
  event text not null,
  status text not null check (status in ('success', 'failed', 'pending')),
  status_code integer,
  response_time_ms integer,
  sent_at timestamptz not null default now(),
  request_payload jsonb
);

create index if not exists webhook_deliveries_webhook_id_idx on webhook_deliveries(webhook_id, sent_at desc);
