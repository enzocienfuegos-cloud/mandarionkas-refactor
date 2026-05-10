import { useCallback, useEffect, useState } from 'react';

function readHashState(): { path: string; params: URLSearchParams } {
  if (typeof window === 'undefined') {
    return { path: '/hub', params: new URLSearchParams() };
  }

  const rawHash = window.location.hash.replace(/^#/, '');
  const [path = '/hub', query = ''] = rawHash.split('?');
  return { path, params: new URLSearchParams(query) };
}

function writeHashState(path: string, params: URLSearchParams): void {
  if (typeof window === 'undefined') return;
  const query = params.toString();
  window.location.hash = query ? `#${path}?${query}` : `#${path}`;
}

export function useHashTabState<T extends string>(
  routePath: string,
  validTabs: readonly T[],
  defaultTab: T,
): [T, (tabId: T) => void] {
  const readCurrentTab = useCallback((): T => {
    const { path, params } = readHashState();
    if (path !== routePath) return defaultTab;
    const candidate = params.get('tab');
    return validTabs.includes(candidate as T) ? (candidate as T) : defaultTab;
  }, [defaultTab, routePath, validTabs]);

  const [activeTab, setActiveTabState] = useState<T>(readCurrentTab);

  useEffect(() => {
    const syncFromHash = () => setActiveTabState(readCurrentTab());
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [readCurrentTab]);

  useEffect(() => {
    setActiveTabState(readCurrentTab());
  }, [readCurrentTab]);

  const setActiveTab = useCallback((tabId: T) => {
    setActiveTabState(tabId);
    const { path, params } = readHashState();
    if (path !== routePath) return;
    params.set('tab', tabId);
    writeHashState(path, params);
  }, [routePath]);

  return [activeTab, setActiveTab];
}
