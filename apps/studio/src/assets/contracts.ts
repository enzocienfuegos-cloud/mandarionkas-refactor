import type {
  AssetAccessScope,
  AssetDerivative,
  AssetDerivativeSet,
  AssetDraft,
  AssetFolder,
  AssetKind,
  AssetQualityPreference,
  AssetProcessingStatus,
  AssetRecord,
  AssetSourceType,
  AssetStorageMode,
} from './types';
import type {
  AssetAccessScopeDto,
  AssetDerivativeDto,
  AssetDerivativeSetDto,
  AssetFolderDto,
  AssetKindDto,
  AssetQualityPreferenceDto,
  AssetProcessingStatusDto,
  AssetRecordDto,
  AssetSourceTypeDto,
  AssetStorageModeDto,
  PreparedAssetUploadDto,
} from '@smx/contracts';
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

function normalizeQualityPreference(value: string | undefined): AssetQualityPreference | undefined {
  return value === 'auto' || value === 'low' || value === 'mid' || value === 'high' ? value : undefined;
}

function normalizeProcessingStatus(value: string | undefined): AssetProcessingStatus | undefined {
  return value === 'queued'
    || value === 'processing'
    || value === 'planned'
    || value === 'blocked'
    || value === 'completed'
    || value === 'failed'
    || value === 'skipped'
    ? value
    : undefined;
}

function mapDerivativeDtoToDomain(dto: AssetDerivativeDto | undefined): AssetDerivative | undefined {
  if (!dto?.src) return undefined;
  return {
    src: dto.src,
    mimeType: dto.mimeType,
    sizeBytes: dto.sizeBytes,
    width: dto.width,
    height: dto.height,
    bitrateKbps: dto.bitrateKbps,
    codec: dto.codec,
  };
}

function mapDerivativeSetDtoToDomain(dto: AssetDerivativeSetDto | undefined): AssetDerivativeSet | undefined {
  if (!dto) return undefined;
  const mapped: AssetDerivativeSet = {
    original: mapDerivativeDtoToDomain(dto.original),
    low: mapDerivativeDtoToDomain(dto.low),
    mid: mapDerivativeDtoToDomain(dto.mid),
    high: mapDerivativeDtoToDomain(dto.high),
    thumbnail: mapDerivativeDtoToDomain(dto.thumbnail),
    poster: mapDerivativeDtoToDomain(dto.poster),
  };
  return Object.values(mapped).some(Boolean) ? mapped : undefined;
}

function mapDerivativeToDto(derivative: AssetDerivative | undefined): AssetDerivativeDto | undefined {
  if (!derivative?.src) return undefined;
  return {
    src: derivative.src,
    mimeType: derivative.mimeType,
    sizeBytes: derivative.sizeBytes,
    width: derivative.width,
    height: derivative.height,
    bitrateKbps: derivative.bitrateKbps,
    codec: derivative.codec,
  };
}

function mapDerivativeSetToDto(derivatives: AssetDerivativeSet | undefined): AssetDerivativeSetDto | undefined {
  if (!derivatives) return undefined;
  const mapped: AssetDerivativeSetDto = {
    original: mapDerivativeToDto(derivatives.original),
    low: mapDerivativeToDto(derivatives.low),
    mid: mapDerivativeToDto(derivatives.mid),
    high: mapDerivativeToDto(derivatives.high),
    thumbnail: mapDerivativeToDto(derivatives.thumbnail),
    poster: mapDerivativeToDto(derivatives.poster),
  };
  return Object.values(mapped).some(Boolean) ? mapped : undefined;
}

export function mapAssetRecordDtoToDomain(dto: AssetRecordDto): AssetRecord {
  const sourceType = normalizeSourceType(dto.sourceType);
  const storageMode = normalizeStorageMode(dto.storageMode, sourceType);
  const derivatives = mapDerivativeSetDtoToDomain(dto.derivatives);
  const preferred = normalizeQualityPreference(dto.qualityPreference);
  const preferredDerivative =
    preferred && preferred !== 'auto'
      ? derivatives?.[preferred]
      : derivatives?.mid ?? derivatives?.high ?? derivatives?.low;
  return {
    id: dto.id,
    name: dto.name,
    kind: normalizeKind(dto.kind),
    src: preferredDerivative?.src ?? dto.optimizedUrl ?? dto.publicUrl ?? dto.src ?? '',
    createdAt: dto.createdAt,
    mimeType: dto.mimeType,
    sourceType,
    storageMode,
    storageKey: dto.storageKey,
    publicUrl: dto.publicUrl,
    optimizedUrl: dto.optimizedUrl,
    qualityPreference: preferred,
    processingStatus: normalizeProcessingStatus(dto.processingStatus),
    processingMessage: dto.processingMessage,
    processingAttempts: dto.processingAttempts,
    processingLastRetryAt: dto.processingLastRetryAt,
    processingNextRetryAt: dto.processingNextRetryAt,
    derivatives,
    originUrl: dto.originUrl,
    fingerprint: dto.fingerprint,
    sizeBytes: dto.sizeBytes,
    width: dto.width,
    height: dto.height,
    durationMs: dto.durationMs,
    posterSrc: dto.posterSrc,
    thumbnailUrl: dto.thumbnailUrl,
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
    optimizedUrl: asset.optimizedUrl,
    qualityPreference: normalizeQualityPreference(asset.qualityPreference) as AssetQualityPreferenceDto | undefined,
    processingStatus: normalizeProcessingStatus(asset.processingStatus) as AssetProcessingStatusDto | undefined,
    processingMessage: asset.processingMessage,
    processingAttempts: asset.processingAttempts,
    processingLastRetryAt: asset.processingLastRetryAt,
    processingNextRetryAt: asset.processingNextRetryAt,
    derivatives: mapDerivativeSetToDto(asset.derivatives),
    originUrl: asset.originUrl,
    posterSrc: asset.posterSrc,
    thumbnailUrl: asset.thumbnailUrl,
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
    assetId: dto.assetId ?? '',
    name: dto.name ?? '',
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
    storageKey: dto.storageKey ?? '',
    uploadUrl: dto.uploadUrl,
    publicUrl: dto.publicUrl,
    optimizedUrl: dto.optimizedUrl,
    derivatives: mapDerivativeSetDtoToDomain(dto.derivatives),
  };
}
