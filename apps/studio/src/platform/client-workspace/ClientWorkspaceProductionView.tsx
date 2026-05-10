import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../shared/ui/ToastProvider';
import { Button } from '../../shared/ui/Button';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import type { useClientWorkspaceController } from './use-client-workspace-controller';
import { ClientWorkspaceBulkBar } from './ClientWorkspaceBulkBar';
import { ClientWorkspaceCampaignGroups } from './ClientWorkspaceCampaignGroups';
import { ClientWorkspaceSidebar } from './ClientWorkspaceSidebar';
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
type ViewMode = 'card' | 'list';

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

  const visibleProjectIds = useMemo(
    () => campaignGroups.flatMap((group) => group.projects.map((project) => project.id)),
    [campaignGroups],
  );
  const selectedSet = useMemo(() => new Set(selectedProjectIds), [selectedProjectIds]);
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
      { id: 'all' as const, label: 'Todo', count: counts.all },
      { id: 'html5' as const, label: 'HTML5', count: counts.html5 },
      { id: 'mraid' as const, label: 'MRAID', count: counts.mraid },
      { id: 'vast' as const, label: 'VAST', count: counts.vast },
      { id: 'static' as const, label: 'Estático', count: counts.static },
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
      title: 'Carpeta creada',
      description: 'La carpeta de campaña ya está disponible en el workspace.',
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
      title: 'Banners movidos',
      description: 'Los banners seleccionados fueron reasignados a la nueva carpeta de campaña.',
      tone: 'success',
    });
  }

  async function handleDuplicateSelected(): Promise<void> {
    await duplicateSelectedProjects();
    pushToast({
      title: 'Banners duplicados',
      description: 'Se agregaron nuevas copias al workspace activo.',
      tone: 'success',
    });
  }

  async function handleArchiveSelected(): Promise<void> {
    await archiveSelectedProjects();
    pushToast({
      title: 'Banners archivados',
      description: 'Los banners seleccionados salieron de la cola activa de producción.',
      tone: 'success',
    });
  }

  async function handleDeleteSelected(): Promise<void> {
    await deleteSelectedProjects();
    pushToast({
      title: 'Banners eliminados',
      description: 'Los banners seleccionados fueron removidos de este workspace.',
      tone: 'success',
    });
  }

  function handleExportSelected(): void {
    pushToast({
      title: 'Export disponible en Studio',
      description: 'Abrí un banner en el editor para exportar paquetes o revisar bundles.',
    });
  }

  return (
    <section className="client-workspace-production">
      <ClientWorkspaceSidebar
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
      />

      <div className="client-workspace-production__main">
        <section className="client-workspace-main__hero panel">
          <div>
            <div className="workspace-hub-kicker">Workspace de proyecto</div>
            <h2>Producción activa del cliente</h2>
            <p className="client-workspace-main__description">Campañas, banners y estados operativos del cliente activo, sin mezclar clientes ni brand kits del hub.</p>
          </div>

          <div className="client-workspace-main__toolbar">
            <label className="client-workspace-search">
              <StudioIcon icon={StudioIcons.scanSearch} size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por banner, marca, campaña o responsable"
                aria-label="Buscar banners"
              />
            </label>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)} aria-label="Ordenar banners">
              <option value="recent">Actualizados recientemente</option>
              <option value="name">A a Z</option>
            </select>
            <SegmentedControl
              options={[
                { id: 'card', label: 'Cards' },
                { id: 'list', label: 'Lista' },
              ]}
              value={viewMode as ViewMode}
              onChange={(value) => setViewMode(value)}
              ariaLabel="Modo de vista de banners"
            />
            <Button variant="ghost" size="sm" className="compact-action" iconBefore={<StudioIcon icon={StudioIcons.plus} size={14} />} onClick={() => setCreatingFolder(true)}>
              Nueva carpeta
            </Button>
            <Button variant="primary" size="sm" className="compact-action" iconBefore={<StudioIcon icon={StudioIcons.upload} size={14} />} onClick={() => void handleUploadBanner()} disabled={!workspace.canCreateProjects}>
              Nuevo banner
            </Button>
          </div>
        </section>

        <div className="client-workspace-main__subfilters">
          <button type="button" className={`filter-pill ${quickFilter === 'all' ? 'is-active' : ''}`.trim()} onClick={() => setQuickFilter('all')}>
            Todo
          </button>
          {quickFilterOptions.slice(1).map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`filter-pill ${quickFilter === filter.id ? 'is-active' : ''}`.trim()}
              onClick={() => setQuickFilter(filter.id)}
            >
              {filter.label}
              <span>{filter.count}</span>
            </button>
          ))}
        </div>

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
          viewMode={viewMode as ViewMode}
          expandedGroupIds={expandedGroupIds}
          selectedSet={selectedSet}
          visibleProjectsCount={visibleProjects.length}
          allVisibleSelected={allVisibleSelected}
          onToggleVisibleSelection={handleToggleVisibleSelection}
          onToggleGroup={(groupId) => setExpandedGroupIds((current) => current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId])}
          onToggleGroupSelection={handleToggleGroupSelection}
          onToggleProjectSelection={handleToggleProjectSelection}
          onOpenProject={(projectId) => {
            void handleOpenProject(projectId);
          }}
        />
      </div>
    </section>
  );
}
