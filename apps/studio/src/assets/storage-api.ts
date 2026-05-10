import type {
  CompleteAssetUploadRequestDto,
  CompleteAssetUploadResponseDto,
  PrepareAssetUploadRequestDto,
  PrepareAssetUploadResponseDto,
} from '@smx/contracts';
import type { AssetRecord } from './types';
import { mapAssetRecordDtoToDomain, mapPreparedUploadDtoToDomain } from './contracts';
import type { PreparedAssetUpload } from './storage-provider';
import { getRepositoryApiBase } from '../repositories/api-config';
import { fetchOptionalJson } from '../shared/net/http-json';

function getBaseUrl(): string {
  return getRepositoryApiBase('smx-studio-v4:asset-api-base');
}

export async function requestAssetUploadPreparation(
  payload: PrepareAssetUploadRequestDto,
): Promise<PreparedAssetUpload | null> {
  const base = getBaseUrl();
  if (!base) return null;

  const response = await fetchOptionalJson<PrepareAssetUploadResponseDto>(`${base}/assets/upload-url`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response?.upload ? mapPreparedUploadDtoToDomain(response.upload) : null;
}

export async function completeAssetUpload(
  payload: CompleteAssetUploadRequestDto,
): Promise<AssetRecord | null> {
  const base = getBaseUrl();
  if (!base) return null;

  const response = await fetchOptionalJson<CompleteAssetUploadResponseDto>(`${base}/assets/complete-upload`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response?.asset ? mapAssetRecordDtoToDomain(response.asset) : null;
}
