import { parseJson, serializeJson } from '../postgres-support.mjs';

export function toDomainAssetFolder(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    ownerUserId: row.owner_user_id,
    parentId: row.parent_id ?? undefined,
    name: row.name,
    createdAt: row.created_at ?? undefined,
  };
}

export function toDomainAsset(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    ownerUserId: row.owner_user_id,
    folderId: row.folder_id ?? undefined,
    name: row.name,
    kind: row.kind,
    src: row.src ?? '',
    createdAt: row.created_at ?? undefined,
    mimeType: row.mime_type ?? undefined,
    sourceType: row.source_type ?? undefined,
    storageMode: row.storage_mode ?? undefined,
    storageKey: row.storage_key ?? undefined,
    publicUrl: row.public_url ?? undefined,
    originUrl: row.origin_url ?? undefined,
    fingerprint: row.fingerprint ?? undefined,
    sizeBytes: typeof row.size_bytes === 'number' ? row.size_bytes : undefined,
    width: typeof row.width === 'number' ? row.width : undefined,
    height: typeof row.height === 'number' ? row.height : undefined,
    durationMs: typeof row.duration_ms === 'number' ? row.duration_ms : undefined,
    posterSrc: row.poster_src ?? undefined,
    fontFamily: row.font_family ?? undefined,
    tags: parseJson(row.tags, []),
    accessScope: row.access_scope ?? undefined,
  };
}

export function toAssetFolderUpsertParams(folder) {
  return [
    folder.id,
    folder.clientId,
    folder.ownerUserId,
    folder.parentId ?? null,
    folder.name,
    folder.createdAt ?? null,
  ];
}

export function toAssetUpsertParams(asset) {
  return [
    asset.id,
    asset.clientId,
    asset.ownerUserId,
    asset.folderId ?? null,
    asset.name,
    asset.kind,
    asset.src ?? '',
    asset.mimeType ?? null,
    asset.sourceType ?? null,
    asset.storageMode ?? null,
    asset.storageKey ?? null,
    asset.publicUrl ?? null,
    asset.originUrl ?? null,
    asset.posterSrc ?? null,
    asset.accessScope ?? null,
    serializeJson(asset.tags ?? []),
    asset.sizeBytes ?? null,
    asset.width ?? null,
    asset.height ?? null,
    asset.durationMs ?? null,
    asset.fingerprint ?? null,
    asset.fontFamily ?? null,
    asset.createdAt ?? null,
  ];
}
