import { appendAuditEventRecord } from '../data/repository.mjs';
import {
  deleteAssetRecord,
  listAssetFolders,
  listAssets,
  upsertAssetFolder,
} from '../data/postgres-asset-repository.mjs';
import { listClients } from '../data/postgres-client-repository.mjs';

export const assetAdminRepository = {
  appendAuditEventRecord,
  deleteAssetRecord,
  listAssetFolders,
  listAssets,
  listClients,
  upsertAssetFolder,
};
