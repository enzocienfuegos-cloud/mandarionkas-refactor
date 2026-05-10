import { Button } from '../../shared/ui/Button';
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

  return (
    <section className="mandarion-projects-panel panel" aria-labelledby="mandarion-projects-heading">
      <div className="agency-section-head mandarion-section-head">
        <div>
          <div className="workspace-hub-kicker">Trabajos recientes</div>
          <h2 id="mandarion-projects-heading">Proyectos activos recientes</h2>
          <p>Primeros 5 proyectos activos ordenados por fecha de actualización.</p>
        </div>
      </div>

      <div className="mandarion-projects-panel__controls">
        <label className="mandarion-field">
          <span>Cliente</span>
          <select value={activeClientId} onChange={(event) => onClientFilterChange(event.target.value)} aria-label="Filtrar proyectos por cliente">
            {clientOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="mandarion-field">
          <span>Orden</span>
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

      {projects.length > 0 ? (
        <div className="mandarion-projects-table" role="table" aria-label="Listado de proyectos recientes">
          <div className="mandarion-projects-table__head" role="row">
            <span>Proyecto</span>
            <span>Cliente</span>
            <span>Estado</span>
            <span>Actualizado</span>
            <span>Acción</span>
          </div>

          <div className="mandarion-projects-table__body">
            {projects.map((project) => (
              <article key={project.id} className="mandarion-project-row" role="row">
                <div className="mandarion-project-row__title">
                  <strong>{project.name}</strong>
                  <small>{project.sceneCount ?? 1} escenas · {project.widgetCount ?? 0} widgets</small>
                </div>
                <span>{project.clientName}</span>
                <span>
                  <span className={`workspace-status-badge workspace-status-badge--${project.status}`}>{project.statusLabel}</span>
                </span>
                <span>{formatProjectUpdatedAt(project.updatedAt)}</span>
                <span>
                  <Button variant="ghost" size="sm" className="compact-action" onClick={() => onOpenProject(project)}>
                    Abrir
                  </Button>
                </span>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="mandarion-empty-state">
          <h3>No encontramos trabajos para este filtro.</h3>
          <p>Ajustá la búsqueda o cambiá el cliente para ver proyectos activos.</p>
        </div>
      )}

      <footer className="mandarion-projects-panel__footer">
        <span>Mostrando {rangeStart}-{rangeEnd} de {totalCount}</span>
        <div className="mandarion-projects-panel__pagination">
          <Button variant="ghost" size="sm" className="compact-action" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Anterior
          </Button>
          <span>Página {page} de {pageCount}</span>
          <Button variant="ghost" size="sm" className="compact-action" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
            Siguiente
          </Button>
        </div>
      </footer>
    </section>
  );
}
