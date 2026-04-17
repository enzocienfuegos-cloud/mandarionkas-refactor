import { useEffect, useMemo, useRef, useState } from 'react';
import type { AssetFolder, AssetRecord } from '../../assets/types';
import { clearAssetLibraryDragPayload, createAssetLibraryDragPayload, writeAssetLibraryDragPayload } from '../../canvas/stage/asset-library-drag';
import { createAssetFolder, deleteAssetFolder, listAssetFolders, moveAsset, renameAssetFolder, reprocessAsset } from '../../repositories/asset';
import { useLeftRailController } from './left-rail/use-left-rail-controller';
import { useTopBarController } from './topbar/use-top-bar-controller';

type AssetLibraryModalProps = {
  onClose: () => void;
};

const PAGE_SIZE = 10;

type FolderTreeNode = AssetFolder & {
  children: FolderTreeNode[];
};

function formatAssetMeta(asset: AssetRecord): string {
  const size = asset.sizeBytes ? `${(asset.sizeBytes / 1024).toFixed(1)} KB` : null;
  const dims = asset.width && asset.height ? `${asset.width} × ${asset.height}` : null;
  const processing = asset.processingStatus ? asset.processingStatus.replace(/-/g, ' ') : null;
  return [size, dims, processing].filter(Boolean).join(' • ') || asset.kind;
}

function renderAssetThumb(asset: AssetRecord): JSX.Element {
  if (asset.kind === 'image') return <img src={asset.src} alt={asset.name} className="asset-browser-thumb" draggable={false} />;
  if (asset.kind === 'video') return <video src={asset.src} poster={asset.posterSrc} className="asset-browser-thumb" muted draggable={false} />;
  return <div className="asset-browser-thumb asset-browser-thumb--fallback">{asset.kind.toUpperCase()}</div>;
}

function canReprocessAsset(asset: AssetRecord): boolean {
  if (asset.storageMode !== 'object-storage') return false;
  if (asset.processingStatus !== 'blocked' && asset.processingStatus !== 'failed') return false;
  if (asset.kind === 'video') return true;
  return asset.kind === 'image' && ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(String(asset.mimeType || '').trim().toLowerCase());
}

export function AssetLibraryModal({ onClose }: AssetLibraryModalProps): JSX.Element {
  const assetController = useLeftRailController();
  const topBar = useTopBarController();
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>('all');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [lastSelectedAssetId, setLastSelectedAssetId] = useState<string | null>(null);
  const [draggedAssetIds, setDraggedAssetIds] = useState<string[]>([]);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [folderDraft, setFolderDraft] = useState('');
  const [bulkMoveTargetId, setBulkMoveTargetId] = useState<string>('__root__');
  const [page, setPage] = useState(1);
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderError, setFolderError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  function refreshFolders(): void {
    void listAssetFolders().then(setFolders).catch(() => setFolders([]));
  }

  useEffect(() => {
    refreshFolders();
  }, []);

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

  const folderCards = useMemo(() => {
    const flat: Array<{ id: string; name: string; depth?: number }> = [...projectFolders.map((project) => ({ id: `project:${project.id}`, name: project.name, depth: 0 }))];
    function visit(nodes: FolderTreeNode[], depth: number): void {
      for (const node of nodes) {
        flat.push({ id: node.id, name: node.name, depth });
        if (node.children.length) visit(node.children, depth + 1);
      }
    }
    visit(folderTree, 0);
    return flat;
  }, [folderTree, projectFolders]);

  const visibleAssets = useMemo(() => {
    const filtered = assetController.filteredAssets.filter((asset) => {
      if (activeFolderId === 'all') return true;
      if (activeFolderId.startsWith('project:')) return true;
      return asset.folderId === activeFolderId;
    });
    return filtered;
  }, [activeFolderId, assetController.filteredAssets]);

  const pageCount = Math.max(1, Math.ceil(visibleAssets.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageAssets = visibleAssets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeFolder = useMemo(
    () => folders.find((folder) => folder.id === activeFolderId),
    [activeFolderId, folders],
  );

  useEffect(() => {
    setPage(1);
  }, [activeFolderId, assetController.assetQuery, assetController.assetSort]);

  useEffect(() => {
    setBulkMoveTargetId(activeFolderId !== 'all' && !activeFolderId.startsWith('project:') ? activeFolderId : '__root__');
  }, [activeFolderId]);

  function getVisibleAssetRange(assetId: string): string[] {
    if (!lastSelectedAssetId) return [assetId];
    const startIndex = visibleAssets.findIndex((asset) => asset.id === lastSelectedAssetId);
    const endIndex = visibleAssets.findIndex((asset) => asset.id === assetId);
    if (startIndex === -1 || endIndex === -1) return [assetId];
    const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
    return visibleAssets.slice(from, to + 1).map((asset) => asset.id);
  }

  function toggleAssetSelection(assetId: string, additive: boolean, range = false): void {
    setSelectedAssetIds((current) => {
      if (range) {
        const rangeIds = getVisibleAssetRange(assetId);
        return additive ? Array.from(new Set([...current, ...rangeIds])) : rangeIds;
      }
      if (!additive) return [assetId];
      return current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId];
    });
    setLastSelectedAssetId(assetId);
    assetController.setSelectedAssetId(assetId);
  }

  async function handleDeleteSelected(): Promise<void> {
    for (const assetId of selectedAssetIds) {
      await assetController.deleteAsset(assetId);
    }
    setSelectedAssetIds([]);
  }

  async function handleReprocessFailed(): Promise<void> {
    const selectedAssets = visibleAssets.filter((asset) => selectedAssetIds.includes(asset.id));
    const candidateAssets = (selectedAssets.length ? selectedAssets : visibleAssets).filter(canReprocessAsset);
    if (!candidateAssets.length) return;
    setFolderBusy(true);
    setFolderError('');
    try {
      for (const asset of candidateAssets) {
        await reprocessAsset(asset.id);
      }
      assetController.refreshAssets();
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : 'Could not reprocess assets.');
    } finally {
      setFolderBusy(false);
    }
  }

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
      const parentId = activeFolderId !== 'all' && !activeFolderId.startsWith('project:') ? activeFolderId : undefined;
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

  function getUploadFolderId(): string | undefined {
    if (activeFolderId === 'all' || activeFolderId.startsWith('project:')) return undefined;
    return activeFolderId;
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
      setFolders((current) => current.map((folder) => (folder.id === renamed.id ? renamed : folder)));
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : 'Could not rename folder.');
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleDeleteActiveFolder(): Promise<void> {
    if (!activeFolder || !assetController.canDeleteAssets || typeof window === 'undefined') return;
    const confirmed = window.confirm(`Delete folder "${activeFolder.name}"? Assets inside it will move back to the root.`);
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

  async function handleMoveSelectedToTarget(): Promise<void> {
    if (!selectedAssetIds.length) return;
    const targetFolderId = bulkMoveTargetId === '__root__' ? undefined : bulkMoveTargetId;
    await handleMoveAssetsToFolder(selectedAssetIds, targetFolderId);
  }

  function toggleAllVisibleSelection(): void {
    const allVisibleIds = pageAssets.map((asset) => asset.id);
    if (!allVisibleIds.length) return;
    const allSelected = allVisibleIds.every((assetId) => selectedAssetIds.includes(assetId));
    setSelectedAssetIds((current) => {
      if (allSelected) {
        return current.filter((assetId) => !allVisibleIds.includes(assetId));
      }
      return Array.from(new Set([...current, ...allVisibleIds]));
    });
    setLastSelectedAssetId(allVisibleIds[allVisibleIds.length - 1] ?? null);
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

  function renderFolderTree(nodes: FolderTreeNode[], depth = 0): JSX.Element[] {
    return nodes.flatMap((folder) => {
      const current = (
        <div key={folder.id}>
          <button
            type="button"
            className={`asset-tree-item asset-tree-item--nested ${activeFolderId === folder.id ? 'is-active' : ''}`}
            style={{ paddingLeft: `${16 + depth * 14}px` }}
            onClick={() => setActiveFolderId(folder.id)}
            onDragOver={(event) => {
              if (!draggedAssetIds.length) return;
              event.preventDefault();
              setDragOverFolderId(folder.id);
            }}
            onDragLeave={() => setDragOverFolderId((current) => (current === folder.id ? null : current))}
            onDrop={(event) => {
              if (!draggedAssetIds.length) return;
              event.preventDefault();
              setDragOverFolderId(null);
              void handleMoveAssetsToFolder(draggedAssetIds, folder.id);
            }}
            data-drop-target={dragOverFolderId === folder.id ? 'true' : 'false'}
          >
            <span>{folder.children.length ? '▾' : '▸'}</span>
            <span>{folder.name}</span>
          </button>
          {folder.children.length ? renderFolderTree(folder.children, depth + 1) : null}
        </div>
      );
      return current;
    });
  }

  function handleDroppedFiles(files: FileList | File[]): void {
    const nextFiles = Array.from(files);
    if (!nextFiles.length) return;
    assetController.handleFilesUpload(nextFiles, getUploadFolderId());
  }

  const selectedAsset = assetController.selectedAsset;
  function isCompatibleWithSelection(asset: AssetRecord | undefined): boolean {
    return Boolean(
      asset &&
      assetController.selectedWidgetAcceptsAsset &&
      (
        (['image', 'hero-image'].includes(assetController.primaryWidget?.type ?? '') && asset.kind === 'image')
        || (assetController.primaryWidget?.type === 'video-hero' && asset.kind === 'video')
        || (['text', 'cta', 'badge'].includes(assetController.primaryWidget?.type ?? '') && asset.kind === 'font')
      )
    );
  }
  const canUseOnSelection = Boolean(
    selectedAsset &&
    assetController.selectedWidgetAcceptsAsset &&
    isCompatibleWithSelection(selectedAsset),
  );
  const selectedReprocessableCount = visibleAssets.filter((asset) => selectedAssetIds.includes(asset.id) && canReprocessAsset(asset)).length;
  const visibleReprocessableCount = visibleAssets.filter(canReprocessAsset).length;
  const reprocessTargetCount = selectedReprocessableCount || visibleReprocessableCount;

  return (
    <div className="asset-library-modal-shell" role="dialog" aria-modal="true" aria-label="Assets" onClick={onClose}>
      <div
        className={`asset-library-browser ${dragActive ? 'is-drag-active' : ''}`}
        onClick={(event) => event.stopPropagation()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragActive(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          if (event.dataTransfer?.files?.length) {
            handleDroppedFiles(event.dataTransfer.files);
          }
        }}
      >
        <div className="asset-library-browser-header">
          <strong>Assets</strong>
          <span className="muted">Reuse, replace, upload, organize.</span>
        </div>

        <div className="asset-library-browser-body">
          <aside className="asset-library-browser-sidebar">
            <button
              type="button"
              className={`asset-tree-item ${activeFolderId === 'all' ? 'is-active' : ''}`}
              onClick={() => setActiveFolderId('all')}
              onDragOver={(event) => {
                if (!draggedAssetIds.length) return;
                event.preventDefault();
                setDragOverFolderId('__root__');
              }}
              onDragLeave={() => setDragOverFolderId((current) => (current === '__root__' ? null : current))}
              onDrop={(event) => {
                if (!draggedAssetIds.length) return;
                event.preventDefault();
                setDragOverFolderId(null);
                void handleMoveAssetsToFolder(draggedAssetIds, undefined);
              }}
              data-drop-target={dragOverFolderId === '__root__' ? 'true' : 'false'}
            >
              <span>▾</span>
              <span>Assets</span>
            </button>
            <div
              className={`asset-root-dropzone ${dragOverFolderId === '__root__' ? 'is-active' : ''}`}
              onDragOver={(event) => {
                if (!draggedAssetIds.length) return;
                event.preventDefault();
                setDragOverFolderId('__root__');
              }}
              onDragLeave={() => setDragOverFolderId((current) => (current === '__root__' ? null : current))}
              onDrop={(event) => {
                if (!draggedAssetIds.length) return;
                event.preventDefault();
                setDragOverFolderId(null);
                void handleMoveAssetsToFolder(draggedAssetIds, undefined);
              }}
            >
              {draggedAssetIds.length
                ? `Drop ${draggedAssetIds.length} asset${draggedAssetIds.length === 1 ? '' : 's'} here to move to root`
                : 'Drag assets here to move them to root'}
            </div>
            <div className="asset-tree-children">
              {projectFolders.map((project) => (
                <button key={project.id} type="button" className={`asset-tree-item asset-tree-item--nested ${activeFolderId === `project:${project.id}` ? 'is-active' : ''}`} onClick={() => setActiveFolderId(`project:${project.id}`)}>
                  <span>▸</span>
                  <span>{project.name}</span>
                </button>
              ))}
              {renderFolderTree(folderTree)}
              {!projectFolders.length && !folders.length ? <div className="asset-tree-empty">No projects or folders yet</div> : null}
            </div>
          </aside>

          <section className="asset-library-browser-main">
            <div className="asset-library-browser-toolbar">
              <div className="asset-library-browser-title">
                <strong>{activeFolderId === 'all' ? 'Assets' : 'Folder contents'}</strong>
              </div>
              <div className="asset-library-browser-controls">
                <input placeholder="Search..." value={assetController.assetQuery} onChange={(event) => assetController.setAssetQuery(event.target.value)} />
                <select value={assetController.assetSort} onChange={(event) => assetController.setAssetSort(event.target.value as typeof assetController.assetSort)}>
                  <option value="recent">Date</option>
                  <option value="name">Name</option>
                  <option value="size">Size</option>
                </select>
              </div>
              <div className="asset-library-browser-actions">
                <button className="ghost compact-action" type="button" disabled={selectedAssetIds.length === 0 || !assetController.canDeleteAssets} onClick={() => void handleDeleteSelected()}>
                  Delete
                </button>
                <button
                  className="ghost compact-action"
                  type="button"
                  disabled={reprocessTargetCount === 0 || folderBusy || !assetController.canUpdateAssets}
                  onClick={() => void handleReprocessFailed()}
                  title={selectedReprocessableCount ? `Reprocess ${selectedReprocessableCount} selected failed assets` : `Reprocess ${visibleReprocessableCount} failed assets in this view`}
                >
                  {selectedReprocessableCount ? `Reprocess selected (${selectedReprocessableCount})` : `Reprocess failed (${visibleReprocessableCount})`}
                </button>
                <select
                  value={bulkMoveTargetId}
                  onChange={(event) => setBulkMoveTargetId(event.target.value)}
                  disabled={folderBusy || !assetController.canUpdateAssets}
                  aria-label="Move selected assets to folder"
                >
                  <option value="__root__">Move to root</option>
                  {folderCards
                    .filter((folder) => !folder.id.startsWith('project:'))
                    .map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {`${'· '.repeat(folder.depth ?? 0)}${folder.name}`}
                      </option>
                    ))}
                </select>
                <button
                  className="ghost compact-action"
                  type="button"
                  disabled={selectedAssetIds.length === 0 || folderBusy || !assetController.canUpdateAssets}
                  onClick={() => void handleMoveSelectedToTarget()}
                  title={bulkMoveTargetId === '__root__' ? 'Move selected assets to root' : 'Move selected assets to selected folder'}
                >
                  Move selected
                </button>
                {assetController.selectedWidgetAcceptsAsset ? (
                  <button
                    className="ghost compact-action"
                    type="button"
                    disabled={!canUseOnSelection || !selectedAsset}
                    onClick={() => {
                      if (!selectedAsset) return;
                      assetController.assignAsset(selectedAsset);
                      onClose();
                    }}
                  >
                    Use on selected
                  </button>
                ) : null}
                <button className="primary compact-action" type="button" onClick={() => assetController.fileInputRef.current?.click()} disabled={!assetController.canCreateAssets}>
                  + New
                </button>
                <button className="ghost compact-action" type="button" onClick={onClose}>
                  ✕
                </button>
              </div>
            </div>

            <input
              ref={assetController.fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.ttf,.otf,.woff,.woff2,font/*"
              hidden
              onChange={(event) => {
                if (event.target.files?.length) {
                  assetController.handleFilesUpload(event.target.files, getUploadFolderId());
                }
                event.currentTarget.value = '';
              }}
            />

            <div className="asset-library-browser-section">
              <div className="asset-library-browser-section-head">Folders</div>
              {draggedAssetIds.length ? (
                <div className="asset-browser-drop-hint">
                  Dragging {draggedAssetIds.length} asset{draggedAssetIds.length === 1 ? '' : 's'}.
                  Drop them on a folder card, the folder tree, or the root item on the left.
                </div>
              ) : null}
              {activeFolder ? (
                <div className="asset-folder-create-row">
                  <button className="ghost compact-action" type="button" disabled={!assetController.canUpdateAssets || folderBusy} onClick={() => void handleRenameActiveFolder()}>
                    Rename active folder
                  </button>
                  <button className="ghost compact-action" type="button" disabled={!assetController.canDeleteAssets || folderBusy} onClick={() => void handleDeleteActiveFolder()}>
                    Delete active folder
                  </button>
                </div>
              ) : null}
              <div className="asset-folder-create-row">
                <input
                  ref={folderInputRef}
                  placeholder={activeFolderId !== 'all' && !activeFolderId.startsWith('project:') ? 'New subfolder name' : 'New folder name'}
                  value={folderDraft}
                  onChange={(event) => {
                    setFolderDraft(event.target.value);
                    if (folderError) setFolderError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleCreateFolder();
                    }
                  }}
                />
                <button
                  className="ghost compact-action"
                  type="button"
                  onClick={() => void handleCreateFolder()}
                  disabled={!assetController.canCreateAssets || folderBusy}
                  aria-disabled={!assetController.canCreateAssets || folderBusy}
                  title={!assetController.canCreateAssets ? 'You do not have permission to create folders.' : undefined}
                >
                  {activeFolderId !== 'all' && !activeFolderId.startsWith('project:') ? 'Create subfolder' : 'Create folder'}
                </button>
              </div>
              {folderError ? <div className="asset-browser-inline-error">{folderError}</div> : null}
              <div className="asset-folder-grid">
                {folderCards.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    className={`asset-folder-card ${activeFolderId === folder.id ? 'is-active' : ''}`}
                    onClick={() => setActiveFolderId(folder.id)}
                    style={typeof folder.depth === 'number' && folder.depth > 0 ? { marginLeft: `${folder.depth * 10}px` } : undefined}
                    onDragOver={(event) => {
                      if (!draggedAssetIds.length || folder.id.startsWith('project:')) return;
                      event.preventDefault();
                      setDragOverFolderId(folder.id);
                    }}
                    onDragLeave={() => setDragOverFolderId((current) => (current === folder.id ? null : current))}
                    onDrop={(event) => {
                      if (!draggedAssetIds.length || folder.id.startsWith('project:')) return;
                      event.preventDefault();
                      setDragOverFolderId(null);
                      void handleMoveAssetsToFolder(draggedAssetIds, folder.id);
                    }}
                    data-drop-target={dragOverFolderId === folder.id ? 'true' : 'false'}
                  >
                    <span className="asset-folder-icon">▣</span>
                    <span className="asset-folder-name">{folder.name}</span>
                  </button>
                ))}
                {!folderCards.length ? <div className="asset-browser-empty">No project folders yet.</div> : null}
              </div>
            </div>

            <div className="asset-library-browser-section">
              <div className="asset-library-browser-section-head">Files</div>
              <div className="asset-folder-create-row">
                <button
                  className="ghost compact-action"
                  type="button"
                  onClick={() => toggleAllVisibleSelection()}
                  disabled={!pageAssets.length}
                >
                  {pageAssets.length && pageAssets.every((asset) => selectedAssetIds.includes(asset.id)) ? 'Clear page selection' : 'Select all on page'}
                </button>
                <span className="pill">{selectedAssetIds.length} selected</span>
              </div>
              {assetController.assetBusy || assetController.assetStatusMessage || assetController.assetError ? (
                <div className="asset-upload-status" aria-live="polite">
                  <div className="asset-upload-status-copy">
                    <strong>{assetController.assetBusy ? 'Uploading asset' : 'Upload complete'}</strong>
                    <span>{assetController.assetError || assetController.assetStatusMessage || 'Ready'}</span>
                  </div>
                  <div className="asset-upload-progress-track">
                    <div className="asset-upload-progress-bar" style={{ width: `${assetController.assetUploadProgress}%` }} />
                  </div>
                </div>
              ) : null}
              {dragActive ? <div className="asset-browser-drop-hint">Drop images, videos, or fonts anywhere in this modal to upload them.</div> : null}
              <div className="asset-browser-grid">
                {pageAssets.map((asset) => {
                  const isSelected = selectedAssetIds.includes(asset.id);
                  return (
                    <div
                      key={asset.id}
                      role="button"
                      tabIndex={0}
                      draggable={asset.kind === 'image' || asset.kind === 'video'}
                      className={`asset-browser-card ${isSelected ? 'is-selected' : ''} ${(asset.kind === 'image' || asset.kind === 'video') ? 'is-draggable' : ''}`}
                      onClick={(event) => toggleAssetSelection(asset.id, event.metaKey || event.ctrlKey, event.shiftKey)}
                      onDoubleClick={() => {
                        assetController.setSelectedAssetId(asset.id);
                        if (isCompatibleWithSelection(asset)) {
                          assetController.assignAsset(asset);
                          onClose();
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggleAssetSelection(asset.id, event.metaKey || event.ctrlKey, event.shiftKey);
                        }
                      }}
                      onDragStart={(event) => {
                        if (asset.kind !== 'image' && asset.kind !== 'video') return;
                        const nextDraggedIds = selectedAssetIds.includes(asset.id) ? selectedAssetIds : [asset.id];
                        setDraggedAssetIds(nextDraggedIds);
                        if (!selectedAssetIds.includes(asset.id)) {
                          setSelectedAssetIds([asset.id]);
                          setLastSelectedAssetId(asset.id);
                        }
                        writeAssetLibraryDragPayload(event.dataTransfer, createAssetLibraryDragPayload(asset));
                      }}
                      onDragEnd={() => {
                        clearAssetLibraryDragPayload();
                        setDraggedAssetIds([]);
                        setDragOverFolderId(null);
                      }}
                    >
                      <label
                        className="asset-browser-card-check"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) => {
                            toggleAssetSelection(asset.id, true, event.nativeEvent instanceof MouseEvent ? event.nativeEvent.shiftKey : false);
                          }}
                        />
                      </label>
                      <div className="asset-browser-media">{renderAssetThumb(asset)}</div>
                      <div className="asset-browser-meta">
                        <strong title={asset.name}>{asset.name}</strong>
                        <small>{formatAssetMeta(asset)}</small>
                      </div>
                    </div>
                  );
                })}
                {!pageAssets.length ? <div className="asset-browser-empty">No assets found in this view.</div> : null}
              </div>
              <div className="asset-browser-pagination">
                <span className="pill">Page {safePage} / {pageCount}</span>
                <div className="asset-browser-pagination-actions">
                  <button className="ghost compact-action" type="button" onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1}>Previous</button>
                  <button className="ghost compact-action" type="button" onClick={() => setPage(Math.min(pageCount, safePage + 1))} disabled={safePage >= pageCount}>Next</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
