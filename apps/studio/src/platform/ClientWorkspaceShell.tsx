import { Button } from '../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../shared/ui/icons';
import { useClientWorkspaceController } from './client-workspace/use-client-workspace-controller';
import { ClientWorkspaceProductionView } from './client-workspace/ClientWorkspaceProductionView';

type ClientWorkspaceShellProps = {
  onBackToAgencyShell(): void;
  onEnterEditor(): void;
};

export function ClientWorkspaceShell({ onBackToAgencyShell, onEnterEditor }: ClientWorkspaceShellProps): JSX.Element {
  const controller = useClientWorkspaceController();
  const { workspace, projectSession, activeClient } = controller;

  async function handleCreateAndEnter(): Promise<void> {
    await controller.createProjectDraft();
    onEnterEditor();
  }

  return (
    <div className="client-workspace-shell-v2">
      <header className="client-workspace-topbar">
        <div className="client-workspace-topbar__brand">
          <Button
            variant="ghost"
            size="sm"
            className="compact-action"
            iconBefore={<StudioIcon icon={StudioIcons.arrowLeft} size={16} />}
            onClick={onBackToAgencyShell}
          >
            Hub de clientes
          </Button>
          <div>
            <div className="workspace-hub-kicker">Workspace del cliente</div>
            <h1>{activeClient?.name ?? 'Client'}</h1>
          </div>
        </div>
        <div className="client-workspace-topbar__actions">
          <Button variant="primary" size="md" className="compact-action" onClick={() => void handleCreateAndEnter()} disabled={!workspace.canCreateProjects}>
            Nuevo banner
          </Button>
          <div className="pill">{workspace.currentUser?.name ?? 'Invitado'}</div>
          <Button variant="ghost" size="sm" className="compact-action" onClick={() => void workspace.handleLogout()}>
            Salir
          </Button>
        </div>
      </header>

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
