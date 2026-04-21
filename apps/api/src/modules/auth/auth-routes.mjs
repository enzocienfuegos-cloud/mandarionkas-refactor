import {
  createUser,
  getUserByEmail,
  getUserById,
  verifyPassword,
  listWorkspacesForUser,
} from '@smx/db';
import { getMember } from '@smx/db/team';

export function buildRequireWorkspace(pool) {
  return async function requireWorkspace(req, reply) {
    const userId = req.session?.userId;
    const workspaceId = req.session?.workspaceId;

    if (!userId || !workspaceId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'No active session' });
    }

    const member = await getMember(pool, workspaceId, userId);
    if (!member) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Not a member of this workspace' });
    }

    const user = await getUserById(pool, userId);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
    }

    req.authSession = {
      userId,
      workspaceId,
      role: member.role,
      email: user.email,
    };
  };
}

async function createWorkspaceWithOwner(pool, userId, workspaceName) {
  const slug = workspaceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  // Create workspace
  const { rows: wsRows } = await pool.query(
    `INSERT INTO workspaces (name, slug, plan)
     VALUES ($1, $2, 'free')
     RETURNING id, name, slug, plan, logo_url, created_at`,
    [workspaceName, slug],
  );
  const workspace = wsRows[0];

  // Create owner membership
  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
     VALUES ($1, $2, 'owner', NOW())`,
    [workspace.id, userId],
  );

  return workspace;
}

export function handleAuthRoutes(app, { pool }) {
  // POST /v1/auth/register
  app.post('/v1/auth/register', async (req, reply) => {
    const { email, firstName, lastName, password, workspaceName } = req.body ?? {};

    if (!email || !password || !workspaceName) {
      return reply.status(400).send({ error: 'Bad Request', message: 'email, password, and workspaceName are required' });
    }

    const existingUser = await getUserByEmail(pool, email);
    if (existingUser) {
      return reply.status(409).send({ error: 'Conflict', message: 'Email already registered' });
    }

    const displayName = [firstName, lastName].filter(Boolean).join(' ') || null;
    const user = await createUser(pool, { email, password, display_name: displayName });
    const workspace = await createWorkspaceWithOwner(pool, user.id, workspaceName);

    req.session.userId = user.id;
    req.session.workspaceId = workspace.id;

    return reply.status(201).send({
      user: { id: user.id, email: user.email, display_name: user.display_name },
      workspace,
    });
  });

  // POST /v1/auth/login
  app.post('/v1/auth/login', async (req, reply) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return reply.status(400).send({ error: 'Bad Request', message: 'email and password are required' });
    }

    const user = await getUserByEmail(pool, email);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    if (!user.password_hash) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    // Get the first/default workspace for this user
    const workspaces = await listWorkspacesForUser(pool, user.id);
    const workspace = workspaces[0] ?? null;

    req.session.userId = user.id;
    req.session.workspaceId = workspace?.id ?? null;

    // Update last_login_at
    await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

    return reply.send({
      user: { id: user.id, email: user.email, display_name: user.display_name },
      workspace,
    });
  });

  // POST /v1/auth/logout
  app.post('/v1/auth/logout', async (req, reply) => {
    req.session.destroy();
    return reply.send({ ok: true });
  });

  // GET /v1/auth/me
  app.get('/v1/auth/me', async (req, reply) => {
    const userId = req.session?.userId;
    const workspaceId = req.session?.workspaceId;

    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'No active session' });
    }

    const user = await getUserById(pool, userId);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Session invalid' });
    }

    let workspace = null;
    let role = null;
    if (workspaceId) {
      const member = await getMember(pool, workspaceId, userId);
      if (member) {
        const { rows } = await pool.query(
          `SELECT id, name, slug, plan, logo_url FROM workspaces WHERE id = $1`,
          [workspaceId],
        );
        workspace = rows[0] ?? null;
        role = member.role;
      }
    }

    return reply.send({
      user: { id: user.id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url },
      workspace,
      role,
    });
  });

  // GET /v1/auth/workspaces
  app.get('/v1/auth/workspaces', async (req, reply) => {
    const userId = req.session?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'No active session' });
    }

    const workspaces = await listWorkspacesForUser(pool, userId);
    return reply.send({ workspaces });
  });

  // POST /v1/auth/switch
  app.post('/v1/auth/switch', async (req, reply) => {
    const userId = req.session?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'No active session' });
    }

    const { workspaceId } = req.body ?? {};
    if (!workspaceId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'workspaceId is required' });
    }

    const member = await getMember(pool, workspaceId, userId);
    if (!member) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Not a member of this workspace' });
    }

    const { rows } = await pool.query(
      `SELECT id, name, slug, plan, logo_url FROM workspaces WHERE id = $1`,
      [workspaceId],
    );
    const workspace = rows[0];
    if (!workspace) {
      return reply.status(404).send({ error: 'Not Found', message: 'Workspace not found' });
    }

    req.session.workspaceId = workspaceId;

    return reply.send({ workspace, role: member.role });
  });
}
