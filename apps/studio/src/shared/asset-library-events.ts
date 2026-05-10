const OPEN_ASSET_LIBRARY_EVENT = 'studio:open-asset-library';

export function requestOpenAssetLibrary(): void {
  window.dispatchEvent(new CustomEvent(OPEN_ASSET_LIBRARY_EVENT));
}

export function subscribeToOpenAssetLibrary(listener: () => void): () => void {
  const handleOpen = () => listener();
  window.addEventListener(OPEN_ASSET_LIBRARY_EVENT, handleOpen);
  return () => window.removeEventListener(OPEN_ASSET_LIBRARY_EVENT, handleOpen);
}
