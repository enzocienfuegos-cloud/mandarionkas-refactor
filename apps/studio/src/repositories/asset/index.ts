import type { AssetDraft, AssetFolder, AssetQualityPreference, AssetRecord } from '../../assets/types';
import { getRepositoryServices } from '../services';
export { ingestAssetFile, ingestAssetUrl } from './ingest';

export function getAssetRepository() {
  return getRepositoryServices().assets;
}

export async function listAssets(): Promise<AssetRecord[]> { return getAssetRepository().list(); }
export async function saveAsset(input: AssetDraft): Promise<AssetRecord> { return getAssetRepository().save(input); }
export async function removeAsset(assetId: string): Promise<void> { return getAssetRepository().remove(assetId); }
export async function renameAsset(assetId: string, name: string): Promise<void> { return getAssetRepository().rename(assetId, name); }
export async function moveAsset(assetId: string, folderId?: string): Promise<void> { return getAssetRepository().move(assetId, folderId); }
export async function updateAssetQuality(assetId: string, qualityPreference: AssetQualityPreference): Promise<void> {
  return getAssetRepository().updateQuality(assetId, qualityPreference);
}
export async function reprocessAsset(assetId: string): Promise<AssetRecord | undefined> {
  return getAssetRepository().reprocess(assetId);
}
export async function getAsset(assetId?: string): Promise<AssetRecord | undefined> { return getAssetRepository().get(assetId); }
export async function listAssetFolders(): Promise<AssetFolder[]> { return getAssetRepository().listFolders(); }
export async function createAssetFolder(name: string, parentId?: string): Promise<AssetFolder> { return getAssetRepository().createFolder(name, parentId); }
export async function renameAssetFolder(folderId: string, name: string): Promise<AssetFolder | undefined> { return getAssetRepository().renameFolder(folderId, name); }
export async function deleteAssetFolder(folderId: string): Promise<void> { return getAssetRepository().deleteFolder(folderId); }
export type { AssetFolder };
