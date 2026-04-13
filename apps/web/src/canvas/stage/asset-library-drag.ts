type AssetKind = 'image' | 'video' | 'font' | 'other';
type DragAssetRecord = {
  id: string;
  kind: AssetKind;
  name: string;
  src: string;
  posterSrc?: string;
};

export const ASSET_LIBRARY_DRAG_MIME = 'application/x-smx-asset-library-item';

let activeAssetLibraryDragPayload: AssetLibraryDragPayload | null = null;

export type AssetLibraryDragPayload = {
  kind: 'asset-library-item';
  source: 'asset-library';
  assetId: string;
  assetKind: AssetKind;
  assetName: string;
  assetSrc: string;
  assetPosterSrc?: string;
};

export function createAssetLibraryDragPayload(asset: DragAssetRecord): AssetLibraryDragPayload {
  return {
    kind: 'asset-library-item',
    source: 'asset-library',
    assetId: asset.id,
    assetKind: asset.kind,
    assetName: asset.name,
    assetSrc: asset.src,
    assetPosterSrc: asset.posterSrc,
  };
}

export function serializeAssetLibraryDragPayload(payload: AssetLibraryDragPayload): string {
  return JSON.stringify(payload);
}

export function parseAssetLibraryDragPayload(raw: string | null | undefined): AssetLibraryDragPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AssetLibraryDragPayload>;
    if (parsed.kind !== 'asset-library-item') return null;
    if (parsed.source !== 'asset-library') return null;
    if (typeof parsed.assetId !== 'string' || typeof parsed.assetName !== 'string' || typeof parsed.assetSrc !== 'string') return null;
    if (parsed.assetKind !== 'image' && parsed.assetKind !== 'video' && parsed.assetKind !== 'font' && parsed.assetKind !== 'other') return null;
    return {
      kind: 'asset-library-item',
      source: 'asset-library',
      assetId: parsed.assetId,
      assetKind: parsed.assetKind,
      assetName: parsed.assetName,
      assetSrc: parsed.assetSrc,
      assetPosterSrc: typeof parsed.assetPosterSrc === 'string' ? parsed.assetPosterSrc : undefined,
    };
  } catch {
    return null;
  }
}

export function writeAssetLibraryDragPayload(dataTransfer: DataTransfer | null | undefined, payload: AssetLibraryDragPayload): void {
  activeAssetLibraryDragPayload = payload;
  if (!dataTransfer) return;
  const serialized = serializeAssetLibraryDragPayload(payload);
  dataTransfer.effectAllowed = 'copy';
  dataTransfer.setData(ASSET_LIBRARY_DRAG_MIME, serialized);
  dataTransfer.setData('application/json', serialized);
  dataTransfer.setData('text/plain', payload.assetName);
}

export function readAssetLibraryDragPayload(dataTransfer: Pick<DataTransfer, 'getData'> | null | undefined): AssetLibraryDragPayload | null {
  if (!dataTransfer) return activeAssetLibraryDragPayload;
  return (
    parseAssetLibraryDragPayload(dataTransfer.getData(ASSET_LIBRARY_DRAG_MIME))
    ?? parseAssetLibraryDragPayload(dataTransfer.getData('application/json'))
    ?? activeAssetLibraryDragPayload
  );
}

export function clearAssetLibraryDragPayload(): void {
  activeAssetLibraryDragPayload = null;
}
