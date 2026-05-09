import type { CSSProperties } from 'react';
import { useLeftRailController } from './left-rail/use-left-rail-controller';
import { useTopBarController } from './topbar/use-top-bar-controller';
import {
  useAssetLibraryController,
  canReprocessAsset,
  formatAssetMeta,
  type FolderTreeNode,
} from './left-rail/use-asset-library-controller';
import type { AssetRecord } from '../../assets/types';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { SurfaceButton } from '../../shared/ui/SurfaceButton';
import { Tooltip } from '../../shared/ui/Tooltip';

type AssetLibraryModalProps = {
  onClose: () => void;
};

function buildAssetModalUploadProgressStyle(progress: number): CSSProperties {
  return { width: `${progress}%` };
}

// ─── Pure render helpers ──────────────────────────────────────────────────────

function AssetThumb({ asset }: { asset: AssetRecord }): JSX.Element {
  if (asset.kind === 'image')
    return <img src={asset.src} alt={asset.name} className="asset-browser-thumb" draggable={false} />;
  if (asset.kind === 'video')
    return <video src={asset.src} poster={asset.posterSrc} className="asset-browser-thumb" muted draggable={false} />;
  return <div className="asset-browser-thumb asset-browser-thumb--fallback">{asset.kind.toUpperCase()}</div>;
}

// ─── Folder tree sidebar (recursive) ─────────────────────────────────────────

type FolderTreeProps = {
  nodes: FolderTreeNode[];
  activeFolderId: string;
  draggedAssetIds: string[];
  dragOverFolderId: string | null;
  onActivate: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragLeave: (id: string) => void;
  onDrop: (id: string) => void;
};

function FolderTreeItems({
  nodes,
  activeFolderId,
  draggedAssetIds,
  dragOverFolderId,
  onActivate,
  onDragOver,
  onDragLeave,
  onDrop,
}: FolderTreeProps): JSX.Element {
  return (
    <>
      {nodes.map((folder) => (
        <div key={folder.id}>
          <SurfaceButton
            size="sm"
            className={`asset-tree-item asset-tree-item--nested ${activeFolderId === folder.id ? 'is-active' : ''}`}
            onClick={() => onActivate(folder.id)}
            onDragOver={(e) => { if (!draggedAssetIds.length) return; e.preventDefault(); onDragOver(folder.id); }}
            onDragLeave={() => onDragLeave(folder.id)}
            onDrop={(e) => { if (!draggedAssetIds.length) return; e.preventDefault(); onDrop(folder.id); }}
            data-drop-target={dragOverFolderId === folder.id ? 'true' : 'false'}
          >
            <StudioIcon icon={folder.children.length ? StudioIcons.chevronDown : StudioIcons.chevronRight} size={14} />
            <span>{folder.name}</span>
          </SurfaceButton>
          {folder.children.length > 0 && (
            <div className="asset-tree-branch">
              <FolderTreeItems
                nodes={folder.children}
                activeFolderId={activeFolderId}
                draggedAssetIds={draggedAssetIds}
                dragOverFolderId={dragOverFolderId}
                onActivate={onActivate}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              />
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AssetLibraryModal({ onClose }: AssetLibraryModalProps): JSX.Element {
  const assetController = useLeftRailController();
  const topBar = useTopBarController();
  const lib = useAssetLibraryController(assetController, topBar);

  function folderDragHandlers(folderId: string) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!lib.draggedAssetIds.length) return;
        e.preventDefault();
        lib.setDragOverFolderId(folderId);
      },
      onDragLeave: () =>
        lib.setDragOverFolderId((cur) => (cur === folderId ? null : cur)),
      onDrop: (e: React.DragEvent) => {
        if (!lib.draggedAssetIds.length) return;
        e.preventDefault();
        lib.setDragOverFolderId(null);
        void lib.handleMoveAssetsToFolder(lib.draggedAssetIds, folderId === '__root__' ? undefined : folderId);
      },
    };
  }

  return (
    <div
      className="asset-library-modal-shell"
      role="dialog"
      aria-modal="true"
      aria-label="Assets"
      onClick={onClose}
    >
      <div
        className={`asset-library-browser ${lib.dragActive ? 'is-drag-active' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => { e.preventDefault(); lib.setDragActive(true); }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) lib.setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          lib.setDragActive(false);
          if (e.dataTransfer?.files?.length) lib.handleDroppedFiles(e.dataTransfer.files);
        }}
      >
        {/* Header */}
        <div className="asset-library-browser-header">
          <strong>Assets</strong>
          <span className="muted">Reuse, replace, upload, organize.</span>
        </div>

        <div className="asset-library-browser-body">
          {/* Sidebar */}
          <aside className="asset-library-browser-sidebar">
            <SurfaceButton
              size="sm"
              className={`asset-tree-item ${lib.activeFolderId === 'all' ? 'is-active' : ''}`}
              onClick={() => lib.setActiveFolderId('all')}
              {...folderDragHandlers('__root__')}
              data-drop-target={lib.dragOverFolderId === '__root__' ? 'true' : 'false'}
            >
              <StudioIcon icon={StudioIcons.chevronDown} size={14} />
              <span>Assets</span>
            </SurfaceButton>

            <div
              className={`asset-root-dropzone ${lib.dragOverFolderId === '__root__' ? 'is-active' : ''}`}
              {...folderDragHandlers('__root__')}
            >
              {lib.draggedAssetIds.length
                ? `Drop ${lib.draggedAssetIds.length} asset${lib.draggedAssetIds.length === 1 ? '' : 's'} here to move to root`
                : 'Drag assets here to move them to root'}
            </div>

            <div className="asset-tree-children">
              <FolderTreeItems
                nodes={lib.folderTree}
                activeFolderId={lib.activeFolderId}
                draggedAssetIds={lib.draggedAssetIds}
                dragOverFolderId={lib.dragOverFolderId}
                onActivate={lib.setActiveFolderId}
                onDragOver={(id) => lib.setDragOverFolderId(id)}
                onDragLeave={(id) => lib.setDragOverFolderId((cur) => (cur === id ? null : cur))}
                onDrop={(id) => {
                  lib.setDragOverFolderId(null);
                  void lib.handleMoveAssetsToFolder(lib.draggedAssetIds, id);
                }}
              />

              {!lib.folders.length && (
                <div className="asset-tree-empty">No projects or folders yet</div>
              )}
            </div>
          </aside>

          {/* Main panel */}
          <section className="asset-library-browser-main">
            {/* Toolbar */}
            <div className="asset-library-browser-toolbar">
              <div className="asset-library-browser-title">
                <strong>{lib.activeFolderId === 'all' ? 'Assets' : 'Folder contents'}</strong>
              </div>
              <div className="asset-library-browser-controls">
                <input
                  placeholder="Search..."
                  value={assetController.assetQuery}
                  onChange={(e) => assetController.setAssetQuery(e.target.value)}
                />
                <select
                  value={assetController.assetSort}
                  onChange={(e) => assetController.setAssetSort(e.target.value as typeof assetController.assetSort)}
                >
                  <option value="recent">Date</option>
                  <option value="name">Name</option>
                  <option value="size">Size</option>
                </select>
              </div>
              <div className="asset-library-browser-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  className="compact-action"
                  disabled={lib.selectedAssetIds.length === 0 || !assetController.canDeleteAssets}
                  onClick={() => void lib.handleDeleteSelected()}
                >
                  Delete
                </Button>
                <Tooltip content={lib.selectedReprocessableCount ? `Reprocess ${lib.selectedReprocessableCount} selected failed assets` : `Reprocess ${lib.visibleReprocessableCount} failed assets in this view`}>
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="compact-action"
                      disabled={lib.reprocessTargetCount === 0 || lib.folderBusy || !assetController.canUpdateAssets}
                      onClick={() => void lib.handleReprocessFailed()}
                    >
                      {lib.selectedReprocessableCount
                        ? `Reprocess selected (${lib.selectedReprocessableCount})`
                        : `Reprocess failed (${lib.visibleReprocessableCount})`}
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip content={lib.activeFolder ? `Move selected assets to ${lib.activeFolder.name}` : 'Move selected assets to root'}>
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="compact-action"
                      disabled={lib.selectedAssetIds.length === 0 || lib.folderBusy}
                      onClick={() => void lib.handleMoveSelectedToActiveFolder()}
                    >
                      {lib.activeFolder ? 'Move selected here' : 'Move selected to root'}
                    </Button>
                  </span>
                </Tooltip>
                {assetController.selectedWidgetAcceptsAsset && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="compact-action"
                    disabled={!lib.canUseOnSelection || !assetController.selectedAsset}
                    onClick={() => {
                      if (!assetController.selectedAsset) return;
                      assetController.assignAsset(assetController.selectedAsset);
                      onClose();
                    }}
                  >
                    Use on selected
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  className="compact-action"
                  onClick={() => assetController.fileInputRef.current?.click()}
                  disabled={!assetController.canCreateAssets}
                  iconBefore={<StudioIcon icon={StudioIcons.plus} size={16} />}
                >
                  New
                </Button>
                <IconButton
                  className="compact-action"
                  variant="ghost"
                  size="md"
                  label="Close asset library"
                  icon={<StudioIcon icon={StudioIcons.x} size={16} />}
                  onClick={onClose}
                />
              </div>
            </div>

            {/* Bulk selection */}
            <div className="asset-library-browser-section">
              <div className="meta-line asset-browser-selection-row">
                <label className="checkbox-row checkbox-row--flush">
                  <input
                    type="checkbox"
                    checked={lib.allVisibleSelected}
                    onChange={(e) => lib.handleToggleSelectAllVisible(e.target.checked)}
                  />
                  Select all in this view
                </label>
                <span className="pill">{lib.selectedAssetIds.length} selected</span>
              </div>

              {lib.selectedAssetIds.length > 0 ? (
                <div className="asset-bulk-actions">
                  <strong className="asset-bulk-actions-title">Bulk actions</strong>
                  <select
                    value={lib.bulkTargetFolderId}
                    onChange={(e) => lib.setBulkTargetFolderId(e.target.value)}
                  >
                    <option value="root">Move to root</option>
                    {lib.selectableFolders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {typeof folder.depth === 'number' && folder.depth > 0
                          ? `${'  '.repeat(folder.depth)}${folder.name}`
                          : folder.name}
                      </option>
                    ))}
                  </select>
                  <Button variant="ghost" size="sm" className="compact-action" disabled={lib.folderBusy} onClick={() => void lib.handleMoveSelectedToFolderChoice()}>Move selected</Button>
                  <Button variant="ghost" size="sm" className="compact-action" disabled={!assetController.canDeleteAssets} onClick={() => void lib.handleDeleteSelected()}>Delete selected</Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="compact-action"
                    disabled={lib.selectedReprocessableCount === 0 || lib.folderBusy || !assetController.canUpdateAssets}
                    onClick={() => void lib.handleReprocessFailed()}
                  >
                    Reprocess selected
                  </Button>
                  <Button variant="ghost" size="sm" className="compact-action" onClick={lib.clearSelection}>Clear selection</Button>
                </div>
              ) : (
                <small className="muted asset-browser-inline-hint">
                  Tip: use the checkboxes to select multiple assets, then move or delete them in bulk.
                </small>
              )}
            </div>

            {/* File input (hidden) */}
            <input
              ref={assetController.fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.ttf,.otf,.woff,.woff2,font/*"
              hidden
              onChange={(e) => {
                if (e.target.files?.length) assetController.handleFilesUpload(e.target.files, lib.getUploadFolderId());
                e.currentTarget.value = '';
              }}
            />

            {/* Folders section */}
            <div className="asset-library-browser-section">
              <div className="asset-library-browser-section-head">Folders</div>

              {lib.draggedAssetIds.length > 0 && (
                <div className="asset-browser-drop-hint">
                  Dragging {lib.draggedAssetIds.length} asset{lib.draggedAssetIds.length === 1 ? '' : 's'}.
                  Drop them on a folder card, the folder tree, or the root zone on the left.
                </div>
              )}

              {lib.activeFolder && (
                <div className="asset-folder-create-row">
                  <Button variant="ghost" size="sm" className="compact-action" disabled={!assetController.canUpdateAssets || lib.folderBusy} onClick={() => void lib.handleRenameActiveFolder()}>Rename active folder</Button>
                  <Button variant="ghost" size="sm" className="compact-action" disabled={!assetController.canDeleteAssets || lib.folderBusy} onClick={() => void lib.handleDeleteActiveFolder()}>Delete active folder</Button>
                </div>
              )}

              <div className="asset-folder-create-row">
                <input
                  ref={lib.folderInputRef}
                  placeholder={lib.activeFolderId !== 'all' && !lib.activeFolderId.startsWith('project:') ? 'New subfolder name' : 'New folder name'}
                  value={lib.folderDraft}
                  onChange={(e) => { lib.setFolderDraft(e.target.value); if (lib.folderError) lib.setFolderDraft(e.target.value); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void lib.handleCreateFolder(); } }}
                />
                <Tooltip content={!assetController.canCreateAssets ? 'You do not have permission to create folders.' : 'Create a new folder in this scope'}>
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="compact-action"
                      onClick={() => void lib.handleCreateFolder()}
                      disabled={!assetController.canCreateAssets || lib.folderBusy}
                    >
                      {lib.activeFolderId !== 'all' && !lib.activeFolderId.startsWith('project:') ? 'Create subfolder' : 'Create folder'}
                    </Button>
                  </span>
                </Tooltip>
              </div>

              {lib.folderError && <div className="asset-browser-inline-error">{lib.folderError}</div>}

              <div className="asset-folder-grid">
                {lib.folderCards.map((folder) => (
                  <SurfaceButton
                    key={folder.id}
                    size="sm"
                    className={`asset-folder-card ${typeof folder.depth === 'number' && folder.depth > 0 ? 'asset-folder-card--depth' : ''} ${lib.activeFolderId === folder.id ? 'is-active' : ''}`}
                    onClick={() => lib.setActiveFolderId(folder.id)}
                    style={typeof folder.depth === 'number' && folder.depth > 0 ? { '--asset-folder-offset': `${folder.depth * 10}px` } as React.CSSProperties : undefined}
                    onDragOver={(e) => { if (!lib.draggedAssetIds.length || folder.id.startsWith('project:')) return; e.preventDefault(); lib.setDragOverFolderId(folder.id); }}
                    onDragLeave={() => lib.setDragOverFolderId((cur) => (cur === folder.id ? null : cur))}
                    onDrop={(e) => { if (!lib.draggedAssetIds.length || folder.id.startsWith('project:')) return; e.preventDefault(); lib.setDragOverFolderId(null); void lib.handleMoveAssetsToFolder(lib.draggedAssetIds, folder.id); }}
                    data-drop-target={lib.dragOverFolderId === folder.id ? 'true' : 'false'}
                  >
                    <span className="asset-folder-icon"><StudioIcon icon={StudioIcons.folder} size={16} /></span>
                    <span className="asset-folder-name">{folder.name}</span>
                  </SurfaceButton>
                ))}
                {!lib.folderCards.length && <div className="asset-browser-empty">No project folders yet.</div>}
              </div>
            </div>

            {/* Files section */}
            <div className="asset-library-browser-section">
              <div className="asset-library-browser-section-head">Files</div>

              {(assetController.assetBusy || assetController.assetStatusMessage || assetController.assetError) && (
                <div className="asset-upload-status" aria-live="polite">
                  <div className="asset-upload-status-copy">
                    <strong>{assetController.assetBusy ? 'Uploading asset' : 'Upload complete'}</strong>
                    <span>{assetController.assetError || assetController.assetStatusMessage || 'Ready'}</span>
                  </div>
                  <div className="asset-upload-progress-track">
                    <div className="asset-upload-progress-bar" style={buildAssetModalUploadProgressStyle(assetController.assetUploadProgress)} />
                  </div>
                </div>
              )}

              {lib.dragActive && (
                <div className="asset-browser-drop-hint">Drop images, videos, or fonts anywhere in this modal to upload them.</div>
              )}

              <div className="asset-browser-grid">
                {lib.pageAssets.map((asset) => {
                  const isSelected = lib.selectedAssetIds.includes(asset.id);
                  return (
                    <div
                      key={asset.id}
                      role="button"
                      tabIndex={0}
                      draggable={asset.kind === 'image' || asset.kind === 'video'}
                      className={`asset-browser-card ${isSelected ? 'is-selected' : ''} ${(asset.kind === 'image' || asset.kind === 'video') ? 'is-draggable' : ''}`}
                      onClick={(e) => lib.toggleAssetSelection(asset.id, e.metaKey || e.ctrlKey, e.shiftKey)}
                      onDoubleClick={() => {
                        assetController.setSelectedAssetId(asset.id);
                        if (lib.isCompatibleWithSelection(asset)) {
                          assetController.assignAsset(asset);
                          onClose();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          lib.toggleAssetSelection(asset.id, e.metaKey || e.ctrlKey, e.shiftKey);
                        }
                      }}
                      onDragStart={(e) => lib.handleDragStart(e, asset)}
                      onDragEnd={lib.handleDragEnd}
                    >
                      <div className="meta-line asset-browser-card-head">
                        <label className="checkbox-row checkbox-row--flush">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              lib.toggleAssetSelection(asset.id, true);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="muted asset-browser-select-copy">Select</span>
                        </label>
                        {isSelected && <span className="pill">Selected</span>}
                      </div>
                      <div className="asset-browser-media"><AssetThumb asset={asset} /></div>
                      <div className="asset-browser-meta">
                        <strong title={asset.name}>{asset.name}</strong>
                        <small>{formatAssetMeta(asset)}</small>
                      </div>
                    </div>
                  );
                })}
                {!lib.pageAssets.length && <div className="asset-browser-empty">No assets found in this view.</div>}
              </div>

              <div className="asset-browser-pagination">
                <span className="pill">Page {lib.safePage} / {lib.pageCount}</span>
                <div className="asset-browser-pagination-actions">
                  <Button variant="ghost" size="sm" className="compact-action" onClick={() => lib.setPage(Math.max(1, lib.safePage - 1))} disabled={lib.safePage <= 1}>Previous</Button>
                  <Button variant="ghost" size="sm" className="compact-action" onClick={() => lib.setPage(Math.min(lib.pageCount, lib.safePage + 1))} disabled={lib.safePage >= lib.pageCount}>Next</Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
