import {
  listMembers,
  createStudioInvite,
  inviteMember,
  getMember,
  updateMemberRole,
  removeMember,
} from '@smx/db';

const VALID_ROLES = ['owner', 'admin', 'member', 'viewer'];

export function handleTeamRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/team — list members
  app.get('/v1/team', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;

    const members = await listMembers(pool, workspaceId);
    return reply.send({ members });
  });

  // POST /v1/team/invite — invite member (static before parameterized)
  app.post('/v1/team/invite', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, userId, role: currentRole } = req.authSession;

    if (currentRole !== 'admin' && currentRole !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins and owners can invite team members' });
    }

    const { email, role } = req.body ?? {};

    if (!email || !email.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'email is required' });
    }

    if (!role || !VALID_ROLES.includes(role)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `role must be one of: ${VALID_ROLES.join(', ')}`,
      });
    }

    // Only owners can invite other owners
    if (role === 'owner' && currentRole !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only owners can add other owners' });
    }

    let member;
    try {
      member = await inviteMember(pool, workspaceId, {
        email: email.trim(),
        role,
        invited_by: userId,
      });
      await createStudioInvite(pool, {
        workspaceId,
        email: email.trim(),
        role: role === 'viewer' ? 'reviewer' : role === 'owner' ? 'owner' : 'editor',
        invitedBy: userId,
      });
    } catch (err) {
      return reply.status(400).send({ error: 'Bad Request', message: err.message });
    }

    return reply.status(201).send({ member });
  });

  // GET /v1/team/:userId — single member (AFTER static routes)
  app.get('/v1/team/:userId', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { userId } = req.params;

    const member = await getMember(pool, workspaceId, userId);
    if (!member) {
      return reply.status(404).send({ error: 'Not Found', message: 'Member not found' });
    }

    return reply.send({ member });
  });

  // PUT /v1/team/:userId/role — change role
  app.put('/v1/team/:userId/role', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, userId: currentUserId, role: currentRole } = req.authSession;
    const { userId } = req.params;
    const { role } = req.body ?? {};

    if (currentRole !== 'admin' && currentRole !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins and owners can change member roles' });
    }

    if (!role || !VALID_ROLES.includes(role)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `role must be one of: ${VALID_ROLES.join(', ')}`,
      });
    }

    // Only owners can make others owners
    if (role === 'owner' && currentRole !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only owners can assign the owner role' });
    }

    // Cannot demote yourself from owner if you are the only owner
    if (userId === currentUserId && currentRole === 'owner' && role !== 'owner') {
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS count FROM workspace_members WHERE workspace_id = $1 AND role = 'owner'`,
        [workspaceId],
      );
      if (parseInt(rows[0].count, 10) <= 1) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Cannot change role: you are the only owner of this workspace',
        });
      }
    }

    let member;
    try {
      member = await updateMemberRole(pool, workspaceId, userId, role);
    } catch (err) {
      return reply.status(400).send({ error: 'Bad Request', message: err.message });
    }

    if (!member) {
      return reply.status(404).send({ error: 'Not Found', message: 'Member not found' });
    }

    return reply.send({ member });
  });

  // DELETE /v1/team/:userId — remove member
  app.delete('/v1/team/:userId', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, userId: currentUserId, role: currentRole } = req.authSession;
    const { userId } = req.params;

    if (currentRole !== 'admin' && currentRole !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins and owners can remove team members' });
    }

    // Can't remove a member with higher privilege (admins can't remove owners)
    if (currentRole === 'admin') {
      const target = await getMember(pool, workspaceId, userId);
      if (target && (target.role === 'owner' || target.role === 'admin')) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Admins cannot remove owners or other admins' });
      }
    }

    let removed;
    try {
      removed = await removeMember(pool, workspaceId, userId);
    } catch (err) {
      return reply.status(400).send({ error: 'Bad Request', message: err.message });
    }

    if (!removed) {
      return reply.status(404).send({ error: 'Not Found', message: 'Member not found' });
    }

    return reply.status(204).send();
  });
}
