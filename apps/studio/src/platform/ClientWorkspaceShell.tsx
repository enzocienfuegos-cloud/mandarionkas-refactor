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
  const userName = workspace.currentUser?.name?.trim() || 'Guest';
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
        searchLabel="Search"
        searchPlaceholder="Search banner, campaign, or format..."
        searchValue={controller.search}
        onSearchChange={controller.setSearch}
        primaryAction={{
          label: 'New banner',
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
          label: 'Client hub',
          onClick: onBackToAgencyShell,
        }}
        className="studio-shell-topbar--workspace"
      />

      {projectSession.autosaveAvailable ? (
        <div className="draft-recovery-banner" role="status">
          <div>
            <strong>Recovered work is available</strong>
            <small>You can return to the last autosaved Studio state for this client.</small>
          </div>
          <div className="draft-recovery-banner__actions">
            <Button variant="ghost" size="sm" className="compact-action" onClick={() => void projectSession.handleClearDraft()}>
              Dismiss
            </Button>
            <Button variant="primary" size="sm" className="compact-action" onClick={() => void projectSession.handleRecoverDraft().then(onEnterEditor)}>
              Recover draft
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
