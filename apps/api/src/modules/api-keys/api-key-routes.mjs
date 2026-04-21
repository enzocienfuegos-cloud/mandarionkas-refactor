import {
  VALID_SCOPES,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  validateApiKey,
} from '@smx/db/api-keys';

export function buildRequireApiKey(pool, requiredScope = null) {
  return async function requireApiKey(req, reply) {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Bearer token required' });
    }

    const key = await validateApiKey(pool, token, requiredScope);
    if (!key) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired API key' });
    }

    req.apiKeyAuth = {
      key,
      workspaceId: key.workspace_id,
    };
  };
}

export function handleApiKeyRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/api-keys — admin/owner only
  app.get('/v1/api-keys', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, role } = req.authSession;

    if (role !== 'admin' && role !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins and owners can manage API keys' });
    }

    const keys = await listApiKeys(pool, workspaceId);
    return reply.send({ keys });
  });

  // POST /v1/api-keys — create key — admin/owner only
  app.post('/v1/api-keys', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, userId, role } = req.authSession;

    if (role !== 'admin' && role !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins and owners can manage API keys' });
    }

    const { name, scopes, expiresAt } = req.body ?? {};

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name is required' });
    }

    if (scopes !== undefined) {
      if (!Array.isArray(scopes)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'scopes must be an array' });
      }
      const invalidScopes = scopes.filter(s => !VALID_SCOPES.includes(s));
      if (invalidScopes.length > 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Invalid scopes: ${invalidScopes.join(', ')}. Valid scopes: ${VALID_SCOPES.join(', ')}`,
        });
      }
    }

    let createdKey;
    try {
      createdKey = await createApiKey(pool, workspaceId, {
        name: name.trim(),
        scopes: scopes ?? [],
        created_by: userId,
        expires_at: expiresAt ?? null,
      });
    } catch (err) {
      return reply.status(400).send({ error: 'Bad Request', message: err.message });
    }

    // rawKey is only returned once
    return reply.status(201).send({
      key: {
        id: createdKey.id,
        name: createdKey.name,
        prefix: createdKey.prefix,
        scopes: createdKey.scopes,
        created_by: createdKey.created_by,
        expires_at: createdKey.expires_at,
        created_at: createdKey.created_at,
      },
      rawKey: createdKey.raw,
    });
  });

  // DELETE /v1/api-keys/:id — revoke key — admin/owner only
  app.delete('/v1/api-keys/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId, role } = req.authSession;
    const { id } = req.params;

    if (role !== 'admin' && role !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins and owners can manage API keys' });
    }

    const result = await revokeApiKey(pool, workspaceId, id);
    if (!result) {
      return reply.status(404).send({ error: 'Not Found', message: 'API key not found or already revoked' });
    }

    return reply.status(204).send();
  });
}
