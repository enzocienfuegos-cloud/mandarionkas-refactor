import React from 'react';
import { loadPreference, savePreference, syncPreferencesFromServer } from '../../shared/preferences';
import {
  THEME_PREFERENCE_KEY,
  applyTheme,
  getInitialTheme,
  persistTheme,
  type ThemeMode,
} from '../../shared/theme';

export function useShellTheme() {
  const [theme, setTheme] = React.useState<ThemeMode>(() => getInitialTheme());
  const hasSyncedRef = React.useRef(false);

  React.useEffect(() => {
    const preferredTheme = loadPreference<ThemeMode>(THEME_PREFERENCE_KEY);
    if (preferredTheme === 'dark' || preferredTheme === 'light') {
      setTheme(preferredTheme);
    }
  }, []);

  React.useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
    if (hasSyncedRef.current) {
      savePreference(THEME_PREFERENCE_KEY, theme);
    }
  }, [theme]);

  const toggle = React.useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const reload = React.useCallback(() => {
    const preferredTheme = loadPreference<ThemeMode>(THEME_PREFERENCE_KEY);
    if (preferredTheme === 'dark' || preferredTheme === 'light') {
      setTheme(preferredTheme);
    }
  }, []);

  const sync = React.useCallback(async () => {
    await syncPreferencesFromServer();
    reload();
    hasSyncedRef.current = true;
  }, [reload]);

  return React.useMemo(
    () => ({ theme, toggle, reload, sync }),
    [theme, toggle, reload, sync],
  );
}
