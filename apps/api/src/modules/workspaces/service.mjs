import { randomUUID } from 'node:crypto';

const WORKSPACE_ROLE_ALIASES = {
  editor: 'member',
  reviewer: 'viewer',
};

const DEFAULT_WORKSPACE_PRODUCT_ACCESS = Object.freeze({
  ad_server: true,
  studio: true,
});

function normalizeWorkspaceRole(role, fallback = 'member') {
  const value = String(role || '').trim().toLowerCase();
  const aliased = WORKSPACE_ROLE_ALIASES[value] || value;
  return ['owner', 'admin', 'member', 'viewer'].includes(aliased) ? aliased : fallback;
}

function createSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace';
}

async function createUniqueWorkspaceSlug(client, name) {
  const base = createSlug(name);
  const rows = await client.query('select slug from workspaces where slug = $1 or slug like $2', [base, `${base}-%`]);
  const existing = new Set(rows.rows.map((row) => row.slug));
  if (!existing.has(base)) return base;
  let counter = 2;
  while (existing.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

function normalizeWorkspaceProductAccess(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    ad_server: raw.ad_server !== false,
    studio: raw.studio !== false,
  };
}

function derivePlatformRoleFromWorkspaceMembership(role, productAccess) {
  const normalizedRole = normalizeWorkspaceRole(role);
  const access = normalizeWorkspaceProductAccess(productAccess);
  if (normalizedRole === 'owner' || normalizedRole === 'admin') return 'admin';
  if (normalizedRole === 'viewer') return 'reviewer';
  if (access.ad_server && !access.studio) return 'ad_ops';
  return 'designer';
}

function toWorkspaceProductAccessJson(value) {
  return JSON.stringify(normalizeWorkspaceProductAccess(value));
}

async function hydrateWorkspaces(client, workspaces) {
  if (!workspaces.length) return [];
  const ids = workspaces.map((workspace) => workspace.id);

  const [membersResult, invitesResult, brandsResult] = await Promise.all([
    client.query(
      `
        select workspace_id, user_id, role, added_at
               , product_access
        from workspace_members
        where workspace_id = any($1::text[])
        order by added_at asc
      `,
      [ids],
    ),
    client.query(
      `
        select id, workspace_id, email, role, status, invited_at, product_access
        from workspace_invites
        where workspace_id = any($1::text[])
          and status <> 'revoked'
        order by invited_at desc
      `,
      [ids],
    ),
    client.query(
      `
        select id, workspace_id, name, primary_color, secondary_color, accent_color, logo_url, font_family
        from brands
        where workspace_id = any($1::text[])
        order by created_at asc
      `,
      [ids],
    ),
  ]);

  const membersByWorkspace = new Map();
  for (const row of membersResult.rows) {
    const current = membersByWorkspace.get(row.workspace_id) || [];
    current.push({
      userId: row.user_id,
      role: row.role,
      addedAt: row.added_at.toISOString(),
      productAccess: normalizeWorkspaceProductAccess(row.product_access),
    });
    membersByWorkspace.set(row.workspace_id, current);
  }

  const invitesByWorkspace = new Map();
  for (const row of invitesResult.rows) {
    const current = invitesByWorkspace.get(row.workspace_id) || [];
    current.push({
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      invitedAt: row.invited_at.toISOString(),
      productAccess: normalizeWorkspaceProductAccess(row.product_access),
    });
    invitesByWorkspace.set(row.workspace_id, current);
  }

  const brandsByWorkspace = new Map();
  for (const row of brandsResult.rows) {
    const current = brandsByWorkspace.get(row.workspace_id) || [];
    current.push({
      id: row.id,
      name: row.name,
      primaryColor: row.primary_color || undefined,
      secondaryColor: row.secondary_color || undefined,
      accentColor: row.accent_color || undefined,
      logoUrl: row.logo_url || undefined,
      fontFamily: row.font_family || undefined,
    });
    brandsByWorkspace.set(row.workspace_id, current);
  }

  return workspaces.map((row) => {
    const members = membersByWorkspace.get(row.id) || [];
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      brandColor: row.brand_color || undefined,
      product_access: normalizeWorkspaceProductAccess(row.product_access || DEFAULT_WORKSPACE_PRODUCT_ACCESS),
      ownerUserId: row.owner_user_id,
      memberUserIds: members.map((member) => member.userId),
      members,
      invites: invitesByWorkspace.get(row.id) || [],
      brands: brandsByWorkspace.get(row.id) || [],
    };
  });
}

export async function listWorkspacesForUser(client, userId) {
  const result = await client.query(
    `
      select distinct w.id, w.slug, w.name, w.brand_color, w.owner_user_id, w.created_at, wm.product_access
      from workspaces w
      join workspace_members wm on wm.workspace_id = w.id
      where wm.user_id = $1
        and w.archived_at is null
      order by w.created_at asc
    `,
    [userId],
  );
  return hydrateWorkspaces(client, result.rows);
}

export async function userHasWorkspaceAccess(client, workspaceId, userId) {
  const result = await client.query(
    `
      select 1
      from workspace_members
      where workspace_id = $1 and user_id = $2
      limit 1
    `,
    [workspaceId, userId],
  );
  return Boolean(result.rows[0]);
}

export async function createWorkspaceForUser(client, { name, ownerUserId }) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new Error('Workspace name is required.');
  }

  const id = randomUUID();
  const slug = await createUniqueWorkspaceSlug(client, trimmedName);
  await client.query(
    `
      insert into workspaces (id, slug, name, brand_color, owner_user_id)
      values ($1, $2, $3, $4, $5)
    `,
    [id, slug, trimmedName, '#8b5cf6', ownerUserId],
  );
  await client.query(
    `
      insert into workspace_members (workspace_id, user_id, role, product_access)
      values ($1, $2, 'owner', '{"ad_server": true, "studio": true}'::jsonb)
      on conflict (workspace_id, user_id) do update
      set role = 'owner',
          product_access = '{"ad_server": true, "studio": true}'::jsonb
    `,
    [id, ownerUserId],
  );

  const workspaces = await hydrateWorkspaces(client, [
    {
      id,
      slug,
      name: trimmedName,
      brand_color: '#8b5cf6',
      owner_user_id: ownerUserId,
    },
  ]);
  return workspaces[0] || null;
}

export async function createBrandForWorkspace(client, { workspaceId, name, primaryColor }) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new Error('Brand name is required.');
  }

  const id = randomUUID();
  const result = await client.query(
    `
      insert into brands (id, workspace_id, name, primary_color, secondary_color, accent_color, font_family)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning id, workspace_id, name, primary_color
    `,
    [
      id,
      workspaceId,
      trimmedName,
      primaryColor || '#8b5cf6',
      '#0f172a',
      primaryColor || '#8b5cf6',
      'Inter, system-ui, sans-serif',
    ],
  );
  return result.rows[0] || { id, workspace_id: workspaceId, name: trimmedName, primary_color: primaryColor || '#8b5cf6' };
}

export async function inviteMemberToWorkspace(client, { workspaceId, email, role, invitedByUserId, productAccess }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Invite email is required.');
  }
  const normalizedRole = normalizeWorkspaceRole(role);
  const normalizedProductAccess = normalizeWorkspaceProductAccess(productAccess);
  if (!['owner', 'admin', 'member', 'viewer'].includes(normalizedRole)) {
    throw new Error('Invite role is invalid.');
  }

  const existingUser = await client.query('select id from users where lower(email) = $1 limit 1', [normalizedEmail]);
  const existingInvite = await client.query(
    `
      select id, status
      from workspace_invites
      where workspace_id = $1 and lower(email) = $2 and status <> 'revoked'
      order by invited_at desc
      limit 1
    `,
    [workspaceId, normalizedEmail],
  );

  if (existingUser.rows[0]) {
    const memberResult = await client.query(
      'select 1 from workspace_members where workspace_id = $1 and user_id = $2 limit 1',
      [workspaceId, existingUser.rows[0].id],
    );
    if (memberResult.rows[0]) {
      return { message: `${normalizedEmail} already belongs to this workspace.`, invite: null };
    }

    await client.query(
      `
        insert into workspace_members (workspace_id, user_id, role, product_access)
        values ($1, $2, $3, $4::jsonb)
        on conflict (workspace_id, user_id) do update
        set role = excluded.role,
            product_access = excluded.product_access
      `,
      [workspaceId, existingUser.rows[0].id, normalizedRole, toWorkspaceProductAccessJson(normalizedProductAccess)],
    );

    if (existingInvite.rows[0]) {
      await client.query(
        `
          update workspace_invites
          set status = 'accepted',
              accepted_at = now()
          where id = $1
        `,
        [existingInvite.rows[0].id],
      );
    } else {
      await client.query(
        `
          insert into workspace_invites (id, workspace_id, email, role, status, invited_by_user_id, accepted_at, product_access)
          values ($1, $2, $3, $4, 'accepted', $5, now(), $6::jsonb)
        `,
        [randomUUID(), workspaceId, normalizedEmail, normalizedRole, invitedByUserId, toWorkspaceProductAccessJson(normalizedProductAccess)],
      );
    }

    return { message: `${normalizedEmail} was added directly because the user already exists.`, invite: null };
  }

  if (existingInvite.rows[0]) {
    return { message: `An invite for ${normalizedEmail} is already pending.`, invite: { email: normalizedEmail } };
  }

  const inviteId = randomUUID();
  await client.query(
    `
      insert into workspace_invites (id, workspace_id, email, role, status, invited_by_user_id, product_access)
      values ($1, $2, $3, $4, 'pending', $5, $6::jsonb)
    `,
    [inviteId, workspaceId, normalizedEmail, normalizedRole, invitedByUserId, toWorkspaceProductAccessJson(normalizedProductAccess)],
  );

  return {
    message: `Invite sent to ${normalizedEmail}.`,
    invite: {
      id: inviteId,
      email: normalizedEmail,
      role: normalizedRole,
      status: 'pending',
      productAccess: normalizedProductAccess,
    },
  };
}

export async function setSessionActiveWorkspace(client, { sessionId, workspaceId, userId }) {
  const allowed = await userHasWorkspaceAccess(client, workspaceId, userId);
  if (!allowed) {
    throw new Error('Workspace not found for this user.');
  }
  await client.query('update sessions set active_workspace_id = $1, last_seen_at = now() where id = $2', [workspaceId, sessionId]);
}

export async function getWorkspaceById(client, workspaceId) {
  const result = await client.query(
    `
      select id, slug, name, brand_color, owner_user_id, created_at, updated_at
      from workspaces
      where id = $1
        and archived_at is null
      limit 1
    `,
    [workspaceId],
  );
  return result.rows[0] || null;
}

export async function updateWorkspaceProfile(client, { workspaceId, name }) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new Error('Workspace name is required.');
  }

  const result = await client.query(
    `
      update workspaces
      set name = $2,
          updated_at = now()
      where id = $1
      returning id, slug, name, brand_color, owner_user_id, created_at, updated_at
    `,
    [workspaceId, trimmedName],
  );
  return result.rows[0] || null;
}

export async function listWorkspaceTeamMembers(client, workspaceId) {
  const result = await client.query(
    `
      select wm.workspace_id,
             wm.user_id,
             wm.role,
             wm.added_at,
             wm.product_access,
             u.email,
             u.display_name
      from workspace_members wm
      join users u on u.id = wm.user_id
      where wm.workspace_id = $1
      order by wm.added_at asc, u.email asc
    `,
    [workspaceId],
  );

  return result.rows.map((row) => ({
    id: row.user_id,
    memberId: `${row.workspace_id}:${row.user_id}`,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: normalizeWorkspaceRole(row.role, row.user_id ? 'member' : 'viewer'),
    platformRole: derivePlatformRoleFromWorkspaceMembership(row.role, row.product_access),
    productAccess: normalizeWorkspaceProductAccess(row.product_access),
    joinedAt: row.added_at?.toISOString?.() || null,
  }));
}

export async function updateWorkspaceMemberRole(client, { workspaceId, userId, role, productAccess }) {
  const normalizedRole = normalizeWorkspaceRole(role);
  const normalizedProductAccess = productAccess === undefined ? undefined : normalizeWorkspaceProductAccess(productAccess);
  if (normalizedRole === 'owner') {
    throw new Error('Owner role cannot be assigned through this endpoint.');
  }

  const existing = await client.query(
    `
      select role
      from workspace_members
      where workspace_id = $1 and user_id = $2
      limit 1
    `,
    [workspaceId, userId],
  );

  if (!existing.rows[0]) {
    throw new Error('Workspace member not found.');
  }
  if (normalizeWorkspaceRole(existing.rows[0].role) === 'owner') {
    throw new Error('Workspace owner cannot be modified.');
  }

  const result = normalizedProductAccess === undefined
    ? await client.query(
      `
        update workspace_members
        set role = $3
        where workspace_id = $1 and user_id = $2
        returning workspace_id, user_id, role, added_at, product_access
      `,
      [workspaceId, userId, normalizedRole],
    )
    : await client.query(
      `
        update workspace_members
        set role = $3,
            product_access = $4::jsonb
        where workspace_id = $1 and user_id = $2
        returning workspace_id, user_id, role, added_at, product_access
      `,
      [workspaceId, userId, normalizedRole, toWorkspaceProductAccessJson(normalizedProductAccess)],
    );
  return result.rows[0] || null;
}

export async function removeWorkspaceMember(client, { workspaceId, userId }) {
  const existing = await client.query(
    `
      select role
      from workspace_members
      where workspace_id = $1 and user_id = $2
      limit 1
    `,
    [workspaceId, userId],
  );

  if (!existing.rows[0]) {
    throw new Error('Workspace member not found.');
  }
  if (normalizeWorkspaceRole(existing.rows[0].role) === 'owner') {
    throw new Error('Workspace owner cannot be removed.');
  }

  await client.query(
    `
      delete from workspace_members
      where workspace_id = $1 and user_id = $2
    `,
    [workspaceId, userId],
  );
  return true;
}

export async function listClientAccessAssignments(client, workspaceIds) {
  const result = await client.query(
    `
      with visible_workspaces as (
        select w.id, w.name
        from workspaces w
        where w.id = any($1::text[])
          and w.archived_at is null
      ),
      member_assignments as (
        select
          u.id as user_id,
          u.email,
          u.display_name,
          vw.id as workspace_id,
          vw.name as workspace_name,
          wm.role,
          wm.product_access,
          'active'::text as status,
          null::timestamptz as invited_at,
          wm.added_at as joined_at
        from visible_workspaces vw
        join workspace_members wm on wm.workspace_id = vw.id
        join users u on u.id = wm.user_id
      ),
      invite_assignments as (
        select
          null::text as user_id,
          wi.email,
          null::text as display_name,
          vw.id as workspace_id,
          vw.name as workspace_name,
          wi.role,
          wi.product_access,
          wi.status,
          wi.invited_at,
          null::timestamptz as joined_at
        from visible_workspaces vw
        join workspace_invites wi on wi.workspace_id = vw.id
        where wi.status = 'pending'
      )
      select *
      from (
        select * from member_assignments
        union all
        select * from invite_assignments
      ) assignments
      order by lower(email) asc, workspace_name asc
    `,
    [workspaceIds],
  );

  const usersByKey = new Map();
  for (const row of result.rows) {
    const key = row.user_id || `invite:${String(row.email || '').toLowerCase()}`;
    const current = usersByKey.get(key) || {
      id: row.user_id || key,
      email: row.email,
      display_name: row.display_name,
      avatar_url: null,
      assignments: [],
    };
    current.assignments.push({
      workspace_id: row.workspace_id,
      workspace_name: row.workspace_name,
      role: normalizeWorkspaceRole(row.role, 'member'),
      platform_role: derivePlatformRoleFromWorkspaceMembership(row.role, row.product_access),
      product_access: normalizeWorkspaceProductAccess(row.product_access),
      status: row.status,
      invited_at: row.invited_at?.toISOString?.() || null,
      joined_at: row.joined_at?.toISOString?.() || null,
    });
    usersByKey.set(key, current);
  }

  return Array.from(usersByKey.values());
}
