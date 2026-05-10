import { Button } from '../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../shared/ui/icons';
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
        className="studio-shell-topbar--workspace client-workspace-shell-topbar"
      />

      <section className="workspace-intro" aria-label="Workspace summary">
        <div className="workspace-intro__text">
          <div className="workspace-hub-kicker">Client Workspace</div>
          <h2 className="workspace-intro__headline">
            {activeClient?.name ?? 'Client'}
          </h2>
          <p className="workspace-intro__copy">
            Production queue, folders, and brand assets for this client.
          </p>
        </div>
        <div className="workspace-intro__stats">
          <div className="hub-stat">
            <StudioIcon icon={StudioIcons.layoutGrid} size={13} className="hub-stat__icon" aria-hidden />
            <span><b>{controller.filteredProjects.length}</b> banners</span>
          </div>
          <div className="hub-stat">
            <StudioIcon icon={StudioIcons.folder} size={13} className="hub-stat__icon" aria-hidden />
            <span><b>{controller.campaignFolders.length}</b> folders</span>
          </div>
        </div>
      </section>

      {projectSession.autosaveAvailable ? (
        <div className="draft-recovery-banner" role="status">
          <div>
            <div className="draft-recovery-banner__kicker">Autosave available</div>
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
