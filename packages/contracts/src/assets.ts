export type AssetKindDto = 'image' | 'video' | 'font' | 'other';
export type AssetStorageModeDto = 'object-storage' | 'remote-url';
export type AssetSourceTypeDto = 'upload' | 'url';
export type AssetAccessScopeDto = 'private' | 'client';

export type AssetRecordDto = {
  id: string;
  name: string;
  kind: AssetKindDto;
  src: string;
  createdAt: string;
  mimeType?: string;
  sourceType?: AssetSourceTypeDto;
  storageMode?: AssetStorageModeDto;
  storageKey?: string;
  publicUrl?: string;
  originUrl?: string;
  posterSrc?: string;
  thumbnailUrl?: string;
  accessScope?: AssetAccessScopeDto;
  tags?: string[];
  folderId?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  fingerprint?: string;
  fontFamily?: string;
  clientId: string;
  ownerUserId: string;
};

export type AssetFolderDto = {
  id: string;
  name: string;
  createdAt: string;
  clientId: string;
  ownerUserId: string;
  parentId?: string;
};

export type SaveAssetRequestDto = {
  asset: Omit<AssetRecordDto, 'id' | 'createdAt' | 'clientId' | 'ownerUserId'>;
};

export type ListAssetsResponseDto = {
  assets: AssetRecordDto[];
};

export type ListAssetFoldersResponseDto = {
  folders: AssetFolderDto[];
};

export type SaveAssetResponseDto = {
  asset: AssetRecordDto;
};

export type GetAssetResponseDto = {
  asset?: AssetRecordDto;
};

export type RenameAssetRequestDto = {
  name: string;
};

export type CreateAssetFolderRequestDto = {
  name: string;
  parentId?: string;
};

export type CreateAssetFolderResponseDto = {
  folder: AssetFolderDto;
};

export type PreparedAssetUploadDto = {
  fontFamily?: string;
  assetId: string;
  name: string;
  kind: AssetKindDto;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  fingerprint?: string;
  accessScope?: AssetAccessScopeDto;
  tags?: string[];
  folderId?: string;
  storageMode: 'object-storage';
  storageKey: string;
  uploadUrl?: string;
  publicUrl?: string;
};

export type PrepareAssetUploadRequestDto = {
  fontFamily?: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  kind?: AssetKindDto;
  requestedName?: string;
  accessScope?: AssetAccessScopeDto;
  tags?: string[];
  folderId?: string;
};

export type PrepareAssetUploadResponseDto = {
  upload: PreparedAssetUploadDto;
};

export type CompleteAssetUploadRequestDto = {
  assetId: string;
  name?: string;
  kind?: AssetKindDto;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  accessScope?: AssetAccessScopeDto;
  tags?: string[];
  folderId?: string;
  fingerprint?: string;
  fontFamily?: string;
  storageMode?: AssetStorageModeDto;
  storageKey: string;
  publicUrl?: string;
  sourceType?: AssetSourceTypeDto;
  metadata?: {
    width?: number;
    height?: number;
    durationMs?: number;
    fingerprint?: string;
  };
};

export type CompleteAssetUploadResponseDto = {
  asset: AssetRecordDto;
};
