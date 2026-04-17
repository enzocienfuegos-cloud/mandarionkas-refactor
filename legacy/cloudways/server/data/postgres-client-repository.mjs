import { executePostgresQuery } from './postgres-client.mjs';
import { table } from './postgres-support.mjs';
import { toClientUpsertParams, toDomainClient } from './mappers/client-mapper.mjs';

export async function listClients() {
  const result = await executePostgresQuery(`SELECT * FROM ${table('clients')} ORDER BY name ASC, id ASC`);
  return (result.rows ?? []).map(toDomainClient);
}

export async function getClient(clientId) {
  const result = await executePostgresQuery(`SELECT * FROM ${table('clients')} WHERE id = $1 LIMIT 1`, [clientId]);
  const row = result.rows?.[0];
  return row ? toDomainClient(row) : null;
}

export async function upsertClient(client) {
  await executePostgresQuery(
    `INSERT INTO ${table('clients')} (
      id, name, slug, brand_color, owner_user_id, member_user_ids, members, invites, brands
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      brand_color = EXCLUDED.brand_color,
      owner_user_id = EXCLUDED.owner_user_id,
      member_user_ids = EXCLUDED.member_user_ids,
      members = EXCLUDED.members,
      invites = EXCLUDED.invites,
      brands = EXCLUDED.brands`,
    toClientUpsertParams(client)
  );
  return client;
}
