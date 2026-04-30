export type ThemeMode = 'light' | 'dark';

export const THEME_PREFERENCE_KEY = 'ui.theme';
export const THEME_STORAGE_KEY = 'smx-theme';

function getSystemTheme(): ThemeMode {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'dark' || stored === 'light' ? stored : getSystemTheme();
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: ThemeMode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}
