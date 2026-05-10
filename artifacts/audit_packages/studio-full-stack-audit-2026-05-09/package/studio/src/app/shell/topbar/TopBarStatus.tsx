import type { TopBarController } from './use-top-bar-controller';
import { formatMs } from './use-top-bar-controller';

export function TopBarStatus({ controller }: { controller: TopBarController }): JSX.Element {
  const { selectionCount, previewMode, playhead, zoom, canvasPresetId, release, lastAction, lastAutosavedAt, platformMeta, lastSavedAt } = controller.snapshot;
  const { repositoryMode } = controller.projectSession;
  const { readiness, diagnostics } = controller.exportReadiness;
  const { openComments, pendingApprovals } = controller.collaboration;
  const { currentUser, activeClientId, clients, workspaceRole, activeClient, permissions, auditCount, sessionExpiresAt, sessionPersistenceMode } = controller.workspace;

  return (
    <div className="status-cluster">
      <span className="pill pill-highlight">Sprint 71</span>
      <span className="pill">{selectionCount ? `${selectionCount} selected` : 'Document selected'}</span>
      <span className="pill">{previewMode ? 'Preview mode' : 'Edit mode'}</span>
      <span className="pill">Playhead {formatMs(playhead)}</span>
      <span className="pill">Zoom {Math.round(zoom * 100)}%</span>
      <span className="pill">Preset {canvasPresetId}</span>
      <span className="pill">Cloud API</span>
      <span className="pill">Release {release.targetChannel}</span>
      <span className="pill">QA {release.qaStatus}</span>
      <span className="pill">Readiness {readiness.score}% · {readiness.grade}</span>
      <span className="pill">Diagnostics {diagnostics.errors}E / {diagnostics.warnings}W</span>
      <span className="pill">Comments {openComments} open</span>
      <span className="pill">Approvals {pendingApprovals} pending</span>
      {lastAction ? <span className="pill">{lastAction}</span> : null}
      {lastAutosavedAt ? <span className="pill">Autosaved {new Date(lastAutosavedAt).toLocaleTimeString()}</span> : null}
      {currentUser ? <span className="pill">User {currentUser.name} · {currentUser.role}</span> : null}
      {activeClientId ? <span className="pill">Client {(clients.find((item) => item.id === activeClientId)?.name) ?? 'Unknown'}</span> : null}
      {workspaceRole ? <span className="pill">Workspace role {workspaceRole}</span> : null}
      {activeClient ? <span className="pill">Members {activeClient.members?.length ?? activeClient.memberUserIds?.length ?? 0}</span> : null}
      {activeClient ? <span className="pill">Invites {activeClient.invites?.filter((item) => item.status === 'pending').length ?? 0}</span> : null}
      {platformMeta?.brandName ? <span className="pill">Brand {platformMeta.brandName}</span> : null}
      {platformMeta?.accessScope ? <span className="pill">Scope {platformMeta.accessScope}</span> : null}
      {platformMeta?.campaignName ? <span className="pill">Campaign {platformMeta.campaignName}</span> : null}
      {permissions.length ? <span className="pill">Perms {permissions.length}</span> : null}
      {sessionPersistenceMode ? <span className="pill">Session {sessionPersistenceMode === 'local' ? 'remembered' : 'ephemeral'}</span> : null}
      {sessionExpiresAt ? <span className="pill">Session until {new Date(sessionExpiresAt).toLocaleTimeString()}</span> : null}
      {auditCount ? <span className="pill">Audit {auditCount}</span> : null}
      {lastSavedAt ? <span className="pill">Saved {new Date(lastSavedAt).toLocaleTimeString()}</span> : null}
    </div>
  );
}
