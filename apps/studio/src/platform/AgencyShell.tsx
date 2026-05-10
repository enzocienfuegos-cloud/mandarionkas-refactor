import { Button } from '../shared/ui/Button';
import { TabBar } from '../shared/ui/TabBar';
import { useHashTabState } from './use-hash-tab-state';
import { useAgencyShellController } from './agency-shell/use-agency-shell-controller';
import { ClientGrid } from './agency-shell/ClientGrid';
import { AddClientCard } from './agency-shell/AddClientCard';
import { RecentWorkSlider } from './agency-shell/RecentWorkSlider';
import { TemplateMarketplace } from './template-gallery/TemplateMarketplace';

type AgencyShellProps = {
  onOpenClientWorkspace(clientId: string): void;
  onEnterEditor(): void;
};

type HubTab = 'clients' | 'recent' | 'templates';

const HUB_TABS: readonly HubTab[] = ['clients', 'recent', 'templates'];

export function AgencyShell({ onOpenClientWorkspace, onEnterEditor }: AgencyShellProps): JSX.Element {
  const controller = useAgencyShellController();
  const [activeTab, setActiveTab] = useHashTabState('/hub', HUB_TABS, 'clients');
  const { workspace, projectSession, recentProjects, clientCards, search, setSearch, markProjectOpened } = controller;

  async function handleResumeProject(projectId: string, clientId?: string): Promise<void> {
    if (clientId && workspace.activeClientId !== clientId) {
      await workspace.handleActiveClientChange(clientId);
    }
    markProjectOpened(projectId);
    await projectSession.handleLoadProject(projectId);
    onEnterEditor();
  }

  const tabs = [
    { id: 'clients' as const, label: 'Clients', count: clientCards.length },
    { id: 'recent' as const, label: 'Recent work', count: recentProjects.length },
    { id: 'templates' as const, label: 'Templates', count: controller.templateCount },
  ];

  return (
    <div className="agency-shell agency-shell--v2">
      <header className="agency-shell-topbar">
        <div className="agency-shell-topbar__brand">
          <div className="workspace-hub-kicker">Agency hub</div>
          <h1>Agency hub</h1>
          <p>Resume work, open a client workspace, or browse templates.</p>
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

      <TabBar tabs={tabs} activeTab={activeTab} onSelectTab={setActiveTab} ariaLabel="Agency hub sections" />

      <main className="agency-shell-content">
        {activeTab === 'clients' ? (
          <section className="agency-clients-tab" aria-labelledby="agency-clients-heading">
            <h2 id="agency-clients-heading" className="visually-hidden">Clients</h2>
            <div className="agency-clients-grid">
              {clientCards.map(({ client, activeCount, sharedCount, recentProjectName }) => (
                <ClientGrid.Card
                  key={client.id}
                  client={client}
                  activeCount={activeCount}
                  sharedCount={sharedCount}
                  recentProjectName={recentProjectName}
                  onOpen={() => onOpenClientWorkspace(client.id)}
                />
              ))}
              {workspace.canCreateClient ? <AddClientCard onAdd={() => void controller.openAddClientDialog()} /> : null}
            </div>
          </section>
        ) : null}

        {activeTab === 'recent' ? (
          <section className="agency-recent-tab" aria-labelledby="agency-recent-heading">
            <h2 id="agency-recent-heading" className="visually-hidden">Recent work</h2>
            <RecentWorkSlider
              projects={recentProjects}
              clients={workspace.visibleClients}
              onResume={(projectId, clientId) => void handleResumeProject(projectId, clientId)}
            />
          </section>
        ) : null}

        {activeTab === 'templates' ? (
          <section className="agency-templates-tab" aria-labelledby="agency-templates-heading">
            <h2 id="agency-templates-heading" className="visually-hidden">Templates</h2>
            <TemplateMarketplace
              onUseTemplate={(templateId, targetClientId) => void controller.handleUseTemplateGlobally(templateId, targetClientId).then(onEnterEditor)}
              showVerticalFilters
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}
