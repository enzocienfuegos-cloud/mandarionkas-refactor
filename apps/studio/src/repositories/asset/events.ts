const ASSET_LIBRARY_EVENT_NAME = 'smx:asset-library-changed';

export type AssetLibraryChangeReason = 'saved' | 'renamed' | 'removed' | 'moved' | 'unknown';

export function emitAssetLibraryChanged(reason: AssetLibraryChangeReason = 'unknown'): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(ASSET_LIBRARY_EVENT_NAME, { detail: { reason } }));
}

export function subscribeToAssetLibraryChanges(listener: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function' || typeof window.removeEventListener !== 'function') return () => {};
  const handler: EventListener = () => listener();
  window.addEventListener(ASSET_LIBRARY_EVENT_NAME, handler);
  return () => window.removeEventListener(ASSET_LIBRARY_EVENT_NAME, handler);
}
