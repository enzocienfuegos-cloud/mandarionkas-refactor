import { getRepositoryApiBase } from '../api-config';
import { fetchJson, fetchOptionalJson, fetchVoid } from '../../shared/net/http-json';
import type { BrandKitRepository } from '../types';
import type {
  BrandKitDto,
  BrandKitDraftDto,
  CreateBrandKitRequestDto,
  GetBrandKitResponseDto,
  ListBrandKitsResponseDto,
  SaveBrandKitResponseDto,
  UpdateBrandKitRequestDto,
} from '@smx/contracts';
import type { BrandKit, BrandKitDraft } from '../../domain/brand-kit/types';

function getBaseUrl(): string {
  return getRepositoryApiBase('smx-studio-v4:brand-kit-api-base');
}

async function tryFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const base = getBaseUrl().trim();
  if (!base) throw new Error('Brand Kit API unavailable');
  return fetchOptionalJson<T>(`${base.replace(/\/$/, '')}${path}`, init);
}

function toDomainBrandKit(brandKit: BrandKitDto): BrandKit {
  return brandKit;
}

function toDraftDto(input: BrandKitDraft): BrandKitDraftDto {
  return {
    name: input.name,
    description: input.description,
    brandId: input.brandId,
    brandName: input.brandName,
    colors: input.colors,
    typography: input.typography,
    radii: input.radii,
    motion: input.motion,
    logos: input.logos,
  };
}

export const apiBrandKitRepository: BrandKitRepository = {
  mode: 'api',

  async list() {
    const response = await tryFetch<ListBrandKitsResponseDto>('/brand-kits');
    return response?.brandKits.map(toDomainBrandKit) ?? [];
  },

  async get(brandKitId) {
    const response = await tryFetch<GetBrandKitResponseDto>(`/brand-kits/${brandKitId}`);
    return response?.brandKit ? toDomainBrandKit(response.brandKit) : undefined;
  },

  async save(input, brandKitId) {
    const payload: CreateBrandKitRequestDto | UpdateBrandKitRequestDto = { brandKit: toDraftDto(input) };
    const response = await tryFetch<SaveBrandKitResponseDto>(brandKitId ? `/brand-kits/${brandKitId}` : '/brand-kits', {
      method: brandKitId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    if (!response?.brandKit) throw new Error('Brand Kit save failed');
    return toDomainBrandKit(response.brandKit);
  },

  async delete(brandKitId) {
    const base = getBaseUrl().trim();
    if (!base) throw new Error('Brand Kit API unavailable');
    await fetchVoid(`${base.replace(/\/$/, '')}/brand-kits/${brandKitId}`, { method: 'DELETE' });
  },
};
