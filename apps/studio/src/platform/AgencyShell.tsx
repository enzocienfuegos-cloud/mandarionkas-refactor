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
    recentProjects,
    mostVisitedProjects,
    clientCards,
    stats,
    efficiency,
  } = controller;

  async function handleResumeProject(projectId: string, clientId?: string): Promise<void> {
    if (clientId && workspace.activeClientId !== clientId) {
      await workspace.handleActiveClientChange(clientId);
    }
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
                  <small>{formatDate(project.updatedAt)}</small>
                </div>
              </article>
            );
          })}
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
                <small>{project.widgetCount ?? 0} widgets · {project.sceneCount ?? 1} scenes</small>
              </div>
              <button className="ghost compact-action" type="button" onClick={() => void handleResumeProject(project.id, project.clientId)}>
                Resume
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
