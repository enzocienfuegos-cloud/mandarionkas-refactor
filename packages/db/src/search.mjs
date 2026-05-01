function normalizeQuery(query) {
  const value = String(query || '').trim().toLowerCase();
  return value.length >= 2 ? value : '';
}

function normalizeType(type) {
  const value = String(type || 'all').trim().toLowerCase();
  return ['all', 'tags', 'campaigns', 'advertisers', 'creatives'].includes(value) ? value : 'all';
}

function normalizeLimit(limit, fallback = 25) {
  return Math.min(Math.max(Number(limit) || fallback, 1), 100);
}

function mapResult(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    subtitle: row.subtitle || undefined,
  };
}

export async function searchWorkspace(client, workspaceId, query, opts = {}) {
  const normalizedQuery = normalizeQuery(query);
  const type = normalizeType(opts?.type);
  const limit = normalizeLimit(opts?.limit, 25);

  if (!workspaceId || !normalizedQuery) {
    return { results: [], total: 0 };
  }

  const params = [workspaceId, `%${normalizedQuery}%`, limit];
  const clauses = [];
  if (type === 'all' || type === 'tags') {
    clauses.push(`
      SELECT
        t.id,
        'tag'::text AS type,
        t.name,
        TRIM(BOTH ' ·' FROM CONCAT(
          COALESCE(c.name, ''),
          CASE WHEN t.format IS NOT NULL THEN CONCAT(' · ', t.format) ELSE '' END
        )) AS subtitle,
        t.created_at
      FROM ad_tags t
      LEFT JOIN campaigns c ON c.id = t.campaign_id
      WHERE t.workspace_id = $1
        AND LOWER(t.name) LIKE $2
    `);
  }

  if (type === 'all' || type === 'campaigns') {
    clauses.push(`
      SELECT
        c.id,
        'campaign'::text AS type,
        c.name,
        COALESCE(adv.name, '') AS subtitle,
        c.created_at
      FROM campaigns c
      LEFT JOIN advertisers adv ON adv.id = c.advertiser_id
      WHERE c.workspace_id = $1
        AND LOWER(c.name) LIKE $2
    `);
  }

  if (type === 'all' || type === 'advertisers') {
    clauses.push(`
      SELECT
        a.id,
        'advertiser'::text AS type,
        a.name,
        COALESCE(a.domain, a.industry, '') AS subtitle,
        a.created_at
      FROM advertisers a
      WHERE a.workspace_id = $1
        AND LOWER(a.name) LIKE $2
    `);
  }

  if (type === 'all' || type === 'creatives') {
    clauses.push(`
      SELECT
        c.id,
        'creative'::text AS type,
        c.name,
        TRIM(BOTH ' ·' FROM CONCAT(
          COALESCE(c.type, ''),
          CASE WHEN c.mime_type IS NOT NULL THEN CONCAT(' · ', c.mime_type) ELSE '' END
        )) AS subtitle,
        c.created_at
      FROM creatives c
      WHERE c.workspace_id = $1
        AND LOWER(c.name) LIKE $2
    `);
  }

  if (!clauses.length) {
    return { results: [], total: 0 };
  }

  const { rows } = await client.query(
    `
      SELECT id, type, name, subtitle
      FROM (
        ${clauses.join('\nUNION ALL\n')}
      ) results
      ORDER BY name ASC
      LIMIT $3
    `,
    params,
  );

  return {
    results: rows.map(mapResult),
    total: rows.length,
  };
}
