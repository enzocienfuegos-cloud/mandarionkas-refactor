import { useEffect, useMemo, useState } from 'react';
import type { AssetFolder, AssetRecord } from '../../assets/types';
import { clearAssetLibraryDragPayload, createAssetLibraryDragPayload, writeAssetLibraryDragPayload } from '../../canvas/stage/asset-library-drag';
import { createRemoteAssetFolder, listRemoteAssetFolders } from '../../repositories/asset/api';
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
  return [size, dims].filter(Boolean).join(' • ') || asset.kind;
}

function renderAssetThumb(asset: AssetRecord): JSX.Element {
  if (asset.kind === 'image') return <img src={asset.src} alt={asset.name} className="asset-browser-thumb" draggable={false} />;
  if (asset.kind === 'video') return <video src={asset.src} poster={asset.posterSrc} className="asset-browser-thumb" muted draggable={false} />;
  return <div className="asset-browser-thumb asset-browser-thumb--fallback">{asset.kind.toUpperCase()}</div>;
}

export function AssetLibraryModal({ onClose }: AssetLibraryModalProps): JSX.Element {
  const assetController = useLeftRailController();
  const topBar = useTopBarController();
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>('all');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [folderDraft, setFolderDraft] = useState('');
  const [page, setPage] = useState(1);
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderError, setFolderError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    void listRemoteAssetFolders().then(setFolders).catch(() => setFolders([]));
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

  useEffect(() => {
    setPage(1);
  }, [activeFolderId, assetController.assetQuery, assetController.assetSort]);

  function toggleAssetSelection(assetId: string, additive: boolean): void {
    setSelectedAssetIds((current) => {
      if (!additive) return [assetId];
      return current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId];
    });
    assetController.setSelectedAssetId(assetId);
  }

  async function handleDeleteSelected(): Promise<void> {
    for (const assetId of selectedAssetIds) {
      await assetController.deleteAsset(assetId);
    }
    setSelectedAssetIds([]);
  }

  async function handleCreateFolder(): Promise<void> {
    const name = folderDraft.trim();
    if (!name) return;
    setFolderBusy(true);
    setFolderError('');
    try {
      const parentId = activeFolderId !== 'all' && !activeFolderId.startsWith('project:') ? activeFolderId : undefined;
      const folder = await createRemoteAssetFolder(name, parentId);
      setFolders((current) => [folder, ...current]);
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

  function renderFolderTree(nodes: FolderTreeNode[], depth = 0): JSX.Element[] {
    return nodes.flatMap((folder) => {
      const current = (
        <div key={folder.id}>
          <button
            type="button"
            className={`asset-tree-item asset-tree-item--nested ${activeFolderId === folder.id ? 'is-active' : ''}`}
            style={{ paddingLeft: `${16 + depth * 14}px` }}
            onClick={() => setActiveFolderId(folder.id)}
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
            <button type="button" className={`asset-tree-item ${activeFolderId === 'all' ? 'is-active' : ''}`} onClick={() => setActiveFolderId('all')}>
              <span>▾</span>
              <span>Assets</span>
            </button>
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
              <div className="asset-folder-create-row">
                <input
                  placeholder={activeFolderId !== 'all' && !activeFolderId.startsWith('project:') ? 'New subfolder name' : 'New folder name'}
                  value={folderDraft}
                  onChange={(event) => setFolderDraft(event.target.value)}
                />
                <button className="ghost compact-action" type="button" onClick={() => void handleCreateFolder()} disabled={!folderDraft.trim() || folderBusy}>
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
                      onClick={(event) => toggleAssetSelection(asset.id, event.metaKey || event.ctrlKey)}
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
                          toggleAssetSelection(asset.id, event.metaKey || event.ctrlKey);
                        }
                      }}
                      onDragStart={(event) => {
                        if (asset.kind !== 'image' && asset.kind !== 'video') return;
                        writeAssetLibraryDragPayload(event.dataTransfer, createAssetLibraryDragPayload(asset));
                      }}
                      onDragEnd={() => clearAssetLibraryDragPayload()}
                    >
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
