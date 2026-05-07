import type { Density } from '../system/data-table/DataTable';

const PREFERENCES_STORAGE_KEY = 'smx-adserver-preferences-v1';

type PreferenceRecord = Record<string, unknown>;

type ServerPreferences = {
  theme?: 'light' | 'dark';
  sidebarCollapsed?: boolean;
  densityByTable?: Record<string, Density>;
  metricStripByScope?: Record<string, { selectedIds: string[] }>;
};

let memoryPreferences: PreferenceRecord | null = null;
let preferencesInflight: Promise<PreferenceRecord> | null = null;
let saveTimer: number | null = null;

function readAllPreferencesLocal(): PreferenceRecord {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as PreferenceRecord : {};
  } catch {
    return {};
  }
}

function writeAllPreferencesLocal(preferences: PreferenceRecord) {
  if (typeof window === 'undefined') return;
  memoryPreferences = preferences;
  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

function getLocalPreferences(): PreferenceRecord {
  if (!memoryPreferences) memoryPreferences = readAllPreferencesLocal();
  return memoryPreferences;
}

function mergeServerPreferencesIntoLocal(server: ServerPreferences): PreferenceRecord {
  const next = {
    ...getLocalPreferences(),
  };

  if (server.theme) next['ui.theme'] = server.theme;
  if (typeof server.sidebarCollapsed === 'boolean') {
    next['dusk:sidebar-collapsed'] = server.sidebarCollapsed ? '1' : '0';
  }
  for (const [tableKey, density] of Object.entries(server.densityByTable ?? {})) {
    next[`dusk:density:${tableKey}`] = density;
  }
  for (const [scope, entry] of Object.entries(server.metricStripByScope ?? {})) {
    next[`dusk:metrics:${scope}`] = entry;
  }

  writeAllPreferencesLocal(next);
  return next;
}

export function buildServerPreferences(preferences: PreferenceRecord): ServerPreferences {
  const out: ServerPreferences = {};
  const densityByTable: Record<string, Density> = {};
  const metricStripByScope: Record<string, { selectedIds: string[] }> = {};

  const localTheme = preferences['ui.theme'];
  if (localTheme === 'light' || localTheme === 'dark') {
    out.theme = localTheme;
  }

  const localSidebar = preferences['dusk:sidebar-collapsed'];
  if (localSidebar === '1' || localSidebar === '0') {
    out.sidebarCollapsed = localSidebar === '1';
  }

  for (const [key, value] of Object.entries(preferences)) {
    if (key.startsWith('dusk:density:')) {
      const tableKey = key.replace('dusk:density:', '');
      if (['compact', 'comfortable', 'spacious'].includes(String(value))) {
        densityByTable[tableKey] = value as Density;
      }
      continue;
    }

    if (key.startsWith('dusk:metrics:')) {
      const scope = key.replace('dusk:metrics:', '');
      const selectedIds = Array.isArray((value as { selectedIds?: unknown[] } | undefined)?.selectedIds)
        ? [...new Set(((value as { selectedIds: unknown[] }).selectedIds).map((item) => String(item || '').trim()).filter(Boolean))]
        : [];
      if (selectedIds.length > 0) {
        metricStripByScope[scope] = { selectedIds };
      }
    }
  }

  if (Object.keys(densityByTable).length > 0) {
    out.densityByTable = densityByTable;
  }
  if (Object.keys(metricStripByScope).length > 0) {
    out.metricStripByScope = metricStripByScope;
  }

  return out;
}

async function pushPreferencesToServer(preferences: PreferenceRecord) {
  try {
    await fetch('/v1/preferences', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: buildServerPreferences(preferences) }),
    });
  } catch {
    // local fallback remains authoritative until next successful sync
  }
}

function scheduleServerSave() {
  if (typeof window === 'undefined') return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    void pushPreferencesToServer(getLocalPreferences());
  }, 150);
}

export function loadPreferenceLocal<T>(key: string): T | undefined {
  return getLocalPreferences()[key] as T | undefined;
}

export function loadPreference<T>(key: string): T | undefined {
  return loadPreferenceLocal<T>(key);
}

export function savePreferenceLocal(key: string, value: unknown) {
  const next = { ...getLocalPreferences(), [key]: value };
  writeAllPreferencesLocal(next);
}

export function savePreference(key: string, value: unknown) {
  savePreferenceLocal(key, value);
  scheduleServerSave();
}

export async function syncPreferencesFromServer() {
  if (typeof window === 'undefined') return getLocalPreferences();
  if (!preferencesInflight) {
    preferencesInflight = fetch('/v1/preferences', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load preferences');
        const payload = await response.json();
        return mergeServerPreferencesIntoLocal(payload?.preferences ?? payload ?? {});
      })
      .catch(() => getLocalPreferences())
      .finally(() => {
        preferencesInflight = null;
      });
  }
  return preferencesInflight;
}

const DENSITY_VALUES: Density[] = ['compact', 'comfortable', 'spacious'];

export function getDensity(key: string): Density | undefined {
  const value = loadPreference<string>(`dusk:density:${key}`);
  return DENSITY_VALUES.includes(value as Density) ? (value as Density) : undefined;
}

export function setDensity(key: string, value: Density) {
  savePreference(`dusk:density:${key}`, value);
}
