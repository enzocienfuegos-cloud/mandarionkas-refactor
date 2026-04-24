const VALID_ROLES = ['owner', 'admin', 'member', 'viewer'];
const DEFAULT_PRODUCT_ACCESS = Object.freeze({
  ad_server: true,
  studio: true,
});

export function normalizeProductAccess(productAccess) {
  if (!productAccess || typeof productAccess !== 'object' || Array.isArray(productAccess)) {
    return { ...DEFAULT_PRODUCT_ACCESS };
  }

  return {
    ad_server: productAccess.ad_server !== false,
    studio: productAccess.studio !== false,
  };
}

export function hasProductAccess(productAccess, product) {
  const normalized = normalizeProductAccess(productAccess);
  return normalized[product] === true;
}

export function memberHasProductAccess(member, product) {
  return hasProductAccess(member?.product_access, product);
}

export async function getWorkspace(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT id, name, slug, plan, settings, logo_url, created_at, updated_at
     FROM workspaces WHERE id = $1`,
    [workspaceId],
  );
  return rows[0] ?? null;
}

export async function updateWorkspace(pool, workspaceId, data) {
  const allowed = ['name', 'slug', 'plan', 'settings', 'logo_url'];
  const setClauses = [];
  const params = [workspaceId];

  for (const key of allowed) {
    if (key in data) {
      params.push(key === 'settings' ? JSON.stringify(data[key]) : data[key]);
      setClauses.push(`${key} = $${params.length}`);
    }
  }
  if (setClauses.length === 0) return getWorkspace(pool, workspaceId);
  setClauses.push(`updated_at = NOW()`);

  const { rows } = await pool.query(
    `UPDATE workspaces SET ${setClauses.join(', ')}
     WHERE id = $1
     RETURNING *`,
    params,
  );
  return rows[0] ?? null;
}

export async function listMembers(pool, workspaceId) {
  const { rows } = await pool.query(
    `SELECT wm.id, wm.workspace_id, wm.user_id, wm.role, wm.status, wm.product_access,
            wm.invited_at, wm.joined_at, wm.updated_at,
            u.email, u.display_name, u.avatar_url, u.email_verified, u.last_login_at
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1
     ORDER BY
       CASE wm.role
         WHEN 'owner'  THEN 1
         WHEN 'admin'  THEN 2
         WHEN 'member' THEN 3
         WHEN 'viewer' THEN 4
         ELSE 5
       END,
       u.display_name ASC`,
    [workspaceId],
  );
  return rows.map((row) => ({
    ...row,
    product_access: normalizeProductAccess(row.product_access),
  }));
}

export async function getMember(pool, workspaceId, userId) {
  const { rows } = await pool.query(
    `SELECT wm.id, wm.workspace_id, wm.user_id, wm.role, wm.status, wm.product_access,
            wm.invited_at, wm.joined_at, wm.updated_at,
            u.email, u.display_name, u.avatar_url, u.email_verified, u.last_login_at
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = $1 AND wm.user_id = $2`,
    [workspaceId, userId],
  );
  if (!rows[0]) return null;
  return {
    ...rows[0],
    product_access: normalizeProductAccess(rows[0].product_access),
  };
}

export async function inviteMember(pool, workspaceId, data) {
  const { email, role = 'member', invited_by, product_access } = data;

  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`);
  }

  // Upsert user by email
  const { rows: userRows } = await pool.query(
    `INSERT INTO users (email)
     VALUES (lower($1))
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id, email`,
    [email],
  );
  const user = userRows[0];

  // Add workspace member
  const { rows } = await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role, status, product_access, invited_by, invited_at, joined_at)
     VALUES ($1, $2, $3, 'pending', $4::jsonb, $5, NOW(), NULL)
     ON CONFLICT (workspace_id, user_id)
     DO UPDATE SET
       role = EXCLUDED.role,
       product_access = EXCLUDED.product_access,
       status = CASE
         WHEN workspace_members.status = 'active' THEN 'active'
         ELSE 'pending'
       END,
       invited_by = EXCLUDED.invited_by,
       invited_at = NOW(),
       joined_at = CASE
         WHEN workspace_members.status = 'active' THEN workspace_members.joined_at
         ELSE NULL
       END,
       updated_at = NOW()
     RETURNING *`,
    [workspaceId, user.id, role, JSON.stringify(normalizeProductAccess(product_access)), invited_by ?? null],
  );
  return { ...rows[0], email: user.email, product_access: normalizeProductAccess(rows[0].product_access) };
}

export async function activatePendingMembershipsForUser(pool, userId) {
  const { rows } = await pool.query(
    `UPDATE workspace_members wm
     SET status = 'active',
         joined_at = COALESCE(wm.joined_at, NOW()),
         updated_at = NOW()
     WHERE wm.user_id = $1
       AND wm.status = 'pending'
     RETURNING wm.workspace_id`,
    [userId],
  );

  await pool.query(
    `UPDATE studio_invites si
     SET status = 'accepted',
         accepted_at = COALESCE(si.accepted_at, NOW())
     FROM users u
     WHERE u.id = $1
       AND lower(si.email) = lower(u.email)
       AND si.status <> 'accepted'
       AND EXISTS (
         SELECT 1
         FROM workspace_members wm
         WHERE wm.user_id = u.id
           AND wm.workspace_id = si.workspace_id
           AND wm.status = 'active'
       )`,
    [userId],
  );

  return rows.map((row) => row.workspace_id);
}

export async function updateMemberRole(pool, workspaceId, userId, role) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`);
  }

  const { rows } = await pool.query(
    `UPDATE workspace_members
     SET role = $3, updated_at = NOW()
     WHERE workspace_id = $1 AND user_id = $2
     RETURNING *`,
    [workspaceId, userId, role],
  );
  return rows[0] ? { ...rows[0], product_access: normalizeProductAccess(rows[0].product_access) } : null;
}

export async function updateMemberProductAccess(pool, workspaceId, userId, productAccess) {
  const { rows } = await pool.query(
    `UPDATE workspace_members
     SET product_access = $3::jsonb,
         updated_at = NOW()
     WHERE workspace_id = $1 AND user_id = $2
     RETURNING *`,
    [workspaceId, userId, JSON.stringify(normalizeProductAccess(productAccess))],
  );
  return rows[0] ? { ...rows[0], product_access: normalizeProductAccess(rows[0].product_access) } : null;
}

export async function removeMember(pool, workspaceId, userId) {
  // Prevent removing the last owner
  const { rows: ownerCheck } = await pool.query(
    `SELECT COUNT(*) AS owner_count
     FROM workspace_members
     WHERE workspace_id = $1 AND role = 'owner' AND status = 'active'`,
    [workspaceId],
  );
  const ownerCount = parseInt(ownerCheck[0]?.owner_count || 0, 10);

  const { rows: memberRole } = await pool.query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  if (memberRole[0]?.role === 'owner' && ownerCount <= 1) {
    throw new Error('Cannot remove the last owner of a workspace');
  }

  const { rowCount } = await pool.query(
    `DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );
  return rowCount > 0;
}

export async function listUsersWithWorkspaceAccess(pool, workspaceIds = []) {
  if (!Array.isArray(workspaceIds) || workspaceIds.length === 0) return [];

  const { rows } = await pool.query(
    `SELECT
       u.id AS user_id,
       u.email,
       u.display_name,
       u.avatar_url,
       wm.workspace_id,
       w.name AS workspace_name,
       wm.role,
       wm.product_access,
       wm.status,
       wm.invited_at,
       wm.joined_at
     FROM workspace_members wm
     JOIN users u ON u.id = wm.user_id
     JOIN workspaces w ON w.id = wm.workspace_id
     WHERE wm.workspace_id = ANY($1::uuid[])
     ORDER BY lower(u.email) ASC, w.name ASC`,
    [workspaceIds],
  );

  const grouped = new Map();
  for (const row of rows) {
    const userId = String(row.user_id);
    if (!grouped.has(userId)) {
      grouped.set(userId, {
        id: userId,
        email: row.email,
        display_name: row.display_name ?? '',
        avatar_url: row.avatar_url ?? null,
        assignments: [],
      });
    }
    grouped.get(userId).assignments.push({
      workspace_id: row.workspace_id,
      workspace_name: row.workspace_name,
      role: row.role,
      product_access: normalizeProductAccess(row.product_access),
      status: row.status,
      invited_at: row.invited_at,
      joined_at: row.joined_at,
    });
  }

  return Array.from(grouped.values());
}
