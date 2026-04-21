export interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type BrowserStorageScope = 'persistent' | 'session';

function resolveStorageKind(scope: BrowserStorageScope): 'localStorage' | 'sessionStorage' {
  return scope === 'persistent' ? 'localStorage' : 'sessionStorage';
}

function getStorage(kind: 'localStorage' | 'sessionStorage'): BrowserStorage | null {
  if (typeof window === 'undefined') return null;
  return (window[kind] as Storage | undefined) ?? null;
}

export function canUseBrowserStorage(kind: 'localStorage' | 'sessionStorage' = 'localStorage'): boolean {
  return !!getStorage(kind);
}

export function canUseScopedBrowserStorage(scope: BrowserStorageScope = 'persistent'): boolean {
  return canUseBrowserStorage(resolveStorageKind(scope));
}

export function readStorageItem(key: string, fallback = '', kind: 'localStorage' | 'sessionStorage' = 'localStorage'): string {
  return getStorage(kind)?.getItem(key) ?? fallback;
}

export function readScopedStorageItem(key: string, fallback = '', scope: BrowserStorageScope = 'persistent'): string {
  return readStorageItem(key, fallback, resolveStorageKind(scope));
}

export function writeStorageItem(key: string, value: string, kind: 'localStorage' | 'sessionStorage' = 'localStorage'): void {
  getStorage(kind)?.setItem(key, value);
}

export function writeScopedStorageItem(key: string, value: string, scope: BrowserStorageScope = 'persistent'): void {
  writeStorageItem(key, value, resolveStorageKind(scope));
}

export function removeStorageItem(key: string, kind: 'localStorage' | 'sessionStorage' = 'localStorage'): void {
  getStorage(kind)?.removeItem(key);
}

export function removeScopedStorageItem(key: string, scope: BrowserStorageScope = 'persistent'): void {
  removeStorageItem(key, resolveStorageKind(scope));
}
