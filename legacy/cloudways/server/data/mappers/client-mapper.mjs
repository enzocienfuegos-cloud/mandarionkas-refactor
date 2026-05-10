import { parseJson, serializeJson } from '../postgres-support.mjs';

export function toDomainClient(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brandColor: row.brand_color ?? undefined,
    ownerUserId: row.owner_user_id,
    memberUserIds: parseJson(row.member_user_ids, []),
    members: parseJson(row.members, []),
    invites: parseJson(row.invites, []),
    brands: parseJson(row.brands, []),
  };
}

export function toClientUpsertParams(client) {
  return [
    client.id,
    client.name,
    client.slug,
    client.brandColor ?? null,
    client.ownerUserId,
    serializeJson(client.memberUserIds ?? []),
    serializeJson(client.members ?? []),
    serializeJson(client.invites ?? []),
    serializeJson(client.brands ?? []),
  ];
}
