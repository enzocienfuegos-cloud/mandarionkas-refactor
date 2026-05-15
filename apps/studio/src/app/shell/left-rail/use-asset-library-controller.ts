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
import type { LeftRailController } from './use-left-rail-controller';
import {
  buildFolderTree,
  canReprocessAsset,
  filterVisibleAssets,
  flattenFolderCards,
  formatAssetMeta,
  getReprocessCandidates,
  getReprocessCounts,
  getVisibleAssetRange,
  isAssetCompatibleWithSelection,
  type FolderCard,
  type FolderTreeNode,
} from './asset-library-controller-helpers';
export type { FolderCard, FolderTreeNode } from './asset-library-controller-helpers';
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
  handleRenameFolder: (folderId: string, nextName: string) => Promise<void>;
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
};
export { formatAssetMeta, canReprocessAsset };

const PAGE_SIZE = 10;

export function useAssetLibraryController(
  assetController: LeftRailController,
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

  const refreshFolders = useCallback((): void => {
    void listAssetFolders().then(setFolders).catch(() => setFolders([]));
  }, []);

  useEffect(() => {
    refreshFolders();
  }, [refreshFolders]);

  const folderTree = useMemo<FolderTreeNode[]>(() => buildFolderTree(folders), [folders]);
  const folderCards = useMemo<FolderCard[]>(() => flattenFolderCards(folderTree), [folderTree]);
  const selectableFolders = useMemo(
    () => folderCards.filter((f) => !f.id.startsWith('project:')),
    [folderCards],
  );
  const activeFolder = useMemo(
    () => folders.find((f) => f.id === activeFolderId),
    [activeFolderId, folders],
  );
  const visibleAssets = useMemo(
    () => filterVisibleAssets(assetController.filteredAssets, activeFolderId),
    [activeFolderId, assetController.filteredAssets],
  );
  const pageCount = Math.max(1, Math.ceil(visibleAssets.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageAssets = visibleAssets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [activeFolderId, assetController.assetQuery, assetController.assetSort]);

  useEffect(() => {
    setBulkTargetFolderId(activeFolder ? activeFolder.id : 'root');
  }, [activeFolder]);

  const allVisibleSelected =
    visibleAssets.length > 0 && visibleAssets.every((a) => selectedAssetIds.includes(a.id));

  function toggleAssetSelection(assetId: string, additive: boolean, range = false): void {
    setSelectedAssetIds((current) => {
      if (range) {
        const rangeIds = getVisibleAssetRange(visibleAssets, assetId, lastSelectedAssetId);
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

  function handleDragStart(event: React.DragEvent, asset: AssetRecord): void {
    if (asset.kind !== 'image' && asset.kind !== 'video' && asset.kind !== 'font') return;
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

  function getUploadFolderId(): string | undefined {
    return activeFolderId === 'all' ? undefined : activeFolderId;
  }

  function isCompatibleWithSelection(asset: AssetRecord | undefined): boolean {
    return isAssetCompatibleWithSelection(asset, assetController);
  }

  const { selectedReprocessableCount, visibleReprocessableCount, reprocessTargetCount } = useMemo(
    () => getReprocessCounts(visibleAssets, selectedAssetIds),
    [selectedAssetIds, visibleAssets],
  );

  const selectedAsset = assetController.selectedAsset;
  const canUseOnSelection = Boolean(
    selectedAsset &&
      assetController.selectedWidgetAcceptsAsset &&
      isCompatibleWithSelection(selectedAsset),
  );

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
      const parentId = activeFolderId !== 'all' ? activeFolderId : undefined;
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
    await handleRenameFolder(activeFolder.id, nextName);
  }

  async function handleRenameFolder(folderId: string, nextName: string): Promise<void> {
    const trimmed = nextName.trim();
    if (!trimmed || !assetController.canUpdateAssets) return;
    setFolderBusy(true);
    setFolderError('');
    try {
      const renamed = await renameAssetFolder(folderId, trimmed);
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
    const candidates = getReprocessCandidates(visibleAssets, selectedAssetIds);
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

  async function handleMoveAssetsToFolder(assetIds: string[], folderId?: string): Promise<void> {
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
    handleRenameFolder,
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
  };
}
