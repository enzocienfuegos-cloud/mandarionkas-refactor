import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../shared/ui/ToastProvider';
import { ClientWorkspaceInspector } from './ClientWorkspaceInspector';
import { ClientWorkspaceToolbar } from './ClientWorkspaceToolbar';
import type { useClientWorkspaceController } from './use-client-workspace-controller';
import { ClientWorkspaceBulkBar } from './ClientWorkspaceBulkBar';
import { ClientWorkspaceCampaignGroups } from './ClientWorkspaceCampaignGroups';
import { ClientWorkspaceSidebar } from './ClientWorkspaceSidebar';
import { PlatformBrandKitModal } from '../shared/PlatformBrandKitModal';
import {
  matchesQuickFilter,
  resolveFormatKey,
  resolveGroupKey,
  resolveGroupName,
  resolveStatusKey,
  type CampaignGroup,
  type QuickFilterId,
} from './production-helpers';

type ClientWorkspaceController = ReturnType<typeof useClientWorkspaceController>;

type ClientWorkspaceProductionViewProps = {
  controller: ClientWorkspaceController;
  onEnterEditor(): void;
};

export function ClientWorkspaceProductionView({
  controller,
  onEnterEditor,
}: ClientWorkspaceProductionViewProps): JSX.Element {
  const { pushToast } = useToast();
  const {
    workspace,
    activeClient,
    search,
    setSearch,
    viewMode,
    setViewMode,
    sortMode,
    setSortMode,
    selectedProjectIds,
    replaceSelectedProjectIds,
    clearSelection,
    filteredProjects,
    campaignFolders,
    folderOptions,
    folderAssignments,
    activeFolderId,
    setActiveFolderId,
    createFolderDraft,
    moveSelectedProjectsToFolder,
    duplicateSelectedProjects,
    archiveSelectedProjects,
    deleteSelectedProjects,
    openProject,
    createProjectDraft,
  } = controller;
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderDraftName, setFolderDraftName] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilterId>('all');
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [bulkFolderId, setBulkFolderId] = useState<string>('root');
  const [inspectedProjectId, setInspectedProjectId] = useState<string | undefined>();
  const [brandKitOpen, setBrandKitOpen] = useState(false);
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
  const [rightRailCollapsed, setRightRailCollapsed] = useState(false);

  const folderNameById = useMemo(
    () => Object.fromEntries(campaignFolders.map((folder) => [folder.id, folder.name])),
    [campaignFolders],
  );

  const visibleProjects = useMemo(
    () => filteredProjects.filter((project) => matchesQuickFilter(project, quickFilter)),
    [filteredProjects, quickFilter],
  );

  const campaignGroups = useMemo<CampaignGroup[]>(() => {
    const groups = new Map<string, CampaignGroup>();
    for (const project of visibleProjects) {
      const folderId = folderAssignments[project.id];
      const groupId = resolveGroupKey(project, folderId);
      const existing = groups.get(groupId);
      if (existing) {
        existing.projects.push(project);
        if (project.updatedAt > existing.updatedAt) existing.updatedAt = project.updatedAt;
        continue;
      }
      groups.set(groupId, {
        id: groupId,
        name: resolveGroupName(project, folderId ? folderNameById[folderId] : undefined),
        folderId,
        clientName: activeClient?.name ?? project.brandName ?? 'Client',
        status: resolveStatusKey(project),
        updatedAt: project.updatedAt,
        projects: [project],
      });
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        status: resolveStatusKey(
          [...group.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? group.projects[0],
        ),
        projects: [...group.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [activeClient?.name, folderAssignments, folderNameById, visibleProjects]);

  const selectedSet = useMemo(() => new Set(selectedProjectIds), [selectedProjectIds]);

  useEffect(() => {
    if (campaignGroups.length === 0) {
      setExpandedGroupIds([]);
      return;
    }
    setExpandedGroupIds((current) => {
      const next = current.filter((id) => campaignGroups.some((group) => group.id === id));
      if (next.length > 0) return next;
      return campaignGroups.slice(0, 2).map((group) => group.id);
    });
  }, [campaignGroups]);

  useEffect(() => {
    const selectedVisibleProject = visibleProjects.find((project) => selectedSet.has(project.id));
    if (selectedVisibleProject && selectedVisibleProject.id !== inspectedProjectId) {
      setInspectedProjectId(selectedVisibleProject.id);
      return;
    }
    if (inspectedProjectId && visibleProjects.some((project) => project.id === inspectedProjectId)) return;
    setInspectedProjectId(visibleProjects[0]?.id);
  }, [inspectedProjectId, selectedSet, visibleProjects]);

  const visibleProjectIds = useMemo(
    () => campaignGroups.flatMap((group) => group.projects.map((project) => project.id)),
    [campaignGroups],
  );
  const inspectedProject = useMemo(
    () => visibleProjects.find((project) => project.id === inspectedProjectId),
    [inspectedProjectId, visibleProjects],
  );
  const allVisibleSelected = visibleProjectIds.length > 0 && visibleProjectIds.every((projectId) => selectedSet.has(projectId));

  const quickFilterOptions = useMemo(() => {
    const counts = {
      all: filteredProjects.length,
      html5: filteredProjects.filter((project) => resolveFormatKey(project) === 'html5').length,
      mraid: filteredProjects.filter((project) => resolveFormatKey(project) === 'mraid').length,
      vast: filteredProjects.filter((project) => resolveFormatKey(project) === 'vast').length,
      static: filteredProjects.filter((project) => resolveFormatKey(project) === 'static').length,
      playable: filteredProjects.filter((project) => resolveFormatKey(project) === 'playable').length,
      draft: filteredProjects.filter((project) => resolveStatusKey(project) === 'draft').length,
      qa: filteredProjects.filter((project) => resolveStatusKey(project) === 'qa').length,
      live: filteredProjects.filter((project) => resolveStatusKey(project) === 'live').length,
    };
    return [
      { id: 'all' as const, label: 'All', count: counts.all },
      { id: 'html5' as const, label: 'HTML5', count: counts.html5 },
      { id: 'mraid' as const, label: 'MRAID', count: counts.mraid },
      { id: 'vast' as const, label: 'VAST', count: counts.vast },
      { id: 'static' as const, label: 'Static', count: counts.static },
      { id: 'playable' as const, label: 'Playable', count: counts.playable },
      { id: 'draft' as const, label: 'Draft', count: counts.draft },
      { id: 'qa' as const, label: 'QA', count: counts.qa },
      { id: 'live' as const, label: 'Live', count: counts.live },
    ];
  }, [filteredProjects]);

  async function handleOpenProject(projectId: string): Promise<void> {
    await openProject(projectId);
    onEnterEditor();
  }

  async function handleUploadBanner(): Promise<void> {
    await createProjectDraft();
    onEnterEditor();
  }

  async function handleCreateFolder(): Promise<void> {
    if (!folderDraftName.trim()) return;
    await createFolderDraft(folderDraftName);
    setFolderDraftName('');
    setCreatingFolder(false);
    pushToast({
      title: 'Folder created',
      description: 'The campaign folder is now available in this workspace.',
      tone: 'success',
    });
  }

  function handleToggleVisibleSelection(): void {
    if (allVisibleSelected) {
      replaceSelectedProjectIds(selectedProjectIds.filter((projectId) => !visibleProjectIds.includes(projectId)));
      return;
    }
    replaceSelectedProjectIds([...selectedProjectIds, ...visibleProjectIds]);
  }

  function handleToggleGroupSelection(group: CampaignGroup): void {
    const groupIds = group.projects.map((project) => project.id);
    const allSelected = groupIds.every((projectId) => selectedSet.has(projectId));
    if (allSelected) {
      replaceSelectedProjectIds(selectedProjectIds.filter((projectId) => !groupIds.includes(projectId)));
      return;
    }
    replaceSelectedProjectIds([...selectedProjectIds, ...groupIds]);
  }

  function handleToggleProjectSelection(projectId: string): void {
    if (selectedSet.has(projectId)) {
      replaceSelectedProjectIds(selectedProjectIds.filter((id) => id !== projectId));
      return;
    }
    replaceSelectedProjectIds([...selectedProjectIds, projectId]);
  }

  async function handleMoveSelected(): Promise<void> {
    moveSelectedProjectsToFolder(bulkFolderId === 'root' || bulkFolderId === 'unfiled' ? undefined : bulkFolderId);
    pushToast({
      title: 'Banners moved',
      description: 'The selected banners were reassigned to the new campaign folder.',
      tone: 'success',
    });
  }

  async function handleDuplicateSelected(): Promise<void> {
    await duplicateSelectedProjects();
    pushToast({
      title: 'Banners duplicated',
      description: 'New copies were added to the active workspace.',
      tone: 'success',
    });
  }

  async function handleArchiveSelected(): Promise<void> {
    await archiveSelectedProjects();
    pushToast({
      title: 'Banners archived',
      description: 'The selected banners were removed from the active production queue.',
      tone: 'success',
    });
  }

  async function handleDeleteSelected(): Promise<void> {
    await deleteSelectedProjects();
    pushToast({
      title: 'Banners deleted',
      description: 'The selected banners were removed from this workspace.',
      tone: 'success',
    });
  }

  function handleExportSelected(): void {
    pushToast({
      title: 'Export is available in Studio',
      description: 'Open a banner in the editor to export packages or review bundles.',
    });
  }

  return (
    <section
      className={[
        'client-workspace-production',
        leftRailCollapsed ? 'is-left-collapsed' : '',
        rightRailCollapsed ? 'is-right-collapsed' : '',
      ].filter(Boolean).join(' ')}
    >
      <ClientWorkspaceSidebar
        activeClient={activeClient}
        canManageBrandkits={workspace.canManageBrandkits}
        activeFolderId={activeFolderId}
        folderOptions={folderOptions}
        quickFilter={quickFilter}
        quickFilterOptions={quickFilterOptions}
        creatingFolder={creatingFolder}
        folderDraftName={folderDraftName}
        onSetActiveFolderId={setActiveFolderId}
        onSetQuickFilter={setQuickFilter}
        onSetCreatingFolder={setCreatingFolder}
        onSetFolderDraftName={setFolderDraftName}
        onCreateFolder={() => { void handleCreateFolder(); }}
        onOpenBrandKit={() => setBrandKitOpen(true)}
        collapsed={leftRailCollapsed}
        onToggleCollapsed={() => setLeftRailCollapsed((current) => !current)}
      />

      <div className="client-workspace-production__main">
        <ClientWorkspaceToolbar
          search={search}
          onSearchChange={setSearch}
          quickFilter={quickFilter}
          onQuickFilterChange={setQuickFilter}
          quickFilterOptions={quickFilterOptions}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onCreateFolder={() => setCreatingFolder(true)}
          onCreateBanner={() => { void handleUploadBanner(); }}
          canCreateProjects={workspace.canCreateProjects}
        />

        {selectedProjectIds.length > 0 ? (
          <ClientWorkspaceBulkBar
            selectedCount={selectedProjectIds.length}
            canDeleteProjects={workspace.canDeleteProjects}
            bulkFolderId={bulkFolderId}
            campaignFolders={campaignFolders}
            onSetBulkFolderId={setBulkFolderId}
            onMove={() => { void handleMoveSelected(); }}
            onDuplicate={() => { void handleDuplicateSelected(); }}
            onArchive={() => { void handleArchiveSelected(); }}
            onExport={handleExportSelected}
            onDelete={() => { void handleDeleteSelected(); }}
            onClear={clearSelection}
          />
        ) : null}

        <ClientWorkspaceCampaignGroups
          campaignGroups={campaignGroups}
          viewMode={viewMode}
          expandedGroupIds={expandedGroupIds}
          selectedSet={selectedSet}
          inspectedProjectId={inspectedProjectId}
          visibleProjectsCount={visibleProjects.length}
          allVisibleSelected={allVisibleSelected}
          onToggleVisibleSelection={handleToggleVisibleSelection}
          onToggleGroup={(groupId) => setExpandedGroupIds((current) => current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId])}
          onToggleGroupSelection={handleToggleGroupSelection}
          onToggleProjectSelection={handleToggleProjectSelection}
          onInspectProject={setInspectedProjectId}
          onOpenProject={(projectId) => {
            void handleOpenProject(projectId);
          }}
        />
      </div>

      <ClientWorkspaceInspector
        activeClient={activeClient}
        project={inspectedProject}
        onOpenProject={(projectId) => {
          void handleOpenProject(projectId);
        }}
        collapsed={rightRailCollapsed}
        onToggleCollapsed={() => setRightRailCollapsed((current) => !current)}
      />

      <PlatformBrandKitModal
        open={brandKitOpen}
        activeClient={activeClient}
        canManageBrandkits={workspace.canManageBrandkits}
        onClose={() => setBrandKitOpen(false)}
      />
    </section>
  );
}
