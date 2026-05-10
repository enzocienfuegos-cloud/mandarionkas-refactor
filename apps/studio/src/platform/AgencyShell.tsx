import { Button } from '../shared/ui/Button';
import { useAgencyShellController } from './agency-shell/use-agency-shell-controller';
import { AgencyCommandHero } from './agency-shell/AgencyCommandHero';
import { AgencyShellEmptyState } from './agency-shell/AgencyShellEmptyState';
import { ClientRail } from './agency-shell/ClientRail';
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
    recentProjects,
    clientCards,
    search,
    activeClientFilter,
    setSearch,
    setActiveClientId,
    markProjectOpened,
  } = controller;

  const focusedClient = (
    activeClientFilter !== 'all'
      ? workspace.visibleClients.find((client) => client.id === activeClientFilter)
      : workspace.visibleClients[0]
  ) ?? null;
  const featuredProject = recentProjects[0] ?? null;
  const continueProjects = recentProjects.slice(featuredProject ? 1 : 0, 7);

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

  return (
    <div className="agency-shell">
      <header className="agency-shell-topbar agency-shell-topbar--premium">
        <div className="agency-shell-topbar__brand">
          <div className="workspace-hub-kicker">Agency hub</div>
          <h1>Agency hub</h1>
          <p className="agency-shell-topbar__tagline">Resume work, switch client, or launch a new campaign.</p>
        </div>
        <div className="agency-shell-topbar__actions">
          <label className="agency-shell-command">
            <span className="workspace-project-meta-label">Find work</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search project, client or brand"
              aria-label="Search projects and clients"
            />
          </label>
          <Button variant="primary" size="md" className="compact-action" onClick={() => void handleCreateCampaign()}>
            New campaign
          </Button>
          <div className="pill">{workspace.currentUser?.name ?? 'Guest'}</div>
          <div className="pill">{workspace.workspaceRole ?? workspace.currentUser?.role ?? 'viewer'}</div>
          <Button variant="ghost" size="sm" className="compact-action" onClick={() => void workspace.handleLogout()}>
            Logout
          </Button>
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
            detail: `${formatDate(featuredProject.updatedAt)} · ${featuredProject.ownerName ?? 'Studio teammate'}`,
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
        />
      </section>

      <section className="agency-shell-section">
        <div className="agency-shell-section-head">
          <div>
            <div className="workspace-hub-kicker">Continue queue</div>
            <h2>Recent projects across clients</h2>
            <p>Keep the hub focused on what is most likely to reopen next.</p>
          </div>
          <div className="pill">{continueProjects.length} ready</div>
        </div>
        <div className="agency-shell-slider">
          {continueProjects.map((project) => {
            const clientName = workspace.visibleClients.find((client) => client.id === project.clientId)?.name ?? 'Client workspace';
            return (
              <article key={project.id} className="agency-project-card agency-project-card--compact">
                <div className="agency-project-card__body">
                  <h3>{project.name}</h3>
                  <p>{clientName} · {project.brandName ?? 'No brand'} · {project.campaignName ?? 'No campaign'}</p>
                  <small>{project.sceneCount ?? 1} scenes · {project.widgetCount ?? 0} widgets · {formatDate(project.updatedAt)}</small>
                </div>
                <div className="agency-project-card__actions">
                  <span className="pill">{project.archivedAt ? 'archived' : 'active'}</span>
                  <Button variant="primary" size="md" className="compact-action" onClick={() => void handleResumeProject(project.id, project.clientId)}>
                    Continue
                  </Button>
                </div>
              </article>
            );
          })}
          {continueProjects.length === 0 ? (
            <AgencyShellEmptyState
              title="No recent work yet"
              description="Start a campaign or open a client workspace and the continue queue will populate here."
            />
          ) : null}
        </div>
      </section>

      <section className="agency-shell-section">
        <div className="agency-shell-section-head">
          <div>
            <div className="workspace-hub-kicker">Client spaces</div>
            <h2>Jump into the right workspace</h2>
            <p>Use the client list as the real navigation surface instead of a backlog index.</p>
          </div>
          <div className="agency-shell-toolbar">
            <select value={activeClientFilter} onChange={(event) => setActiveClientId(event.target.value)}>
              <option value="all">All clients</option>
              {workspace.visibleClients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="agency-client-grid">
          {clientCards.map(({ client, activeCount, archivedCount, sharedCount, recentProjectName, recentUpdatedAt }) => (
            <article key={client.id} className={`agency-client-card ${focusedClient?.id === client.id ? 'is-active' : ''}`.trim()}>
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
                <Button variant="primary" size="md" className="compact-action" onClick={() => onOpenClientWorkspace(client.id)}>
                  Open workspace
                </Button>
              </div>
            </article>
          ))}
          {clientCards.length === 0 ? (
            <AgencyShellEmptyState
              title="No client spaces available"
              description="Once client workspaces are visible in this session, they will appear here as the main navigation grid."
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
