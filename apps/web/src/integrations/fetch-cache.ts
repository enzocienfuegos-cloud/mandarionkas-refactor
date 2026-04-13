export type FetchPolicy = 'network-first' | 'cache-first' | 'network-only' | 'cache-only' | 'static-only';

type CacheEntry<T> = {
  savedAt: number;
  ttlMs: number;
  data: T;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const STORAGE_PREFIX = 'smx-studio-v4:fetch-cache:';

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && !!window.sessionStorage;
}

function readStorage<T>(key: string): CacheEntry<T> | null {
  if (!canUseSessionStorage()) return null;
  const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, entry: CacheEntry<T>): void {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
}

function isFresh(entry: CacheEntry<unknown> | null | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.savedAt <= entry.ttlMs;
}

export function getCachedValue<T>(key: string): T | null {
  const memoryEntry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (isFresh(memoryEntry)) return memoryEntry!.data;
  const storageEntry = readStorage<T>(key);
  if (isFresh(storageEntry)) {
    memoryCache.set(key, storageEntry as CacheEntry<unknown>);
    return storageEntry!.data;
  }
  return null;
}

export function setCachedValue<T>(key: string, data: T, ttlMs: number): void {
  const entry: CacheEntry<T> = { data, ttlMs, savedAt: Date.now() };
  memoryCache.set(key, entry as CacheEntry<unknown>);
  writeStorage(key, entry);
}

export function clearCachedValue(key: string): void {
  memoryCache.delete(key);
  if (canUseSessionStorage()) {
    window.sessionStorage.removeItem(STORAGE_PREFIX + key);
  }
}

export async function fetchJsonWithPolicy<T>(
  key: string,
  url: string,
  policy: FetchPolicy,
  ttlMs = 5 * 60 * 1000,
  init?: RequestInit,
): Promise<{ data: T; source: 'network' | 'cache' | 'static' }> {
  const cached = getCachedValue<T>(key);

  if (policy === 'cache-first' && cached != null) return { data: cached, source: 'cache' };
  if (policy === 'cache-only') {
    if (cached == null) throw new Error('No cached data available');
    return { data: cached, source: 'cache' };
  }
  if (policy === 'static-only') throw new Error('Static-only policy blocks network fetch');

  try {
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as T;
    setCachedValue(key, data, ttlMs);
    return { data, source: 'network' };
  } catch (error) {
    if ((policy === 'network-first' || policy === 'cache-first') && cached != null) {
      return { data: cached, source: 'cache' };
    }
    throw error;
  }
}
