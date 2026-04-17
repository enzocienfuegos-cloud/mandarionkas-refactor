import { completeAssetUpload, requestAssetUploadPreparation } from '../storage-api';
import { createAssetUploadMetadataFromFile } from '../pipeline';
import type { AssetStorageProvider } from '../storage-provider';

async function uploadFileToSignedUrl(
  uploadUrl: string,
  file: File,
  mimeType?: string,
  onProgress?: (progress: { loadedBytes: number; totalBytes: number; percentage: number }) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl, true);
    if (mimeType) request.setRequestHeader('Content-Type', mimeType);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress({
        loadedBytes: event.loaded,
        totalBytes: event.total,
        percentage: Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))),
      });
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.({
          loadedBytes: file.size,
          totalBytes: file.size,
          percentage: 100,
        });
        resolve();
        return;
      }
      reject(new Error(`Signed upload failed: ${request.status}${request.responseText ? ` ${request.responseText}` : ''}`));
    };
    request.onerror = () => reject(new Error('Signed upload failed: network error'));
    request.send(file);
  });
}

export const apiAssetStorageProvider: AssetStorageProvider = {
  async prepareUpload(input) {
    const metadata = await createAssetUploadMetadataFromFile(input);

    const prepared = await requestAssetUploadPreparation({
      filename: input.file.name,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.sizeBytes,
      kind: metadata.kind,
      requestedName: metadata.name,
      accessScope: metadata.accessScope,
      tags: metadata.tags,
      folderId: input.folderId,
      fontFamily: metadata.fontFamily,
    });

    if (!prepared) {
      throw new Error('Asset upload preparation failed');
    }

    return prepared;
  },

  async completeUpload(input) {
    const { prepared, file, onProgress } = input;

    if (prepared.uploadUrl) {
      await uploadFileToSignedUrl(prepared.uploadUrl, file, prepared.mimeType, onProgress);
    }

    const remoteAsset = await completeAssetUpload({
      assetId: prepared.assetId,
      name: prepared.name,
      kind: prepared.kind,
      mimeType: prepared.mimeType,
      sizeBytes: prepared.sizeBytes,
      width: prepared.width,
      height: prepared.height,
      durationMs: prepared.durationMs,
      accessScope: prepared.accessScope,
      tags: prepared.tags,
      folderId: prepared.folderId,
      fingerprint: prepared.fingerprint,
      fontFamily: prepared.fontFamily,
      storageMode: prepared.storageMode,
      storageKey: prepared.storageKey,
      publicUrl: prepared.publicUrl,
      sourceType: 'upload',
    });

    if (!remoteAsset) {
      throw new Error('Complete upload failed: no asset returned');
    }

    return remoteAsset;
  },
};
