import type { AssetAccessScope, AssetDraft, AssetKind, AssetRecord } from './types';

export type AssetUploadInput = {
  file: File;
  name?: string;
  accessScope?: AssetAccessScope;
  tags?: string[];
  folderId?: string;
  onProgress?: (progress: { loadedBytes: number; totalBytes: number; percentage: number }) => void;
};

export type PreparedAssetUpload = {
  assetId: string;
  name: string;
  kind: AssetKind;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  fingerprint?: string;
  fontFamily?: string;
  accessScope?: AssetAccessScope;
  tags?: string[];
  folderId?: string;
  storageMode: 'object-storage';
  storageKey: string;
  uploadUrl?: string;
  publicUrl?: string;
};

export interface AssetStorageProvider {
  prepareUpload(input: AssetUploadInput): Promise<PreparedAssetUpload>;
  completeUpload(input: {
    prepared: PreparedAssetUpload;
    file: File;
    onProgress?: (progress: { loadedBytes: number; totalBytes: number; percentage: number }) => void;
  }): Promise<AssetUploadResult>;
}


export type AssetUploadResult = AssetDraft | AssetRecord;
