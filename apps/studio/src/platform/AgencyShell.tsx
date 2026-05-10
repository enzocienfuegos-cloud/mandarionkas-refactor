import { Button } from '../shared/ui/Button';
import { useAgencyShellController } from './agency-shell/use-agency-shell-controller';
import { AgencyCommandHero } from './agency-shell/AgencyCommandHero';
import { AgencyShellEmptyState } from './agency-shell/AgencyShellEmptyState';
import { ClientRail } from './agency-shell/ClientRail';
import { ReviewActivityRail } from './agency-shell/ReviewActivityRail';
import { listTemplates } from '../templates/library/registry';

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
  const templates = listTemplates();
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
    remoteOverview,
    toggleProjectFavorite,
  } = controller;

  const focusedClient = (
    activeClientFilter !== 'all'
      ? workspace.visibleClients.find((client) => client.id === activeClientFilter)
      : workspace.visibleClients[0]
  ) ?? null;

  const featuredProject = recentProjects[0];
  const topProjects = (remoteOverview?.topProjects ?? []).slice(0, 3).map((project) => ({
    id: project.id,
    name: project.name,
    workspaceName: project.workspaceName,
    sceneCount: project.sceneCount,
    widgetCount: project.widgetCount,
  }));

  const recentActivity = (remoteOverview?.recentActivity ?? []).slice(0, 4).map((activity) => ({
    id: activity.id,
    actorName: activity.actorName ?? 'Studio teammate',
    projectName: activity.projectName,
    action: activity.action,
    createdAt: activity.createdAt,
  }));

  async function handleResumeProject(projectId: string, clientId?: string): Promise<void> {
    if (clientId && workspace.activeClientId !== clientId) {
      await workspace.handleActiveClientChange(clientId);
    }
    markProjectOpened(projectId);
    await projectSession.handleLoadProject(projectId);
    onEnterEditor();
  }

  async function handleCreateCampaign(): Promise<void> {
    const nextClientId = focusedClient?.id ?? workspace.activeClientId ?? workspace.visibleClients[0]?.id;
    if (nextClientId && workspace.activeClientId !== nextClientId) {
      await workspace.handleActiveClientChange(nextClientId);
    }
    await projectSession.handleCreateProject();
    onEnterEditor();
  }

  function handleJumpToReview(): void {
    document.getElementById('agency-review-rail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="agency-shell">
      <header className="agency-shell-topbar agency-shell-topbar--premium">
        <div className="agency-shell-topbar__brand">
          <div className="workspace-hub-kicker">Agency command center</div>
          <h1>Continue work, launch campaigns, and review exports without leaving the hub.</h1>
          <p>Studio stays cross-client, but the hierarchy is centered on the next action instead of the whole backlog.</p>
        </div>
        <div className="agency-shell-topbar__actions">
          <label className="agency-shell-command">
            <span className="workspace-project-meta-label">Search / command</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search project, client, brand, owner"
              aria-label="Search projects and clients"
            />
          </label>
          <Button variant="primary" size="md" className="compact-action" onClick={() => void handleCreateCampaign()}>
            New campaign
          </Button>
          <div className="pill">{workspace.currentUser?.name ?? 'Guest'}</div>
          <div className="pill">{workspace.workspaceRole ?? workspace.currentUser?.role ?? 'viewer'}</div>
          <Button variant="ghost" size="sm" className="compact-action" onClick={() => void workspace.handleLogout()}>Logout</Button>
        </div>
      </header>

      <section className="agency-command-grid">
        <ClientRail
          items={clientCards.slice(0, 6).map(({ client, activeCount, sharedCount, recentProjectName }) => ({
            id: client.id,
            name: client.name,
            plan: client.plan,
            activeCount,
            sharedCount,
            recentProjectName,
          }))}
          activeClientId={activeClientFilter === 'all' ? focusedClient?.id ?? '' : activeClientFilter}
          onSelect={setActiveClientId}
          onOpen={onOpenClientWorkspace}
        />

        <AgencyCommandHero
          selectedClientName={focusedClient?.name ?? 'all visible clients'}
          templateCount={templates.length}
          featuredProject={featuredProject ? {
            name: featuredProject.name,
            summary: `${featuredProject.brandName ?? 'No brand'} · ${featuredProject.campaignName ?? 'No campaign'} · ${featuredProject.sceneCount ?? 1} scenes · ${featuredProject.widgetCount ?? 0} widgets`,
            detail: `${formatDate(projectInsights[featuredProject.id]?.lastOpenedAt ?? featuredProject.updatedAt)} · ${projectInsights[featuredProject.id]?.visitCount ?? 0} opens`,
          } : null}
          onContinue={() => {
            if (!featuredProject) return;
            void handleResumeProject(featuredProject.id, featuredProject.clientId);
          }}
          onCreateCampaign={() => void handleCreateCampaign()}
          onOpenClientWorkspace={() => {
            if (!focusedClient) return;
            onOpenClientWorkspace(focusedClient.id);
          }}
          onJumpToReview={handleJumpToReview}
        />

        <ReviewActivityRail
          topProjects={topProjects}
          recentActivity={recentActivity}
          totals={{
            exports: efficiency.totalExportEvents,
            shares: efficiency.totalShareEvents,
            openToExportMinutes: efficiency.averageOpenToExportMinutes,
          }}
          onResumeProject={(projectId) => {
            const target = remoteOverview?.topProjects.find((project) => project.id === projectId);
            void handleResumeProject(projectId, target?.workspaceId);
          }}
        />
      </section>

      <section className="agency-shell-metrics-row">
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
          <span className="workspace-hub-stat-label">Avg open → save</span>
          <strong>{efficiency.averageOpenToSaveMinutes == null ? '—' : `${efficiency.averageOpenToSaveMinutes}m`}</strong>
          <small>{efficiency.totalOpenEvents} opens · {efficiency.totalSaveEvents} saves · {efficiency.totalExportEvents} exports</small>
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
                  <Button variant="ghost" size="sm" className="compact-action" onClick={() => toggleProjectFavorite(project.id)}>
                    {projectInsights[project.id]?.isFavorite ? '★ Favorite' : '☆ Favorite'}
                  </Button>
                  <Button variant="primary" size="md" className="compact-action" onClick={() => void handleResumeProject(project.id, project.clientId)}>
                    Open
                  </Button>
                </div>
              </article>
            );
          })}
          {paginatedProjects.length === 0 ? (
            <AgencyShellEmptyState
              title="No projects match this view"
              description="Adjust client, favorites, or shared filters to widen the global project explorer."
            />
          ) : null}
        </div>
        <footer className="workspace-hub-pagination">
          <div className="pill">Page {page} / {pageCount}</div>
          <div className="workspace-hub-pagination-actions">
            <Button variant="ghost" size="sm" className="compact-action" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>Previous</Button>
            <Button variant="ghost" size="sm" className="compact-action" onClick={() => setPage(Math.min(pageCount, page + 1))} disabled={page >= pageCount}>Next</Button>
          </div>
        </footer>
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
                <Button variant="ghost" size="sm" className="compact-action" onClick={() => toggleProjectFavorite(project.id)}>Remove</Button>
                <Button variant="primary" size="md" className="compact-action" onClick={() => void handleResumeProject(project.id, project.clientId)}>Resume</Button>
              </div>
            </article>
          ))}
          {favoriteProjects.length === 0 ? (
            <AgencyShellEmptyState
              title="No favorites yet"
              description="Star projects from the recent rail to keep your cross-client priority list visible here."
            />
          ) : null}
        </div>
      </section>

      <section className="agency-shell-section">
        <div className="agency-shell-section-head">
          <div>
            <div className="workspace-hub-kicker">Momentum</div>
            <h2>Most visited projects</h2>
          </div>
        </div>
        <div className="agency-shell-slider">
          {mostVisitedProjects.map((project) => (
            <article key={project.id} className="agency-project-card agency-project-card--compact">
              <div className="agency-project-card__body">
                <h3>{project.name}</h3>
                <p>{project.brandName ?? 'No brand'} · {project.campaignName ?? 'No campaign'}</p>
                <small>{projectInsights[project.id]?.visitCount ?? 0} opens · {formatDate(project.updatedAt)}</small>
              </div>
              <div className="agency-project-card__actions">
                <Button variant="ghost" size="sm" className="compact-action" onClick={() => toggleProjectFavorite(project.id)}>
                  {projectInsights[project.id]?.isFavorite ? '★ Favorited' : '☆ Pin'}
                </Button>
                <Button variant="primary" size="md" className="compact-action" onClick={() => void handleResumeProject(project.id, project.clientId)}>
                  Resume
                </Button>
              </div>
            </article>
          ))}
          {mostVisitedProjects.length === 0 ? (
            <AgencyShellEmptyState
              title="No visit history yet"
              description="Once the team starts opening projects, the most visited queue will appear here."
            />
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
                <Button variant="primary" size="md" className="compact-action" onClick={() => onOpenClientWorkspace(client.id)}>Open workspace</Button>
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
                <Button variant="ghost" size="sm" className="compact-action" onClick={() => toggleProjectFavorite(project.id)}>
                  {projectInsights[project.id]?.isFavorite ? '★ Favorite' : '☆ Favorite'}
                </Button>
                <Button variant="primary" size="md" className="compact-action" onClick={() => void handleResumeProject(project.id, project.clientId)}>Resume</Button>
              </div>
            </article>
          ))}
          {mostVisitedProjects.length === 0 ? (
            <AgencyShellEmptyState
              title="No visit data yet"
              description="As people keep opening banners from this shell and the client workspace, this list will start surfacing the busiest work."
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
