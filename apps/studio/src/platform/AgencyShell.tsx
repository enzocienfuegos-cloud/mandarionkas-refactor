import { Button } from '../shared/ui/Button';
import { useAgencyShellController } from './agency-shell/use-agency-shell-controller';
import { ClientGrid } from './agency-shell/ClientGrid';
import { AddClientCard } from './agency-shell/AddClientCard';
import { ReviewActivityRail } from './agency-shell/ReviewActivityRail';

type AgencyShellProps = {
  onOpenClientWorkspace(clientId: string): void;
  onEnterEditor(): void;
};

function buildGreeting(name?: string): string {
  const hour = new Date().getHours();
  const dayPeriod = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${dayPeriod}, ${name ?? 'there'} — Sprint 55`;
}

export function AgencyShell({ onOpenClientWorkspace, onEnterEditor }: AgencyShellProps): JSX.Element {
  const controller = useAgencyShellController();
  const { workspace, projectSession, recentProjects, clientCards, search, setSearch, markProjectOpened, remoteOverview } = controller;

  async function handleResumeProject(projectId: string, clientId?: string): Promise<void> {
    if (clientId && workspace.activeClientId !== clientId) {
      await workspace.handleActiveClientChange(clientId);
    }
    markProjectOpened(projectId);
    await projectSession.handleLoadProject(projectId);
    onEnterEditor();
  }

  const recentActivity = remoteOverview?.recentActivity?.length
    ? remoteOverview.recentActivity.map((entry) => ({
      id: entry.id,
      actorName: entry.actorName ?? 'Studio',
      projectName: entry.projectName,
      action: entry.action,
      createdAt: entry.createdAt,
      projectId: entry.projectId,
    }))
    : recentProjects.map((project) => ({
      id: project.id,
      actorName: workspace.currentUser?.name ?? 'Studio',
      projectName: project.name,
      action: 'edited this project',
      createdAt: project.updatedAt ?? new Date().toISOString(),
      projectId: project.id,
    }));
  const searchQuery = search.trim().toLowerCase();
  const visibleClientCards = searchQuery
    ? clientCards.filter(({ client, recentProjectName }) => `${client.name} ${recentProjectName}`.toLowerCase().includes(searchQuery))
    : clientCards;
  const visibleActivity = searchQuery
    ? recentActivity.filter((entry) => `${entry.projectName} ${entry.actorName} ${entry.action}`.toLowerCase().includes(searchQuery))
    : recentActivity;

  return (
    <div className="agency-shell agency-shell--v2">
      <header className="agency-shell-topbar agency-shell-topbar--premium">
        <div className="agency-shell-topbar__brand">
          <div className="workspace-hub-kicker">Agency Hub</div>
          <h1>Agency Hub</h1>
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
          <Button variant="primary" size="md" className="compact-action" onClick={() => void controller.openAddClientDialog()}>
            New client
          </Button>
          <div className="pill">{workspace.currentUser?.name ?? 'Guest'}</div>
          <Button variant="ghost" size="sm" className="compact-action" onClick={() => void workspace.handleLogout()}>
            Logout
          </Button>
        </div>
      </header>

      <main className="agency-shell-content agency-shell-content--command-center">
        <section className="agency-greeting panel">
          <h2>{buildGreeting(workspace.currentUser?.name)}</h2>
        </section>

        <section className="agency-clients-section" aria-labelledby="agency-clients-heading">
          <div className="agency-section-head">
            <div>
              <div className="workspace-hub-kicker">Clients</div>
              <h2 id="agency-clients-heading">Open a client workspace and keep the team moving.</h2>
            </div>
          </div>
          <div className="agency-clients-grid">
            {visibleClientCards.map(({ client, activeCount, sharedCount, recentProjectName, recentUpdatedAt }) => (
              <ClientGrid.Card
                key={client.id}
                client={client}
                activeCount={activeCount}
                sharedCount={sharedCount}
                recentProjectName={recentProjectName}
                recentUpdatedAt={recentUpdatedAt}
                onOpen={() => onOpenClientWorkspace(client.id)}
              />
            ))}
            {workspace.canCreateClient ? <AddClientCard onAdd={() => void controller.openAddClientDialog()} /> : null}
          </div>
        </section>

        <ReviewActivityRail
          recentActivity={visibleActivity}
          onResumeProject={(projectId) => {
            const project = recentProjects.find((entry) => entry.id === projectId);
            void handleResumeProject(projectId, project?.clientId);
          }}
        />
      </main>
    </div>
  );
}
