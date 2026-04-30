alter table workspace_members
  drop constraint if exists workspace_members_role_check;

alter table workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'member', 'viewer', 'editor', 'reviewer'));

alter table workspace_invites
  drop constraint if exists workspace_invites_role_check;

alter table workspace_invites
  add constraint workspace_invites_role_check
  check (role in ('owner', 'admin', 'member', 'viewer', 'editor', 'reviewer'));
