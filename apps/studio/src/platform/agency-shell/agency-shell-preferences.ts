import { readScopedStorageItem, writeScopedStorageItem } from '../../shared/browser/storage';

const STORAGE_KEY = 'smx-studio-v4:agency-shell-preferences';

export type AgencyProjectFilter = 'all' | 'favorites' | 'shared' | 'archived';
export type AgencySortMode = 'recent' | 'name' | 'most-visited';

export type AgencyShellPreferences = {
  search: string;
  activeClientId: string;
  projectFilter: AgencyProjectFilter;
  sortMode: AgencySortMode;
};

const DEFAULT_PREFERENCES: AgencyShellPreferences = {
  search: '',
  activeClientId: 'all',
  projectFilter: 'all',
  sortMode: 'recent',
};

export function readAgencyShellPreferences(): AgencyShellPreferences {
  try {
    const raw = readScopedStorageItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AgencyShellPreferences>;
    return {
      search: typeof parsed.search === 'string' ? parsed.search : DEFAULT_PREFERENCES.search,
      activeClientId: typeof parsed.activeClientId === 'string' ? parsed.activeClientId : DEFAULT_PREFERENCES.activeClientId,
      projectFilter: parsed.projectFilter === 'favorites' || parsed.projectFilter === 'shared' || parsed.projectFilter === 'archived'
        ? parsed.projectFilter
        : DEFAULT_PREFERENCES.projectFilter,
      sortMode: parsed.sortMode === 'name' || parsed.sortMode === 'most-visited'
        ? parsed.sortMode
        : DEFAULT_PREFERENCES.sortMode,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writeAgencyShellPreferences(preferences: AgencyShellPreferences): void {
  writeScopedStorageItem(STORAGE_KEY, JSON.stringify(preferences));
}
