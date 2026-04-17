import { createAssetUploadMetadataFromFile, readFileAsDataUrl } from '../pipeline';
import type { AssetStorageProvider } from '../storage-provider';

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function sanitizeFileName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

export const demoAssetStorageProvider: AssetStorageProvider = {
  mode: 'demo',
  async prepareUpload(input) {
    const metadata = await createAssetUploadMetadataFromFile(input);
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
    };
  },
  async completeUpload(input) {
    input.onProgress?.({
      loadedBytes: input.file.size,
      totalBytes: input.file.size,
      percentage: 100,
    });
    const payload = await readFileAsDataUrl(input.file);
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
      storagePayload: payload,
    };
  },
};
