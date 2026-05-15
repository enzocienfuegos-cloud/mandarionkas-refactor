import type { AssetFolder, AssetRecord } from '../../../assets/types';
import { acceptsAssetKind } from '../../../widgets/registry/widget-definition';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';
import type { LeftRailController } from './use-left-rail-controller';

export type FolderTreeNode = AssetFolder & { children: FolderTreeNode[] };
export type FolderCard = { id: string; name: string; depth?: number };

export function formatAssetMeta(asset: AssetRecord): string {
  const size = asset.sizeBytes ? `${(asset.sizeBytes / 1024).toFixed(1)} KB` : null;
  const dims = asset.width && asset.height ? `${asset.width} × ${asset.height}` : null;
  const processing = asset.processingStatus ? asset.processingStatus.replace(/-/g, ' ') : null;
  return [size, dims, processing].filter(Boolean).join(' • ') || asset.kind;
}

export function canReprocessAsset(asset: AssetRecord): boolean {
  if (asset.storageMode !== 'object-storage') return false;
  if (asset.processingStatus !== 'blocked' && asset.processingStatus !== 'failed') return false;
  if (asset.kind === 'video') return true;
  return asset.kind === 'image' && ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(String(asset.mimeType ?? '').trim().toLowerCase());
}

export function buildFolderTree(folders: AssetFolder[]): FolderTreeNode[] {
  const nodes = new Map<string, FolderTreeNode>();
  for (const folder of folders) {
    nodes.set(folder.id, { ...folder, children: [] });
  }
  const roots: FolderTreeNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function flattenFolderCards(folderTree: FolderTreeNode[]): FolderCard[] {
  const flat: FolderCard[] = [];
  function visit(nodes: FolderTreeNode[], depth: number): void {
    for (const node of nodes) {
      flat.push({ id: node.id, name: node.name, depth });
      if (node.children.length) visit(node.children, depth + 1);
    }
  }
  visit(folderTree, 0);
  return flat;
}

export function filterVisibleAssets(assets: AssetRecord[], activeFolderId: string): AssetRecord[] {
  return assets.filter((asset) => activeFolderId === 'all' || asset.folderId === activeFolderId);
}

export function getVisibleAssetRange(
  visibleAssets: AssetRecord[],
  assetId: string,
  lastSelectedAssetId: string | null,
): string[] {
  if (!lastSelectedAssetId) return [assetId];
  const startIndex = visibleAssets.findIndex((asset) => asset.id === lastSelectedAssetId);
  const endIndex = visibleAssets.findIndex((asset) => asset.id === assetId);
  if (startIndex === -1 || endIndex === -1) return [assetId];
  const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
  return visibleAssets.slice(from, to + 1).map((asset) => asset.id);
}

export function isAssetCompatibleWithSelection(
  asset: AssetRecord | undefined,
  assetController: Pick<LeftRailController, 'primaryWidget' | 'selectedWidgetAcceptsAsset'>,
): boolean {
  const primaryWidget = assetController.primaryWidget;
  if (!asset || !assetController.selectedWidgetAcceptsAsset || !primaryWidget) return false;
  if (primaryWidget.type === 'scratch-reveal') return asset.kind === 'image';
  if (primaryWidget.type === 'group' && primaryWidget.props.scratchEnabled) return asset.kind === 'image';
  return acceptsAssetKind(getWidgetDefinition(primaryWidget.type), asset.kind as 'image' | 'video' | 'font');
}

export function getReprocessCounts(visibleAssets: AssetRecord[], selectedAssetIds: string[]): {
  selectedReprocessableCount: number;
  visibleReprocessableCount: number;
  reprocessTargetCount: number;
} {
  const selectedReprocessableCount = visibleAssets.filter((asset) => selectedAssetIds.includes(asset.id) && canReprocessAsset(asset)).length;
  const visibleReprocessableCount = visibleAssets.filter(canReprocessAsset).length;
  return {
    selectedReprocessableCount,
    visibleReprocessableCount,
    reprocessTargetCount: selectedReprocessableCount || visibleReprocessableCount,
  };
}

export function getReprocessCandidates(visibleAssets: AssetRecord[], selectedAssetIds: string[]): AssetRecord[] {
  const selectedAssets = visibleAssets.filter((asset) => selectedAssetIds.includes(asset.id));
  return (selectedAssets.length ? selectedAssets : visibleAssets).filter(canReprocessAsset);
}
