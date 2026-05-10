alter table workspace_members
  add column if not exists product_access jsonb not null default '{"ad_server": true, "studio": true}'::jsonb;

alter table workspace_invites
  add column if not exists product_access jsonb not null default '{"ad_server": true, "studio": true}'::jsonb;

update workspace_members
set product_access = '{"ad_server": true, "studio": true}'::jsonb
where product_access is null;

update workspace_invites
set product_access = '{"ad_server": true, "studio": true}'::jsonb
where product_access is null;
