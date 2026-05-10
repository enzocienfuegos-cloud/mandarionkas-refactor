import { Button } from '../../shared/ui/Button';

type ClientWorkspaceBulkBarProps = {
  selectedCount: number;
  canDeleteProjects: boolean;
  bulkFolderId: string;
  campaignFolders: Array<{ id: string; name: string }>;
  onSetBulkFolderId(folderId: string): void;
  onMove(): void;
  onDuplicate(): void;
  onArchive(): void;
  onExport(): void;
  onDelete(): void;
  onClear(): void;
};

export function ClientWorkspaceBulkBar({
  selectedCount,
  canDeleteProjects,
  bulkFolderId,
  campaignFolders,
  onSetBulkFolderId,
  onMove,
  onDuplicate,
  onArchive,
  onExport,
  onDelete,
  onClear,
}: ClientWorkspaceBulkBarProps): JSX.Element {
  return (
    <section className="client-workspace-bulk-bar panel" aria-label="Bulk banner actions">
      <div className="client-workspace-bulk-bar__summary">
        <strong>{selectedCount} selected</strong>
        <span>Move, duplicate, archive or export the selected banners.</span>
      </div>
      <div className="client-workspace-bulk-bar__actions">
        <select value={bulkFolderId} onChange={(event) => onSetBulkFolderId(event.target.value)} aria-label="Move selected banners">
          <option value="root">Move</option>
          <option value="unfiled">Unfiled</option>
          {campaignFolders.map((folder) => (
            <option key={folder.id} value={folder.id}>{folder.name}</option>
          ))}
        </select>
        <Button variant="ghost" size="sm" className="compact-action" onClick={onMove}>
          Move
        </Button>
        <Button variant="ghost" size="sm" className="compact-action" onClick={onDuplicate}>
          Duplicate
        </Button>
        <Button variant="ghost" size="sm" className="compact-action" onClick={onArchive}>
          Archive
        </Button>
        <Button variant="ghost" size="sm" className="compact-action" onClick={onExport}>
          Export
        </Button>
        {canDeleteProjects ? (
          <Button variant="danger" size="sm" className="compact-action" onClick={onDelete}>
            Delete
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="compact-action" onClick={onClear}>
          Clear
        </Button>
      </div>
    </section>
  );
}
