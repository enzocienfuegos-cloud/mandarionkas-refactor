import { useAgencyShellController } from './agency-shell/use-agency-shell-controller';
import { ClientGrid } from './agency-shell/ClientGrid';
import { AddClientCard } from './agency-shell/AddClientCard';
import { RecentProjectsPanel } from './agency-shell/RecentProjectsPanel';
import { CreateClientModal } from './agency-shell/CreateClientModal';
import { StudioTopbar } from './shared/StudioTopbar';
import { StudioIcon, StudioIcons } from '../shared/ui/icons';

type AgencyShellProps = {
  onOpenClientWorkspace(clientId: string): void;
  onEnterEditor(): void;
};

export function AgencyShell({ onOpenClientWorkspace, onEnterEditor }: AgencyShellProps): JSX.Element {
  const controller = useAgencyShellController();
  const {
    workspace,
    projectSession,
    paginatedProjects,
    visibleClientCards,
    clientFilterOptions,
    summary,
    search,
    setSearch,
    activeClientFilter,
    setActiveClientId,
    sortMode,
    setSortMode,
    page,
    setPage,
    pageCount,
    pageSize,
    filteredProjects,
    markProjectOpened,
    isCreateClientOpen,
    openCreateClientModal,
    closeCreateClientModal,
    createClientName,
    setCreateClientName,
    createClientSlug,
    createClientError,
    isCreatingClient,
    submitCreateClient,
  } = controller;

  async function handleOpenProject(projectId: string, clientId?: string): Promise<void> {
    if (clientId && workspace.activeClientId !== clientId) {
      await workspace.handleActiveClientChange(clientId);
    }
    markProjectOpened(projectId);
    await projectSession.handleLoadProject(projectId);
    onEnterEditor();
  }

  async function handleCreateClient(): Promise<void> {
    const createdClient = await submitCreateClient();
    if (createdClient) {
      onOpenClientWorkspace(createdClient.id);
    }
  }

  return (
    <div className="agency-shell agency-shell--mandarion agency-shell--client-hub">
      <StudioTopbar
        className="studio-shell-topbar--hub"
        eyebrow="Studio Hub"
        title="Client Hub"
        searchLabel="Search"
        searchPlaceholder="Client or project..."
        searchValue={search}
        onSearchChange={setSearch}
        primaryAction={{
          label: 'Create client',
          onClick: openCreateClientModal,
          disabled: !workspace.canCreateClient,
        }}
        userLabel={workspace.currentUser?.name ?? 'Guest'}
        onLogout={() => void workspace.handleLogout()}
      />

      <main className="hub-content">
        <section className="hub-intro" aria-label="Hub summary">
          <div className="hub-intro-text">
            <div className="kicker">Client hub</div>
            <h2>Pick up what matters.</h2>
            <p>Active clients, recent projects, and account creation in one place.</p>
          </div>
          <div className="hub-stats">
            <div className="hub-stat">
              <StudioIcon icon={StudioIcons.users} size={13} className="hub-stat__icon" />
              <span><b>{summary.activeClientCount}</b> clients</span>
            </div>
            <div className="hub-stat">
              <StudioIcon icon={StudioIcons.layoutGrid} size={13} className="hub-stat__icon" />
              <span><b>{summary.activeProjectCount}</b> active projects</span>
            </div>
            <div className="hub-stat">
              <StudioIcon icon={StudioIcons.calendar} size={13} className="hub-stat__icon" />
              <span><b>{pageSize}</b> per page</span>
            </div>
          </div>
        </section>

        <div className="hub-grid">
          <RecentProjectsPanel
            projects={paginatedProjects}
            clientOptions={clientFilterOptions}
            activeClientId={activeClientFilter}
            sortMode={sortMode}
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            totalCount={filteredProjects.length}
            onClientFilterChange={setActiveClientId}
            onSortModeChange={setSortMode}
            onPageChange={setPage}
            onOpenProject={(project) => {
              void handleOpenProject(project.id, project.clientId);
            }}
          />

          <section className="mandarion-clients-panel client-hub-clients-panel panel" aria-labelledby="mandarion-clients-heading">
            <div className="clients-section-head">
              <div>
                <div className="workspace-hub-kicker">Clients</div>
                <h2 id="mandarion-clients-heading">Active directory</h2>
                <p>Open a workspace or create a new client. Brand kits live and persist in this hub.</p>
              </div>
              <span className="clients-count-pill">{visibleClientCards.length}</span>
            </div>

            {visibleClientCards.length > 0 ? (
              <div className="client-list">
                {visibleClientCards.map((clientCard) => (
                  <ClientGrid.Card
                    key={clientCard.client.id}
                    clientCard={clientCard}
                    onOpen={() => onOpenClientWorkspace(clientCard.client.id)}
                  />
                ))}
                {workspace.canCreateClient ? <AddClientCard onAdd={openCreateClientModal} /> : null}
              </div>
            ) : (
              <div className="empty-state">
                <strong>No clients yet</strong>
                <p>Try clearing the search or create a new client from the hub.</p>
              </div>
            )}
          </section>
        </div>
      </main>

      <CreateClientModal
        open={isCreateClientOpen}
        clientName={createClientName}
        clientSlug={createClientSlug}
        error={createClientError}
        isSubmitting={isCreatingClient}
        onNameChange={setCreateClientName}
        onClose={closeCreateClientModal}
        onSubmit={() => {
          void handleCreateClient();
        }}
      />
    </div>
  );
}
