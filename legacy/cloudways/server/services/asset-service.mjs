import { randomUUID } from 'node:crypto';
import { deleteObject } from '../r2.mjs';
import { assetRepository } from '../contracts/asset-repository.mjs';
import { createAuditActor, createAuditEvent } from './audit-service.mjs';
import { assertPermission, nowIso } from './shared.mjs';

function canViewAsset(sessionRecord, asset) {
  if (sessionRecord.user.role === 'admin') return true;
  if (asset.ownerUserId === sessionRecord.user.id) return true;
  return asset.clientId === sessionRecord.activeClientId && asset.accessScope !== 'private';
}

function canEditAsset(sessionRecord, asset) {
  if (sessionRecord.user.role === 'admin') return true;
  if (asset.ownerUserId === sessionRecord.user.id) return true;
  return asset.clientId === sessionRecord.activeClientId && sessionRecord.user.role === 'editor';
}

function buildAuditInput(sessionRecord, input) {
  return createAuditEvent({
    ...input,
    ...createAuditActor(sessionRecord),
  });
}

function syncAssetFolderInSession(sessionRecord, folder) {
  if (!sessionRecord?.db) return;
  sessionRecord.db.assetFolders ??= [];
  const index = sessionRecord.db.assetFolders.findIndex((entry) => entry.id === folder.id);
  if (index >= 0) {
    sessionRecord.db.assetFolders[index] = folder;
  } else {
    sessionRecord.db.assetFolders.unshift(folder);
  }
}

function syncAssetInSession(sessionRecord, asset) {
  if (!sessionRecord?.db) return;
  sessionRecord.db.assets ??= [];
  const index = sessionRecord.db.assets.findIndex((entry) => entry.id === asset.id);
  if (index >= 0) {
    sessionRecord.db.assets[index] = asset;
  } else {
    sessionRecord.db.assets.unshift(asset);
  }
}

export async function listAssetsForSession(sessionRecord) {
  assertPermission(sessionRecord, 'assets:view-client');
  const assets = await assetRepository.listAssets();
  return assets.filter((asset) => canViewAsset(sessionRecord, asset));
}

export async function listAssetFoldersForSession(sessionRecord) {
  assertPermission(sessionRecord, 'assets:view-client');
  const folders = await assetRepository.listAssetFolders();
  return folders.filter((folder) => {
    return folder.clientId === sessionRecord.activeClientId && (
      sessionRecord.user.role === 'admin' ||
      folder.ownerUserId === sessionRecord.user.id ||
      sessionRecord.user.role === 'editor'
    );
  });
}

export async function createAssetFolderForSession(sessionRecord, name, parentId) {
  assertPermission(sessionRecord, 'assets:create');
  const normalizedName = String(name || '').trim();
  if (!normalizedName) throw new Error('Folder name is required');
  const normalizedParentId = typeof parentId === 'string' && parentId.trim() ? parentId.trim() : undefined;
  if (normalizedParentId) {
    const parentFolder = await assetRepository.getAssetFolder(normalizedParentId);
    if (!parentFolder) throw new Error('Parent folder not found');
    if (parentFolder.clientId !== sessionRecord.activeClientId) throw new Error('Forbidden: parent folder access denied');
  }
  const folder = {
    id: randomUUID(),
    name: normalizedName,
    createdAt: nowIso(),
    clientId: sessionRecord.activeClientId,
    ownerUserId: sessionRecord.user.id,
    parentId: normalizedParentId,
  };
  await assetRepository.upsertAssetFolder(folder);
  syncAssetFolderInSession(sessionRecord, folder);
  await assetRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'asset.folder.create',
    target: 'asset-folder',
    targetId: folder.id,
    summary: `${sessionRecord.user.name} created asset folder ${folder.name}`,
  }));
  return folder;
}

export async function saveAssetForSession(sessionRecord, asset) {
  assertPermission(sessionRecord, 'assets:create');
  const normalized = {
    ...asset,
    clientId: sessionRecord.activeClientId,
    ownerUserId: sessionRecord.user.id,
  };
  await assetRepository.upsertAsset(normalized);
  syncAssetInSession(sessionRecord, normalized);
  await assetRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'asset.create',
    target: 'asset',
    targetId: normalized.id,
    summary: `${sessionRecord.user.name} created asset ${normalized.name}`,
    metadata: { kind: normalized.kind, storageMode: normalized.storageMode },
  }));
  return normalized;
}

export async function getAssetForSession(sessionRecord, assetId) {
  assertPermission(sessionRecord, 'assets:view-client');
  const asset = await assetRepository.getAsset(assetId);
  if (!asset || !canViewAsset(sessionRecord, asset)) return undefined;
  return asset;
}

export async function renameAssetForSession(sessionRecord, assetId, name) {
  assertPermission(sessionRecord, 'assets:update');
  const asset = await assetRepository.getAsset(assetId);
  if (!asset) return undefined;
  if (!canEditAsset(sessionRecord, asset)) throw new Error('Forbidden: cannot rename asset');
  const nextAsset = {
    ...asset,
    name: name || asset.name,
  };
  await assetRepository.upsertAsset(nextAsset);
  syncAssetInSession(sessionRecord, nextAsset);
  await assetRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'asset.rename',
    target: 'asset',
    targetId: nextAsset.id,
    summary: `${sessionRecord.user.name} renamed asset to ${nextAsset.name}`,
  }));
  return nextAsset;
}

export async function deleteAssetForSession(sessionRecord, assetId, options = {}) {
  assertPermission(sessionRecord, 'assets:delete');
  const asset = await assetRepository.getAsset(assetId);
  if (!asset) return false;
  if (!canEditAsset(sessionRecord, asset)) throw new Error('Forbidden: cannot delete asset');
  const removedAsset = await assetRepository.deleteAssetRecord(assetId);
  if (!removedAsset) return false;
  if (sessionRecord.db?.assets) {
    sessionRecord.db.assets = sessionRecord.db.assets.filter((entry) => entry.id !== assetId);
  }
  await assetRepository.appendAuditEventRecord(buildAuditInput(sessionRecord, {
    action: 'asset.delete',
    target: 'asset',
    targetId: asset.id,
    summary: `${sessionRecord.user.name} deleted asset ${asset.name}`,
    metadata: { purgeBinary: Boolean(options?.purgeBinary) },
  }));
  await (options?.purgeBinary && asset.storageKey ? deleteObject(asset.storageKey) : Promise.resolve());
  return true;
}
