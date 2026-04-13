import type { AssetDraft, AssetRecord } from '../../assets/types';
import { canUseBrowserStorage, readStorageItem, writeStorageItem } from '../../shared/browser/storage';
import { getRepositoryContext } from '../context';
import type { AssetRepository } from '../types';
import { emitAssetLibraryChanged } from './events';

const ASSET_LIBRARY_KEY = 'smx-studio-v4:asset-library';
const ASSET_OBJECT_STORE_KEY = 'smx-studio-v4:asset-object-store';

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeStorageMode(asset: Pick<AssetRecord, 'storageMode' | 'sourceType'>): AssetRecord['storageMode'] {
  if (asset.storageMode === 'object-storage' || asset.storageMode === 'remote-url') return asset.storageMode;
  if (asset.storageMode === 'inline') return 'object-storage';
  if (asset.storageMode === 'remote') return 'remote-url';
  return asset.sourceType === 'url' ? 'remote-url' : 'object-storage';
}

function readObjectStore(): Record<string, string> {
  if (!canUseBrowserStorage()) return {};
  const raw = readStorageItem(ASSET_OBJECT_STORE_KEY, '');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeObjectStore(store: Record<string, string>): void {
  if (!canUseBrowserStorage()) return;
  writeStorageItem(ASSET_OBJECT_STORE_KEY, JSON.stringify(store));
}

function hydrateAsset(asset: AssetRecord, objectStore: Record<string, string>): AssetRecord {
  const storageMode = normalizeStorageMode(asset);
  const resolvedPublicUrl = asset.publicUrl ?? (storageMode === 'remote-url' ? asset.src : undefined);
  const resolvedStoredObject = storageMode === 'object-storage' && asset.storageKey ? objectStore[asset.storageKey] : undefined;
  return {
    ...asset,
    storageMode,
    publicUrl: resolvedPublicUrl,
    src: resolvedPublicUrl ?? resolvedStoredObject ?? asset.src,
    clientId: asset.clientId ?? 'client_default',
    ownerUserId: asset.ownerUserId ?? 'anonymous',
    accessScope: asset.accessScope ?? 'client',
  };
}

function normalizeStoredAsset(asset: AssetRecord): AssetRecord {
  return hydrateAsset(asset, readObjectStore());
}

function readAll(): AssetRecord[] {
  if (!canUseBrowserStorage()) return [];
  const raw = readStorageItem(ASSET_LIBRARY_KEY, '');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AssetRecord[];
    return Array.isArray(parsed) ? parsed.map(normalizeStoredAsset) : [];
  } catch {
    return [];
  }
}

function writeAll(assets: AssetRecord[]): void {
  if (!canUseBrowserStorage()) return;
  writeStorageItem(ASSET_LIBRARY_KEY, JSON.stringify(assets));
}

function canViewAsset(asset: AssetRecord, clientId: string, ownerUserId: string, canViewClientAssets: boolean): boolean {
  if (asset.clientId !== clientId) return false;
  return asset.accessScope === 'client' || asset.ownerUserId === ownerUserId || canViewClientAssets;
}

function canManageAsset(asset: AssetRecord, ownerUserId: string, canManageClientAssets: boolean): boolean {
  if (asset.ownerUserId === ownerUserId) return true;
  return asset.accessScope === 'client' && canManageClientAssets;
}

function findDuplicateAsset(assets: AssetRecord[], input: AssetDraft, clientId: string): AssetRecord | undefined {
  const normalizedOrigin = input.originUrl?.trim();
  return assets.find((asset) => {
    if (asset.clientId !== clientId) return false;
    if (input.fingerprint && asset.fingerprint && asset.fingerprint === input.fingerprint) return true;
    if (normalizedOrigin && asset.originUrl?.trim() === normalizedOrigin && asset.kind === input.kind) return true;
    return false;
  });
}

function persistObjectPayload(input: AssetDraft): void {
  if (!input.storagePayload || !input.storageKey) return;
  const objectStore = readObjectStore();
  objectStore[input.storageKey] = input.storagePayload;
  writeObjectStore(objectStore);
}

function removeObjectPayload(asset: AssetRecord): void {
  if (!asset.storageKey) return;
  const objectStore = readObjectStore();
  if (!(asset.storageKey in objectStore)) return;
  delete objectStore[asset.storageKey];
  writeObjectStore(objectStore);
}

function stripTransientInput(input: AssetDraft): AssetDraft {
  const { storagePayload: _storagePayload, ...rest } = input;
  return rest;
}

export const localAssetRepository: AssetRepository = {
  mode: 'local',
  async list() {
    const ctx = getRepositoryContext();
    return readAll()
      .filter((asset) => canViewAsset(asset, ctx.clientId, ctx.ownerUserId, ctx.can('assets:view-client')))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async save(input) {
    const ctx = getRepositoryContext();
    const assets = readAll();
    const duplicate = findDuplicateAsset(assets, input, ctx.clientId);
    if (duplicate && canViewAsset(duplicate, ctx.clientId, ctx.ownerUserId, ctx.can('assets:view-client'))) {
      return duplicate;
    }
    persistObjectPayload(input);
    const normalizedInput = stripTransientInput(input);
    const storedAsset = {
      ...normalizedInput,
      src: normalizedInput.publicUrl ?? (normalizedInput.storageMode === 'remote-url' ? normalizedInput.src : ''),
    };
    const asset: AssetRecord = {
      ...storedAsset,
      id: createId('asset'),
      createdAt: new Date().toISOString(),
      clientId: ctx.clientId,
      ownerUserId: ctx.ownerUserId,
      accessScope: normalizedInput.accessScope ?? (ctx.can('assets:manage-client') ? 'client' : 'private'),
      storageMode: normalizeStorageMode(normalizedInput),
    };
    writeAll([asset, ...assets]);
    emitAssetLibraryChanged('saved');
    return hydrateAsset(asset, readObjectStore());
  },
  async remove(assetId) {
    const ctx = getRepositoryContext();
    const nextAssets: AssetRecord[] = [];
    for (const asset of readAll()) {
      const shouldRemove = asset.id === assetId && asset.clientId === ctx.clientId && canManageAsset(asset, ctx.ownerUserId, ctx.can('assets:manage-client'));
      if (shouldRemove) {
        removeObjectPayload(asset);
        continue;
      }
      nextAssets.push(asset);
    }
    writeAll(nextAssets);
    emitAssetLibraryChanged('removed');
  },
  async rename(assetId, name) {
    const ctx = getRepositoryContext();
    writeAll(readAll().map((asset) => asset.id === assetId && asset.clientId === ctx.clientId && canManageAsset(asset, ctx.ownerUserId, ctx.can('assets:manage-client')) ? { ...asset, name } : asset));
    emitAssetLibraryChanged('renamed');
  },
  async get(assetId) {
    if (!assetId) return undefined;
    const ctx = getRepositoryContext();
    return readAll().find((asset) => asset.id === assetId && canViewAsset(asset, ctx.clientId, ctx.ownerUserId, ctx.can('assets:view-client')));
  },
};
