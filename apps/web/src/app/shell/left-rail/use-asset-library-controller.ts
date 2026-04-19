import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssetFolder, AssetRecord } from '../../../assets/types';
import {
  clearAssetLibraryDragPayload,
  createAssetLibraryDragPayload,
  writeAssetLibraryDragPayload,
} from '../../../canvas/stage/asset-library-drag';
import {
  createAssetFolder,
  deleteAssetFolder,
  listAssetFolders,
  moveAsset,
  renameAssetFolder,
  reprocessAsset,
} from '../../../repositories/asset';
import type { useLeftRailController } from './use-left-rail-controller';
import type { useTopBarController } from '../topbar/use-top-bar-controller';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FolderTreeNode = AssetFolder & { children: FolderTreeNode[] };

export type FolderCard = { id: string; name: string; depth?: number };

export type AssetLibraryController = {
  // Folder state
  folders: AssetFolder[];
  folderTree: FolderTreeNode[];
  folderCards: FolderCard[];
  selectableFolders: FolderCard[];
  activeFolder: AssetFolder | undefined;
  activeFolderId: string;
  setActiveFolderId: (id: string) => void;
  folderDraft: string;
  setFolderDraft: (v: string) => void;
  folderBusy: boolean;
  folderError: string;
  folderInputRef: React.RefObject<HTMLInputElement>;
  bulkTargetFolderId: string;
  setBulkTargetFolderId: (id: string) => void;

  // Asset selection
  selectedAssetIds: string[];
  allVisibleSelected: boolean;
  toggleAssetSelection: (assetId: string, additive: boolean, range?: boolean) => void;
  handleToggleSelectAllVisible: (checked: boolean) => void;
  clearSelection: () => void;

  // Drag state
  draggedAssetIds: string[];
  dragOverFolderId: string | null;
  dragActive: boolean;
  setDragActive: (v: boolean) => void;
  setDragOverFolderId: React.Dispatch<React.SetStateAction<string | null>>;
  handleDragStart: (event: React.DragEvent, asset: AssetRecord) => void;
  handleDragEnd: () => void;

  // Pagination
  page: number;
  pageCount: number;
  safePage: number;
  pageAssets: AssetRecord[];
  setPage: (n: number) => void;
  visibleAssets: AssetRecord[];

  // Derived UI state
  canUseOnSelection: boolean;
  reprocessTargetCount: number;
  selectedReprocessableCount: number;
  visibleReprocessableCount: number;

  // Actions
  handleCreateFolder: () => Promise<void>;
  handleRenameActiveFolder: () => Promise<void>;
  handleDeleteActiveFolder: () => Promise<void>;
  handleDeleteSelected: () => Promise<void>;
  handleReprocessFailed: () => Promise<void>;
  handleMoveSelectedToActiveFolder: () => Promise<void>;
  handleMoveSelectedToFolderChoice: () => Promise<void>;
  handleMoveAssetsToFolder: (assetIds: string[], folderId?: string) => Promise<void>;
  handleDroppedFiles: (files: FileList | File[]) => void;

  // Helpers
  getUploadFolderId: () => string | undefined;
  isCompatibleWithSelection: (asset: AssetRecord | undefined) => boolean;
  renderFolderTree: (nodes: FolderTreeNode[], depth?: number) => FolderTreeNode[];
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

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
  return (
    asset.kind === 'image' &&
    ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(
      String(asset.mimeType ?? '').trim().toLowerCase(),
    )
  );
}

const PAGE_SIZE = 10;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAssetLibraryController(
  assetController: ReturnType<typeof useLeftRailController>,
  topBar: ReturnType<typeof useTopBarController>,
): AssetLibraryController {
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>('all');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [lastSelectedAssetId, setLastSelectedAssetId] = useState<string | null>(null);
  const [draggedAssetIds, setDraggedAssetIds] = useState<string[]>([]);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [folderDraft, setFolderDraft] = useState('');
  const [bulkTargetFolderId, setBulkTargetFolderId] = useState<string>('root');
  const [page, setPage] = useState(1);
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderError, setFolderError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // ── Folder data ────────────────────────────────────────────────────────────

  const refreshFolders = useCallback((): void => {
    void listAssetFolders().then(setFolders).catch(() => setFolders([]));
  }, []);

  useEffect(() => {
    refreshFolders();
  }, [refreshFolders]);

  const projectFolders = topBar.projectSession.projects;

  const folderTree = useMemo<FolderTreeNode[]>(() => {
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
  }, [folders]);

  const folderCards = useMemo<FolderCard[]>(() => {
    const flat: FolderCard[] = [
      ...projectFolders.map((project) => ({
        id: `project:${project.id}`,
        name: project.name,
        depth: 0,
      })),
    ];
    function visit(nodes: FolderTreeNode[], depth: number): void {
      for (const node of nodes) {
        flat.push({ id: node.id, name: node.name, depth });
        if (node.children.length) visit(node.children, depth + 1);
      }
    }
    visit(folderTree, 0);
    return flat;
  }, [folderTree, projectFolders]);

  const selectableFolders = useMemo(
    () => folderCards.filter((f) => !f.id.startsWith('project:')),
    [folderCards],
  );

  const activeFolder = useMemo(
    () => folders.find((f) => f.id === activeFolderId),
    [activeFolderId, folders],
  );

  // ── Visible assets + pagination ────────────────────────────────────────────

  const visibleAssets = useMemo(() => {
    return assetController.filteredAssets.filter((asset) => {
      if (activeFolderId === 'all') return true;
      if (activeFolderId.startsWith('project:')) return true;
      return asset.folderId === activeFolderId;
    });
  }, [activeFolderId, assetController.filteredAssets]);

  const pageCount = Math.max(1, Math.ceil(visibleAssets.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageAssets = visibleAssets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [activeFolderId, assetController.assetQuery, assetController.assetSort]);

  useEffect(() => {
    setBulkTargetFolderId(activeFolder ? activeFolder.id : 'root');
  }, [activeFolder]);

  // ── Selection ──────────────────────────────────────────────────────────────

  const allVisibleSelected =
    visibleAssets.length > 0 && visibleAssets.every((a) => selectedAssetIds.includes(a.id));

  function getVisibleAssetRange(assetId: string): string[] {
    if (!lastSelectedAssetId) return [assetId];
    const startIndex = visibleAssets.findIndex((a) => a.id === lastSelectedAssetId);
    const endIndex = visibleAssets.findIndex((a) => a.id === assetId);
    if (startIndex === -1 || endIndex === -1) return [assetId];
    const [from, to] =
      startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
    return visibleAssets.slice(from, to + 1).map((a) => a.id);
  }

  function toggleAssetSelection(assetId: string, additive: boolean, range = false): void {
    setSelectedAssetIds((current) => {
      if (range) {
        const rangeIds = getVisibleAssetRange(assetId);
        return additive ? Array.from(new Set([...current, ...rangeIds])) : rangeIds;
      }
      if (!additive) return [assetId];
      return current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId];
    });
    setLastSelectedAssetId(assetId);
    assetController.setSelectedAssetId(assetId);
  }

  function handleToggleSelectAllVisible(checked: boolean): void {
    if (checked) {
      setSelectedAssetIds(visibleAssets.map((a) => a.id));
      setLastSelectedAssetId(visibleAssets[0]?.id ?? null);
      if (visibleAssets[0]) assetController.setSelectedAssetId(visibleAssets[0].id);
      return;
    }
    setSelectedAssetIds([]);
  }

  // ── Drag ──────────────────────────────────────────────────────────────────

  function handleDragStart(event: React.DragEvent, asset: AssetRecord): void {
    if (asset.kind !== 'image' && asset.kind !== 'video') return;
    const nextDraggedIds = selectedAssetIds.includes(asset.id) ? selectedAssetIds : [asset.id];
    setDraggedAssetIds(nextDraggedIds);
    if (!selectedAssetIds.includes(asset.id)) {
      setSelectedAssetIds([asset.id]);
      setLastSelectedAssetId(asset.id);
    }
    writeAssetLibraryDragPayload(event.dataTransfer, createAssetLibraryDragPayload(asset));
  }

  function handleDragEnd(): void {
    clearAssetLibraryDragPayload();
    setDraggedAssetIds([]);
    setDragOverFolderId(null);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getUploadFolderId(): string | undefined {
    if (activeFolderId === 'all' || activeFolderId.startsWith('project:')) return undefined;
    return activeFolderId;
  }

  function isCompatibleWithSelection(asset: AssetRecord | undefined): boolean {
    return Boolean(
      asset &&
        assetController.selectedWidgetAcceptsAsset &&
        ((['image', 'hero-image'].includes(assetController.primaryWidget?.type ?? '') &&
          asset.kind === 'image') ||
          (assetController.primaryWidget?.type === 'video-hero' && asset.kind === 'video') ||
          (['text', 'cta', 'badge'].includes(assetController.primaryWidget?.type ?? '') &&
            asset.kind === 'font')),
    );
  }

  // ── Derived counts ─────────────────────────────────────────────────────────

  const selectedReprocessableCount = visibleAssets.filter(
    (a) => selectedAssetIds.includes(a.id) && canReprocessAsset(a),
  ).length;
  const visibleReprocessableCount = visibleAssets.filter(canReprocessAsset).length;
  const reprocessTargetCount = selectedReprocessableCount || visibleReprocessableCount;

  const selectedAsset = assetController.selectedAsset;
  const canUseOnSelection = Boolean(
    selectedAsset &&
      assetController.selectedWidgetAcceptsAsset &&
      isCompatibleWithSelection(selectedAsset),
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleCreateFolder(): Promise<void> {
    const name = folderDraft.trim();
    if (!assetController.canCreateAssets) {
      setFolderError('You do not have permission to create folders.');
      return;
    }
    if (!name) {
      setFolderError('Enter a folder name first.');
      folderInputRef.current?.focus();
      return;
    }
    setFolderBusy(true);
    setFolderError('');
    try {
      const parentId =
        activeFolderId !== 'all' && !activeFolderId.startsWith('project:')
          ? activeFolderId
          : undefined;
      const folder = await createAssetFolder(name, parentId);
      refreshFolders();
      setFolderDraft('');
      setActiveFolderId(folder.id);
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : 'Could not create folder.');
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleRenameActiveFolder(): Promise<void> {
    if (!activeFolder || !assetController.canUpdateAssets || typeof window === 'undefined') return;
    const nextName = window.prompt('Rename folder', activeFolder.name)?.trim();
    if (!nextName || nextName === activeFolder.name) return;
    setFolderBusy(true);
    setFolderError('');
    try {
      const renamed = await renameAssetFolder(activeFolder.id, nextName);
      if (!renamed) throw new Error('Could not rename folder.');
      setFolders((current) => current.map((f) => (f.id === renamed.id ? renamed : f)));
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : 'Could not rename folder.');
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleDeleteActiveFolder(): Promise<void> {
    if (!activeFolder || !assetController.canDeleteAssets || typeof window === 'undefined') return;
    const confirmed = window.confirm(
      `Delete folder "${activeFolder.name}"? Assets inside it will move back to the root.`,
    );
    if (!confirmed) return;
    setFolderBusy(true);
    setFolderError('');
    try {
      await deleteAssetFolder(activeFolder.id);
      refreshFolders();
      setActiveFolderId('all');
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : 'Could not delete folder.');
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleDeleteSelected(): Promise<void> {
    for (const assetId of selectedAssetIds) {
      await assetController.deleteAsset(assetId);
    }
    setSelectedAssetIds([]);
  }

  async function handleReprocessFailed(): Promise<void> {
    const selectedAssets = visibleAssets.filter((a) => selectedAssetIds.includes(a.id));
    const candidates = (selectedAssets.length ? selectedAssets : visibleAssets).filter(
      canReprocessAsset,
    );
    if (!candidates.length) return;
    setFolderBusy(true);
    setFolderError('');
    try {
      for (const asset of candidates) {
        await reprocessAsset(asset.id);
      }
      assetController.refreshAssets();
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : 'Could not reprocess assets.');
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleMoveAssetsToFolder(
    assetIds: string[],
    folderId?: string,
  ): Promise<void> {
    if (!assetIds.length) return;
    setFolderBusy(true);
    setFolderError('');
    try {
      for (const assetId of assetIds) {
        await moveAsset(assetId, folderId);
      }
      assetController.refreshAssets();
      setSelectedAssetIds([]);
      setDraggedAssetIds([]);
      setDragOverFolderId(null);
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : 'Could not move selected assets.');
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleMoveSelectedToActiveFolder(): Promise<void> {
    if (!selectedAssetIds.length) return;
    await handleMoveAssetsToFolder(selectedAssetIds, getUploadFolderId());
  }

  async function handleMoveSelectedToFolderChoice(): Promise<void> {
    if (!selectedAssetIds.length) return;
    const targetFolderId = bulkTargetFolderId === 'root' ? undefined : bulkTargetFolderId;
    await handleMoveAssetsToFolder(selectedAssetIds, targetFolderId);
  }

  function handleDroppedFiles(files: FileList | File[]): void {
    const nextFiles = Array.from(files);
    if (!nextFiles.length) return;
    assetController.handleFilesUpload(nextFiles, getUploadFolderId());
  }

  // renderFolderTree returns the flat node list for the sidebar — rendering is
  // handled by the component. Exposed so the component can iterate recursively.
  function renderFolderTree(nodes: FolderTreeNode[], _depth = 0): FolderTreeNode[] {
    return nodes;
  }

  return {
    folders,
    folderTree,
    folderCards,
    selectableFolders,
    activeFolder,
    activeFolderId,
    setActiveFolderId,
    folderDraft,
    setFolderDraft,
    folderBusy,
    folderError,
    folderInputRef,
    bulkTargetFolderId,
    setBulkTargetFolderId,

    selectedAssetIds,
    allVisibleSelected,
    toggleAssetSelection,
    handleToggleSelectAllVisible,
    clearSelection: () => setSelectedAssetIds([]),

    draggedAssetIds,
    dragOverFolderId,
    dragActive,
    setDragActive,
    setDragOverFolderId,
    handleDragStart,
    handleDragEnd,

    page,
    pageCount,
    safePage,
    pageAssets,
    setPage,
    visibleAssets,

    canUseOnSelection,
    reprocessTargetCount,
    selectedReprocessableCount,
    visibleReprocessableCount,

    handleCreateFolder,
    handleRenameActiveFolder,
    handleDeleteActiveFolder,
    handleDeleteSelected,
    handleReprocessFailed,
    handleMoveSelectedToActiveFolder,
    handleMoveSelectedToFolderChoice,
    handleMoveAssetsToFolder,
    handleDroppedFiles,

    getUploadFolderId,
    isCompatibleWithSelection,
    renderFolderTree,
  };
}
