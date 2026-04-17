import type { AssetDraft, AssetFolder, AssetRecord } from '../../assets/types';
import { setAssetRepositoryMode } from '../mode';
import { getRepositoryServices } from '../services';
export { ingestAssetFile, ingestAssetUrl } from './ingest';
export { createRemoteAssetFolder, listRemoteAssetFolders } from './api';

export { setAssetRepositoryMode };

export function getAssetRepository() {
  return getRepositoryServices().assets;
}

export async function listAssets(): Promise<AssetRecord[]> { return getAssetRepository().list(); }
export async function saveAsset(input: AssetDraft): Promise<AssetRecord> { return getAssetRepository().save(input); }
export async function removeAsset(assetId: string): Promise<void> { return getAssetRepository().remove(assetId); }
export async function renameAsset(assetId: string, name: string): Promise<void> { return getAssetRepository().rename(assetId, name); }
export async function getAsset(assetId?: string): Promise<AssetRecord | undefined> { return getAssetRepository().get(assetId); }
export type { AssetFolder };
