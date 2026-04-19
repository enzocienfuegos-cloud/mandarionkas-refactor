import type { AssetAccessScope, AssetDerivativeSet, AssetDraft, AssetKind, AssetQualityPreference, AssetRecord } from './types';

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
  optimizedUrl?: string;
  qualityPreference?: AssetQualityPreference;
  derivatives?: AssetDerivativeSet;
  localFiles?: {
    upload?: File;
    original?: File;
    low?: File;
    mid?: File;
    high?: File;
    thumbnail?: File;
    poster?: File;
  };
};

export interface AssetStorageProvider {
  mode?: 'demo' | 'api';
  prepareUpload(input: AssetUploadInput): Promise<PreparedAssetUpload>;
  completeUpload(input: {
    prepared: PreparedAssetUpload;
    file: File;
    onProgress?: (progress: { loadedBytes: number; totalBytes: number; percentage: number }) => void;
  }): Promise<AssetUploadResult>;
}


export type AssetUploadResult = AssetDraft | AssetRecord;
