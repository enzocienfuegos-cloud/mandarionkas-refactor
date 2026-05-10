import { Button } from '../shared/ui/Button';
import { useToast } from '../shared/ui/ToastProvider';
import { useClientWorkspaceController } from './client-workspace/use-client-workspace-controller';
import { ClientWorkspaceProductionView } from './client-workspace/ClientWorkspaceProductionView';
import { StudioTopbar } from './shared/StudioTopbar';

type ClientWorkspaceShellProps = {
  onBackToAgencyShell(): void;
  onEnterEditor(): void;
};

export function ClientWorkspaceShell({ onBackToAgencyShell, onEnterEditor }: ClientWorkspaceShellProps): JSX.Element {
  const controller = useClientWorkspaceController();
  const { pushToast } = useToast();
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
        eyebrow="Project Workspace"
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
          icon: 'plus',
        }}
        secondaryAction={{
          label: 'Export',
          icon: 'download',
          onClick: () => {
            pushToast({
              title: 'Export starts in Studio',
              description: 'Open a banner to export packages, previews, or review bundles.',
            });
          },
        }}
        user={{
          label: userName,
          avatarText: userInitials,
        }}
        showLogout={false}
        backAction={{
          label: 'Client Hub',
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
