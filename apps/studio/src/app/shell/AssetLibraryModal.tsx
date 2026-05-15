import { useLeftRailController } from './left-rail/use-left-rail-controller';
import { useAssetLibraryController } from './left-rail/use-asset-library-controller';
import { Button } from '../../shared/ui/Button';
import { AssetLibraryFilesSection, AssetLibraryFoldersSection, AssetLibrarySidebar, AssetLibraryToolbar } from './AssetLibraryModal.sections';
import type { AssetLibraryOpenRequest } from '../../shared/asset-library-events';

type AssetLibraryModalProps = {
  onClose: () => void;
  request?: AssetLibraryOpenRequest;
};

export function AssetLibraryModal({ onClose, request }: AssetLibraryModalProps): JSX.Element {
  const assetController = useLeftRailController();
  const lib = useAssetLibraryController(assetController);

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
          <span className="muted">
            {request?.target === 'scratch-cover'
              ? 'Choose the cover image for the selected scratch widget.'
              : request?.target === 'scratch-reveal'
                ? 'Choose the reveal image for the selected scratch widget.'
                : 'Reuse, replace, upload, organize.'}
          </span>
        </div>

        <div className="asset-library-browser-body">
          <AssetLibrarySidebar lib={lib} />

          <section className="asset-library-browser-main">
            <AssetLibraryToolbar assetController={assetController} lib={lib} onClose={onClose} request={request} />

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
                <div className="asset-bulk-bar">
                  <span>{lib.selectedAssetIds.length} selected</span>
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
                  <Button variant="ghost" size="sm" className="compact-action" disabled={lib.folderBusy} onClick={() => void lib.handleMoveSelectedToFolderChoice()}>Move to…</Button>
                  <Button variant="ghost" size="sm" className="compact-action" disabled={!assetController.canDeleteAssets} onClick={() => void lib.handleDeleteSelected()}>Delete</Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="compact-action"
                    disabled={lib.selectedReprocessableCount === 0 || lib.folderBusy || !assetController.canUpdateAssets}
                    onClick={() => void lib.handleReprocessFailed()}
                  >
                    Reprocess
                  </Button>
                  <Button variant="ghost" size="sm" className="compact-action" onClick={lib.clearSelection}>Clear</Button>
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

            <AssetLibraryFoldersSection assetController={assetController} lib={lib} />

            <AssetLibraryFilesSection assetController={assetController} lib={lib} onClose={onClose} request={request} />
          </section>
        </div>
      </div>
    </div>
  );
}
