import { serializeJson } from '../postgres-support.mjs';

export function toDomainProject(row) {
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

export function toDomainProjectVersion(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    versionNumber: Number(row.version_number || 0),
    savedAt: row.saved_at,
    note: row.note ?? undefined,
  };
}

export function toProjectUpsertParams(project) {
  return [
    project.id,
    project.name,
    project.updatedAt ?? null,
    project.clientId,
    project.ownerUserId,
    project.ownerName,
    project.brandId ?? null,
    project.brandName ?? null,
    project.campaignName ?? null,
    project.accessScope ?? 'client',
    project.canvasPresetId ?? null,
    project.sceneCount ?? 0,
    project.widgetCount ?? 0,
    project.archivedAt ?? null,
  ];
}

export function toProjectStateUpsertParams(projectId, state) {
  return [projectId, serializeJson(state)];
}

export function toProjectVersionInsertParams(version) {
  return [
    version.id,
    version.projectId,
    version.projectName,
    version.versionNumber ?? 0,
    version.savedAt ?? null,
    version.note ?? null,
  ];
}

export function toProjectVersionStateInsertParams(versionId, state) {
  return [versionId, serializeJson(state)];
}
