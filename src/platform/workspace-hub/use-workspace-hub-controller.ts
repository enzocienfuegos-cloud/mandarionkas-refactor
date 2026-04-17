import { useMemo, useState } from 'react';
import { CANVAS_PRESETS, getCanvasPresetById } from '../../types/canvas-presets';
import { useTopBarController } from '../../app/shell/topbar/use-top-bar-controller';
import type { ProjectSummaryDto as ProjectSummary } from '../../types/contracts/projects';

type ProjectFilter = 'all' | 'mine' | 'shared';
type ProjectView = 'active' | 'archived' | 'all';
type SortMode = 'recent' | 'name';

function matchesSearch(project: ProjectSummary, query: string): boolean {
  if (!query) return true;
  const haystack = [project.name, project.brandName, project.campaignName, project.id, project.ownerName, project.ownerUserId]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function useWorkspaceHubController() {
  const topBar = useTopBarController();
  const [search, setSearch] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');
  const [projectView, setProjectView] = useState<ProjectView>('active');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const { workspace, projectSession, snapshot } = topBar;
  const { activeClientId, visibleClients, currentUser } = workspace;
  const activeClient = visibleClients.find((client) => client.id === activeClientId) ?? workspace.activeClient;
  const isAdmin = currentUser?.role === 'admin';

  const clientProjects = useMemo(
    () => projectSession.projects.filter((project) => !activeClientId || project.clientId === activeClientId),
    [projectSession.projects, activeClientId],
  );

  const filteredProjects = useMemo(() => {
    const next = clientProjects.filter((project) => {
      if (!matchesSearch(project, search)) return false;
      if (projectView === 'active' && project.archivedAt) return false;
      if (projectView === 'archived' && !project.archivedAt) return false;
      if (projectFilter === 'mine') return project.ownerUserId === currentUser?.id;
      if (projectFilter === 'shared') return project.ownerUserId !== currentUser?.id;
      return true;
    });
    next.sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return next;
  }, [clientProjects, currentUser?.id, projectFilter, projectView, search, sortMode]);

  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = filteredProjects.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedProjects = filteredProjects.filter((project) => selectedProjectIds.includes(project.id));

  function toggleProjectSelection(projectId: string): void {
    setSelectedProjectIds((current) => current.includes(projectId) ? current.filter((item) => item !== projectId) : [...current, projectId]);
  }

  function clearSelection(): void {
    setSelectedProjectIds([]);
  }

  function selectAllVisible(): void {
    setSelectedProjectIds(pageItems.map((project) => project.id));
  }

  async function deleteSelectedProjects(): Promise<void> {
    for (const project of selectedProjects) {
      await projectSession.handleLoadProject(project.id);
      await projectSession.handleDeleteProject();
    }
    clearSelection();
    projectSession.refreshProjects();
  }

  async function archiveSelectedProjects(): Promise<void> {
    for (const project of selectedProjects.filter((item) => !item.archivedAt)) {
      await projectSession.handleArchiveProject(project.id);
    }
    clearSelection();
  }

  async function restoreSelectedProjects(): Promise<void> {
    for (const project of selectedProjects.filter((item) => item.archivedAt)) {
      await projectSession.handleRestoreProject(project.id);
    }
    clearSelection();
  }

  async function openProject(projectId: string): Promise<void> {
    await projectSession.handleLoadProject(projectId);
  }

  async function duplicateProjectCard(projectId: string): Promise<void> {
    await projectSession.handleDuplicateProject(projectId);
  }

  async function archiveProjectCard(projectId: string): Promise<void> {
    await projectSession.handleArchiveProject(projectId);
  }

  async function restoreProjectCard(projectId: string): Promise<void> {
    await projectSession.handleRestoreProject(projectId);
  }

  async function changeProjectOwner(projectId: string, ownerUserId: string): Promise<void> {
    const ownerName = ownerOptions.find((option) => option.userId === ownerUserId)?.label;
    await projectSession.handleChangeProjectOwner(projectId, ownerUserId, ownerName);
  }

  function createProjectDraft(): void {
    projectSession.handleCreateProject();
  }

  const stats = {
    totalProjects: clientProjects.length,
    mine: clientProjects.filter((project) => project.ownerUserId === currentUser?.id && !project.archivedAt).length,
    shared: clientProjects.filter((project) => project.ownerUserId !== currentUser?.id && !project.archivedAt).length,
    archived: clientProjects.filter((project) => Boolean(project.archivedAt)).length,
    clientCount: visibleClients.length,
  };

  const ownerOptions = useMemo(() => {
    const ids = Array.from(new Set(activeClient?.memberUserIds ?? []));
    return ids.map((userId) => ({
      userId,
      label: userId === currentUser?.id ? `${currentUser.name} (you)` : userId,
    }));
  }, [activeClient?.memberUserIds, currentUser?.id, currentUser?.name]);

  return {
    topBar,
    workspace,
    projectSession,
    snapshot,
    activeClient,
    isAdmin,
    clients: visibleClients,
    search,
    setSearch,
    selectedProjectIds,
    selectedProjects,
    toggleProjectSelection,
    clearSelection,
    selectAllVisible,
    deleteSelectedProjects,
    archiveSelectedProjects,
    restoreSelectedProjects,
    projectFilter,
    setProjectFilter,
    projectView,
    setProjectView,
    sortMode,
    setSortMode,
    page: safePage,
    setPage,
    pageCount,
    pageItems,
    filteredProjects,
    pageSize,
    openProject,
    duplicateProjectCard,
    archiveProjectCard,
    restoreProjectCard,
    changeProjectOwner,
    createProjectDraft,
    stats,
    ownerOptions,
    canvasPresets: CANVAS_PRESETS,
    currentPreset: getCanvasPresetById(snapshot.canvasPresetId),
  };
}
