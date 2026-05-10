import type { BrandKit, BrandKitDraft } from '../../domain/brand-kit/types';
import { setBrandKitRepositoryMode } from '../mode';
import { getRepositoryServices } from '../services';

export { setBrandKitRepositoryMode };

export function getBrandKitRepository() {
  return getRepositoryServices().brandKits;
}

export async function listBrandKits(): Promise<BrandKit[]> {
  return getBrandKitRepository().list();
}

export async function getBrandKit(brandKitId: string): Promise<BrandKit | undefined> {
  return getBrandKitRepository().get(brandKitId);
}

export async function saveBrandKit(input: BrandKitDraft, brandKitId?: string): Promise<BrandKit> {
  return getBrandKitRepository().save(input, brandKitId);
}

export async function deleteBrandKit(brandKitId: string): Promise<void> {
  return getBrandKitRepository().delete(brandKitId);
}
