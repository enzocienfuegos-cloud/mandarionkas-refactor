import { getPostgresMetadata } from './postgres-client.mjs';

export function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function table(name) {
  return `${quoteIdentifier(getPostgresMetadata().schema)}.${quoteIdentifier(name)}`;
}

export function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

export function serializeJson(value) {
  return JSON.stringify(value ?? null);
}

export function mapUserRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
  };
}

export function mapClientRow(row) {
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

export function mapSessionRow(row) {
  return {
    userId: row.user_id,
    activeClientId: row.active_client_id ?? undefined,
    issuedAt: row.issued_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    persistenceMode: row.persistence_mode ?? 'session',
  };
}

export function mapProjectRow(row) {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at ?? undefined,
    clientId: row.client_id,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    brandId: row.brand_id ?? undefined,
    brandName: row.brand_name ?? undefined,
    campaignName: row.campaign_name ?? undefined,
    accessScope: row.access_scope ?? 'client',
    canvasPresetId: row.canvas_preset_id ?? undefined,
    sceneCount: Number(row.scene_count || 0),
    widgetCount: Number(row.widget_count || 0),
    archivedAt: row.archived_at ?? undefined,
  };
}

export function mapProjectVersionRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    versionNumber: Number(row.version_number || 0),
    savedAt: row.saved_at,
    note: row.note ?? undefined,
  };
}

export function mapRecordRow(row, fallbackFactory) {
  return fallbackFactory(row);
}
