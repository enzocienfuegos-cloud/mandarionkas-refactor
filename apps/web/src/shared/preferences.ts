import type { Density } from '../system/data-table/DataTable';

const PREFERENCES_STORAGE_KEY = 'smx-adserver-preferences-v1';

type PreferenceRecord = Record<string, unknown>;

type ServerPreferences = {
  theme?: 'light' | 'dark';
  sidebarCollapsed?: boolean;
  densityByTable?: Record<string, Density>;
  metricStripByScope?: Record<string, { selectedIds: string[] }>;
  profile?: {
    timezone?: string;
    locale?: string;
  };
  notifications?: {
    emailPacing?: boolean;
    emailDiscrepancies?: boolean;
    emailApprovals?: boolean;
    slackWebhookUrl?: string;
  };
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
  if (server.profile?.timezone) next['user.timezone'] = server.profile.timezone;
  if (server.profile?.locale) next['user.locale'] = server.profile.locale;
  if (typeof server.notifications?.emailPacing === 'boolean') {
    next['notifications.emailPacing'] = server.notifications.emailPacing;
  }
  if (typeof server.notifications?.emailDiscrepancies === 'boolean') {
    next['notifications.emailDiscrepancies'] = server.notifications.emailDiscrepancies;
  }
  if (typeof server.notifications?.emailApprovals === 'boolean') {
    next['notifications.emailApprovals'] = server.notifications.emailApprovals;
  }
  if (typeof server.notifications?.slackWebhookUrl === 'string') {
    next['notifications.slackWebhookUrl'] = server.notifications.slackWebhookUrl;
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
  const profile: NonNullable<ServerPreferences['profile']> = {};
  const notifications: NonNullable<ServerPreferences['notifications']> = {};

  const localTheme = preferences['ui.theme'];
  if (localTheme === 'light' || localTheme === 'dark') {
    out.theme = localTheme;
  }

  const localSidebar = preferences['dusk:sidebar-collapsed'];
  if (localSidebar === '1' || localSidebar === '0') {
    out.sidebarCollapsed = localSidebar === '1';
  }

  const localTimezone = String(preferences['user.timezone'] ?? '').trim();
  if (localTimezone) {
    profile.timezone = localTimezone;
  }

  const localLocale = String(preferences['user.locale'] ?? '').trim();
  if (localLocale) {
    profile.locale = localLocale;
  }

  for (const [prefKey, outputKey] of [
    ['notifications.emailPacing', 'emailPacing'],
    ['notifications.emailDiscrepancies', 'emailDiscrepancies'],
    ['notifications.emailApprovals', 'emailApprovals'],
  ] as const) {
    if (typeof preferences[prefKey] === 'boolean') {
      notifications[outputKey] = preferences[prefKey] as boolean;
    }
  }

  const slackWebhookUrl = String(preferences['notifications.slackWebhookUrl'] ?? '').trim();
  if (slackWebhookUrl) {
    notifications.slackWebhookUrl = slackWebhookUrl;
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
  if (Object.keys(profile).length > 0) {
    out.profile = profile;
  }
  if (Object.keys(notifications).length > 0) {
    out.notifications = notifications;
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

export function getPreferencesSnapshot(): PreferenceRecord {
  return { ...getLocalPreferences() };
}

export async function persistPreferences() {
  await pushPreferencesToServer(getLocalPreferences());
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
