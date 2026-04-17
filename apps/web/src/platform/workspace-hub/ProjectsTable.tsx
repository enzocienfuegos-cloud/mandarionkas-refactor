import type { JSX } from 'react';
import { ColumnCustomizer } from './ColumnCustomizer';
import { ChevronDownIcon, DotsIcon, FilterIcon, FolderIcon, GridIcon, ImageStackIcon, ListIcon } from './icons';
import type { DisplayMode, WorkspaceFilters, WorkspaceProjectColumn, WorkspaceProjectRow } from './types';

type ColumnOption = {
  id: WorkspaceProjectColumn;
  label: string;
};

type ProjectsTableProps = {
  projects: WorkspaceProjectRow[];
  visibleColumns: WorkspaceProjectColumn[];
  displayMode: DisplayMode;
  filters: WorkspaceFilters;
  ownerOptions: string[];
  folderOptions: string[];
  sizeOptions: string[];
  columnsOpen: boolean;
  filtersOpen: boolean;
  columnOptions: ColumnOption[];
  onToggleColumns(): void;
  onToggleFilters(): void;
  onToggleColumn(column: WorkspaceProjectColumn): void;
  onDisplayModeChange(mode: DisplayMode): void;
  onFilterChange(next: WorkspaceFilters): void;
  onOpenProject(projectId: string): void;
  onDuplicateProject(projectId: string): void;
  onArchiveProject(projectId: string): void;
  onCreateProject(): void;
  onUploadAssets(): void;
};

function renderStatus(status: WorkspaceProjectRow['status']): JSX.Element {
  return <span className={`workspace-admin-status-pill is-${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</span>;
}

function renderCell(project: WorkspaceProjectRow, column: WorkspaceProjectColumn): JSX.Element | string {
  switch (column) {
    case 'project':
      return (
        <div className="workspace-admin-project-cell">
          <div className={`workspace-admin-thumb tone-${project.thumbnailTone}`}>{project.name.slice(0, 2).toUpperCase()}</div>
          <div className="workspace-admin-project-copy">
            <strong>{project.name}</strong>
            <span><FolderIcon className="workspace-admin-inline-icon tiny" /> {project.folder}</span>
          </div>
        </div>
      );
    case 'format':
      return project.format;
    case 'size':
      return project.size;
    case 'status':
      return renderStatus(project.status);
    case 'lastUpdated':
      return project.lastUpdated;
    case 'owner':
      return (
        <div className="workspace-admin-owner-cell">
          <span className="workspace-admin-owner-avatar">{project.ownerInitials}</span>
          {project.owner}
        </div>
      );
    case 'progress':
      return (
        <div className="workspace-admin-progress-cell">
          <span>{project.progress}%</span>
          <div className="workspace-admin-progress-track">
            <div className="workspace-admin-progress-fill" style={{ width: `${project.progress}%` }} />
          </div>
        </div>
      );
    case 'priority':
      return project.priority;
    case 'dueDate':
      return project.dueDate ?? 'No date';
    case 'channel':
      return project.channel;
    case 'version':
      return project.version;
    case 'campaign':
      return project.campaign;
    case 'folder':
      return project.folder;
    case 'tags':
      return project.tags.length ? project.tags.join(', ') : 'No tags';
    default:
      return '';
  }
}

export function ProjectsTable({
  projects,
  visibleColumns,
  displayMode,
  filters,
  ownerOptions,
  folderOptions,
  sizeOptions,
  columnsOpen,
  filtersOpen,
  columnOptions,
  onToggleColumns,
  onToggleFilters,
  onToggleColumn,
  onDisplayModeChange,
  onFilterChange,
  onOpenProject,
  onDuplicateProject,
  onArchiveProject,
  onCreateProject,
  onUploadAssets,
}: ProjectsTableProps): JSX.Element {
  return (
    <section className="workspace-admin-projects-card">
      <div className="workspace-admin-projects-head">
        <div>
          <h2>Active projects</h2>
          <p>Projects in flight for this client workspace.</p>
        </div>
        <div className="workspace-admin-projects-controls">
          <div className="workspace-admin-floating-control">
            <button className="workspace-admin-control-button" type="button" onClick={onToggleColumns}>
              <ImageStackIcon className="workspace-admin-inline-icon" />
              Customize columns
            </button>
            <ColumnCustomizer
              open={columnsOpen}
              options={columnOptions}
              visibleColumns={visibleColumns}
              onToggleColumn={onToggleColumn}
            />
          </div>
          <div className="workspace-admin-floating-control">
            <button className="workspace-admin-control-button" type="button" onClick={onToggleFilters}>
              <FilterIcon className="workspace-admin-inline-icon" />
              Filter
            </button>
            {filtersOpen ? (
              <div className="workspace-admin-flyout workspace-admin-filter-panel">
                <div className="workspace-admin-filter-grid">
                  <label>
                    <span>Format</span>
                    <select value={filters.format} onChange={(event) => onFilterChange({ ...filters, format: event.target.value as WorkspaceFilters['format'] })}>
                      <option value="all">All formats</option>
                      <option value="Rich Media">Rich Media</option>
                      <option value="HTML5">HTML5</option>
                      <option value="Takeover">Takeover</option>
                    </select>
                  </label>
                  <label>
                    <span>Folder</span>
                    <select value={filters.folder} onChange={(event) => onFilterChange({ ...filters, folder: event.target.value })}>
                      <option value="all">All folders</option>
                      {folderOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select value={filters.status} onChange={(event) => onFilterChange({ ...filters, status: event.target.value as WorkspaceFilters['status'] })}>
                      <option value="all">All statuses</option>
                      <option value="Draft">Draft</option>
                      <option value="In progress">In progress</option>
                      <option value="Review">Review</option>
                    </select>
                  </label>
                  <label>
                    <span>Owner</span>
                    <select value={filters.owner} onChange={(event) => onFilterChange({ ...filters, owner: event.target.value })}>
                      <option value="all">All owners</option>
                      {ownerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Last updated</span>
                    <select value={filters.lastUpdated} onChange={(event) => onFilterChange({ ...filters, lastUpdated: event.target.value as WorkspaceFilters['lastUpdated'] })}>
                      <option value="all">Any time</option>
                      <option value="24h">Last 24 hours</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                    </select>
                  </label>
                  <label>
                    <span>Size</span>
                    <select value={filters.size} onChange={(event) => onFilterChange({ ...filters, size: event.target.value })}>
                      <option value="all">All sizes</option>
                      {sizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}
          </div>
          <div className="workspace-admin-view-toggle">
            <button className={displayMode === 'list' ? 'is-active' : ''} type="button" onClick={() => onDisplayModeChange('list')}><ListIcon className="workspace-admin-inline-icon" /></button>
            <button className={displayMode === 'grid' ? 'is-active' : ''} type="button" onClick={() => onDisplayModeChange('grid')}><GridIcon className="workspace-admin-inline-icon" /></button>
          </div>
        </div>
      </div>

      {displayMode === 'list' ? (
        <div className="workspace-admin-projects-table-shell">
          <table className="workspace-admin-projects-table">
            <thead>
              <tr>
                {visibleColumns.map((column) => (
                  <th key={column}>{column === 'lastUpdated' ? 'Last updated' : column.charAt(0).toUpperCase() + column.slice(1)}</th>
                ))}
                <th className="workspace-admin-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  {visibleColumns.map((column) => (
                    <td key={`${project.id}-${column}`}>{renderCell(project, column)}</td>
                  ))}
                  <td className="workspace-admin-actions-col">
                    <details className="workspace-admin-row-menu">
                      <summary>
                        <DotsIcon className="workspace-admin-inline-icon" />
                      </summary>
                      <div className="workspace-admin-row-menu-panel">
                        <button type="button" onClick={() => onOpenProject(project.id)}>Open in editor</button>
                        <button type="button" onClick={() => onDuplicateProject(project.id)}>Duplicate</button>
                        <button type="button" onClick={() => onArchiveProject(project.id)}>Archive</button>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="workspace-admin-projects-footnote">Showing {projects.length} of {projects.length} projects</div>
        </div>
      ) : (
        <div className="workspace-admin-grid-view">
          {projects.map((project) => (
            <article key={project.id} className="workspace-admin-grid-card">
              <div className={`workspace-admin-grid-thumb tone-${project.thumbnailTone}`}>
                <span>{project.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="workspace-admin-grid-copy">
                <strong>{project.name}</strong>
                <span>{project.folder}</span>
              </div>
              <div className="workspace-admin-grid-meta">
                <span>{project.format}</span>
                <span>{project.size}</span>
                <span>{project.lastUpdated}</span>
                <span>{project.owner}</span>
              </div>
              <div className="workspace-admin-grid-actions">
                <button type="button" onClick={() => onOpenProject(project.id)}>Open in editor</button>
                <button type="button" onClick={() => onDuplicateProject(project.id)}>Duplicate</button>
                <button type="button" onClick={() => onArchiveProject(project.id)}>Archive</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="workspace-admin-empty-state">
          <h3>No projects yet</h3>
          <p>Create your first rich media or HTML5 banner for this workspace.</p>
          <div className="workspace-admin-empty-actions">
            <button type="button" onClick={onCreateProject}>New project</button>
            <button type="button" onClick={onCreateProject}>Use template</button>
            <button type="button" onClick={onUploadAssets}>Upload assets</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
