export type AssetKind = 'image' | 'video' | 'font' | 'other';
export type AssetSourceType = 'url' | 'upload';
export type AssetAccessScope = 'client' | 'private';
export type AssetStorageMode = 'object-storage' | 'remote-url';
export type AssetQualityTier = 'low' | 'mid' | 'high';
export type AssetQualityPreference = 'auto' | AssetQualityTier;
export type AssetProcessingStatus = 'queued' | 'processing' | 'planned' | 'blocked' | 'completed' | 'failed' | 'skipped';

export type AssetDerivative = {
  src: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  bitrateKbps?: number;
  codec?: string;
};

export type AssetDerivativeSet = {
  original?: AssetDerivative;
  low?: AssetDerivative;
  mid?: AssetDerivative;
  high?: AssetDerivative;
  thumbnail?: AssetDerivative;
  poster?: AssetDerivative;
};

export type AssetRecord = {
  id: string;
  name: string;
  kind: AssetKind;
  src: string;
  createdAt: string;
  mimeType?: string;
  sourceType?: AssetSourceType;
  storageMode?: AssetStorageMode;
  storageKey?: string;
  publicUrl?: string;
  optimizedUrl?: string;
  qualityPreference?: AssetQualityPreference;
  processingStatus?: AssetProcessingStatus;
  processingMessage?: string;
  processingAttempts?: number;
  processingLastRetryAt?: string;
  processingNextRetryAt?: string;
  derivatives?: AssetDerivativeSet;
  originUrl?: string;
  fingerprint?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  posterSrc?: string;
  thumbnailUrl?: string;
  fontFamily?: string;
  tags?: string[];
  folderId?: string;
  clientId?: string;
  ownerUserId?: string;
  accessScope?: AssetAccessScope;
};

export type AssetDraft = Omit<AssetRecord, 'id' | 'createdAt' | 'clientId' | 'ownerUserId'> & {
  storagePayload?: string;
};

export type AssetFolder = {
  id: string;
  name: string;
  createdAt: string;
  clientId?: string;
  ownerUserId?: string;
  parentId?: string;
};
