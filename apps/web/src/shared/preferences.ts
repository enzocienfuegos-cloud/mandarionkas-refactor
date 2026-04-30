const PREFERENCES_STORAGE_KEY = 'smx-adserver-preferences-v1';

function readAllPreferences(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function writeAllPreferences(preferences: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

export function loadPreference<T>(key: string): T | undefined {
  const preferences = readAllPreferences();
  return preferences[key] as T | undefined;
}

export function savePreference(key: string, value: unknown) {
  const preferences = readAllPreferences();
  preferences[key] = value;
  writeAllPreferences(preferences);
}
