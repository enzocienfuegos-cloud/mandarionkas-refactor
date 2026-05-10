import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import type { AgencyProjectRow } from './use-agency-shell-controller';

function formatProjectUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function RecentProjectsPanel({
  projects,
  clientOptions,
  activeClientId,
  sortMode,
  page,
  pageCount,
  pageSize,
  totalCount,
  onOpenProject,
  onClientFilterChange,
  onSortModeChange,
  onPageChange,
}: {
  projects: AgencyProjectRow[];
  clientOptions: Array<{ value: string; label: string }>;
  activeClientId: string;
  sortMode: 'newest' | 'oldest';
  page: number;
  pageCount: number;
  pageSize: number;
  totalCount: number;
  onOpenProject(project: AgencyProjectRow): void;
  onClientFilterChange(value: string): void;
  onSortModeChange(value: 'newest' | 'oldest'): void;
  onPageChange(value: number): void;
}): JSX.Element {
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

  function buildClientInitials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '??';
  }

  return (
    <section className="mandarion-projects-panel panel" aria-labelledby="mandarion-projects-heading">
      <div className="section-head">
        <div className="section-head-text">
          <div className="kicker">Recent work</div>
          <h2 id="mandarion-projects-heading">Active projects</h2>
          <p>Sorted by last update, with pagination to browse more.</p>
        </div>
        <div className="section-controls">
          <label className="control-field">
            <span className="control-label">Client</span>
          <select value={activeClientId} onChange={(event) => onClientFilterChange(event.target.value)} aria-label="Filter projects by client">
            {clientOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          </label>

          <label className="control-field">
            <span className="control-label">Sort</span>
            <select
              value={sortMode}
              onChange={(event) => onSortModeChange(event.target.value as 'newest' | 'oldest')}
              aria-label="Sort projects by date"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
      </div>

      {projects.length > 0 ? (
        <div className="proj-table" role="table" aria-label="Recent projects">
          <div className="proj-row-head" role="row">
            <span role="columnheader">Project</span>
            <span role="columnheader">Client</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Updated</span>
            <span role="columnheader" aria-label="Action" />
          </div>

          {projects.map((project) => (
            <article
              key={project.id}
              className="proj-row proj-row--clickable"
              role="button"
              tabIndex={0}
              onClick={() => onOpenProject(project)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenProject(project);
                }
              }}
            >
              <div className="proj-main">
                <span className="proj-avatar" aria-hidden="true">{buildClientInitials(project.clientName)}</span>
                <div className="proj-info">
                  <strong>{project.name}</strong>
                  <small>{project.sceneCount ?? 1} escenas · {project.widgetCount ?? 0} widgets</small>
                </div>
              </div>
              <span className="proj-client">{project.clientName}</span>
              <span>
                <span className={`sbadge sbadge--${project.status}`}>{project.statusLabel}</span>
              </span>
              <span className="proj-date">{formatProjectUpdatedAt(project.updatedAt)}</span>
              <span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="compact-action"
                  iconAfter={<StudioIcon icon={StudioIcons.externalLink} size={11} />}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenProject(project);
                  }}
                >
                  Open
                </Button>
              </span>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>No projects</strong>
          <p>Try clearing the search or changing the client filter.</p>
        </div>
      )}

      <footer className="pagination">
        <span>Showing {rangeStart}-{rangeEnd} of {totalCount}</span>
        <div className="pagination-actions">
          <Button
            variant="ghost"
            size="sm"
            className="compact-action"
            iconBefore={<StudioIcon icon={StudioIcons.chevronLeft} size={12} />}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span>Page {page} / {pageCount}</span>
          <Button
            variant="ghost"
            size="sm"
            className="compact-action"
            iconAfter={<StudioIcon icon={StudioIcons.chevronRight} size={12} />}
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </footer>
    </section>
  );
}
