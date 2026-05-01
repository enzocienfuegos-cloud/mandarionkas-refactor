alter table users
  drop constraint if exists users_global_role_check;

alter table users
  add constraint users_global_role_check
  check (global_role in ('admin', 'editor', 'designer', 'ad_ops', 'reviewer'));

alter table users
  add column if not exists platform_role text;

update users as u
set platform_role = case
  when lower(coalesce(u.global_role, '')) = 'admin' then 'admin'
  when lower(coalesce(u.global_role, '')) = 'reviewer' then 'reviewer'
  when lower(coalesce(u.global_role, '')) = 'designer' then 'designer'
  when lower(coalesce(u.global_role, '')) = 'ad_ops' then 'ad_ops'
  when lower(coalesce(u.global_role, '')) = 'editor' then case
    when exists (
      select 1
      from workspace_members wm
      where wm.user_id = u.id
        and coalesce((wm.product_access ->> 'ad_server')::boolean, true)
        and not coalesce((wm.product_access ->> 'studio')::boolean, true)
    )
      and not exists (
        select 1
        from workspace_members wm
        where wm.user_id = u.id
          and coalesce((wm.product_access ->> 'studio')::boolean, true)
      ) then 'ad_ops'
    else 'designer'
  end
  else 'reviewer'
end;

update users
set platform_role = case
  when lower(coalesce(global_role, '')) = 'admin' then 'admin'
  when lower(coalesce(global_role, '')) = 'reviewer' then 'reviewer'
  when lower(coalesce(global_role, '')) = 'designer' then 'designer'
  when lower(coalesce(global_role, '')) = 'ad_ops' then 'ad_ops'
  when lower(coalesce(global_role, '')) = 'editor' then 'designer'
  else 'reviewer'
end
where platform_role is null;

alter table users
  alter column platform_role set not null;

alter table users
  drop constraint if exists users_platform_role_check;

alter table users
  add constraint users_platform_role_check
  check (platform_role in ('admin', 'designer', 'ad_ops', 'reviewer'));
