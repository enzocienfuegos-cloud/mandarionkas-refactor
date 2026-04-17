export type AssetKind = 'image' | 'video' | 'font' | 'other';
export type AssetSourceType = 'url' | 'upload';
export type AssetAccessScope = 'client' | 'private';
export type AssetStorageMode = 'object-storage' | 'remote-url';

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
  originUrl?: string;
  fingerprint?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  posterSrc?: string;
  fontFamily?: string;
  tags?: string[];
  folderId?: string;
  clientId: string;
  ownerUserId: string;
  accessScope?: AssetAccessScope;
};

export type AssetDraft = Omit<AssetRecord, 'id' | 'createdAt' | 'clientId' | 'ownerUserId'> & {
  storagePayload?: string;
};

export type AssetFolder = {
  id: string;
  name: string;
  createdAt: string;
  clientId: string;
  ownerUserId: string;
  parentId?: string;
};
