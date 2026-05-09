import { createId } from '../../domain/document/factories';
import type { BrandKit, BrandKitDraft } from '../../domain/brand-kit/types';
import { getRepositoryContext } from '../context';
import { canUseBrowserStorage, readStorageItem, removeStorageItem, writeStorageItem } from '../../shared/browser/storage';
import type { BrandKitRepository } from '../types';

const BRAND_KIT_INDEX_KEY = 'smx-studio-v4:brand-kits:index';
const brandKitKey = (brandKitId: string) => `smx-studio-v4:brand-kit:${brandKitId}`;

function readIndex(): BrandKit[] {
  if (!canUseBrowserStorage()) return [];
  const raw = readStorageItem(BRAND_KIT_INDEX_KEY, '');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as BrandKit[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(items: BrandKit[]): void {
  if (!canUseBrowserStorage()) return;
  writeStorageItem(BRAND_KIT_INDEX_KEY, JSON.stringify(items));
}

function cloneBrandKit(brandKit: BrandKit): BrandKit {
  return JSON.parse(JSON.stringify(brandKit)) as BrandKit;
}

export const localBrandKitRepository: BrandKitRepository = {
  mode: 'local',

  async list() {
    const ctx = getRepositoryContext();
    return readIndex()
      .filter((item) => item.workspaceId === ctx.clientId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(cloneBrandKit);
  },

  async get(brandKitId) {
    const ctx = getRepositoryContext();
    const found = readIndex().find((item) => item.id === brandKitId && item.workspaceId === ctx.clientId);
    return found ? cloneBrandKit(found) : undefined;
  },

  async save(input: BrandKitDraft, brandKitId?: string) {
    const ctx = getRepositoryContext();
    if (!ctx.can('brandkits:manage')) {
      throw new Error('You do not have permission to manage Brand Kits.');
    }

    const now = new Date().toISOString();
    const existing = brandKitId ? readIndex().find((item) => item.id === brandKitId && item.workspaceId === ctx.clientId) : undefined;
    const nextBrandKit: BrandKit = {
      id: existing?.id ?? brandKitId ?? createId('brandkit'),
      workspaceId: ctx.clientId,
      name: input.name.trim() || 'Untitled Brand Kit',
      description: input.description?.trim() || undefined,
      brandId: input.brandId?.trim() || undefined,
      brandName: input.brandName?.trim() || undefined,
      colors: input.colors ?? {},
      typography: input.typography ?? {},
      radii: input.radii ?? {},
      motion: input.motion ?? {},
      logos: input.logos ?? {},
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (canUseBrowserStorage()) {
      writeStorageItem(brandKitKey(nextBrandKit.id), JSON.stringify(nextBrandKit));
    }

    const rest = readIndex().filter((item) => item.id !== nextBrandKit.id);
    writeIndex([nextBrandKit, ...rest]);
    return cloneBrandKit(nextBrandKit);
  },

  async delete(brandKitId) {
    const ctx = getRepositoryContext();
    if (!ctx.can('brandkits:manage')) {
      throw new Error('You do not have permission to manage Brand Kits.');
    }

    const existing = readIndex().find((item) => item.id === brandKitId && item.workspaceId === ctx.clientId);
    if (!existing) return;
    removeStorageItem(brandKitKey(brandKitId));
    writeIndex(readIndex().filter((item) => item.id !== brandKitId));
  },
};
