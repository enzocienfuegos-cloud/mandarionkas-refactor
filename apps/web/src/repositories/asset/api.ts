import type { AssetDraft, AssetFolder, AssetRecord } from '../../assets/types';
import { mapAssetDraftToDto, mapAssetFolderDtoToDomain, mapAssetRecordDtoToDomain } from '../../assets/contracts';
import { getRepositoryApiBase } from '../api-config';
import { fetchJson, fetchOptionalJson } from '../../shared/net/http-json';
import type { AssetRepository } from '../types';
import type {
  CreateAssetFolderResponseDto,
  GetAssetResponseDto,
  ListAssetFoldersResponseDto,
  ListAssetsResponseDto,
  MoveAssetRequestDto,
  RenameAssetRequestDto,
  RenameAssetFolderRequestDto,
  RenameAssetFolderResponseDto,
  SaveAssetRequestDto,
  SaveAssetResponseDto,
  UpdateAssetQualityRequestDto,
} from '../../types/contracts/assets';
import { emitAssetLibraryChanged } from './events';

function getBaseUrl(): string {
  return getRepositoryApiBase('smx-studio-v4:asset-api-base');
}

async function tryFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const base = getBaseUrl().trim();
  if (!base) throw new Error('Asset API unavailable');
  return fetchOptionalJson<T>(`${base.replace(/\/$/, '')}${path}`, init);
}

function unwrapRecords(response: ListAssetsResponseDto | null): AssetRecord[] {
  return response?.assets.map(mapAssetRecordDtoToDomain) ?? [];
}

function unwrapRecord(response: SaveAssetResponseDto | GetAssetResponseDto | null): AssetRecord | undefined {
  return response?.asset ? mapAssetRecordDtoToDomain(response.asset) : undefined;
}

function unwrapFolders(response: ListAssetFoldersResponseDto | null): AssetFolder[] {
  return response?.folders.map(mapAssetFolderDtoToDomain) ?? [];
}

function stripTransientPayload(input: AssetDraft): AssetDraft {
  return {
    ...input,
    storagePayload: undefined,
  };
}

function buildCompleteUploadPayload(input: AssetDraft): Record<string, unknown> {
  return {
    name: input.name,
    kind: input.kind,
    mimeType: input.mimeType,
    sourceType: input.sourceType ?? 'upload',
    storageMode: input.storageMode ?? 'object-storage',
    storageKey: input.storageKey,
    publicUrl: input.publicUrl ?? input.src,
    optimizedUrl: input.optimizedUrl,
    qualityPreference: input.qualityPreference,
    derivatives: input.derivatives,
    accessScope: input.accessScope,
    tags: input.tags,
    folderId: input.folderId,
    sizeBytes: input.sizeBytes,
    width: input.width,
    height: input.height,
    durationMs: input.durationMs,
    fingerprint: input.fingerprint,
    fontFamily: input.fontFamily,
    thumbnailUrl: input.thumbnailUrl,
    metadata: {
      width: input.width,
      height: input.height,
      durationMs: input.durationMs,
      fingerprint: input.fingerprint,
    },
  };
}

export const apiAssetRepository: AssetRepository = {
  async list() {
    const response = await tryFetch<ListAssetsResponseDto>('/assets');
    return unwrapRecords(response);
  },

  async save(input) {
    let saved: AssetRecord | undefined;

    if (input.storageMode === 'object-storage' && input.storageKey) {
      const response = await tryFetch<SaveAssetResponseDto>('/assets/complete-upload', {
        method: 'POST',
        body: JSON.stringify(buildCompleteUploadPayload(input)),
      });
      saved = unwrapRecord(response);
    } else {
      const payload: SaveAssetRequestDto = { asset: mapAssetDraftToDto(stripTransientPayload(input)) };
      const response = await tryFetch<SaveAssetResponseDto>('/assets', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      saved = unwrapRecord(response);
    }

    if (!saved) throw new Error('Asset save failed');

    emitAssetLibraryChanged('saved');
    return saved;
  },

  async remove(assetId) {
    const base = getBaseUrl().trim();
    if (!base) throw new Error('Asset API unavailable');

    await fetchJson<unknown>(`${base.replace(/\/$/, '')}/assets/${assetId}`, { method: 'DELETE' });
    emitAssetLibraryChanged('removed');
  },

  async rename(assetId, name) {
    const payload: RenameAssetRequestDto = { name };
    await tryFetch(`/assets/${assetId}/rename`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    emitAssetLibraryChanged('renamed');
  },

  async move(assetId, folderId) {
    const payload: MoveAssetRequestDto = { folderId };
    await tryFetch(`/assets/${assetId}/move`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    emitAssetLibraryChanged('moved');
  },

  async updateQuality(assetId, qualityPreference) {
    const payload: UpdateAssetQualityRequestDto = { qualityPreference };
    await tryFetch(`/assets/${assetId}/quality`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    emitAssetLibraryChanged('saved');
  },

  async reprocess(assetId) {
    const response = await tryFetch<SaveAssetResponseDto>(`/assets/${assetId}/reprocess`, {
      method: 'POST',
    });
    const asset = unwrapRecord(response);
    emitAssetLibraryChanged('saved');
    return asset;
  },

  async get(assetId) {
    if (!assetId) return undefined;
    const response = await tryFetch<GetAssetResponseDto>(`/assets/${assetId}`);
    return unwrapRecord(response);
  },

  async listFolders() {
    const response = await tryFetch<ListAssetFoldersResponseDto>('/assets/folders');
    return unwrapFolders(response);
  },

  async createFolder(name, parentId) {
    const response = await tryFetch<CreateAssetFolderResponseDto>('/assets/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parentId }),
    });
    const folder = response?.folder ? mapAssetFolderDtoToDomain(response.folder) : undefined;
    if (!folder) throw new Error('Asset folder create failed');
    emitAssetLibraryChanged('saved');
    return folder;
  },

  async renameFolder(folderId, name) {
    const payload: RenameAssetFolderRequestDto = { name };
    const response = await tryFetch<RenameAssetFolderResponseDto>(`/assets/folders/${folderId}/rename`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const folder = response?.folder ? mapAssetFolderDtoToDomain(response.folder) : undefined;
    emitAssetLibraryChanged('renamed');
    return folder;
  },

  async deleteFolder(folderId) {
    const base = getBaseUrl().trim();
    if (!base) throw new Error('Asset API unavailable');
    await fetchJson<unknown>(`${base.replace(/\/$/, '')}/assets/folders/${folderId}`, { method: 'DELETE' });
    emitAssetLibraryChanged('removed');
  },
};

export async function listRemoteAssetFolders(): Promise<AssetFolder[]> {
  return apiAssetRepository.listFolders();
}

export async function createRemoteAssetFolder(name: string, parentId?: string): Promise<AssetFolder> {
  return apiAssetRepository.createFolder(name, parentId);
}

export async function renameRemoteAssetFolder(folderId: string, name: string): Promise<AssetFolder | undefined> {
  return apiAssetRepository.renameFolder(folderId, name);
}

export async function deleteRemoteAssetFolder(folderId: string): Promise<void> {
  return apiAssetRepository.deleteFolder(folderId);
}

export async function moveRemoteAssetToFolder(assetId: string, folderId?: string): Promise<void> {
  return apiAssetRepository.move(assetId, folderId);
}
