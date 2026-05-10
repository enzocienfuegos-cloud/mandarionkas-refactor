import { Button } from '../shared/ui/Button';
import { useAgencyShellController } from './agency-shell/use-agency-shell-controller';
import { ClientGrid } from './agency-shell/ClientGrid';
import { AddClientCard } from './agency-shell/AddClientCard';
import { RecentProjectsPanel } from './agency-shell/RecentProjectsPanel';
import { CreateClientModal } from './agency-shell/CreateClientModal';

type AgencyShellProps = {
  onOpenClientWorkspace(clientId: string): void;
  onEnterEditor(): void;
};

function formatSummaryDate(value?: string): string {
  if (!value) return 'Sin actividad reciente';
  return new Intl.DateTimeFormat('es-SV', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

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
    <div className="agency-shell agency-shell--v2 agency-shell--mandarion">
      <header className="agency-shell-topbar agency-shell-topbar--premium">
        <div className="agency-shell-topbar__brand agency-shell-topbar__brand--mandarion">
          <img
            src="/assets/mandarion-logo.svg"
            alt="MandaRion"
            className="agency-shell__brand-logo"
          />
          <div>
            <div className="workspace-hub-kicker">MandaRion</div>
            <h1>Hub de clientes</h1>
          </div>
        </div>

        <div className="agency-shell-topbar__actions agency-shell-topbar__actions--mandarion">
          <label className="agency-shell-command agency-shell-command--mandarion">
            <span className="workspace-project-meta-label">Buscar cliente o trabajo</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscá clientes, campañas o proyectos"
              aria-label="Buscar cliente o trabajo"
            />
          </label>

          {workspace.canCreateClient ? (
            <Button variant="primary" size="md" className="compact-action" onClick={openCreateClientModal}>
              Crear cliente
            </Button>
          ) : null}
          <div className="pill">{workspace.currentUser?.name ?? 'Invitado'}</div>
          <Button variant="ghost" size="sm" className="compact-action" onClick={() => void workspace.handleLogout()}>
            Salir
          </Button>
        </div>
      </header>

      <main className="agency-shell-content agency-shell-content--mandarion">
        <section className="mandarion-shell-hero panel">
          <div className="mandarion-shell-hero__copy">
            <div className="workspace-hub-kicker">Hub de clientes</div>
            <h2>Clientes activos y trabajos recientes</h2>
            <p>Visualizá clientes activos, retomá los trabajos recientes y creá nuevos workspaces sin salir del Studio.</p>
          </div>
          <div className="mandarion-shell-hero__summary" aria-label="Resumen operativo">
            <div className="mandarion-summary-card">
              <span>Clientes activos</span>
              <strong>{summary.activeClientCount}</strong>
            </div>
            <div className="mandarion-summary-card">
              <span>Proyectos activos</span>
              <strong>{summary.activeProjectCount}</strong>
            </div>
            <div className="mandarion-summary-card">
              <span>Última actualización</span>
              <strong>{formatSummaryDate(summary.latestUpdatedAt)}</strong>
            </div>
          </div>
        </section>

        <div className="mandarion-shell-grid">
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

          <section className="mandarion-clients-panel panel" aria-labelledby="mandarion-clients-heading">
            <div className="agency-section-head mandarion-section-head">
              <div>
                <div className="workspace-hub-kicker">Clientes</div>
                <h2 id="mandarion-clients-heading">Directorio activo del studio.</h2>
              </div>
            </div>

            {visibleClientCards.length > 0 ? (
              <div className="mandarion-clients-panel__grid">
                {visibleClientCards.map(({ client, projectCount, recentProjectName, latestActivityAt }) => (
                  <ClientGrid.Card
                    key={client.id}
                    client={client}
                    projectCount={projectCount}
                    recentProjectName={recentProjectName}
                    latestActivityAt={latestActivityAt}
                    onOpen={() => onOpenClientWorkspace(client.id)}
                  />
                ))}
                {workspace.canCreateClient ? <AddClientCard onAdd={openCreateClientModal} /> : null}
              </div>
            ) : (
              <div className="mandarion-empty-state">
                <h3>No hay clientes para esta búsqueda.</h3>
                <p>Cambiá la búsqueda o creá un nuevo cliente para seguir trabajando desde el hub.</p>
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
