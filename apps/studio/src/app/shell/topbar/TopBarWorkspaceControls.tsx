import { CANVAS_PRESETS } from '../../../domain/document/canvas-presets';
import { ColorControl } from '../../../shared/ui/ColorControl';
import type { TopBarController } from './use-top-bar-controller';

export function TopBarWorkspaceControls({ controller, compact = false }: { controller: TopBarController; compact?: boolean }): JSX.Element {
  const { activeProjectId, isPlaying, previewMode, documentVersion } = controller.snapshot;
  const { uiActions } = controller.document;
  const workspace = controller.workspace;
  const projectSession = controller.projectSession;

  return (
    <div className={`top-control-group ${compact ? 'top-control-group--compact' : ''}`}>
      <strong className="section-kicker">Workspace</strong>
      <div className="top-control-grid">
        <select value={workspace.activeClientId ?? ''} onChange={(event) => void workspace.handleActiveClientChange(event.target.value)}>
          {workspace.visibleClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <input placeholder="New client" value={workspace.newClientName} onChange={(event) => workspace.setNewClientName(event.target.value)} />
        <button className="ghost" onClick={() => void workspace.handleCreateClient()} disabled={!workspace.canCreateClient}>Create client</button>
        <input placeholder="New brand kit" value={workspace.newBrandName} onChange={(event) => workspace.setNewBrandName(event.target.value)} />
        <ColorControl label="Brand color" compact value={workspace.newBrandColor} fallback="#8b5cf6" onChange={workspace.setNewBrandColor} />
        <button className="ghost" onClick={() => void workspace.handleCreateBrand()} disabled={!workspace.canManageBrandkits || !workspace.activeClientId}>Add brand</button>
        <input placeholder="Invite email" value={workspace.inviteEmail} onChange={(event) => workspace.setInviteEmail(event.target.value)} />
        <select value={workspace.inviteRole} onChange={(event) => workspace.setInviteRole(event.target.value as 'editor' | 'reviewer')}>
          <option value="editor">Invite as editor</option>
          <option value="reviewer">Invite as reviewer</option>
        </select>
        <button className="ghost" onClick={() => void workspace.handleInviteMember()} disabled={!workspace.activeClientId || !workspace.inviteEmail.trim() || !workspace.canInviteClients}>Invite/member</button>
        <select value={projectSession.newProjectPresetId} onChange={(event) => projectSession.setNewProjectPresetId(event.target.value)}>
          {CANVAS_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
        </select>
        <input placeholder="New project name" value={projectSession.newProjectName} onChange={(event) => projectSession.setNewProjectName(event.target.value)} />
        <button className="ghost" onClick={projectSession.handleCreateProject} disabled={!workspace.canCreateProjects}>New project</button>
        <span className="top-inline-pill">Cloud API</span>
        <select value={activeProjectId ?? ''} onChange={(event) => event.target.value ? void projectSession.handleLoadProject(event.target.value) : undefined}>
          <option value="">Load project…</option>
          {projectSession.projects.map((project) => <option key={project.id} value={project.id}>{project.name} · {project.accessScope ?? 'client'}</option>)}
        </select>
        <button className="ghost" onClick={() => void projectSession.handleSaveProject()} disabled={!workspace.canSaveProjects}>Save project</button>
        <select value={projectSession.selectedVersionId} onChange={(event) => projectSession.setSelectedVersionId(event.target.value)} disabled={!activeProjectId || projectSession.versions.length === 0}>
          <option value="">Versions…</option>
          {projectSession.versions.map((version) => <option key={version.id} value={version.id}>v{version.versionNumber} · {new Date(version.savedAt).toLocaleTimeString()}</option>)}
        </select>
        <button className="ghost" disabled={!activeProjectId || !projectSession.selectedVersionId} onClick={() => void projectSession.handleRestoreVersion(projectSession.selectedVersionId)}>Restore version</button>
        <button className="ghost" disabled={!activeProjectId || !workspace.canDeleteProjects} onClick={() => void projectSession.handleDeleteProject()}>Delete project</button>
        <span className="top-inline-pill">Doc v{documentVersion}</span>
        <button className="ghost" onClick={() => uiActions.undo()}>Undo</button>
        <button className="ghost" onClick={() => uiActions.redo()}>Redo</button>
        <button className="ghost" onClick={() => uiActions.setPreviewMode(!previewMode)}>{previewMode ? 'Exit preview' : 'Preview'}</button>
        <button className="ghost" onClick={() => { if (!previewMode) uiActions.setPreviewMode(true); uiActions.setPlaying(!isPlaying); }}>{isPlaying ? 'Pause' : 'Play'}</button>
        <button className="ghost" disabled={!projectSession.autosaveAvailable} onClick={() => void projectSession.handleRecoverDraft()}>Recover draft</button>
        <button className="ghost" disabled={!projectSession.autosaveAvailable} onClick={() => void projectSession.handleClearDraft()}>Clear draft</button>
      </div>
    </div>
  );
}
