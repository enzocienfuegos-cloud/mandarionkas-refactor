import type { CSSProperties } from 'react';
import { getCanvasPresetById } from '../domain/document/canvas-presets';
import { getProjectStarters } from '../app/shell/topbar/project-starters';
import { Button } from '../shared/ui/Button';
import { useClientWorkspaceController } from './client-workspace/use-client-workspace-controller';
import { StudioIcon, StudioIcons } from '../shared/ui/icons';
import { TemplateGallery } from './template-gallery/TemplateGallery';

type ClientWorkspaceShellProps = {
  onBackToAgencyShell(): void;
  onEnterEditor(): void;
};

function formatDate(value?: string): string {
  if (!value) return 'No saves yet';
  return new Date(value).toLocaleString();
}

function buildClientWorkspaceFrameStyle(borderColor: string, aspectRatio: string): CSSProperties {
  return { borderColor, aspectRatio };
}

export function ClientWorkspaceShell({ onBackToAgencyShell, onEnterEditor }: ClientWorkspaceShellProps): JSX.Element {
  const controller = useClientWorkspaceController();
  const starters = getProjectStarters();
  const defaultTemplateStarter = starters.find((starter) => starter.id !== 'blank');
  const {
    workspace,
    projectSession,
    activeClient,
    clients,
    stats,
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
    activeFolderId,
    setActiveFolderId,
    newFolderName,
    setNewFolderName,
    bulkTargetFolderId,
    setBulkTargetFolderId,
    folderCards,
    folderAssignments,
    selectedProjectIds,
    toggleProjectSelection,
    clearSelection,
    selectAllVisible,
    ownerOptions,
  } = controller;

  async function handleOpen(projectId: string): Promise<void> {
    await controller.openProject(projectId);
    onEnterEditor();
  }

  async function handleCreateAndEnter(): Promise<void> {
    await controller.createProjectDraft();
    onEnterEditor();
  }

  async function handleCreateFromStarter(starterId: string): Promise<void> {
    const starter = starters.find((item) => item.id === starterId);
    await projectSession.handleCreateProjectFromStarter(starterId, starter?.label);
    onEnterEditor();
  }

  function handleJumpToTemplateMarketplace(): void {
    document.getElementById('template-marketplace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const hasProjects = stats.totalProjects > 0;

  return (
    <div className="workspace-hub-shell">
      <header className="workspace-hub-topbar workspace-hub-topbar--launchpad">
        <div>
          <div className="workspace-hub-kicker">Client launchpad</div>
          <h1>{activeClient?.name ?? 'Choose a workspace'}</h1>
          <p>Templates, blank starts, variants, folders and bulk actions stay scoped to the selected client workspace.</p>
        </div>
        <div className="workspace-hub-session">
          <Button
            variant="ghost"
            size="sm"
            className="compact-action"
            iconBefore={<StudioIcon icon={StudioIcons.arrowLeft} size={16} />}
            onClick={onBackToAgencyShell}
          >
            Agency shell
          </Button>
          <Button variant="primary" size="md" className="compact-action" onClick={() => void handleCreateAndEnter()} disabled={!workspace.canCreateProjects}>
            Create campaign
          </Button>
          <div className="pill">{workspace.currentUser?.name ?? 'Guest'}</div>
          <div className="pill">{workspace.workspaceRole ?? workspace.currentUser?.role ?? 'viewer'}</div>
          <Button variant="ghost" size="sm" className="compact-action" onClick={() => void workspace.handleLogout()}>Logout</Button>
        </div>
      </header>

      <section className="workspace-launchpad">
        <div className="workspace-launchpad__hero">
          <div>
            <div className="workspace-hub-kicker">Creative launchpad</div>
            <h2>Start from a template, a blank canvas, or a DCO-ready scaffold.</h2>
            <p>Creation paths should be explicit before the project grid takes over. Use the launch cards below or drop into the template marketplace.</p>
          </div>
          <div className="workspace-launchpad__hero-pills">
            <span className="pill">{stats.totalProjects - stats.archived} active</span>
            <span className="pill">{stats.shared} shared</span>
            <span className="pill">{starters.length - 1} starters</span>
          </div>
        </div>
        <div className="workspace-launchpad__paths">
          <button type="button" className="workspace-launch-card" onClick={handleJumpToTemplateMarketplace}>
            <span className="workspace-launch-card__eyebrow">Marketplace</span>
            <strong>Start from template</strong>
            <p>Browse vertical-ready campaign starters with stronger previews and faster setup.</p>
          </button>
          <button type="button" className="workspace-launch-card" onClick={() => void handleCreateAndEnter()} disabled={!workspace.canCreateProjects}>
            <span className="workspace-launch-card__eyebrow">Blank creative</span>
            <strong>Open a clean canvas</strong>
            <p>Jump straight into the editor with full control over size, layout, widgets and motion.</p>
          </button>
          <button
            type="button"
            className="workspace-launch-card"
            onClick={() => defaultTemplateStarter ? void handleCreateFromStarter(defaultTemplateStarter.id) : void handleCreateAndEnter()}
            disabled={!workspace.canCreateProjects}
          >
            <span className="workspace-launch-card__eyebrow">Variants & DCO</span>
            <strong>Use a scalable starter</strong>
            <p>{defaultTemplateStarter ? `Kick off from ${defaultTemplateStarter.label} and layer variants, feeds or brand rules later.` : 'Use the best available starter and evolve it into a dynamic campaign.'}</p>
          </button>
        </div>
      </section>

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
          <Button variant="ghost" size="sm" className="compact-action" onClick={() => void workspace.handleCreateClient()} disabled={!workspace.canCreateClient || !workspace.newClientName.trim()}>Create client</Button>
          <small>Creates the workspace remotely and updates the server session.</small>
        </div>
        <div className="workspace-hub-stat-card workspace-hub-stat-card--form">
          <label>
            New project name
            <input value={projectSession.newProjectName} onChange={(event) => projectSession.setNewProjectName(event.target.value)} placeholder="Campaign Spring launch" />
          </label>
          <label>
            Starter
            <select value={projectSession.newProjectStarterId} onChange={(event) => projectSession.setNewProjectStarterId(event.target.value as typeof projectSession.newProjectStarterId)}>
              {starters.map((starter) => <option key={starter.id} value={starter.id}>{starter.label}</option>)}
            </select>
          </label>
          <label>
            Banner size
            <select
              value={projectSession.newProjectPresetId}
              onChange={(event) => projectSession.setNewProjectPresetId(event.target.value)}
              disabled={projectSession.newProjectStarterId !== 'blank'}
            >
              {controller.canvasPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
          </label>
          <small>
            {starters.find((starter) => starter.id === projectSession.newProjectStarterId)?.description}
          </small>
          <Button variant="primary" size="md" onClick={() => void handleCreateAndEnter()} disabled={!workspace.canCreateProjects}>Create and open editor</Button>
        </div>
      </section>

      <section className={`workspace-hub-onboarding ${hasProjects ? 'workspace-hub-onboarding--compact' : ''}`.trim()} id="template-marketplace">
          <div className="workspace-hub-onboarding__intro">
            <div>
              <div className="workspace-hub-kicker">Template marketplace</div>
              <h2>{hasProjects ? 'Keep new briefs moving with stronger launch points' : 'Start from a template instead of an empty editor'}</h2>
              <p>{hasProjects ? 'Marketplace-style starters keep new campaigns on-brand and reduce repetitive setup before teams enter the editor.' : 'There are no projects in this client workspace yet. Pick a launch point by vertical, or create a blank project if you want full control from the start.'}</p>
            </div>
            <div className="workspace-hub-onboarding__actions">
              <Button variant="primary" size="md" onClick={() => void handleCreateAndEnter()} disabled={!workspace.canCreateProjects}>
                Blank project
              </Button>
            </div>
          </div>
          <TemplateGallery onUseTemplate={(templateId) => void handleCreateFromStarter(templateId)} />
      </section>

      <section className="workspace-hub-toolbar">
        <div className="workspace-hub-folder-bar">
          <div className="workspace-hub-folder-list">
            {folderCards.map((folder) => (
              <button
                key={folder.id}
                className={`workspace-folder-card ${activeFolderId === folder.id ? 'is-active' : ''}`}
                type="button"
                onClick={() => {
                  setActiveFolderId(folder.id);
                  setPage(1);
                }}
              >
                <span>{folder.name}</span>
                <strong>{folder.count}</strong>
              </button>
            ))}
          </div>
          <div className="workspace-hub-folder-create">
            <input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Create a folder in this client workspace"
            />
            <Button
              variant="ghost"
              size="sm"
              className="compact-action"
              onClick={() => void controller.createFolderDraft()}
              disabled={!newFolderName.trim() || !activeClient?.id}
            >
              New folder
            </Button>
          </div>
        </div>
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
          <div className="pill">Client-scoped view</div>
        </div>
        {selectedProjectIds.length > 0 || projectSession.autosaveAvailable ? (
          <div className="workspace-hub-toolbar-row workspace-hub-toolbar-row--actions">
            <div className="pill">{controller.filteredProjects.length} results</div>
            <div className="pill">{selectedProjectIds.length} selected</div>
            <Button variant="ghost" size="sm" className="compact-action" onClick={selectAllVisible}>Select page</Button>
            <Button variant="ghost" size="sm" className="compact-action" onClick={clearSelection}>Clear</Button>
            <select
              value={bulkTargetFolderId}
              onChange={(event) => setBulkTargetFolderId(event.target.value)}
              disabled={selectedProjectIds.length === 0}
            >
              <option value="root">Move to unfiled</option>
              {folderCards.filter((folder) => folder.id !== 'all' && folder.id !== 'root').map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              className="compact-action"
              onClick={() => controller.moveSelectedProjectsToFolder(bulkTargetFolderId === 'root' ? undefined : bulkTargetFolderId)}
              disabled={selectedProjectIds.length === 0}
            >
              Move selected
            </Button>
            <Button variant="ghost" size="sm" className="compact-action" onClick={() => void controller.archiveSelectedProjects()} disabled={selectedProjectIds.length === 0 || !workspace.canDeleteProjects}>Archive selected</Button>
            <Button variant="ghost" size="sm" className="compact-action" onClick={() => void controller.restoreSelectedProjects()} disabled={selectedProjectIds.length === 0 || !workspace.canDeleteProjects}>Restore selected</Button>
            <Button variant="ghost" size="sm" className="compact-action" onClick={() => void controller.deleteSelectedProjects()} disabled={selectedProjectIds.length === 0 || !workspace.canDeleteProjects}>Delete selected</Button>
            <Button variant="ghost" size="sm" className="compact-action" onClick={() => void projectSession.handleRecoverDraft()} disabled={!projectSession.autosaveAvailable}>Recover draft</Button>
          </div>
        ) : null}
      </section>

      <section className="workspace-hub-grid">
        {pageItems.map((project) => {
          const preset = getCanvasPresetById(project.canvasPresetId ?? (project.id === controller.snapshot.activeProjectId ? controller.snapshot.canvasPresetId : undefined));
          const isSelected = selectedProjectIds.includes(project.id);
          const brandColor = activeClient?.brands?.find((brand) => brand.id === project.brandId)?.primaryColor ?? activeClient?.brandColor ?? '#7c5cff';
          const aspectRatio = preset ? `${preset.width} / ${preset.height}` : '16 / 9';
          const assignedFolderName = folderCards.find((folder) => folder.id === folderAssignments[project.id])?.name ?? 'Unfiled';
          return (
            <article key={project.id} className={`workspace-project-card ${isSelected ? 'is-selected' : ''} ${project.archivedAt ? 'is-archived' : ''}`}>
              <label className="workspace-project-select">
                <input type="checkbox" checked={isSelected} onChange={() => toggleProjectSelection(project.id)} />
                <span>Select</span>
              </label>
              <button className="workspace-project-preview" type="button" onClick={() => void handleOpen(project.id)}>
                <div className="workspace-project-frame" style={buildClientWorkspaceFrameStyle(`${brandColor}66`, aspectRatio)}>
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
                <div className="workspace-project-folder-row">
                  <span className="workspace-project-meta-label">Folder</span>
                  <strong>{assignedFolderName}</strong>
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
                  <Button variant="primary" size="md" className="compact-action" onClick={() => void handleOpen(project.id)} disabled={Boolean(project.archivedAt)}>Open in editor</Button>
                  <Button variant="ghost" size="sm" className="compact-action" onClick={() => void controller.duplicateProjectCard(project.id)}>Duplicate</Button>
                  {project.archivedAt ? (
                    <Button variant="ghost" size="sm" className="compact-action" onClick={() => void controller.restoreProjectCard(project.id)} disabled={!workspace.canDeleteProjects}>Restore</Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="compact-action" onClick={() => void controller.archiveProjectCard(project.id)} disabled={!workspace.canDeleteProjects}>Archive</Button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {pageItems.length === 0 ? (
          <div className="workspace-hub-empty-state panel">
            <h3>No projects match this view</h3>
            <p>Change the filters, switch client, or create a fresh document from the starter gallery above.</p>
          </div>
        ) : null}
      </section>

      <footer className="workspace-hub-pagination">
        <div className="pill">Page {page} / {pageCount}</div>
        <div className="workspace-hub-pagination-actions">
          <Button variant="ghost" size="sm" className="compact-action" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>Previous</Button>
          <Button variant="ghost" size="sm" className="compact-action" onClick={() => setPage(Math.min(pageCount, page + 1))} disabled={page >= pageCount}>Next</Button>
        </div>
      </footer>
    </div>
  );
}
