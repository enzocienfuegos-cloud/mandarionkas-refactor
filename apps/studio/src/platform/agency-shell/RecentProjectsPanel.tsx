import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import type { AgencyProjectRow } from './use-agency-shell-controller';

function formatProjectUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('es-SV', {
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
          <div className="kicker">Trabajos recientes</div>
          <h2 id="mandarion-projects-heading">Proyectos activos</h2>
          <p>Ordenados por fecha de actualización, con paginación para ver más.</p>
        </div>
        <div className="section-controls">
          <label className="control-field">
            <span className="control-label">Cliente</span>
          <select value={activeClientId} onChange={(event) => onClientFilterChange(event.target.value)} aria-label="Filtrar proyectos por cliente">
            {clientOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          </label>

          <label className="control-field">
            <span className="control-label">Orden</span>
            <select
              value={sortMode}
              onChange={(event) => onSortModeChange(event.target.value as 'newest' | 'oldest')}
              aria-label="Ordenar proyectos por fecha"
            >
              <option value="newest">Más recientes</option>
              <option value="oldest">Más antiguos</option>
            </select>
          </label>
        </div>
      </div>

      {projects.length > 0 ? (
        <div className="proj-table" role="table" aria-label="Proyectos recientes">
          <div className="proj-row-head" role="row">
            <span role="columnheader">Proyecto</span>
            <span role="columnheader">Cliente</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader">Actualizado</span>
            <span role="columnheader" aria-label="Acción" />
          </div>

          {projects.map((project) => (
            <article key={project.id} className="proj-row" role="row">
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
                  onClick={() => onOpenProject(project)}
                >
                  Abrir
                </Button>
              </span>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>Sin proyectos</strong>
          <p>Probá limpiando la búsqueda o cambiando el filtro de cliente.</p>
        </div>
      )}

      <footer className="pagination">
        <span>Mostrando {rangeStart}-{rangeEnd} de {totalCount}</span>
        <div className="pagination-actions">
          <Button
            variant="ghost"
            size="sm"
            className="compact-action"
            iconBefore={<StudioIcon icon={StudioIcons.chevronLeft} size={12} />}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </Button>
          <span>Página {page} / {pageCount}</span>
          <Button
            variant="ghost"
            size="sm"
            className="compact-action"
            iconAfter={<StudioIcon icon={StudioIcons.chevronRight} size={12} />}
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      </footer>
    </section>
  );
}
