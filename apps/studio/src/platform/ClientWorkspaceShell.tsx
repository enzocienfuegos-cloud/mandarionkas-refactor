import type { CSSProperties } from 'react';
import { getCanvasPresetById } from '../domain/document/canvas-presets';
import { Button } from '../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../shared/ui/icons';
import { TabBar } from '../shared/ui/TabBar';
import { useHashTabState } from './use-hash-tab-state';
import { useClientWorkspaceController } from './client-workspace/use-client-workspace-controller';
import { TemplateMarketplace } from './template-gallery/TemplateMarketplace';
import { BrandKitDrawer } from '../app/shell/topbar/BrandKitDrawer';

type ClientWorkspaceShellProps = {
  onBackToAgencyShell(): void;
  onEnterEditor(): void;
};

type WorkspaceTab = 'templates' | 'projects' | 'folders' | 'brand-kit';

const WORKSPACE_TABS: readonly WorkspaceTab[] = ['templates', 'projects', 'folders', 'brand-kit'];

function buildClientWorkspaceFrameStyle(borderColor: string, aspectRatio: string): CSSProperties {
  return {
    aspectRatio,
    ['--brand-color' as string]: borderColor,
  };
}

function getPresetIcon(presetId?: string) {
  if (presetId?.includes('story') || presetId?.includes('vertical') || presetId?.includes('reel')) {
    return StudioIcons.smartphone;
  }
  if (presetId?.includes('custom')) {
    return StudioIcons.boxes;
  }
  return StudioIcons.library;
}

export function ClientWorkspaceShell({ onBackToAgencyShell, onEnterEditor }: ClientWorkspaceShellProps): JSX.Element {
  const controller = useClientWorkspaceController();
  const {
    workspace,
    projectSession,
    activeClient,
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
  const routePath = `/hub/client/${encodeURIComponent(activeClient?.id ?? workspace.activeClientId ?? 'client')}`;
  const defaultTab: WorkspaceTab = stats.totalProjects > 0 ? 'projects' : 'templates';
  const [activeTab, setActiveTab] = useHashTabState(routePath, WORKSPACE_TABS, defaultTab);

  async function handleOpen(projectId: string): Promise<void> {
    await controller.openProject(projectId);
    onEnterEditor();
  }

  async function handleCreateAndEnter(): Promise<void> {
    await controller.createProjectDraft();
    onEnterEditor();
  }

  async function handleCreateFromStarter(starterId: string): Promise<void> {
    await projectSession.handleCreateProjectFromStarter(starterId as import('../app/shell/topbar/project-starters').ProjectStarterId);
    onEnterEditor();
  }

  const tabs = [
    { id: 'templates' as const, label: 'Templates', count: controller.templateCount ?? undefined },
    { id: 'projects' as const, label: 'Projects', count: stats.totalProjects - stats.archived },
    { id: 'folders' as const, label: 'Folders', count: Math.max(0, folderCards.length - 2) },
    { id: 'brand-kit' as const, label: 'Brand kit' },
  ];

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
            Agency hub
          </Button>
          <div>
            <div className="workspace-hub-kicker">Client workspace</div>
            <h1>{activeClient?.name ?? 'Client'}</h1>
          </div>
        </div>
        <div className="client-workspace-topbar__actions">
          <Button variant="primary" size="md" className="compact-action" onClick={() => void handleCreateAndEnter()} disabled={!workspace.canCreateProjects}>
            New campaign
          </Button>
          <div className="pill">{workspace.currentUser?.name ?? 'Guest'}</div>
          <Button variant="ghost" size="sm" className="compact-action" onClick={() => void workspace.handleLogout()}>
            Logout
          </Button>
        </div>
      </header>

      {projectSession.autosaveAvailable ? (
        <div className="draft-recovery-banner" role="status">
          <div>
            <strong>Recovered work available</strong>
            <small>Jump back into the latest autosaved studio state for this client.</small>
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

      <TabBar tabs={tabs} activeTab={activeTab} onSelectTab={setActiveTab} ariaLabel="Client workspace sections" />

      <main className="client-workspace-content">
        {activeTab === 'templates' ? (
          <TemplateMarketplace
            clientId={activeClient?.id}
            onUseTemplate={(templateId) => void handleCreateFromStarter(templateId)}
            onBlankCanvas={() => void handleCreateAndEnter()}
            showVerticalFilters
            includeBlankAndStarterPaths
          />
        ) : null}

        {activeTab === 'projects' ? (
          <>
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
              </div>
              <div className="workspace-hub-toolbar-row workspace-hub-toolbar-row--actions">
                <div className="pill">{controller.filteredProjects.length} results</div>
                <div className="pill">{selectedProjectIds.length} selected</div>
                <Button variant="ghost" size="sm" className="compact-action" onClick={selectAllVisible}>Select page</Button>
                <Button variant="ghost" size="sm" className="compact-action" onClick={clearSelection}>Clear</Button>
                <select value={bulkTargetFolderId} onChange={(event) => setBulkTargetFolderId(event.target.value)} disabled={selectedProjectIds.length === 0}>
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
              </div>
            </section>

            <section className="workspace-hub-grid">
              {pageItems.map((project) => {
                const preset = getCanvasPresetById(project.canvasPresetId ?? (project.id === controller.snapshot.activeProjectId ? controller.snapshot.canvasPresetId : undefined));
                const isSelected = selectedProjectIds.includes(project.id);
                const brandColor = activeClient?.brands?.find((brand) => brand.id === project.brandId)?.primaryColor ?? activeClient?.brandColor ?? '#7c5cff';
                const aspectRatio = preset ? `${preset.width} / ${preset.height}` : '16 / 9';
                const assignedFolderName = folderCards.find((folder) => folder.id === folderAssignments[project.id])?.name ?? 'Unfiled';
                return (
                  <article key={project.id} className={`workspace-project-card ${isSelected ? 'is-selected' : ''} ${project.archivedAt ? 'is-archived' : ''}`.trim()}>
                    <label className="workspace-project-select">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleProjectSelection(project.id)} />
                      <span>Select</span>
                    </label>
                    <button className="workspace-project-preview" type="button" onClick={() => void handleOpen(project.id)}>
                      <div className="workspace-project-thumb" style={buildClientWorkspaceFrameStyle(brandColor, aspectRatio)}>
                        <div className="workspace-project-thumb__placeholder">
                          <StudioIcon icon={getPresetIcon(preset?.id)} size={28} />
                          <span>{preset?.label ?? 'Custom'}</span>
                          <small>{project.sceneCount ?? 1} scenes · {project.widgetCount ?? 0} widgets</small>
                        </div>
                      </div>
                    </button>
                    <div className="workspace-project-card__body">
                      <div className="workspace-project-card__header">
                        <div>
                          <h3>{project.name}</h3>
                          <p>{project.brandName ?? 'No brand'} · {project.campaignName ?? 'No campaign'}</p>
                        </div>
                        <span className="pill">{assignedFolderName}</span>
                      </div>
                      <div className="workspace-project-card__meta-grid">
                        <div>
                          <span className="workspace-project-meta-label">Owner</span>
                          <select value={project.ownerUserId ?? ''} onChange={(event) => void controller.changeProjectOwner(project.id, event.target.value)}>
                            {ownerOptions.map((option) => <option key={option.userId} value={option.userId}>{option.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <span className="workspace-project-meta-label">Updated</span>
                          <strong>{new Date(project.updatedAt).toLocaleString()}</strong>
                        </div>
                        <div>
                          <span className="workspace-project-meta-label">Canvas</span>
                          <strong>{preset ? `${preset.width}×${preset.height}` : 'Custom'}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="workspace-project-card__footer">
                      <Button variant="primary" size="sm" onClick={() => void handleOpen(project.id)}>Open</Button>
                      <Button variant="ghost" size="sm" onClick={() => void controller.duplicateProjectCard(project.id)}>Duplicate</Button>
                      {project.archivedAt ? (
                        <Button variant="ghost" size="sm" onClick={() => void controller.restoreProjectCard(project.id)}>Restore</Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => void controller.archiveProjectCard(project.id)}>Archive</Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>

            <div className="workspace-hub-pagination">
              <div className="pill">Page {page} of {pageCount}</div>
              <div className="workspace-project-actions">
                <Button variant="ghost" size="sm" className="compact-action" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</Button>
                <Button variant="ghost" size="sm" className="compact-action" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>Next</Button>
              </div>
            </div>
          </>
        ) : null}

        {activeTab === 'folders' ? (
          <section className="workspace-folders-panel">
            <div className="workspace-folders-panel__head">
              <div>
                <div className="workspace-hub-kicker">Folders</div>
                <h2>Organize campaign families</h2>
                <p>Create client-specific folders and keep active work grouped by launch stream or brand line.</p>
              </div>
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
            <div className="agency-clients-grid">
              {folderCards.filter((folder) => folder.id !== 'all').map((folder) => (
                <article key={folder.id} className="agency-client-card-v2 workspace-folder-showcase">
                  <div className="agency-client-card-v2__title">
                    <strong>{folder.name}</strong>
                    <small>{folder.count} projects</small>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setActiveFolderId(folder.id); setActiveTab('projects'); }}>
                    View projects
                  </Button>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === 'brand-kit' ? (
          <div className="brand-kit-inline-panel">
            <BrandKitDrawer embedded onClose={() => setActiveTab('templates')} />
          </div>
        ) : null}
      </main>
    </div>
  );
}
