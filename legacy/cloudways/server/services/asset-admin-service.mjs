import { objectExists } from '../r2.mjs';
import { assetAdminRepository } from '../contracts/asset-admin-repository.mjs';
import { createAuditActor, createAuditEvent } from './audit-service.mjs';
import { nowIso } from './shared.mjs';

function assertAdmin(sessionRecord, message) {
  if (sessionRecord.user.role !== 'admin') throw new Error(`Forbidden: ${message}`);
}

function toIssueAsset(asset, extra = {}) {
  return {
    id: asset.id,
    name: asset.name,
    folderId: asset.folderId,
    clientId: asset.clientId,
    storageKey: asset.storageKey,
    ...extra,
  };
}

export async function getAssetHousekeepingForSession(sessionRecord) {
  assertAdmin(sessionRecord, 'asset housekeeping requires admin access');
  const [assets, folders, clients] = await Promise.all([
    assetAdminRepository.listAssets(),
    assetAdminRepository.listAssetFolders(),
    assetAdminRepository.listClients(),
  ]);

  const folderIds = new Set(folders.map((folder) => folder.id));
  const clientIds = new Set(clients.map((client) => client.id));
  const objectStorageAssets = assets.filter((asset) => asset.storageMode === 'object-storage');
  const binaryChecks = await Promise.all(objectStorageAssets.map(async (asset) => ({
    asset,
    exists: asset.storageKey ? await objectExists(asset.storageKey) : false,
  })));

  const objectStorageAssetsMissingBinary = binaryChecks
    .filter((entry) => entry.asset.storageKey && !entry.exists)
    .map((entry) => toIssueAsset(entry.asset));

  return {
    ok: true,
    generatedAt: nowIso(),
    issues: {
      assetsMissingFolder: assets
        .filter((asset) => asset.folderId && !folderIds.has(asset.folderId))
        .map((asset) => toIssueAsset(asset)),
      assetsMissingClient: assets
        .filter((asset) => !clientIds.has(asset.clientId))
        .map((asset) => toIssueAsset(asset)),
      foldersMissingParent: folders
        .filter((folder) => folder.parentId && !folderIds.has(folder.parentId))
        .map((folder) => ({ id: folder.id, name: folder.name, parentId: folder.parentId, clientId: folder.clientId })),
      foldersMissingClient: folders
        .filter((folder) => !clientIds.has(folder.clientId))
        .map((folder) => ({ id: folder.id, name: folder.name, clientId: folder.clientId })),
      objectStorageAssetsMissingBinary,
      objectStorageAssetsMissingStorageKey: objectStorageAssets
        .filter((asset) => !asset.storageKey)
        .map((asset) => toIssueAsset(asset)),
      remoteUrlAssetsMissingSource: assets
        .filter((asset) => asset.storageMode === 'remote-url' && !String(asset.src || '').trim())
        .map((asset) => toIssueAsset(asset)),
    },
  };
}

export async function cleanupAssetHousekeepingForSession(sessionRecord) {
  assertAdmin(sessionRecord, 'asset housekeeping requires admin access');
  const [assets, folders, clients] = await Promise.all([
    assetAdminRepository.listAssets(),
    assetAdminRepository.listAssetFolders(),
    assetAdminRepository.listClients(),
  ]);

  const folderIds = new Set(folders.map((folder) => folder.id));
  const clientIds = new Set(clients.map((client) => client.id));
  const removedAssets = [];
  const repairedFolders = [];

  for (const asset of assets) {
    const missingFolder = asset.folderId && !folderIds.has(asset.folderId);
    const missingClient = !clientIds.has(asset.clientId);
    const missingStorageKey = asset.storageMode === 'object-storage' && !asset.storageKey;
    const missingRemoteSource = asset.storageMode === 'remote-url' && !String(asset.src || '').trim();
    if (!(missingFolder || missingClient || missingStorageKey || missingRemoteSource)) continue;
    await assetAdminRepository.deleteAssetRecord(asset.id);
    removedAssets.push({
      id: asset.id,
      name: asset.name,
      storageKey: asset.storageKey,
      reason: missingFolder
        ? 'missing-folder'
        : missingClient
          ? 'missing-client'
          : missingStorageKey
            ? 'missing-storage-key'
            : 'missing-remote-source',
    });
  }

  for (const folder of folders) {
    if (!clientIds.has(folder.clientId)) continue;
    if (folder.parentId && !folderIds.has(folder.parentId)) {
      await assetAdminRepository.upsertAssetFolder({
        ...folder,
        parentId: undefined,
      });
      repairedFolders.push({
        id: folder.id,
        name: folder.name,
        action: 'cleared-missing-parent',
      });
    }
  }

  await assetAdminRepository.appendAuditEventRecord(createAuditEvent({
    action: 'asset.housekeeping.cleanup',
    target: 'asset',
    summary: `${sessionRecord.user.name} ran asset housekeeping cleanup`,
    metadata: {
      removedAssets: removedAssets.length,
      repairedFolders: repairedFolders.length,
    },
    ...createAuditActor(sessionRecord),
  }));

  return {
    ok: true,
    removedAssets,
    repairedFolders,
  };
}
