const OPEN_ASSET_LIBRARY_EVENT = 'studio:open-asset-library';

export type AssetLibrarySelectableAsset = {
  id: string;
  name: string;
  kind: 'image' | 'video' | 'font' | 'other';
  src: string;
  mimeType?: string;
  publicUrl?: string;
  optimizedUrl?: string;
  posterSrc?: string;
  thumbnailUrl?: string;
  fontFamily?: string;
  qualityPreference?: 'auto' | 'low' | 'mid' | 'high';
  derivatives?: {
    poster?: { src: string };
  };
};

export type AssetLibraryOpenRequest = {
  target?: 'scratch-cover' | 'scratch-reveal' | 'group-scratch-cover';
  accept?: 'image' | 'video' | 'font' | 'any';
  title?: string;
  onSelect?: (asset: AssetLibrarySelectableAsset) => void;
};

function isAssetLibraryOpenRequest(value: unknown): value is AssetLibraryOpenRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as AssetLibraryOpenRequest;
  const target = request.target;
  const accept = request.accept;
  const title = request.title;
  const onSelect = request.onSelect;
  const targetValid = target === undefined || target === 'scratch-cover' || target === 'scratch-reveal' || target === 'group-scratch-cover';
  const acceptValid = accept === undefined || accept === 'image' || accept === 'video' || accept === 'font' || accept === 'any';
  const titleValid = title === undefined || typeof title === 'string';
  const onSelectValid = onSelect === undefined || typeof onSelect === 'function';
  return targetValid && acceptValid && titleValid && onSelectValid;
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
