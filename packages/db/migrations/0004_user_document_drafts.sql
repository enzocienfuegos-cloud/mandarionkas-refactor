create table if not exists user_document_drafts (
  user_id text not null references users(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('autosave', 'manual')),
  document_state jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by_user_id text references users(id),
  primary key (user_id, kind)
);
create index if not exists user_document_drafts_workspace_id_idx on user_document_drafts(workspace_id, updated_at desc);
