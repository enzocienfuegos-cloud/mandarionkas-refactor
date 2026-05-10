import { executePostgresQuery } from './postgres-client.mjs';
import { table } from './postgres-support.mjs';
import {
  toAssetFolderUpsertParams,
  toAssetUpsertParams,
  toDomainAsset,
  toDomainAssetFolder,
} from './mappers/asset-mapper.mjs';

export async function listAssetFolders() {
  const result = await executePostgresQuery(`SELECT * FROM ${table('asset_folders')} ORDER BY created_at DESC NULLS LAST, id DESC`);
  return (result.rows ?? []).map(toDomainAssetFolder);
}

export async function getAssetFolder(folderId) {
  const result = await executePostgresQuery(`SELECT * FROM ${table('asset_folders')} WHERE id = $1 LIMIT 1`, [folderId]);
  const row = result.rows?.[0];
  return row ? toDomainAssetFolder(row) : null;
}

export async function upsertAssetFolder(folder) {
  await executePostgresQuery(
    `INSERT INTO ${table('asset_folders')} (
      id, client_id, owner_user_id, parent_id, name, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id) DO UPDATE SET
      client_id = EXCLUDED.client_id,
      owner_user_id = EXCLUDED.owner_user_id,
      parent_id = EXCLUDED.parent_id,
      name = EXCLUDED.name,
      created_at = EXCLUDED.created_at`,
    toAssetFolderUpsertParams(folder)
  );
  return folder;
}

export async function listAssets() {
  const result = await executePostgresQuery(`SELECT * FROM ${table('assets')} ORDER BY created_at DESC NULLS LAST, id DESC`);
  return (result.rows ?? []).map(toDomainAsset);
}

export async function getAsset(assetId) {
  const result = await executePostgresQuery(`SELECT * FROM ${table('assets')} WHERE id = $1 LIMIT 1`, [assetId]);
  const row = result.rows?.[0];
  return row ? toDomainAsset(row) : null;
}

export async function upsertAsset(asset) {
  await executePostgresQuery(
    `INSERT INTO ${table('assets')} (
      id, client_id, owner_user_id, folder_id, name, kind, src, mime_type, source_type, storage_mode,
      storage_key, public_url, origin_url, poster_src, access_scope, tags, size_bytes, width, height,
      duration_ms, fingerprint, font_family, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18, $19, $20, $21, $22, $23)
    ON CONFLICT (id) DO UPDATE SET
      client_id = EXCLUDED.client_id,
      owner_user_id = EXCLUDED.owner_user_id,
      folder_id = EXCLUDED.folder_id,
      name = EXCLUDED.name,
      kind = EXCLUDED.kind,
      src = EXCLUDED.src,
      mime_type = EXCLUDED.mime_type,
      source_type = EXCLUDED.source_type,
      storage_mode = EXCLUDED.storage_mode,
      storage_key = EXCLUDED.storage_key,
      public_url = EXCLUDED.public_url,
      origin_url = EXCLUDED.origin_url,
      poster_src = EXCLUDED.poster_src,
      access_scope = EXCLUDED.access_scope,
      tags = EXCLUDED.tags,
      size_bytes = EXCLUDED.size_bytes,
      width = EXCLUDED.width,
      height = EXCLUDED.height,
      duration_ms = EXCLUDED.duration_ms,
      fingerprint = EXCLUDED.fingerprint,
      font_family = EXCLUDED.font_family,
      created_at = EXCLUDED.created_at`,
    toAssetUpsertParams(asset)
  );
  return asset;
}

export async function deleteAssetRecord(assetId) {
  const asset = await getAsset(assetId);
  if (!asset) return null;
  await executePostgresQuery(`DELETE FROM ${table('assets')} WHERE id = $1`, [assetId]);
  return asset;
}
