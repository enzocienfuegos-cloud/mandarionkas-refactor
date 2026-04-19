import { completeAssetUpload, requestAssetUploadPreparation } from '../storage-api';
import { optimizeImageFileForUpload } from '../image-optimization';
import { createAssetUploadMetadataFromFile } from '../pipeline';
import { optimizeVideoFileForUpload } from '../video-optimization';
import type { AssetStorageProvider } from '../storage-provider';
import type { AssetDerivativeSet } from '../types';

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

function mapPreparedDerivatives(
  derivatives?: Partial<Record<'original' | 'low' | 'mid' | 'high' | 'thumbnail' | 'poster', { metadata: NonNullable<AssetDerivativeSet[keyof AssetDerivativeSet]> }>>,
): AssetDerivativeSet | undefined {
  if (!derivatives) return undefined;
  return {
    original: derivatives.original?.metadata,
    low: derivatives.low?.metadata,
    mid: derivatives.mid?.metadata,
    high: derivatives.high?.metadata,
    thumbnail: derivatives.thumbnail?.metadata,
    poster: derivatives.poster?.metadata,
  };
}

export const apiAssetStorageProvider: AssetStorageProvider = {
  async prepareUpload(input) {
    const optimizedImage = await optimizeImageFileForUpload(input.file);
    const metadata = await createAssetUploadMetadataFromFile({ ...input, file: optimizedImage?.uploadFile ?? input.file });
    const optimizedVideo = optimizedImage ? null : await optimizeVideoFileForUpload({
      file: input.file,
      width: metadata.width,
      height: metadata.height,
      durationMs: metadata.durationMs,
    });
    const optimized = optimizedImage ?? optimizedVideo;
    const uploadFile = optimized?.uploadFile ?? input.file;
    const localFiles = optimizedImage
      ? {
          upload: uploadFile,
          original: optimizedImage.derivatives.original?.file,
          low: optimizedImage.derivatives.low?.file,
          mid: optimizedImage.derivatives.mid?.file,
          high: optimizedImage.derivatives.high?.file,
          thumbnail: optimizedImage.derivatives.thumbnail?.file,
        }
      : optimizedVideo
        ? {
            upload: uploadFile,
            original: optimizedVideo.derivatives.original?.file,
            low: optimizedVideo.derivatives.low?.file,
            mid: optimizedVideo.derivatives.mid?.file,
            high: optimizedVideo.derivatives.high?.file,
            poster: optimizedVideo.derivatives.poster?.file,
          }
        : {
            upload: input.file,
            original: input.file,
          };

    const prepared = await requestAssetUploadPreparation({
      filename: uploadFile.name,
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

    return {
      ...prepared,
      qualityPreference: optimized?.qualityPreference ?? prepared.qualityPreference,
      derivatives: optimized ? mapPreparedDerivatives(optimized.derivatives) : prepared.derivatives,
      localFiles,
    };
  },

  async completeUpload(input) {
    const { prepared, file, onProgress } = input;
    const uploadFile = prepared.localFiles?.upload ?? file;

    if (prepared.uploadUrl) {
      await uploadFileToSignedUrl(prepared.uploadUrl, uploadFile, prepared.mimeType, onProgress);
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
      optimizedUrl: prepared.optimizedUrl,
      qualityPreference: prepared.qualityPreference,
      sourceType: 'upload',
    });

    if (!remoteAsset) {
      throw new Error('Complete upload failed: no asset returned');
    }

    return remoteAsset;
  },
};
