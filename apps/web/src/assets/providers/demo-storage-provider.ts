import { createAssetUploadMetadataFromFile, readFileAsDataUrl } from '../pipeline';
import { materializeDerivativeSetWithDataUrls, optimizeImageFileForUpload } from '../image-optimization';
import { optimizeVideoFileForUpload } from '../video-optimization';
import type { AssetStorageProvider } from '../storage-provider';
import type { AssetDerivativeSet } from '../types';

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function sanitizeFileName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
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

export const demoAssetStorageProvider: AssetStorageProvider = {
  mode: 'demo',
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
    const assetId = createId('asset');
    const storageKey = `demo/${new Date().toISOString().slice(0, 10)}/${assetId}/${sanitizeFileName(metadata.name) || 'asset'}`;
    return {
      assetId,
      name: metadata.name,
      kind: metadata.kind,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.sizeBytes,
      width: metadata.width,
      height: metadata.height,
      durationMs: metadata.durationMs,
      fingerprint: metadata.fingerprint,
      fontFamily: metadata.fontFamily,
      accessScope: metadata.accessScope,
      tags: metadata.tags,
      storageMode: 'object-storage',
      storageKey,
      qualityPreference: optimized?.qualityPreference,
      derivatives: mapPreparedDerivatives(optimized?.derivatives),
      localFiles,
    };
  },
  async completeUpload(input) {
    const uploadFile = input.prepared.localFiles?.upload ?? input.file;
    input.onProgress?.({
      loadedBytes: uploadFile.size,
      totalBytes: uploadFile.size,
      percentage: 100,
    });
    const payload = await readFileAsDataUrl(uploadFile);
    const derivatives = await materializeDerivativeSetWithDataUrls({
      original:
        input.prepared.localFiles?.original && input.prepared.derivatives?.original
          ? {
              file: input.prepared.localFiles.original,
              metadata: input.prepared.derivatives.original,
            }
          : undefined,
      low:
        input.prepared.localFiles?.low && input.prepared.derivatives?.low
          ? {
              file: input.prepared.localFiles.low,
              metadata: input.prepared.derivatives.low,
            }
          : undefined,
      mid:
        input.prepared.localFiles?.mid && input.prepared.derivatives?.mid
          ? {
              file: input.prepared.localFiles.mid,
              metadata: input.prepared.derivatives.mid,
            }
          : undefined,
      high:
        input.prepared.localFiles?.high && input.prepared.derivatives?.high
          ? {
              file: input.prepared.localFiles.high,
              metadata: input.prepared.derivatives.high,
            }
          : undefined,
      thumbnail:
        input.prepared.localFiles?.thumbnail && input.prepared.derivatives?.thumbnail
          ? {
              file: input.prepared.localFiles.thumbnail,
              metadata: input.prepared.derivatives.thumbnail,
            }
          : undefined,
      poster:
        input.prepared.localFiles?.poster && input.prepared.derivatives?.poster
          ? {
              file: input.prepared.localFiles.poster,
              metadata: input.prepared.derivatives.poster,
            }
          : undefined,
    });
    return {
      name: input.prepared.name,
      kind: input.prepared.kind,
      src: '',
      publicUrl: input.prepared.publicUrl,
      mimeType: input.prepared.mimeType,
      sourceType: 'upload',
      storageMode: 'object-storage',
      storageKey: input.prepared.storageKey,
      accessScope: input.prepared.accessScope,
      sizeBytes: input.prepared.sizeBytes,
      width: input.prepared.width,
      height: input.prepared.height,
      durationMs: input.prepared.durationMs,
      tags: input.prepared.tags,
      fingerprint: input.prepared.fingerprint,
      fontFamily: input.prepared.fontFamily,
      qualityPreference: input.prepared.qualityPreference ?? 'auto',
      derivatives,
      posterSrc: derivatives?.poster?.src,
      thumbnailUrl: derivatives?.thumbnail?.src,
      storagePayload: payload,
    };
  },
};
