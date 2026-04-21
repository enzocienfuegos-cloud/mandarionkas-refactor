export const MIN_QUERY_LENGTH = 2;

export function sanitizeQuery(q) {
  if (!q || typeof q !== 'string') return '';
  return q.trim().replace(/[^\w\s\-"']/g, ' ').replace(/\s+/g, ' ').trim();
}

export function scoreLabel(rank) {
  const r = Number(rank) || 0;
  if (r >= 0.6) return 'high';
  if (r >= 0.3) return 'medium';
  return 'low';
}

export async function searchTags(pool, workspaceId, q, limit = 20) {
  const safeQ = sanitizeQuery(q);
  if (safeQ.length < MIN_QUERY_LENGTH) return [];
  const safeLimit = Math.min(Number(limit) || 20, 100);

  const { rows } = await pool.query(
    `SELECT t.id, t.name, t.format, t.status, t.campaign_id,
            ts_rank(t.search_vec, websearch_to_tsquery('english', $2)) AS rank
     FROM ad_tags t
     WHERE t.workspace_id = $1
       AND t.search_vec @@ websearch_to_tsquery('english', $2)
     ORDER BY rank DESC
     LIMIT $3`,
    [workspaceId, safeQ, safeLimit],
  );
  return rows.map(r => ({ ...r, type: 'tag', scoreLabel: scoreLabel(r.rank) }));
}

export async function searchCampaigns(pool, workspaceId, q, limit = 20) {
  const safeQ = sanitizeQuery(q);
  if (safeQ.length < MIN_QUERY_LENGTH) return [];
  const safeLimit = Math.min(Number(limit) || 20, 100);

  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.status, c.advertiser_id, c.start_date, c.end_date,
            ts_rank(c.search_vec, websearch_to_tsquery('english', $2)) AS rank
     FROM campaigns c
     WHERE c.workspace_id = $1
       AND c.search_vec @@ websearch_to_tsquery('english', $2)
     ORDER BY rank DESC
     LIMIT $3`,
    [workspaceId, safeQ, safeLimit],
  );
  return rows.map(r => ({ ...r, type: 'campaign', scoreLabel: scoreLabel(r.rank) }));
}

export async function searchAdvertisers(pool, workspaceId, q, limit = 20) {
  const safeQ = sanitizeQuery(q);
  if (safeQ.length < MIN_QUERY_LENGTH) return [];
  const safeLimit = Math.min(Number(limit) || 20, 100);

  const { rows } = await pool.query(
    `SELECT a.id, a.name, a.domain, a.industry, a.status,
            ts_rank(a.search_vec, websearch_to_tsquery('english', $2)) AS rank
     FROM advertisers a
     WHERE a.workspace_id = $1
       AND a.search_vec @@ websearch_to_tsquery('english', $2)
     ORDER BY rank DESC
     LIMIT $3`,
    [workspaceId, safeQ, safeLimit],
  );
  return rows.map(r => ({ ...r, type: 'advertiser', scoreLabel: scoreLabel(r.rank) }));
}

export async function searchCreatives(pool, workspaceId, q, limit = 20) {
  const safeQ = sanitizeQuery(q);
  if (safeQ.length < MIN_QUERY_LENGTH) return [];
  const safeLimit = Math.min(Number(limit) || 20, 100);

  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.type, c.approval_status, c.transcode_status,
            ts_rank(c.search_vec, websearch_to_tsquery('english', $2)) AS rank
     FROM creatives c
     WHERE c.workspace_id = $1
       AND c.search_vec @@ websearch_to_tsquery('english', $2)
     ORDER BY rank DESC
     LIMIT $3`,
    [workspaceId, safeQ, safeLimit],
  );
  return rows.map(r => ({ ...r, type: 'creative', scoreLabel: scoreLabel(r.rank) }));
}

export async function searchAll(pool, workspaceId, q, opts = {}) {
  const { limit = 10 } = opts;
  const safeQ = sanitizeQuery(q);
  if (safeQ.length < MIN_QUERY_LENGTH) return { tags: [], campaigns: [], advertisers: [], creatives: [] };

  const [tags, campaigns, advertisers, creatives] = await Promise.all([
    searchTags(pool, workspaceId, safeQ, limit),
    searchCampaigns(pool, workspaceId, safeQ, limit),
    searchAdvertisers(pool, workspaceId, safeQ, limit),
    searchCreatives(pool, workspaceId, safeQ, limit),
  ]);

  return { tags, campaigns, advertisers, creatives };
}
