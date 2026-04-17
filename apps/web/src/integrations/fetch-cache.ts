export type FetchPolicy = 'network-first' | 'cache-first' | 'network-only' | 'cache-only' | 'static-only';

type CacheEntry<T> = {
  savedAt: number;
  ttlMs: number;
  data: T;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();

function isFresh(entry: CacheEntry<unknown> | null | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.savedAt <= entry.ttlMs;
}

export function getCachedValue<T>(key: string): T | null {
  const memoryEntry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (isFresh(memoryEntry)) return memoryEntry!.data;
  return null;
}

export function setCachedValue<T>(key: string, data: T, ttlMs: number): void {
  const entry: CacheEntry<T> = { data, ttlMs, savedAt: Date.now() };
  memoryCache.set(key, entry as CacheEntry<unknown>);
}

export function clearCachedValue(key: string): void {
  memoryCache.delete(key);
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
