import { readScopedStorageItem, writeScopedStorageItem } from '../../shared/browser/storage';

const STORAGE_KEY = 'smx-studio-v4:agency-shell-preferences';

export type AgencySortMode = 'newest' | 'oldest';

export type AgencyShellPreferences = {
  search: string;
  activeClientId: string;
  sortMode: AgencySortMode;
};

const DEFAULT_PREFERENCES: AgencyShellPreferences = {
  search: '',
  activeClientId: 'all',
  sortMode: 'newest',
};

export function readAgencyShellPreferences(): AgencyShellPreferences {
  try {
    const raw = readScopedStorageItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AgencyShellPreferences>;
    return {
      search: typeof parsed.search === 'string' ? parsed.search : DEFAULT_PREFERENCES.search,
      activeClientId: typeof parsed.activeClientId === 'string' ? parsed.activeClientId : DEFAULT_PREFERENCES.activeClientId,
      sortMode: parsed.sortMode === 'oldest'
        ? 'oldest'
        : DEFAULT_PREFERENCES.sortMode,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writeAgencyShellPreferences(preferences: AgencyShellPreferences): void {
  writeScopedStorageItem(STORAGE_KEY, JSON.stringify(preferences));
}
