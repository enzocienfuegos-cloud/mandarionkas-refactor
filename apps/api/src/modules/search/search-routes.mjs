import {
  sanitizeQuery,
  searchAll,
  searchTags,
  searchCampaigns,
  searchAdvertisers,
  searchCreatives,
} from '@smx/db/search';

const VALID_TYPES = ['all', 'tags', 'campaigns', 'advertisers', 'creatives'];

export function handleSearchRoutes(app, { requireWorkspace, pool }) {
  // GET /v1/search?q=&type=&limit=
  app.get('/v1/search', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { q, type = 'all', limit } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'q must be at least 2 characters',
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `type must be one of: ${VALID_TYPES.join(', ')}`,
      });
    }

    const safeLimit = limit !== undefined ? parseInt(limit, 10) : 10;
    if (isNaN(safeLimit) || safeLimit < 1 || safeLimit > 50) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'limit must be between 1 and 50',
      });
    }

    const cleanQuery = sanitizeQuery(q);
    if (cleanQuery.length < 2) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'q must be at least 2 meaningful characters',
      });
    }

    let results;
    switch (type) {
      case 'tags':
        results = { tags: await searchTags(pool, workspaceId, cleanQuery, safeLimit) };
        break;
      case 'campaigns':
        results = { campaigns: await searchCampaigns(pool, workspaceId, cleanQuery, safeLimit) };
        break;
      case 'advertisers':
        results = { advertisers: await searchAdvertisers(pool, workspaceId, cleanQuery, safeLimit) };
        break;
      case 'creatives':
        results = { creatives: await searchCreatives(pool, workspaceId, cleanQuery, safeLimit) };
        break;
      case 'all':
      default:
        results = await searchAll(pool, workspaceId, cleanQuery, { limit: safeLimit });
        break;
    }

    return reply.send({ query: cleanQuery, type, results });
  });
}
