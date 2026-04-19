import { useLeftRailController } from './left-rail/use-left-rail-controller';
import { useTopBarController } from './topbar/use-top-bar-controller';
import {
  useAssetLibraryController,
  canReprocessAsset,
  formatAssetMeta,
  type FolderTreeNode,
} from './left-rail/use-asset-library-controller';
import type { AssetRecord } from '../../assets/types';

type AssetLibraryModalProps = {
  onClose: () => void;
};

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
  depth: number;
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
  depth,
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
          <button
            type="button"
            className={`asset-tree-item asset-tree-item--nested ${activeFolderId === folder.id ? 'is-active' : ''}`}
            style={{ paddingLeft: `${16 + depth * 14}px` }}
            onClick={() => onActivate(folder.id)}
            onDragOver={(e) => { if (!draggedAssetIds.length) return; e.preventDefault(); onDragOver(folder.id); }}
            onDragLeave={() => onDragLeave(folder.id)}
            onDrop={(e) => { if (!draggedAssetIds.length) return; e.preventDefault(); onDrop(folder.id); }}
            data-drop-target={dragOverFolderId === folder.id ? 'true' : 'false'}
          >
            <span>{folder.children.length ? '▾' : '▸'}</span>
            <span>{folder.name}</span>
          </button>
          {folder.children.length > 0 && (
            <FolderTreeItems
              nodes={folder.children}
              depth={depth + 1}
              activeFolderId={activeFolderId}
              draggedAssetIds={draggedAssetIds}
              dragOverFolderId={dragOverFolderId}
              onActivate={onActivate}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
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

  const projectFolders = topBar.projectSession.projects;

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
            <button
              type="button"
              className={`asset-tree-item ${lib.activeFolderId === 'all' ? 'is-active' : ''}`}
              onClick={() => lib.setActiveFolderId('all')}
              {...folderDragHandlers('__root__')}
              data-drop-target={lib.dragOverFolderId === '__root__' ? 'true' : 'false'}
            >
              <span>▾</span>
              <span>Assets</span>
            </button>

            <div
              className={`asset-root-dropzone ${lib.dragOverFolderId === '__root__' ? 'is-active' : ''}`}
              {...folderDragHandlers('__root__')}
            >
              {lib.draggedAssetIds.length
                ? `Drop ${lib.draggedAssetIds.length} asset${lib.draggedAssetIds.length === 1 ? '' : 's'} here to move to root`
                : 'Drag assets here to move them to root'}
            </div>

            <div className="asset-tree-children">
              {projectFolders.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`asset-tree-item asset-tree-item--nested ${lib.activeFolderId === `project:${project.id}` ? 'is-active' : ''}`}
                  onClick={() => lib.setActiveFolderId(`project:${project.id}`)}
                >
                  <span>▸</span>
                  <span>{project.name}</span>
                </button>
              ))}

              <FolderTreeItems
                nodes={lib.folderTree}
                depth={0}
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

              {!projectFolders.length && !lib.folders.length && (
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
                <button
                  className="ghost compact-action"
                  type="button"
                  disabled={lib.selectedAssetIds.length === 0 || !assetController.canDeleteAssets}
                  onClick={() => void lib.handleDeleteSelected()}
                >
                  Delete
                </button>
                <button
                  className="ghost compact-action"
                  type="button"
                  disabled={lib.reprocessTargetCount === 0 || lib.folderBusy || !assetController.canUpdateAssets}
                  onClick={() => void lib.handleReprocessFailed()}
                  title={
                    lib.selectedReprocessableCount
                      ? `Reprocess ${lib.selectedReprocessableCount} selected failed assets`
                      : `Reprocess ${lib.visibleReprocessableCount} failed assets in this view`
                  }
                >
                  {lib.selectedReprocessableCount
                    ? `Reprocess selected (${lib.selectedReprocessableCount})`
                    : `Reprocess failed (${lib.visibleReprocessableCount})`}
                </button>
                <button
                  className="ghost compact-action"
                  type="button"
                  disabled={lib.selectedAssetIds.length === 0 || lib.folderBusy}
                  onClick={() => void lib.handleMoveSelectedToActiveFolder()}
                  title={lib.activeFolder ? `Move selected assets to ${lib.activeFolder.name}` : 'Move selected assets to root'}
                >
                  {lib.activeFolder ? 'Move selected here' : 'Move selected to root'}
                </button>
                {assetController.selectedWidgetAcceptsAsset && (
                  <button
                    className="ghost compact-action"
                    type="button"
                    disabled={!lib.canUseOnSelection || !assetController.selectedAsset}
                    onClick={() => {
                      if (!assetController.selectedAsset) return;
                      assetController.assignAsset(assetController.selectedAsset);
                      onClose();
                    }}
                  >
                    Use on selected
                  </button>
                )}
                <button
                  className="primary compact-action"
                  type="button"
                  onClick={() => assetController.fileInputRef.current?.click()}
                  disabled={!assetController.canCreateAssets}
                >
                  + New
                </button>
                <button className="ghost compact-action" type="button" onClick={onClose}>✕</button>
              </div>
            </div>

            {/* Bulk selection */}
            <div className="asset-library-browser-section">
              <div className="meta-line" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <label className="checkbox-row" style={{ margin: 0 }}>
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
                <div className="asset-inline-actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 12 }}>Bulk actions</strong>
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
                  <button className="ghost compact-action" type="button" disabled={lib.folderBusy} onClick={() => void lib.handleMoveSelectedToFolderChoice()}>Move selected</button>
                  <button className="ghost compact-action" type="button" disabled={!assetController.canDeleteAssets} onClick={() => void lib.handleDeleteSelected()}>Delete selected</button>
                  <button
                    className="ghost compact-action"
                    type="button"
                    disabled={lib.selectedReprocessableCount === 0 || lib.folderBusy || !assetController.canUpdateAssets}
                    onClick={() => void lib.handleReprocessFailed()}
                  >
                    Reprocess selected
                  </button>
                  <button className="ghost compact-action" type="button" onClick={lib.clearSelection}>Clear selection</button>
                </div>
              ) : (
                <small className="muted" style={{ display: 'block', marginTop: 10 }}>
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
                  <button className="ghost compact-action" type="button" disabled={!assetController.canUpdateAssets || lib.folderBusy} onClick={() => void lib.handleRenameActiveFolder()}>Rename active folder</button>
                  <button className="ghost compact-action" type="button" disabled={!assetController.canDeleteAssets || lib.folderBusy} onClick={() => void lib.handleDeleteActiveFolder()}>Delete active folder</button>
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
                <button
                  className="ghost compact-action"
                  type="button"
                  onClick={() => void lib.handleCreateFolder()}
                  disabled={!assetController.canCreateAssets || lib.folderBusy}
                  title={!assetController.canCreateAssets ? 'You do not have permission to create folders.' : undefined}
                >
                  {lib.activeFolderId !== 'all' && !lib.activeFolderId.startsWith('project:') ? 'Create subfolder' : 'Create folder'}
                </button>
              </div>

              {lib.folderError && <div className="asset-browser-inline-error">{lib.folderError}</div>}

              <div className="asset-folder-grid">
                {lib.folderCards.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    className={`asset-folder-card ${lib.activeFolderId === folder.id ? 'is-active' : ''}`}
                    onClick={() => lib.setActiveFolderId(folder.id)}
                    style={typeof folder.depth === 'number' && folder.depth > 0 ? { marginLeft: `${folder.depth * 10}px` } : undefined}
                    onDragOver={(e) => { if (!lib.draggedAssetIds.length || folder.id.startsWith('project:')) return; e.preventDefault(); lib.setDragOverFolderId(folder.id); }}
                    onDragLeave={() => lib.setDragOverFolderId((cur) => (cur === folder.id ? null : cur))}
                    onDrop={(e) => { if (!lib.draggedAssetIds.length || folder.id.startsWith('project:')) return; e.preventDefault(); lib.setDragOverFolderId(null); void lib.handleMoveAssetsToFolder(lib.draggedAssetIds, folder.id); }}
                    data-drop-target={lib.dragOverFolderId === folder.id ? 'true' : 'false'}
                  >
                    <span className="asset-folder-icon">▣</span>
                    <span className="asset-folder-name">{folder.name}</span>
                  </button>
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
                    <div className="asset-upload-progress-bar" style={{ width: `${assetController.assetUploadProgress}%` }} />
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
                      <div className="meta-line" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <label className="checkbox-row" style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              lib.toggleAssetSelection(asset.id, true);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="muted" style={{ fontSize: 11 }}>Select</span>
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
                  <button className="ghost compact-action" type="button" onClick={() => lib.setPage(Math.max(1, lib.safePage - 1))} disabled={lib.safePage <= 1}>Previous</button>
                  <button className="ghost compact-action" type="button" onClick={() => lib.setPage(Math.min(lib.pageCount, lib.safePage + 1))} disabled={lib.safePage >= lib.pageCount}>Next</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
