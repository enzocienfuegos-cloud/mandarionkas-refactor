import { getCanvasPresetById } from '../domain/document/canvas-presets';
import { useWorkspaceHubController } from './workspace-hub/use-workspace-hub-controller';

type WorkspaceHubProps = {
  onEnterEditor(): void;
};

function formatDate(value?: string): string {
  if (!value) return 'No saves yet';
  return new Date(value).toLocaleString();
}

export function WorkspaceHub({ onEnterEditor }: WorkspaceHubProps): JSX.Element {
  const controller = useWorkspaceHubController();
  const {
    workspace,
    projectSession,
    activeClient,
    clients,
    stats,
    isAdmin,
    search,
    setSearch,
    projectFilter,
    setProjectFilter,
    projectView,
    setProjectView,
    sortMode,
    setSortMode,
    page,
    setPage,
    pageCount,
    pageItems,
    selectedProjectIds,
    toggleProjectSelection,
    clearSelection,
    selectAllVisible,
    ownerOptions,
    storageDiagnostics,
    storageDiagnosticsLoading,
    storageDiagnosticsMessage,
    refreshStorageDiagnostics,
    rebuildStorageDiagnostics,
  } = controller;

  const storageIssueCount = storageDiagnostics
    ? Object.values(storageDiagnostics.issues).reduce((count, value) => count + (Array.isArray(value) ? value.length : 0), 0)
    : 0;

  async function handleOpen(projectId: string): Promise<void> {
    await controller.openProject(projectId);
    onEnterEditor();
  }

  function handleCreateAndEnter(): void {
    controller.createProjectDraft();
    onEnterEditor();
  }

  return (
    <div className="workspace-hub-shell">
      <header className="workspace-hub-topbar">
        <div>
          <div className="workspace-hub-kicker">Workspace hub</div>
          <h1>{activeClient?.name ?? 'Choose a client'}</h1>
          <p>Projects now live in a real admin layer before the editor, with owner controls and archive flow.</p>
        </div>
        <div className="workspace-hub-session">
          <div className="pill">{workspace.currentUser?.name ?? 'Guest'}</div>
          <div className="pill">{workspace.workspaceRole ?? workspace.currentUser?.role ?? 'viewer'}</div>
          <div className="pill">URL {typeof window !== 'undefined' ? `${window.location.pathname}#/hub` : '/#/hub'}</div>
          <button className="ghost compact-action" type="button" onClick={() => void workspace.handleLogout()}>Logout</button>
        </div>
      </header>

      <section className="workspace-hub-hero">
        <div className="workspace-hub-stat-card">
          <span className="workspace-hub-stat-label">Active projects</span>
          <strong>{stats.totalProjects - stats.archived}</strong>
          <small>{stats.mine} yours · {stats.shared} shared</small>
        </div>
        <div className="workspace-hub-stat-card">
          <span className="workspace-hub-stat-label">Archived</span>
          <strong>{stats.archived}</strong>
          <small>Restorable from the hub</small>
        </div>
        <div className="workspace-hub-stat-card">
          <span className="workspace-hub-stat-label">Clients</span>
          <strong>{stats.clientCount}</strong>
          <small>Visible in this session</small>
        </div>
        <div className="workspace-hub-stat-card workspace-hub-stat-card--form">
          <label>
            Active client
            <select value={workspace.activeClientId ?? ''} onChange={(event) => void workspace.handleActiveClientChange(event.target.value)}>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
        </div>
        <div className="workspace-hub-stat-card workspace-hub-stat-card--form">
          <label>
            Create client
            <input
              value={workspace.newClientName}
              onChange={(event) => workspace.setNewClientName(event.target.value)}
              placeholder="New client / workspace name"
            />
          </label>
          <button className="ghost compact-action" type="button" onClick={() => void workspace.handleCreateClient()} disabled={!workspace.canCreateClient || !workspace.newClientName.trim()}>
            Create client
          </button>
          <small>Make client creation explicit before entering the editor.</small>
        </div>
        <div className="workspace-hub-stat-card workspace-hub-stat-card--form">
          <label>
            New project name
            <input value={projectSession.newProjectName} onChange={(event) => projectSession.setNewProjectName(event.target.value)} placeholder="Campaign Spring launch" />
          </label>
          <label>
            Banner size
            <select value={projectSession.newProjectPresetId} onChange={(event) => projectSession.setNewProjectPresetId(event.target.value)}>
              {controller.canvasPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
          </label>
          <button className="primary" type="button" onClick={handleCreateAndEnter} disabled={!workspace.canCreateProjects}>Create and open editor</button>
        </div>
      </section>

      {isAdmin ? (
        <section className="workspace-hub-storage panel">
          <div className="workspace-hub-storage-header">
            <div>
              <div className="workspace-hub-kicker">Remote storage</div>
              <h2>R2 diagnostics</h2>
              <p>Inspect sidecars, indexes and object-storage consistency without SSH.</p>
            </div>
            <div className="workspace-hub-storage-actions">
              <button className="ghost compact-action" type="button" onClick={() => void refreshStorageDiagnostics()} disabled={storageDiagnosticsLoading}>
                Refresh
              </button>
              <button className="ghost compact-action" type="button" onClick={() => void rebuildStorageDiagnostics()} disabled={storageDiagnosticsLoading}>
                Rebuild indexes
              </button>
            </div>
          </div>
          <div className="workspace-hub-storage-grid">
            <div className="workspace-hub-stat-card">
              <span className="workspace-hub-stat-label">Projects</span>
              <strong>{storageDiagnostics?.totals.projects ?? '—'}</strong>
              <small>{storageDiagnostics?.totals.projectSidecars ?? '—'} sidecars</small>
            </div>
            <div className="workspace-hub-stat-card">
              <span className="workspace-hub-stat-label">Assets</span>
              <strong>{storageDiagnostics?.totals.assets ?? '—'}</strong>
              <small>{storageDiagnostics?.totals.assetSidecars ?? '—'} sidecars · {storageDiagnostics?.totals.binaryObjects ?? '—'} binaries</small>
            </div>
            <div className="workspace-hub-stat-card">
              <span className="workspace-hub-stat-label">Clients</span>
              <strong>{storageDiagnostics?.totals.clients ?? '—'}</strong>
              <small>{storageDiagnostics?.totals.clientSidecars ?? '—'} sidecars</small>
            </div>
            <div className="workspace-hub-stat-card">
              <span className="workspace-hub-stat-label">Issues</span>
              <strong>{storageIssueCount}</strong>
              <small>{storageDiagnostics?.legacyStorePresent ? 'Legacy mirror present' : 'No legacy mirror detected'}</small>
            </div>
          </div>
          <div className="workspace-hub-storage-meta">
            <div className="pill">Prefix {storageDiagnostics?.dataPrefix ?? 'loading...'}</div>
            <div className="pill">Generated {storageDiagnostics ? formatDate(storageDiagnostics.generatedAt) : '—'}</div>
            {storageDiagnosticsMessage ? <div className="pill">{storageDiagnosticsMessage}</div> : null}
          </div>
        </section>
      ) : null}

      <section className="workspace-hub-toolbar">
        <div className="workspace-hub-toolbar-row">
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search by project, brand, campaign or owner" />
          <select value={projectFilter} onChange={(event) => { setProjectFilter(event.target.value as typeof projectFilter); setPage(1); }}>
            <option value="all">All projects</option>
            <option value="mine">My projects</option>
            <option value="shared">Shared with me</option>
          </select>
          <select value={projectView} onChange={(event) => { setProjectView(event.target.value as typeof projectView); setPage(1); }}>
            <option value="active">Active only</option>
            <option value="archived">Archived only</option>
            <option value="all">Everything</option>
          </select>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
            <option value="recent">Recently updated</option>
            <option value="name">A to Z</option>
          </select>
          <select value={projectSession.repositoryMode} onChange={(event) => projectSession.handleRepositoryModeChange(event.target.value as 'local' | 'api')}>
            <option value="api">API repo</option>
          </select>
        </div>
        <div className="workspace-hub-toolbar-row workspace-hub-toolbar-row--actions">
          <div className="pill">{controller.filteredProjects.length} results</div>
          <div className="pill">{selectedProjectIds.length} selected</div>
          <button className="ghost compact-action" type="button" onClick={selectAllVisible}>Select page</button>
          <button className="ghost compact-action" type="button" onClick={clearSelection}>Clear</button>
          <button className="ghost compact-action" type="button" onClick={() => void controller.archiveSelectedProjects()} disabled={selectedProjectIds.length === 0 || !workspace.canDeleteProjects}>Archive selected</button>
          <button className="ghost compact-action" type="button" onClick={() => void controller.restoreSelectedProjects()} disabled={selectedProjectIds.length === 0 || !workspace.canDeleteProjects}>Restore selected</button>
          <button className="ghost compact-action" type="button" onClick={() => void controller.deleteSelectedProjects()} disabled={selectedProjectIds.length === 0 || !workspace.canDeleteProjects}>Delete selected</button>
          <button className="ghost compact-action" type="button" onClick={() => void projectSession.handleRecoverDraft()} disabled={!projectSession.autosaveAvailable}>Recover draft</button>
        </div>
      </section>

      <section className="workspace-hub-grid">
        {pageItems.map((project) => {
          const preset = getCanvasPresetById(project.canvasPresetId ?? (project.id === controller.snapshot.activeProjectId ? controller.snapshot.canvasPresetId : undefined));
          const isSelected = selectedProjectIds.includes(project.id);
          const brandColor = activeClient?.brands?.find((brand) => brand.id === project.brandId)?.primaryColor ?? activeClient?.brandColor ?? '#7c5cff';
          const aspectRatio = preset ? `${preset.width} / ${preset.height}` : '16 / 9';
          return (
            <article key={project.id} className={`workspace-project-card ${isSelected ? 'is-selected' : ''} ${project.archivedAt ? 'is-archived' : ''}`}>
              <label className="workspace-project-select">
                <input type="checkbox" checked={isSelected} onChange={() => toggleProjectSelection(project.id)} />
                <span>Select</span>
              </label>
              <button className="workspace-project-preview" type="button" onClick={() => void handleOpen(project.id)}>
                <div className="workspace-project-frame" style={{ borderColor: `${brandColor}66`, aspectRatio }}>
                  <div className="workspace-project-frame-label">{preset?.label ?? 'Saved project'}</div>
                  <div className="workspace-project-frame-meta">{project.sceneCount ?? 1} scenes · {project.widgetCount ?? 0} widgets</div>
                </div>
              </button>
              <div className="workspace-project-body">
                <div className="workspace-project-title-row">
                  <div>
                    <h3>{project.name}</h3>
                    <p>{project.brandName ?? 'No brand'} · {project.campaignName ?? 'No campaign'}</p>
                  </div>
                  <span className="pill">{project.archivedAt ? 'archived' : (project.accessScope ?? 'client')}</span>
                </div>
                <div className="workspace-project-meta-grid">
                  <div>
                    <span className="workspace-project-meta-label">Updated</span>
                    <strong>{formatDate(project.updatedAt)}</strong>
                  </div>
                  <div>
                    <span className="workspace-project-meta-label">Owner</span>
                    <strong>{project.ownerName ?? project.ownerUserId}</strong>
                  </div>
                  <div>
                    <span className="workspace-project-meta-label">Format</span>
                    <strong>{preset?.label ?? 'Custom'}</strong>
                  </div>
                  <div>
                    <span className="workspace-project-meta-label">Status</span>
                    <strong>{project.archivedAt ? `Archived ${formatDate(project.archivedAt)}` : 'Active'}</strong>
                  </div>
                </div>
                <div className="workspace-project-owner-row">
                  <label>
                    Owner
                    <select value={project.ownerUserId} onChange={(event) => void controller.changeProjectOwner(project.id, event.target.value)} disabled={!workspace.canDeleteProjects}>
                      {ownerOptions.map((option) => <option key={option.userId} value={option.userId}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
                <div className="workspace-project-actions">
                  <button className="primary compact-action" type="button" onClick={() => void handleOpen(project.id)} disabled={Boolean(project.archivedAt)}>Open in editor</button>
                  <button className="ghost compact-action" type="button" onClick={() => void controller.duplicateProjectCard(project.id)}>Duplicate</button>
                  {project.archivedAt ? (
                    <button className="ghost compact-action" type="button" onClick={() => void controller.restoreProjectCard(project.id)} disabled={!workspace.canDeleteProjects}>Restore</button>
                  ) : (
                    <button className="ghost compact-action" type="button" onClick={() => void controller.archiveProjectCard(project.id)} disabled={!workspace.canDeleteProjects}>Archive</button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {pageItems.length === 0 ? (
          <div className="workspace-hub-empty-state panel">
            <h3>No projects match this view</h3>
            <p>Change the filters, switch client, or create a fresh document from the banner-size picker.</p>
          </div>
        ) : null}
      </section>

      <footer className="workspace-hub-pagination">
        <div className="pill">Page {page} / {pageCount}</div>
        <div className="workspace-hub-pagination-actions">
          <button className="ghost compact-action" type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>Previous</button>
          <button className="ghost compact-action" type="button" onClick={() => setPage(Math.min(pageCount, page + 1))} disabled={page >= pageCount}>Next</button>
        </div>
      </footer>
    </div>
  );
}
