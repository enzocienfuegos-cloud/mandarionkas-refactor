import type { AssetAccessScope, AssetDraft, AssetFolder, AssetKind, AssetRecord, AssetSourceType, AssetStorageMode } from './types';
import type {
  AssetAccessScopeDto,
  AssetFolderDto,
  AssetKindDto,
  AssetRecordDto,
  AssetSourceTypeDto,
  AssetStorageModeDto,
  PreparedAssetUploadDto,
} from '../types/contracts/assets';
import type { PreparedAssetUpload } from './storage-provider';

function normalizeKind(kind: string | undefined): AssetKind {
  return kind === 'image' || kind === 'video' || kind === 'font' || kind === 'other' ? kind : 'other';
}

function normalizeSourceType(sourceType: string | undefined): AssetSourceType | undefined {
  return sourceType === 'upload' || sourceType === 'url' ? sourceType : undefined;
}

function normalizeStorageMode(storageMode: string | undefined, sourceType?: AssetSourceType): AssetStorageMode | undefined {
  if (storageMode === 'object-storage' || storageMode === 'remote-url') return storageMode;
  if (sourceType === 'url') return 'remote-url';
  if (sourceType === 'upload') return 'object-storage';
  return undefined;
}

function normalizeAccessScope(scope: string | undefined): AssetAccessScope | undefined {
  return scope === 'client' || scope === 'private' ? scope : undefined;
}

export function mapAssetRecordDtoToDomain(dto: AssetRecordDto): AssetRecord {
  const sourceType = normalizeSourceType(dto.sourceType);
  const storageMode = normalizeStorageMode(dto.storageMode, sourceType);
  return {
    id: dto.id,
    name: dto.name,
    kind: normalizeKind(dto.kind),
    src: dto.publicUrl ?? dto.src,
    createdAt: dto.createdAt,
    mimeType: dto.mimeType,
    sourceType,
    storageMode,
    storageKey: dto.storageKey,
    publicUrl: dto.publicUrl,
    originUrl: dto.originUrl,
    fingerprint: dto.fingerprint,
    sizeBytes: dto.sizeBytes,
    width: dto.width,
    height: dto.height,
    durationMs: dto.durationMs,
    posterSrc: dto.posterSrc,
    fontFamily: dto.fontFamily,
    tags: dto.tags,
    folderId: dto.folderId,
    clientId: dto.clientId,
    ownerUserId: dto.ownerUserId,
    accessScope: normalizeAccessScope(dto.accessScope),
  };
}

export function mapAssetDraftToDto(asset: AssetDraft) {
  const sourceType = normalizeSourceType(asset.sourceType);
  const storageMode = normalizeStorageMode(asset.storageMode, sourceType);
  return {
    name: asset.name,
    kind: normalizeKind(asset.kind) as AssetKindDto,
    src: asset.src,
    mimeType: asset.mimeType,
    sourceType: sourceType as AssetSourceTypeDto | undefined,
    storageMode: storageMode as AssetStorageModeDto | undefined,
    storageKey: asset.storageKey,
    publicUrl: asset.publicUrl,
    originUrl: asset.originUrl,
    posterSrc: asset.posterSrc,
    accessScope: normalizeAccessScope(asset.accessScope) as AssetAccessScopeDto | undefined,
    tags: asset.tags,
    folderId: asset.folderId,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
    fingerprint: asset.fingerprint,
    fontFamily: asset.fontFamily,
  } satisfies Omit<AssetRecordDto, 'id' | 'createdAt' | 'clientId' | 'ownerUserId'>;
}

export function mapAssetFolderDtoToDomain(dto: AssetFolderDto): AssetFolder {
  return {
    id: dto.id,
    name: dto.name,
    createdAt: dto.createdAt,
    clientId: dto.clientId,
    ownerUserId: dto.ownerUserId,
    parentId: dto.parentId,
  };
}

export function mapPreparedUploadDtoToDomain(dto: PreparedAssetUploadDto): PreparedAssetUpload {
  return {
    assetId: dto.assetId,
    name: dto.name,
    kind: normalizeKind(dto.kind),
    mimeType: dto.mimeType,
    sizeBytes: dto.sizeBytes,
    width: dto.width,
    height: dto.height,
    durationMs: dto.durationMs,
    fingerprint: dto.fingerprint,
    fontFamily: dto.fontFamily,
    accessScope: normalizeAccessScope(dto.accessScope),
    tags: dto.tags,
    storageMode: 'object-storage',
    folderId: dto.folderId,
    storageKey: dto.storageKey,
    uploadUrl: dto.uploadUrl,
    publicUrl: dto.publicUrl,
  };
}
