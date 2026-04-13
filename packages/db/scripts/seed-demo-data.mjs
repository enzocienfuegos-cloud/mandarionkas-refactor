import { randomUUID } from 'node:crypto';
import { getPool, closeAllPools } from '../src/pool.mjs';
import { hashPassword } from '../../config/src/security.mjs';

const connectionString = process.env.DATABASE_URL;

function createSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace';
}

async function upsertUser(client, user) {
  const result = await client.query(
    `
      insert into users (id, email, password_hash, display_name, global_role)
      values ($1, $2, $3, $4, $5)
      on conflict (email) do update
      set password_hash = excluded.password_hash,
          display_name = excluded.display_name,
          global_role = excluded.global_role,
          updated_at = now()
      returning id
    `,
    [user.id, user.email, user.passwordHash, user.displayName, user.globalRole],
  );
  return result.rows[0]?.id;
}

async function main() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to seed demo data.');
  }

  const pool = getPool(connectionString);
  const client = await pool.connect();

  try {
    const adminId = randomUUID();
    const editorId = randomUUID();
    const reviewerId = randomUUID();
    const adminHash = await hashPassword('demo123');
    const editorHash = await hashPassword('demo123');
    const reviewerHash = await hashPassword('demo123');

    await client.query('begin');

    const resolvedAdminId = await upsertUser(client, {
      id: adminId,
      email: 'admin@smx.studio',
      passwordHash: adminHash,
      displayName: 'SMX Admin',
      globalRole: 'admin',
    });
    const resolvedEditorId = await upsertUser(client, {
      id: editorId,
      email: 'editor@smx.studio',
      passwordHash: editorHash,
      displayName: 'Client Editor',
      globalRole: 'editor',
    });
    const resolvedReviewerId = await upsertUser(client, {
      id: reviewerId,
      email: 'reviewer@smx.studio',
      passwordHash: reviewerHash,
      displayName: 'Client Reviewer',
      globalRole: 'reviewer',
    });

    const workspaceId = randomUUID();
    const slug = createSlug('Default Client');
    await client.query(
      `
        insert into workspaces (id, slug, name, brand_color, owner_user_id)
        values ($1, $2, $3, $4, $5)
        on conflict (slug) do update set owner_user_id = excluded.owner_user_id
      `,
      [workspaceId, slug, 'Default Client', '#8b5cf6', resolvedAdminId],
    );

    const workspaceRow = await client.query('select id from workspaces where slug = $1 limit 1', [slug]);
    const resolvedWorkspaceId = workspaceRow.rows[0]?.id;
    if (!resolvedWorkspaceId) {
      throw new Error('Failed to resolve seeded workspace.');
    }

    for (const [userId, role] of [[resolvedAdminId, 'owner'], [resolvedEditorId, 'editor'], [resolvedReviewerId, 'reviewer']]) {
      await client.query(
        `
          insert into workspace_members (workspace_id, user_id, role)
          values ($1, $2, $3)
          on conflict (workspace_id, user_id) do update set role = excluded.role
        `,
        [resolvedWorkspaceId, userId, role],
      );
    }

    await client.query(
      `
        insert into brands (id, workspace_id, name, primary_color, secondary_color, accent_color, font_family)
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict do nothing
      `,
      [randomUUID(), resolvedWorkspaceId, 'Core Brand', '#8b5cf6', '#0f172a', '#ec4899', 'Inter, system-ui, sans-serif'],
    );

    await client.query('commit');
    console.log(JSON.stringify({ ok: true, workspaceId: resolvedWorkspaceId }, null, 2));
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exitCode = 1;
} finally {
  await closeAllPools();
}
