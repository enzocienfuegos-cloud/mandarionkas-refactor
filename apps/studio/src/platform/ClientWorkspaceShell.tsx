import { useState } from 'react';
import { Button } from '../shared/ui/Button';
import { SegmentedControl } from '../shared/ui/SegmentedControl';
import { StudioIcon, StudioIcons } from '../shared/ui/icons';
import { TabBar } from '../shared/ui/TabBar';
import { BrandKitDrawer } from '../app/shell/topbar/BrandKitDrawer';
import { useHashTabState } from './use-hash-tab-state';
import { useClientWorkspaceController, type WorkspaceViewMode } from './client-workspace/use-client-workspace-controller';
import { ProjectCard, WorkspaceProjectBulkBar, WorkspaceProjectTable, type WorkspaceProjectItem } from './client-workspace/WorkspaceProjectViews';
import { TemplateMarketplace } from './template-gallery/TemplateMarketplace';

type ClientWorkspaceShellProps = {
  onBackToAgencyShell(): void;
  onEnterEditor(): void;
};

type WorkspaceTab = 'projects' | 'templates' | 'brand-kit';

const WORKSPACE_TABS: readonly WorkspaceTab[] = ['projects', 'templates', 'brand-kit'];

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
    stateFilter,
    setStateFilter,
    sortMode,
    setSortMode,
    viewMode,
    setViewMode,
    page,
    setPage,
    pageCount,
    pageItems,
    filteredProjects,
    activeFolderId,
    setActiveFolderId,
    newFolderName,
    setNewFolderName,
    campaignFolders,
    folderOptions,
    folderAssignments,
    selectedProjectIds,
    allVisibleSelected,
    toggleProjectSelection,
    clearSelection,
    selectAllVisible,
    ownerOptions,
  } = controller;
  const routePath = `/hub/client/${encodeURIComponent(activeClient?.id ?? workspace.activeClientId ?? 'client')}`;
  const [activeTab, setActiveTab] = useHashTabState(routePath, WORKSPACE_TABS, 'projects');
  const [creatingFolder, setCreatingFolder] = useState(false);

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

  function handleDeleteProject(projectId: string, projectName: string): void {
    if (!window.confirm(`Delete "${projectName}"? This cannot be undone.`)) return;
    void projectSession.handleLoadProject(projectId).then(async () => {
      await projectSession.handleDeleteProject();
      projectSession.refreshProjects();
    });
  }

  function getProjectActions(project: WorkspaceProjectItem) {
    return {
      onOpen: () => void handleOpen(project.id),
      onDuplicate: () => void controller.duplicateProjectCard(project.id),
      onArchive: () => void controller.archiveProjectCard(project.id),
      onRestore: () => void controller.restoreProjectCard(project.id),
      onDelete: () => handleDeleteProject(project.id, project.name),
      onMoveToFolder: (folderId?: string) => controller.moveProjectToFolder(project.id, folderId),
      onSetStatus: (status: 'draft' | 'review' | 'ready') => controller.updateProjectStatus(project.id, status),
    };
  }

  function handleFolderDraftBlur(): void {
    if (newFolderName.trim()) {
      void controller.createFolderDraft().then(() => setCreatingFolder(false));
      return;
    }
    setCreatingFolder(false);
  }

  const tabs = [
    { id: 'projects' as const, label: 'Projects', count: stats.active },
    { id: 'templates' as const, label: 'Templates', count: controller.templateCount ?? undefined },
    { id: 'brand-kit' as const, label: 'Brand kit' },
  ];

  const viewModeOptions = [
    { id: 'card' as const, label: 'Cards' },
    { id: 'list' as const, label: 'List' },
  ];

  const stateFilterOptions = [
    { id: 'all' as const, label: 'All' },
    { id: 'active' as const, label: 'Active' },
    { id: 'inactive' as const, label: 'Inactive' },
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
            New ad
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
          <section className="workspace-projects-shell">
            <aside className="workspace-projects-sidebar panel">
              <div className="workspace-projects-sidebar__section">
                <div className="workspace-hub-kicker">Campaigns</div>
                <div className="workspace-projects-sidebar__list">
                  {folderOptions.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      className={`workspace-campaign-link ${activeFolderId === folder.id ? 'is-active' : ''}`.trim()}
                      onClick={() => setActiveFolderId(folder.id)}
                    >
                      <span className="workspace-campaign-link__label">
                        <StudioIcon icon={StudioIcons.folder} size={14} />
                        {folder.name}
                      </span>
                      <strong>{folder.count}</strong>
                    </button>
                  ))}
                </div>
                {creatingFolder ? (
                  <input
                    autoFocus
                    value={newFolderName}
                    className="workspace-campaign-input"
                    placeholder="New campaign folder"
                    onChange={(event) => setNewFolderName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void controller.createFolderDraft().then(() => setCreatingFolder(false));
                      }
                      if (event.key === 'Escape') {
                        setCreatingFolder(false);
                        setNewFolderName('');
                      }
                    }}
                    onBlur={handleFolderDraftBlur}
                  />
                ) : (
                  <button type="button" className="workspace-campaign-create" onClick={() => setCreatingFolder(true)}>
                    + New campaign folder
                  </button>
                )}
              </div>
            </aside>

            <div className="workspace-projects-main">
              <section className="workspace-hub-toolbar workspace-hub-toolbar--workspace">
                <div className="workspace-hub-toolbar-row workspace-hub-toolbar-row--primary">
                  <div className="workspace-project-search">
                    <input
                      value={search}
                      onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                      placeholder="Search by project, brand, campaign or owner"
                    />
                  </div>
                  <SegmentedControl
                    options={stateFilterOptions}
                    value={stateFilter}
                    onChange={(value) => { setStateFilter(value); setPage(1); }}
                    ariaLabel="Project state filter"
                  />
                  <SegmentedControl
                    options={viewModeOptions}
                    value={viewMode}
                    onChange={(value) => setViewMode(value as WorkspaceViewMode)}
                    ariaLabel="Project view mode"
                  />
                  <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)} aria-label="Sort projects">
                    <option value="recent">Recently edited</option>
                    <option value="name">A to Z</option>
                  </select>
                  <Button variant="primary" size="sm" className="compact-action" onClick={() => void handleCreateAndEnter()} disabled={!workspace.canCreateProjects}>
                    New ad
                  </Button>
                </div>
                <div className="workspace-hub-toolbar-row workspace-hub-toolbar-row--secondary">
                  <select value={projectFilter} onChange={(event) => { setProjectFilter(event.target.value as typeof projectFilter); setPage(1); }} aria-label="Project ownership filter">
                    <option value="all">All owners</option>
                    <option value="mine">Mine</option>
                    <option value="shared">Shared</option>
                  </select>
                  <div className="pill">{filteredProjects.length} projects</div>
                  <div className="pill">{stats.inactive} inactive</div>
                </div>
              </section>

              {!pageItems.length ? (
                <section className="workspace-hub-empty-state panel">
                  <div>
                    <div className="workspace-hub-kicker">Projects</div>
                    <h3>No projects yet</h3>
                    <p>Start from a template or create a blank campaign. This workspace opens on projects first, even when it is still empty.</p>
                  </div>
                  <div className="workspace-project-actions">
                    <Button variant="ghost" size="sm" className="compact-action" onClick={() => setActiveTab('templates')}>
                      Browse templates
                    </Button>
                    <Button variant="primary" size="sm" className="compact-action" onClick={() => void handleCreateAndEnter()} disabled={!workspace.canCreateProjects}>
                      Blank canvas
                    </Button>
                  </div>
                </section>
              ) : viewMode === 'card' ? (
                <section className="workspace-project-grid">
                  {pageItems.map((project) => {
                    const folderName = campaignFolders.find((folder) => folder.id === folderAssignments[project.id])?.name ?? 'Unfiled';
                    return (
                      <ProjectCard
                        key={project.id}
                        project={project as WorkspaceProjectItem}
                        folderName={folderName}
                        folders={campaignFolders}
                        canDelete={workspace.canDeleteProjects}
                        ownerOptions={ownerOptions}
                        onChangeOwner={(ownerUserId) => void controller.changeProjectOwner(project.id, ownerUserId)}
                        {...getProjectActions(project as WorkspaceProjectItem)}
                      />
                    );
                  })}
                </section>
              ) : (
                <section className="workspace-project-table panel">
                  <WorkspaceProjectTable
                    projects={pageItems as WorkspaceProjectItem[]}
                    selectedProjectIds={selectedProjectIds}
                    allVisibleSelected={allVisibleSelected}
                    canDelete={workspace.canDeleteProjects}
                    folders={campaignFolders}
                    onSelectAll={selectAllVisible}
                    onToggleSelection={toggleProjectSelection}
                    getProjectActions={(project) => getProjectActions(project)}
                  />

                  <WorkspaceProjectBulkBar
                    visible={selectedProjectIds.length > 0}
                    selectedCount={selectedProjectIds.length}
                    canDelete={workspace.canDeleteProjects}
                    folders={campaignFolders}
                    onMoveToFolder={(folderId) => controller.moveSelectedProjectsToFolder(folderId)}
                    onSetStatus={(status: 'draft' | 'review' | 'ready') => controller.updateSelectedProjectStatus(status)}
                    onArchive={() => void controller.archiveSelectedProjects()}
                    onDelete={() => {
                      if (window.confirm(`Delete ${selectedProjectIds.length} selected project(s)? This cannot be undone.`)) {
                        void controller.deleteSelectedProjects();
                      }
                    }}
                  />
                </section>
              )}

              <div className="workspace-hub-pagination">
                <div className="pill">Page {page} of {pageCount}</div>
                <div className="workspace-project-actions">
                  <Button variant="ghost" size="sm" className="compact-action" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</Button>
                  {selectedProjectIds.length > 0 ? (
                    <Button variant="ghost" size="sm" className="compact-action" onClick={clearSelection}>Clear selection</Button>
                  ) : null}
                  <Button variant="ghost" size="sm" className="compact-action" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>Next</Button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'brand-kit' ? (
          <div className="brand-kit-inline-panel">
            <BrandKitDrawer embedded onClose={() => setActiveTab('projects')} />
          </div>
        ) : null}
      </main>
    </div>
  );
}
