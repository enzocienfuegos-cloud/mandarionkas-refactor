import { useState } from 'react';
import { getCanvasPresetById } from '../../domain/document/canvas-presets';
import type { ProjectSummary } from '../../repositories/types';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

export type WorkspaceProjectStatus = 'draft' | 'review' | 'ready' | 'exported' | 'archived';

export type WorkspaceProjectItem = ProjectSummary & {
  workspaceStatus: WorkspaceProjectStatus;
  inactive: boolean;
  channelBadge: string;
};

type FolderOption = { id: string; name: string };
type OwnerOption = { userId: string; label: string };

type ProjectActionBindings = {
  onOpen(): void;
  onDuplicate(): void;
  onArchive(): void;
  onRestore(): void;
  onDelete(): void;
  onMoveToFolder(folderId?: string): void;
  onSetStatus(status: 'draft' | 'review' | 'ready'): void;
};

type ProjectCardProps = ProjectActionBindings & {
  project: WorkspaceProjectItem;
  folderName: string;
  folders: FolderOption[];
  canDelete: boolean;
  ownerOptions: OwnerOption[];
  onChangeOwner(ownerUserId: string): void;
};

type WorkspaceProjectTableProps = {
  projects: WorkspaceProjectItem[];
  selectedProjectIds: string[];
  allVisibleSelected: boolean;
  canDelete: boolean;
  folders: FolderOption[];
  onSelectAll(checked: boolean): void;
  onToggleSelection(projectId: string): void;
  getProjectActions(project: WorkspaceProjectItem): ProjectActionBindings;
};

type BulkActionBarProps = {
  visible: boolean;
  selectedCount: number;
  canDelete: boolean;
  folders: FolderOption[];
  onMoveToFolder(folderId?: string): void;
  onSetStatus(status: 'draft' | 'review' | 'ready'): void;
  onArchive(): void;
  onDelete(): void;
};

function getPresetIcon(presetId?: string) {
  if (presetId?.includes('story') || presetId?.includes('vertical') || presetId?.includes('reel')) {
    return StudioIcons.smartphone;
  }
  if (presetId?.includes('custom')) {
    return StudioIcons.boxes;
  }
  return StudioIcons.library;
}

function getThumbVariant(width?: number, height?: number): string {
  if (!width || !height) return 'custom';
  if (width === height) return 'square';
  return width > height ? 'landscape' : 'portrait';
}

export function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getStatusLabel(status: WorkspaceProjectStatus): string {
  switch (status) {
    case 'draft': return 'Draft';
    case 'review': return 'Review';
    case 'ready': return 'Ready';
    case 'exported': return 'Exported';
    case 'archived': return 'Archived';
    default: return status;
  }
}

export function ProjectStatusBadge({ status }: { status: WorkspaceProjectStatus }): JSX.Element {
  return (
    <span className={`workspace-status-badge workspace-status-badge--${status}`.trim()}>
      {getStatusLabel(status)}
    </span>
  );
}

function ProjectActionsMenu({
  project,
  folders,
  canDelete,
  onOpen,
  onDuplicate,
  onArchive,
  onRestore,
  onMoveToFolder,
  onSetStatus,
  onDelete,
}: ProjectActionBindings & {
  project: WorkspaceProjectItem;
  folders: FolderOption[];
  canDelete: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="workspace-project-menu">
      <IconButton
        size="sm"
        label="Project actions"
        tooltipPlacement="bottom"
        icon={<StudioIcon icon={StudioIcons.moreHorizontal} size={14} />}
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <div className="workspace-project-menu__popover panel" role="menu" aria-label="Project actions">
          <button type="button" role="menuitem" className="workspace-project-menu__action" onClick={() => { setOpen(false); onOpen(); }}>
            Open
          </button>
          <button type="button" role="menuitem" className="workspace-project-menu__action" onClick={() => { setOpen(false); onDuplicate(); }}>
            Duplicate
          </button>
          <div className="workspace-project-menu__group-label">Move to folder</div>
          <button type="button" role="menuitem" className="workspace-project-menu__action" onClick={() => { setOpen(false); onMoveToFolder(undefined); }}>
            Unfiled
          </button>
          {folders.map((folder) => (
            <button key={folder.id} type="button" role="menuitem" className="workspace-project-menu__action" onClick={() => { setOpen(false); onMoveToFolder(folder.id); }}>
              {folder.name}
            </button>
          ))}
          <div className="workspace-project-menu__group-label">Set status</div>
          <button type="button" role="menuitem" className="workspace-project-menu__action" onClick={() => { setOpen(false); onSetStatus('draft'); }}>
            Draft
          </button>
          <button type="button" role="menuitem" className="workspace-project-menu__action" onClick={() => { setOpen(false); onSetStatus('review'); }}>
            Review
          </button>
          <button type="button" role="menuitem" className="workspace-project-menu__action" onClick={() => { setOpen(false); onSetStatus('ready'); }}>
            Ready
          </button>
          {project.workspaceStatus === 'archived' ? (
            <button type="button" role="menuitem" className="workspace-project-menu__action" onClick={() => { setOpen(false); onRestore(); }}>
              Restore
            </button>
          ) : (
            <button type="button" role="menuitem" className="workspace-project-menu__action" onClick={() => { setOpen(false); onArchive(); }}>
              Archive
            </button>
          )}
          {canDelete ? (
            <button type="button" role="menuitem" className="workspace-project-menu__action workspace-project-menu__action--danger" onClick={() => { setOpen(false); onDelete(); }}>
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BulkActionBar({
  visible,
  selectedCount,
  canDelete,
  folders,
  onMoveToFolder,
  onSetStatus,
  onArchive,
  onDelete,
}: BulkActionBarProps): JSX.Element | null {
  const [folderId, setFolderId] = useState('root');
  const [status, setStatus] = useState<'draft' | 'review' | 'ready'>('draft');

  if (!visible) return null;

  return (
    <div className="workspace-bulk-bar">
      <div className="workspace-bulk-bar__summary">{selectedCount} selected</div>
      <div className="workspace-bulk-bar__controls">
        <select value={folderId} onChange={(event) => setFolderId(event.target.value)} aria-label="Move selected projects to folder">
          <option value="root">Move to folder</option>
          <option value="unfiled">Unfiled</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>{folder.name}</option>
          ))}
        </select>
        <Button variant="ghost" size="sm" className="compact-action" onClick={() => onMoveToFolder(folderId === 'unfiled' || folderId === 'root' ? undefined : folderId)}>
          Apply folder
        </Button>
        <select value={status} onChange={(event) => setStatus(event.target.value as 'draft' | 'review' | 'ready')} aria-label="Set selected project status">
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="ready">Ready</option>
        </select>
        <Button variant="ghost" size="sm" className="compact-action" onClick={() => onSetStatus(status)}>
          Set status
        </Button>
        <Button variant="ghost" size="sm" className="compact-action" onClick={onArchive}>
          Archive
        </Button>
        {canDelete ? (
          <Button variant="danger" size="sm" className="compact-action" onClick={onDelete}>
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ProjectCard({
  project,
  folderName,
  folders,
  canDelete,
  ownerOptions,
  onOpen,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
  onMoveToFolder,
  onSetStatus,
  onChangeOwner,
}: ProjectCardProps): JSX.Element {
  const preset = getCanvasPresetById(project.canvasPresetId);
  const thumbVariant = getThumbVariant(preset?.width, preset?.height);

  return (
    <article className={`workspace-project-card ${project.inactive ? 'is-inactive' : ''}`.trim()}>
      <button className="workspace-project-preview" type="button" onClick={onOpen}>
        <div className={`workspace-project-thumb workspace-project-thumb--${thumbVariant}`.trim()}>
          <div className="workspace-project-thumb__placeholder">
            <StudioIcon icon={getPresetIcon(preset?.id)} size={28} />
            <span>{preset ? `${preset.width}×${preset.height}` : 'Custom size'}</span>
            <small>{project.sceneCount ?? 1} scenes · {project.widgetCount ?? 0} widgets</small>
          </div>
        </div>
      </button>
      <div className="workspace-project-card__body">
        <div className="workspace-project-card__header">
          <div>
            <h3>{project.name}</h3>
            <p>{project.brandName ?? 'No brand'} · {project.campaignName ?? 'No campaign'}</p>
          </div>
          <ProjectActionsMenu
            project={project}
            folders={folders}
            canDelete={canDelete}
            onOpen={onOpen}
            onDuplicate={onDuplicate}
            onArchive={onArchive}
            onRestore={onRestore}
            onDelete={onDelete}
            onMoveToFolder={onMoveToFolder}
            onSetStatus={onSetStatus}
          />
        </div>

        <div className="workspace-project-card__badges">
          <ProjectStatusBadge status={project.workspaceStatus} />
          <span className="workspace-channel-badge">{project.channelBadge}</span>
          <span className="pill">{folderName}</span>
        </div>

        <div className="workspace-project-card__meta-grid">
          <div>
            <span className="workspace-project-meta-label">Format</span>
            <strong>{preset ? `${preset.width}×${preset.height}` : 'Custom'}</strong>
          </div>
          <div>
            <span className="workspace-project-meta-label">Edited</span>
            <strong>{formatRelativeTime(project.updatedAt)}</strong>
          </div>
          <div>
            <span className="workspace-project-meta-label">Owner</span>
            <select value={project.ownerUserId ?? ''} onChange={(event) => onChangeOwner(event.target.value)}>
              {ownerOptions.map((option) => <option key={option.userId} value={option.userId}>{option.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </article>
  );
}

export function WorkspaceProjectTable({
  projects,
  selectedProjectIds,
  allVisibleSelected,
  canDelete,
  folders,
  onSelectAll,
  onToggleSelection,
  getProjectActions,
}: WorkspaceProjectTableProps): JSX.Element {
  return (
    <table>
      <thead>
        <tr>
          <th className="workspace-project-table__col workspace-project-table__col--select">
            <input
              type="checkbox"
              aria-label="Select visible projects"
              checked={allVisibleSelected}
              onChange={(event) => onSelectAll(event.target.checked)}
            />
          </th>
          <th>Name</th>
          <th className="workspace-project-table__col workspace-project-table__col--format">Format</th>
          <th className="workspace-project-table__col workspace-project-table__col--channel">Channel</th>
          <th className="workspace-project-table__col workspace-project-table__col--status">Status</th>
          <th className="workspace-project-table__col workspace-project-table__col--edited">Edited</th>
          <th className="workspace-project-table__col workspace-project-table__col--actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => {
          const preset = getCanvasPresetById(project.canvasPresetId);
          const actions = getProjectActions(project);
          return (
            <tr key={project.id}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Select ${project.name}`}
                  checked={selectedProjectIds.includes(project.id)}
                  onChange={() => onToggleSelection(project.id)}
                />
              </td>
              <td>
                <button type="button" className="workspace-project-row__name" onClick={actions.onOpen}>
                  <StudioIcon icon={getPresetIcon(project.canvasPresetId)} size={14} />
                  <span>{project.name}</span>
                </button>
              </td>
              <td>{preset ? `${preset.width}×${preset.height}` : 'Custom'}</td>
              <td><span className="workspace-channel-badge">{project.channelBadge}</span></td>
              <td><ProjectStatusBadge status={project.workspaceStatus} /></td>
              <td>{formatRelativeTime(project.updatedAt)}</td>
              <td>
                <ProjectActionsMenu
                  project={project}
                  folders={folders}
                  canDelete={canDelete}
                  onOpen={actions.onOpen}
                  onDuplicate={actions.onDuplicate}
                  onArchive={actions.onArchive}
                  onRestore={actions.onRestore}
                  onDelete={actions.onDelete}
                  onMoveToFolder={actions.onMoveToFolder}
                  onSetStatus={actions.onSetStatus}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function WorkspaceProjectBulkBar(props: BulkActionBarProps): JSX.Element | null {
  return <BulkActionBar {...props} />;
}
