import { getCanvasPresetById } from '../domain/document/canvas-presets';
import { useAgencyShellController } from './agency-shell/use-agency-shell-controller';

type AgencyShellProps = {
  onOpenClientWorkspace(clientId: string): void;
  onEnterEditor(): void;
};

function formatDate(value?: string): string {
  if (!value) return 'No activity yet';
  return new Date(value).toLocaleString();
}

export function AgencyShell({ onOpenClientWorkspace, onEnterEditor }: AgencyShellProps): JSX.Element {
  const controller = useAgencyShellController();
  const {
    workspace,
    projectSession,
    projectInsights,
    recentProjects,
    favoriteProjects,
    mostVisitedProjects,
    clientCards,
    stats,
    efficiency,
    search,
    activeClientFilter,
    projectFilter,
    sortMode,
    filteredProjects,
    paginatedProjects,
    page,
    setPage,
    pageCount,
    setSearch,
    setActiveClientId,
    setProjectFilter,
    setSortMode,
    markProjectOpened,
    toggleProjectFavorite,
  } = controller;

  async function handleResumeProject(projectId: string, clientId?: string): Promise<void> {
    if (clientId && workspace.activeClientId !== clientId) {
      await workspace.handleActiveClientChange(clientId);
    }
    markProjectOpened(projectId);
    await projectSession.handleLoadProject(projectId);
    onEnterEditor();
  }

  return (
    <div className="agency-shell">
      <header className="agency-shell-topbar">
        <div>
          <div className="workspace-hub-kicker">Agency command center</div>
          <h1>Cross-client studio operations</h1>
          <p>Track recent work, jump between client workspaces, and monitor studio throughput from one global shell.</p>
        </div>
        <div className="workspace-hub-session">
          <div className="pill">{workspace.currentUser?.name ?? 'Guest'}</div>
          <div className="pill">{workspace.workspaceRole ?? workspace.currentUser?.role ?? 'viewer'}</div>
          <button className="ghost compact-action" type="button" onClick={() => void workspace.handleLogout()}>Logout</button>
        </div>
      </header>

      <section className="agency-shell-hero">
        <article className="workspace-hub-stat-card">
          <span className="workspace-hub-stat-label">Visible clients</span>
          <strong>{stats.clientCount}</strong>
          <small>Cross-agency access in this session</small>
        </article>
        <article className="workspace-hub-stat-card">
          <span className="workspace-hub-stat-label">Active projects</span>
          <strong>{stats.activeProjects}</strong>
          <small>{stats.archivedProjects} archived · {stats.sharedProjects} shared</small>
        </article>
        <article className="workspace-hub-stat-card">
          <span className="workspace-hub-stat-label">Avg widgets / banner</span>
          <strong>{efficiency.averageWidgetsPerProject}</strong>
          <small>Proxy signal until time-tracking lands</small>
        </article>
        <article className="workspace-hub-stat-card">
          <span className="workspace-hub-stat-label">Avg scenes / project</span>
          <strong>{efficiency.averageScenesPerProject}</strong>
          <small>Busiest client: {efficiency.busiestClientName}</small>
        </article>
      </section>

      <section className="agency-shell-section">
        <div className="agency-shell-section-head">
          <div>
            <div className="workspace-hub-kicker">Cross-client project index</div>
            <h2>Project explorer</h2>
          </div>
          <div className="pill">{filteredProjects.length} results</div>
        </div>
        <div className="agency-shell-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by project, brand, campaign, owner or client"
          />
          <select value={activeClientFilter} onChange={(event) => setActiveClientId(event.target.value)}>
            <option value="all">All clients</option>
            {workspace.visibleClients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value as typeof projectFilter)}>
            <option value="all">All projects</option>
            <option value="favorites">Favorites</option>
            <option value="shared">Shared with me</option>
            <option value="archived">Archived</option>
          </select>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
            <option value="recent">Recently updated</option>
            <option value="name">A to Z</option>
            <option value="most-visited">Most visited</option>
          </select>
        </div>
        <div className="agency-project-index">
          {paginatedProjects.map((project) => {
            const clientName = workspace.visibleClients.find((client) => client.id === project.clientId)?.name ?? project.clientId;
            return (
              <article key={project.id} className="agency-project-index-row">
                <div>
                  <h3>{project.name}</h3>
                  <p>{clientName} · {project.brandName ?? 'No brand'} · {project.campaignName ?? 'No campaign'}</p>
                </div>
                <div className="agency-project-index-meta">
                  <div className="pill">{project.archivedAt ? 'archived' : 'active'}</div>
                  <div className="pill">{projectInsights[project.id]?.visitCount ?? 0} opens</div>
                  <div className="pill">{project.ownerName ?? project.ownerUserId}</div>
                </div>
                <div className="agency-project-card__actions">
                  <button className="ghost compact-action" type="button" onClick={() => toggleProjectFavorite(project.id)}>
                    {projectInsights[project.id]?.isFavorite ? '★ Favorite' : '☆ Favorite'}
                  </button>
                  <button className="primary compact-action" type="button" onClick={() => void handleResumeProject(project.id, project.clientId)}>
                    Open
                  </button>
                </div>
              </article>
            );
          })}
          {paginatedProjects.length === 0 ? (
            <div className="agency-empty-state">
              <h3>No projects match this view</h3>
              <p>Adjust client, favorites, or shared filters to widen the global project explorer.</p>
            </div>
          ) : null}
        </div>
        <footer className="workspace-hub-pagination">
          <div className="pill">Page {page} / {pageCount}</div>
          <div className="workspace-hub-pagination-actions">
            <button className="ghost compact-action" type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>Previous</button>
            <button className="ghost compact-action" type="button" onClick={() => setPage(Math.min(pageCount, page + 1))} disabled={page >= pageCount}>Next</button>
          </div>
        </footer>
      </section>

      <section className="agency-shell-section">
        <div className="agency-shell-section-head">
          <div>
            <div className="workspace-hub-kicker">Continue where you left off</div>
            <h2>Recent projects</h2>
          </div>
        </div>
        <div className="agency-shell-slider">
          {recentProjects.map((project) => {
            const preset = getCanvasPresetById(project.canvasPresetId);
            return (
              <article key={project.id} className="agency-project-card">
                <button className="agency-project-card__preview" type="button" onClick={() => void handleResumeProject(project.id, project.clientId)}>
                  <div className="workspace-project-frame" style={{ aspectRatio: preset ? `${preset.width} / ${preset.height}` : '16 / 9' }}>
                    <div className="workspace-project-frame-label">{preset?.label ?? 'Saved project'}</div>
                    <div className="workspace-project-frame-meta">{project.sceneCount ?? 1} scenes · {project.widgetCount ?? 0} widgets</div>
                  </div>
                </button>
                <div className="agency-project-card__body">
                  <h3>{project.name}</h3>
                  <p>{project.brandName ?? 'No brand'} · {project.campaignName ?? 'No campaign'}</p>
                  <small>{formatDate(projectInsights[project.id]?.lastOpenedAt ?? project.updatedAt)}</small>
                </div>
                <button className="ghost compact-action" type="button" onClick={() => toggleProjectFavorite(project.id)}>
                  {projectInsights[project.id]?.isFavorite ? '★ Favorite' : '☆ Favorite'}
                </button>
              </article>
            );
          })}
          {recentProjects.length === 0 ? (
            <div className="agency-empty-state">
              <h3>No recent work yet</h3>
              <p>Open a project from any client workspace and it will start showing up here.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="agency-shell-section">
        <div className="agency-shell-section-head">
          <div>
            <div className="workspace-hub-kicker">Pinned across clients</div>
            <h2>Favorite projects</h2>
          </div>
        </div>
        <div className="agency-shell-slider">
          {favoriteProjects.map((project) => (
            <article key={project.id} className="agency-project-card agency-project-card--compact">
              <div className="agency-project-card__body">
                <h3>{project.name}</h3>
                <p>{project.brandName ?? 'No brand'} · {project.campaignName ?? 'No campaign'}</p>
                <small>{projectInsights[project.id]?.visitCount ?? 0} opens · {formatDate(projectInsights[project.id]?.lastOpenedAt ?? project.updatedAt)}</small>
              </div>
              <div className="agency-project-card__actions">
                <button className="ghost compact-action" type="button" onClick={() => toggleProjectFavorite(project.id)}>Remove</button>
                <button className="primary compact-action" type="button" onClick={() => void handleResumeProject(project.id, project.clientId)}>Resume</button>
              </div>
            </article>
          ))}
          {favoriteProjects.length === 0 ? (
            <div className="agency-empty-state">
              <h3>No favorites yet</h3>
              <p>Star projects from the recent rail to keep your cross-client priority list visible here.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="agency-shell-section">
        <div className="agency-shell-section-head">
          <div>
            <div className="workspace-hub-kicker">Cross-client workspaces</div>
            <h2>Client workspaces</h2>
          </div>
        </div>
        <div className="agency-client-grid">
          {clientCards.map(({ client, activeCount, archivedCount, sharedCount, recentProjectName, recentUpdatedAt }) => (
            <article key={client.id} className="agency-client-card">
              <div className="agency-client-card__header">
                <div>
                  <h3>{client.name}</h3>
                  <p>{client.slug}</p>
                </div>
                <span className="pill">{client.plan ?? 'studio'}</span>
              </div>
              <div className="agency-client-card__metrics">
                <div>
                  <span className="workspace-project-meta-label">Active</span>
                  <strong>{activeCount}</strong>
                </div>
                <div>
                  <span className="workspace-project-meta-label">Archived</span>
                  <strong>{archivedCount}</strong>
                </div>
                <div>
                  <span className="workspace-project-meta-label">Shared</span>
                  <strong>{sharedCount}</strong>
                </div>
              </div>
              <div className="agency-client-card__footer">
                <div>
                  <span className="workspace-project-meta-label">Latest work</span>
                  <strong>{recentProjectName}</strong>
                  <small>{formatDate(recentUpdatedAt)}</small>
                </div>
                <button className="primary compact-action" type="button" onClick={() => onOpenClientWorkspace(client.id)}>
                  Open workspace
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="agency-shell-section">
        <div className="agency-shell-section-head">
          <div>
            <div className="workspace-hub-kicker">Most visited right now</div>
            <h2>High-activity banners</h2>
          </div>
        </div>
        <div className="agency-shell-slider">
          {mostVisitedProjects.map((project) => (
            <article key={project.id} className="agency-project-card agency-project-card--compact">
              <div className="agency-project-card__body">
                <h3>{project.name}</h3>
                <p>{project.brandName ?? 'No brand'} · {project.ownerName ?? project.ownerUserId}</p>
                <small>{projectInsights[project.id]?.visitCount ?? 0} opens · {project.widgetCount ?? 0} widgets · {project.sceneCount ?? 1} scenes</small>
              </div>
              <div className="agency-project-card__actions">
                <button className="ghost compact-action" type="button" onClick={() => toggleProjectFavorite(project.id)}>
                  {projectInsights[project.id]?.isFavorite ? '★ Favorite' : '☆ Favorite'}
                </button>
                <button className="ghost compact-action" type="button" onClick={() => void handleResumeProject(project.id, project.clientId)}>
                  Resume
                </button>
              </div>
            </article>
          ))}
          {mostVisitedProjects.length === 0 ? (
            <div className="agency-empty-state">
              <h3>No visit data yet</h3>
              <p>As people keep opening banners from this shell and the client workspace, this list will start surfacing the busiest work.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
