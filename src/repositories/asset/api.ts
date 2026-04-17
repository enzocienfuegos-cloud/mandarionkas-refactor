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
  RenameAssetRequestDto,
  SaveAssetRequestDto,
  SaveAssetResponseDto,
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
    accessScope: input.accessScope,
    tags: input.tags,
    folderId: input.folderId,
    sizeBytes: input.sizeBytes,
    width: input.width,
    height: input.height,
    durationMs: input.durationMs,
    fingerprint: input.fingerprint,
    fontFamily: input.fontFamily,
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

  async get(assetId) {
    if (!assetId) return undefined;
    const response = await tryFetch<GetAssetResponseDto>(`/assets/${assetId}`);
    return unwrapRecord(response);
  },
};

export async function listRemoteAssetFolders(): Promise<AssetFolder[]> {
  const response = await tryFetch<ListAssetFoldersResponseDto>('/assets/folders');
  return unwrapFolders(response);
}

export async function createRemoteAssetFolder(name: string, parentId?: string): Promise<AssetFolder> {
  const response = await tryFetch<CreateAssetFolderResponseDto>('/assets/folders', {
    method: 'POST',
    body: JSON.stringify({ name, parentId }),
  });
  const folder = response?.folder ? mapAssetFolderDtoToDomain(response.folder) : undefined;
  if (!folder) throw new Error('Asset folder create failed');
  emitAssetLibraryChanged('saved');
  return folder;
}
