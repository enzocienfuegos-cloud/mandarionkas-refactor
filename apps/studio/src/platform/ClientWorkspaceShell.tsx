import { Button } from '../shared/ui/Button';
import { useClientWorkspaceController } from './client-workspace/use-client-workspace-controller';
import { ClientWorkspaceProductionView } from './client-workspace/ClientWorkspaceProductionView';
import { StudioTopbar } from './shared/StudioTopbar';

type ClientWorkspaceShellProps = {
  onBackToAgencyShell(): void;
  onEnterEditor(): void;
};

export function ClientWorkspaceShell({ onBackToAgencyShell, onEnterEditor }: ClientWorkspaceShellProps): JSX.Element {
  const controller = useClientWorkspaceController();
  const { workspace, projectSession, activeClient } = controller;
  const userName = workspace.currentUser?.name?.trim() || 'Invitado';
  const userInitials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'IN';

  async function handleCreateAndEnter(): Promise<void> {
    await controller.createProjectDraft();
    onEnterEditor();
  }

  return (
    <div className="client-workspace-shell-v2">
      <StudioTopbar
        eyebrow="Client Workspace"
        title={activeClient?.name ?? 'Client'}
        searchLabel="Buscar"
        searchPlaceholder="Buscar banner, campaña o formato..."
        searchValue={controller.search}
        onSearchChange={controller.setSearch}
        primaryAction={{
          label: 'Nuevo banner',
          onClick: () => {
            if (workspace.canCreateProjects) {
              void handleCreateAndEnter();
            }
          },
          disabled: !workspace.canCreateProjects,
        }}
        user={{
          label: userName,
          avatarText: userInitials,
        }}
        showLogout={false}
        backAction={{
          label: 'Hub de clientes',
          onClick: onBackToAgencyShell,
        }}
        className="studio-shell-topbar--workspace"
      />

      {projectSession.autosaveAvailable ? (
        <div className="draft-recovery-banner" role="status">
          <div>
            <strong>Hay trabajo recuperado disponible</strong>
            <small>Podés volver al último estado autoguardado del Studio para este cliente.</small>
          </div>
          <div className="draft-recovery-banner__actions">
            <Button variant="ghost" size="sm" className="compact-action" onClick={() => void projectSession.handleClearDraft()}>
              Descartar
            </Button>
            <Button variant="primary" size="sm" className="compact-action" onClick={() => void projectSession.handleRecoverDraft().then(onEnterEditor)}>
              Recuperar draft
            </Button>
          </div>
        </div>
      ) : null}

      <main className="client-workspace-content">
        <ClientWorkspaceProductionView controller={controller} onEnterEditor={onEnterEditor} />
      </main>
    </div>
  );
}
