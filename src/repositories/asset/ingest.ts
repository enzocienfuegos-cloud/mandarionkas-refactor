import type { AssetAccessScope, AssetRecord } from '../../assets/types';
import { createAssetDraftFromUrl } from '../../assets/pipeline';
import { getAssetStorageProvider } from '../../assets/providers';
import { getRepositoryServices } from '../services';

function getAssetRepository() {
  return getRepositoryServices().assets;
}

export async function ingestAssetUrl(input: {
  url: string;
  name?: string;
  accessScope?: AssetAccessScope;
  tags?: string[];
  folderId?: string;
}): Promise<AssetRecord> {
  const draft = await createAssetDraftFromUrl(input);
  return getAssetRepository().save(draft);
}

export async function ingestAssetFile(input: {
  file: File;
  name?: string;
  accessScope?: AssetAccessScope;
  tags?: string[];
  folderId?: string;
  onProgress?: (progress: { loadedBytes: number; totalBytes: number; percentage: number }) => void;
}): Promise<AssetRecord> {
  const provider = getAssetStorageProvider();
  const prepared = await provider.prepareUpload(input);
  const uploaded = await provider.completeUpload({ prepared, file: input.file, onProgress: input.onProgress });

  if ('id' in uploaded && 'createdAt' in uploaded && 'clientId' in uploaded && 'ownerUserId' in uploaded) {
    return uploaded;
  }

  return getAssetRepository().save(uploaded);
}
