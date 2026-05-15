const OPEN_ASSET_LIBRARY_EVENT = 'studio:open-asset-library';

export type AssetLibraryOpenRequest = {
  target?: 'scratch-cover' | 'scratch-reveal' | 'group-scratch-cover';
};

function isAssetLibraryOpenRequest(value: unknown): value is AssetLibraryOpenRequest {
  if (!value || typeof value !== 'object') return false;
  const target = (value as AssetLibraryOpenRequest).target;
  return target === undefined || target === 'scratch-cover' || target === 'scratch-reveal' || target === 'group-scratch-cover';
}

export function requestOpenAssetLibrary(request?: unknown): void {
  const detail = isAssetLibraryOpenRequest(request) ? request : undefined;
  window.dispatchEvent(new CustomEvent<AssetLibraryOpenRequest>(OPEN_ASSET_LIBRARY_EVENT, { detail }));
}

export function subscribeToOpenAssetLibrary(listener: (request?: AssetLibraryOpenRequest) => void): () => void {
  const handleOpen = (event: Event) => listener((event as CustomEvent<AssetLibraryOpenRequest>).detail);
  window.addEventListener(OPEN_ASSET_LIBRARY_EVENT, handleOpen);
  return () => window.removeEventListener(OPEN_ASSET_LIBRARY_EVENT, handleOpen);
}
