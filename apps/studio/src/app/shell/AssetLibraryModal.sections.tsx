import { useState, type CSSProperties } from 'react';
import { useLeftRailController } from './left-rail/use-left-rail-controller';
import { useAssetLibraryController, formatAssetMeta, type FolderTreeNode } from './left-rail/use-asset-library-controller';
import type { AssetRecord } from '../../assets/types';
import { resolveFontAssetFamily } from '../../assets/font-family';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { SurfaceButton } from '../../shared/ui/SurfaceButton';
import { Tooltip } from '../../shared/ui/Tooltip';

type AssetController = ReturnType<typeof useLeftRailController>;
type AssetLibraryController = ReturnType<typeof useAssetLibraryController>;
function buildAssetModalUploadProgressStyle(progress: number): CSSProperties {
  return { width: `${progress}%` };
}

function AssetThumb({ asset }: { asset: AssetRecord }): JSX.Element {
  if (asset.kind === 'image') return <img src={asset.src} alt={asset.name} className="asset-browser-thumb" draggable={false} />;
  if (asset.kind === 'video') return <video src={asset.src} poster={asset.posterSrc} className="asset-browser-thumb" muted playsInline preload="metadata" draggable={false} />;
  if (asset.kind === 'font') return <div className="asset-browser-thumb asset-browser-thumb--fallback" style={{ fontFamily: resolveFontAssetFamily(asset), fontSize: 24, fontWeight: 800 }}>Aa</div>;
  return <div className="asset-browser-thumb asset-browser-thumb--fallback">{asset.kind.toUpperCase()}</div>;
}

function AssetDetailMedia({
  asset,
  previewUrl,
}: {
  asset: AssetRecord;
  previewUrl: string;
}): JSX.Element {
  if (asset.kind === 'video') {
    return (
      <video
        className="asset-detail-video"
        src={previewUrl}
        poster={asset.posterSrc}
        controls
        muted
        loop
        playsInline
      />
    );
  }

  if (asset.kind === 'font') {
    return (
      <div
        className="asset-detail-img"
        style={{
          display: 'grid',
          placeItems: 'center',
          fontFamily: resolveFontAssetFamily(asset),
          fontSize: 40,
          fontWeight: 800,
        }}
      >
        Aa
      </div>
    );
  }

  return <img className="asset-detail-img" src={previewUrl} alt={asset.name} />;
}

function FolderTreeItems({
  nodes,
  activeFolderId,
  draggedAssetIds,
  dragOverFolderId,
  onActivate,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  nodes: FolderTreeNode[];
  activeFolderId: string;
  draggedAssetIds: string[];
  dragOverFolderId: string | null;
  onActivate: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragLeave: (id: string) => void;
  onDrop: (id: string) => void;
}): JSX.Element {
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

export function AssetLibrarySidebar({ lib }: { lib: AssetLibraryController }): JSX.Element {
  function folderDragHandlers(folderId: string) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!lib.draggedAssetIds.length) return;
        e.preventDefault();
        lib.setDragOverFolderId(folderId);
      },
      onDragLeave: () => lib.setDragOverFolderId((cur) => (cur === folderId ? null : cur)),
      onDrop: (e: React.DragEvent) => {
        if (!lib.draggedAssetIds.length) return;
        e.preventDefault();
        lib.setDragOverFolderId(null);
        void lib.handleMoveAssetsToFolder(lib.draggedAssetIds, folderId === '__root__' ? undefined : folderId);
      },
    };
  }

  return (
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
        {!lib.folders.length ? <div className="asset-tree-empty">No projects or folders yet</div> : null}
      </div>
    </aside>
  );
}

export function AssetLibraryToolbar({
  assetController,
  lib,
  onClose,
}: {
  assetController: AssetController;
  lib: AssetLibraryController;
  onClose: () => void;
}): JSX.Element {
  return (
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
        {assetController.selectedWidgetAcceptsAsset ? (
          <Button
            variant="ghost"
            size="sm"
            className="compact-action"
            disabled={!lib.canUseOnSelection || !assetController.selectedAsset || assetController.selectedAsset.kind === 'font'}
            onClick={() => {
              if (!assetController.selectedAsset) return;
              assetController.assignAsset(assetController.selectedAsset);
              onClose();
            }}
          >
            Use on selected
          </Button>
        ) : null}
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
  );
}

export function AssetLibraryFoldersSection({
  assetController,
  lib,
}: {
  assetController: AssetController;
  lib: AssetLibraryController;
}): JSX.Element {
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  async function commitFolderRename(folderId: string, originalName: string): Promise<void> {
    const trimmed = editingFolderName.trim();
    setEditingFolderId(null);
    if (!trimmed || trimmed === originalName) return;
    await lib.handleRenameFolder(folderId, trimmed);
  }

  return (
    <div className="asset-library-browser-section">
      <div className="asset-library-browser-section-head">Folders</div>
      {lib.draggedAssetIds.length > 0 ? (
        <div className="asset-browser-drop-hint">
          Dragging {lib.draggedAssetIds.length} asset{lib.draggedAssetIds.length === 1 ? '' : 's'}.
          Drop them on a folder card, the folder tree, or the root zone on the left.
        </div>
      ) : null}
      {lib.activeFolder ? (
        <div className="asset-folder-create-row">
          <Button variant="ghost" size="sm" className="compact-action" disabled={!assetController.canUpdateAssets || lib.folderBusy} onClick={() => void lib.handleRenameActiveFolder()}>Rename active folder</Button>
          <Button variant="ghost" size="sm" className="compact-action" disabled={!assetController.canDeleteAssets || lib.folderBusy} onClick={() => void lib.handleDeleteActiveFolder()}>Delete active folder</Button>
        </div>
      ) : null}

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
      {lib.folderError ? <div className="asset-browser-inline-error">{lib.folderError}</div> : null}
      <div className="asset-folder-grid">
        {lib.folderCards.map((folder) => (
          <SurfaceButton
            key={folder.id}
            size="sm"
            className={`asset-folder-card ${typeof folder.depth === 'number' && folder.depth > 0 ? 'asset-folder-card--depth' : ''} ${lib.activeFolderId === folder.id ? 'is-active' : ''} ${editingFolderId === folder.id ? 'is-renaming' : ''}`}
            onClick={() => lib.setActiveFolderId(folder.id)}
            style={typeof folder.depth === 'number' && folder.depth > 0 ? { '--asset-folder-offset': `${folder.depth * 10}px` } as React.CSSProperties : undefined}
            onDragOver={(e) => { if (!lib.draggedAssetIds.length || folder.id.startsWith('project:')) return; e.preventDefault(); lib.setDragOverFolderId(folder.id); }}
            onDragLeave={() => lib.setDragOverFolderId((cur) => (cur === folder.id ? null : cur))}
            onDrop={(e) => { if (!lib.draggedAssetIds.length || folder.id.startsWith('project:')) return; e.preventDefault(); lib.setDragOverFolderId(null); void lib.handleMoveAssetsToFolder(lib.draggedAssetIds, folder.id); }}
            data-drop-target={lib.dragOverFolderId === folder.id ? 'true' : 'false'}
          >
            <span className="asset-folder-icon"><StudioIcon icon={StudioIcons.folder} size={16} /></span>
            {editingFolderId === folder.id ? (
              <input
                className="asset-rename-input"
                value={editingFolderName}
                autoFocus
                onChange={(event) => setEditingFolderName(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onBlur={() => void commitFolderRename(folder.id, folder.name)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void commitFolderRename(folder.id, folder.name);
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setEditingFolderId(null);
                    setEditingFolderName('');
                  }
                }}
              />
            ) : (
              <span
                className="asset-folder-name"
                onDoubleClick={(event) => {
                  if (!assetController.canUpdateAssets || folder.id.startsWith('project:')) return;
                  event.stopPropagation();
                  setEditingFolderId(folder.id);
                  setEditingFolderName(folder.name);
                }}
              >
                {folder.name}
              </span>
            )}
          </SurfaceButton>
        ))}
        {!lib.folderCards.length ? <div className="asset-browser-empty">No project folders yet.</div> : null}
      </div>
    </div>
  );
}

export function AssetLibraryFilesSection({
  assetController,
  lib,
  onClose,
}: {
  assetController: AssetController;
  lib: AssetLibraryController;
  onClose: () => void;
}): JSX.Element {
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingAssetName, setEditingAssetName] = useState('');
  const selectedAsset = assetController.selectedAsset;

  async function commitAssetRename(assetId: string, originalName: string): Promise<void> {
    const trimmed = editingAssetName.trim();
    setEditingAssetId(null);
    if (!trimmed || trimmed === originalName) return;
    await assetController.renameAssetById(assetId, trimmed);
  }

  function handleAssetCardActivation(
    asset: AssetRecord,
    options: {
      additive?: boolean;
      range?: boolean;
      closeOnApply?: boolean;
    } = {},
  ): void {
    lib.toggleAssetSelection(asset.id, Boolean(options.additive), Boolean(options.range));
    assetController.setSelectedAssetId(asset.id);

    if (options.additive || options.range) return;
    if (asset.kind === 'font') return;
    if (!lib.isCompatibleWithSelection(asset)) return;

    assetController.assignAsset(asset);
    if (options.closeOnApply ?? true) onClose();
  }

  return (
    <div className="asset-library-browser-section">
      <div className="asset-library-browser-section-head">Files</div>
      {(assetController.assetBusy || assetController.assetStatusMessage || assetController.assetError) ? (
        <div className="asset-upload-status" aria-live="polite">
          <div className="asset-upload-status-copy">
            <strong>{assetController.assetBusy ? 'Uploading asset' : 'Upload complete'}</strong>
            <span>{assetController.assetError || assetController.assetStatusMessage || 'Ready'}</span>
          </div>
          <div className="asset-upload-progress-track">
            <div className="asset-upload-progress-bar" style={buildAssetModalUploadProgressStyle(assetController.assetUploadProgress)} />
          </div>
        </div>
      ) : null}
      {lib.dragActive ? (
        <div className="asset-browser-drop-hint">Drop images, videos, or fonts anywhere in this modal to upload them.</div>
      ) : null}
      {selectedAsset ? (
        <div className="asset-detail-card">
          <div className="meta-line asset-detail-head">
            <div className="asset-detail-title">
              <strong>{selectedAsset.name}</strong>
              <small>{formatAssetMeta(selectedAsset)}</small>
            </div>
            <div className="asset-tile-badges">
              <span className="pill">{selectedAsset.kind}</span>
              {selectedAsset.folderId ? <span className="pill">folder</span> : <span className="pill">root</span>}
            </div>
          </div>
          <div className="asset-detail-preview">
            <AssetDetailMedia asset={selectedAsset} previewUrl={assetController.resolveAssetPreviewUrl(selectedAsset)} />
          </div>
          {selectedAsset.kind === 'font' ? (
            <small className="muted">
              Font installed in Studio. Choose it from the widget&apos;s `Font asset` dropdown after closing this library.
            </small>
          ) : null}
        </div>
      ) : null}
      <div className={`asset-browser-grid ${lib.selectedAssetIds.length > 0 ? 'is-selecting' : ''}`.trim()}>
        {lib.pageAssets.map((asset) => {
          const isSelected = lib.selectedAssetIds.includes(asset.id);
          return (
            <div
              key={asset.id}
              role="button"
              tabIndex={0}
              draggable={asset.kind === 'image' || asset.kind === 'video' || asset.kind === 'font'}
              className={`asset-browser-card ${isSelected ? 'is-selected' : ''} ${editingAssetId === asset.id ? 'is-renaming' : ''} ${(asset.kind === 'image' || asset.kind === 'video' || asset.kind === 'font') ? 'is-draggable' : ''}`}
              onClick={(e) => handleAssetCardActivation(asset, { additive: e.metaKey || e.ctrlKey, range: e.shiftKey })}
              onDoubleClick={() => {
                handleAssetCardActivation(asset, { closeOnApply: true });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleAssetCardActivation(asset, { additive: e.metaKey || e.ctrlKey, range: e.shiftKey });
                }
              }}
              onDragStart={(e) => lib.handleDragStart(e, asset)}
              onDragEnd={lib.handleDragEnd}
            >
              <button
                type="button"
                className="asset-browser-card__check"
                aria-checked={isSelected}
                onClick={(event) => {
                  event.stopPropagation();
                  lib.toggleAssetSelection(asset.id, true);
                }}
              >
                <StudioIcon icon={StudioIcons.check} size={12} />
              </button>
              <div className="asset-browser-media"><AssetThumb asset={asset} /></div>
              <div className="asset-browser-meta">
                {editingAssetId === asset.id ? (
                  <input
                    className="asset-rename-input"
                    value={editingAssetName}
                    autoFocus
                    onChange={(event) => setEditingAssetName(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onBlur={() => void commitAssetRename(asset.id, asset.name)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void commitAssetRename(asset.id, asset.name);
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setEditingAssetId(null);
                        setEditingAssetName('');
                      }
                    }}
                  />
                ) : (
                  <strong
                    title={asset.name}
                    onDoubleClick={(event) => {
                      if (!assetController.canUpdateAssets) return;
                      event.stopPropagation();
                      setEditingAssetId(asset.id);
                      setEditingAssetName(asset.name);
                    }}
                  >
                    {asset.name}
                  </strong>
                )}
                <small>{formatAssetMeta(asset)}</small>
              </div>
            </div>
          );
        })}
        {!lib.pageAssets.length ? <div className="asset-browser-empty">No assets found in this view.</div> : null}
      </div>
      <div className="asset-browser-pagination">
        <span className="pill">Page {lib.safePage} / {lib.pageCount}</span>
        <div className="asset-browser-pagination-actions">
          <Button variant="ghost" size="sm" className="compact-action" onClick={() => lib.setPage(Math.max(1, lib.safePage - 1))} disabled={lib.safePage <= 1}>Previous</Button>
          <Button variant="ghost" size="sm" className="compact-action" onClick={() => lib.setPage(Math.min(lib.pageCount, lib.safePage + 1))} disabled={lib.safePage >= lib.pageCount}>Next</Button>
        </div>
      </div>
    </div>
  );
}
