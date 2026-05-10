import { useCallback, useEffect, useRef, useState } from 'react';

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
  const routePathRef = useRef(routePath);
  const validTabsRef = useRef(validTabs);
  const defaultTabRef = useRef(defaultTab);
  routePathRef.current = routePath;
  validTabsRef.current = validTabs;
  defaultTabRef.current = defaultTab;

  const readCurrentTab = useCallback((): T => {
    const { path, params } = readHashState();
    if (path !== routePathRef.current) return defaultTabRef.current;
    const candidate = params.get('tab');
    return validTabsRef.current.includes(candidate as T) ? (candidate as T) : defaultTabRef.current;
  }, []);

  const [activeTab, setActiveTabState] = useState<T>(readCurrentTab);

  useEffect(() => {
    const syncFromHash = () => setActiveTabState(readCurrentTab());
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [readCurrentTab]);

  useEffect(() => {
    setActiveTabState(readCurrentTab());
  }, [routePath, readCurrentTab]);

  const setActiveTab = useCallback((tabId: T) => {
    setActiveTabState(tabId);
    const { path, params } = readHashState();
    if (path !== routePathRef.current) return;
    params.set('tab', tabId);
    writeHashState(path, params);
  }, []);

  return [activeTab, setActiveTab];
}
