import {
  appendAuditEventRecord,
} from '../data/repository.mjs';
import {
  deleteAssetRecord,
  getAsset,
  getAssetFolder,
  listAssetFolders,
  listAssets,
  upsertAsset,
  upsertAssetFolder,
} from '../data/postgres-asset-repository.mjs';

// Explicit asset-domain contract. Asset services should only depend on this surface.
export const assetRepository = {
  appendAuditEventRecord,
  deleteAssetRecord,
  getAsset,
  getAssetFolder,
  listAssetFolders,
  listAssets,
  upsertAsset,
  upsertAssetFolder,
};
