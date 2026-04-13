import { randomUUID } from 'node:crypto';

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

async function hydrateWorkspaces(client, workspaces) {
  if (!workspaces.length) return [];
  const ids = workspaces.map((workspace) => workspace.id);

  const [membersResult, invitesResult, brandsResult] = await Promise.all([
    client.query(
      `
        select workspace_id, user_id, role, added_at
        from workspace_members
        where workspace_id = any($1::text[])
        order by added_at asc
      `,
      [ids],
    ),
    client.query(
      `
        select id, workspace_id, email, role, status, invited_at
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
      select distinct w.id, w.slug, w.name, w.brand_color, w.owner_user_id, w.created_at
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
      insert into workspace_members (workspace_id, user_id, role)
      values ($1, $2, 'owner')
      on conflict (workspace_id, user_id) do update set role = 'owner'
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

export async function inviteMemberToWorkspace(client, { workspaceId, email, role, invitedByUserId }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Invite email is required.');
  }
  if (!['owner', 'editor', 'reviewer'].includes(role)) {
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
        insert into workspace_members (workspace_id, user_id, role)
        values ($1, $2, $3)
        on conflict (workspace_id, user_id) do update set role = excluded.role
      `,
      [workspaceId, existingUser.rows[0].id, role],
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
          insert into workspace_invites (id, workspace_id, email, role, status, invited_by_user_id, accepted_at)
          values ($1, $2, $3, $4, 'accepted', $5, now())
        `,
        [randomUUID(), workspaceId, normalizedEmail, role, invitedByUserId],
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
      insert into workspace_invites (id, workspace_id, email, role, status, invited_by_user_id)
      values ($1, $2, $3, $4, 'pending', $5)
    `,
    [inviteId, workspaceId, normalizedEmail, role, invitedByUserId],
  );

  return { message: `Invite sent to ${normalizedEmail}.`, invite: { id: inviteId, email: normalizedEmail, role, status: 'pending' } };
}

export async function setSessionActiveWorkspace(client, { sessionId, workspaceId, userId }) {
  const allowed = await userHasWorkspaceAccess(client, workspaceId, userId);
  if (!allowed) {
    throw new Error('Workspace not found for this user.');
  }
  await client.query('update sessions set active_workspace_id = $1, last_seen_at = now() where id = $2', [workspaceId, sessionId]);
}
