import { useEffect, useMemo, useState } from 'react';
import { CANVAS_PRESETS, getCanvasPresetById } from '../../domain/document/canvas-presets';
import { useTopBarController } from '../../app/shell/topbar/use-top-bar-controller';
import type { ProjectSummary } from '../../repositories/types';
import {
  WORKSPACE_VIEW_MODE_STORAGE_KEY,
  assignProjectsToFolder,
  createProjectFolder,
  getProjectFolderAssignments,
  getProjectWorkflowStatuses,
  listProjectFolders,
  setProjectWorkflowStatus,
  type ProjectFolderRecord,
  type ProjectWorkflowStatus,
  type ProjectWorkflowStatusRecord,
} from '../client-workspace/project-folder-store';
import { recordProjectVisit } from '../agency-shell/project-insights-store';
import { listTemplates } from '../../templates/library/registry';
import { readScopedStorageItem, writeScopedStorageItem } from '../../shared/browser/storage';

type ProjectFilter = 'all' | 'mine' | 'shared';
type ProjectStateFilter = 'all' | 'active' | 'inactive';
type SortMode = 'recent' | 'name';
export type WorkspaceViewMode = 'card' | 'list';
export type WorkspaceProjectStatus = ProjectWorkflowStatus | 'archived';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_VIEW_MODE: WorkspaceViewMode = 'card';

function readWorkspaceViewMode(): WorkspaceViewMode {
  const value = readScopedStorageItem(WORKSPACE_VIEW_MODE_STORAGE_KEY).trim();
  return value === 'list' ? 'list' : DEFAULT_VIEW_MODE;
}

function writeWorkspaceViewMode(value: WorkspaceViewMode): void {
  writeScopedStorageItem(WORKSPACE_VIEW_MODE_STORAGE_KEY, value);
}

function matchesSearch(project: ProjectSummary, query: string): boolean {
  if (!query) return true;
  const haystack = [
    project.name,
    project.brandName,
    project.campaignName,
    project.channel,
    project.id,
    project.ownerName,
    project.ownerUserId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function resolveProjectStatus(
  project: ProjectSummary,
  workflowStatuses: Record<string, ProjectWorkflowStatusRecord | undefined>,
): WorkspaceProjectStatus {
  if (project.archivedAt || project.isArchived) return 'archived';
  return workflowStatuses[project.id]?.value ?? 'draft';
}

function isProjectInactive(
  project: ProjectSummary,
  workflowStatuses: Record<string, ProjectWorkflowStatusRecord | undefined>,
): boolean {
  const status = resolveProjectStatus(project, workflowStatuses);
  if (status === 'archived') return true;
  if (status !== 'exported') return false;
  const exportedAt = workflowStatuses[project.id]?.updatedAt ?? project.updatedAt;
  const exportedMs = new Date(exportedAt).getTime();
  return Number.isFinite(exportedMs) && (Date.now() - exportedMs) > THIRTY_DAYS_MS;
}

function formatChannelBadge(project: ProjectSummary): string {
  switch (project.channel) {
    case 'google-display':
      return 'Display';
    case 'playable':
      return 'Playable';
    case 'mraid':
      return 'MRAID';
    case 'vast-simid':
      return 'SIMID';
    case 'generic-html5':
      return 'HTML5';
    default:
      return project.channel?.trim() || 'Studio';
  }
}

export function useWorkspaceHubController() {
  const topBar = useTopBarController();
  const [search, setSearch] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');
  const [stateFilter, setStateFilter] = useState<ProjectStateFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>(() => readWorkspaceViewMode());
  const [page, setPage] = useState(1);
  const [activeFolderId, setActiveFolderId] = useState<string>('all');
  const [newFolderName, setNewFolderName] = useState('');
  const [folderTick, setFolderTick] = useState(0);
  const pageSize = 8;

  const { workspace, projectSession, snapshot } = topBar;
  const { activeClientId, visibleClients, currentUser } = workspace;
  const activeClient = visibleClients.find((client) => client.id === activeClientId) ?? workspace.activeClient;

  useEffect(() => {
    writeWorkspaceViewMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    setActiveFolderId('all');
    setPage(1);
    setSelectedProjectIds([]);
  }, [activeClientId]);

  const projectFolders = useMemo<ProjectFolderRecord[]>(
    () => (activeClientId ? listProjectFolders(activeClientId) : []),
    [activeClientId, folderTick],
  );

  const workflowStatuses = useMemo(
    () => getProjectWorkflowStatuses(),
    [folderTick],
  );

  const folderAssignments = useMemo(
    () => getProjectFolderAssignments(),
    [folderTick],
  );

  const clientProjects = useMemo(
    () => projectSession.projects.filter((project) => !activeClientId || project.clientId === activeClientId),
    [projectSession.projects, activeClientId],
  );

  const decoratedProjects = useMemo(
    () => clientProjects.map((project) => ({
      ...project,
      workspaceStatus: resolveProjectStatus(project, workflowStatuses),
      inactive: isProjectInactive(project, workflowStatuses),
      channelBadge: formatChannelBadge(project),
    })),
    [clientProjects, workflowStatuses],
  );

  const filteredProjects = useMemo(() => {
    const next = decoratedProjects.filter((project) => {
      if (!matchesSearch(project, search)) return false;
      const projectFolderId = folderAssignments[project.id];
      if (activeFolderId === 'root' && projectFolderId) return false;
      if (activeFolderId !== 'all' && activeFolderId !== 'root' && projectFolderId !== activeFolderId) return false;
      if (projectFilter === 'mine' && project.ownerUserId !== currentUser?.id) return false;
      if (projectFilter === 'shared' && project.ownerUserId === currentUser?.id) return false;
      if (stateFilter === 'active' && project.inactive) return false;
      if (stateFilter === 'inactive' && !project.inactive) return false;
      return true;
    });

    next.sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return next;
  }, [activeFolderId, currentUser?.id, decoratedProjects, folderAssignments, projectFilter, search, sortMode, stateFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = filteredProjects.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedProjects = filteredProjects.filter((project) => selectedProjectIds.includes(project.id));
  const allVisibleSelected = pageItems.length > 0 && pageItems.every((project) => selectedProjectIds.includes(project.id));
  const someVisibleSelected = pageItems.some((project) => selectedProjectIds.includes(project.id));

  function toggleProjectSelection(projectId: string): void {
    setSelectedProjectIds((current) => current.includes(projectId) ? current.filter((item) => item !== projectId) : [...current, projectId]);
  }

  function clearSelection(): void {
    setSelectedProjectIds([]);
  }

  function replaceSelectedProjectIds(projectIds: string[]): void {
    setSelectedProjectIds(Array.from(new Set(projectIds)));
  }

  function selectAllVisible(nextSelected?: boolean): void {
    const shouldSelect = nextSelected ?? !allVisibleSelected;
    if (!shouldSelect) {
      setSelectedProjectIds((current) => current.filter((projectId) => !pageItems.some((project) => project.id === projectId)));
      return;
    }
    setSelectedProjectIds((current) => Array.from(new Set([...current, ...pageItems.map((project) => project.id)])));
  }

  async function createFolderDraft(nameOverride?: string): Promise<void> {
    const nextName = (nameOverride ?? newFolderName).trim();
    if (!activeClientId || !nextName) return;
    createProjectFolder(activeClientId, nextName);
    setNewFolderName('');
    setFolderTick((current) => current + 1);
  }

  function moveProjectsToFolder(projectIds: string[], folderId?: string): void {
    if (!projectIds.length) return;
    assignProjectsToFolder(projectIds, folderId);
    setFolderTick((current) => current + 1);
  }

  function moveSelectedProjectsToFolder(folderId?: string): void {
    moveProjectsToFolder(selectedProjectIds, folderId);
    clearSelection();
  }

  function moveProjectToFolder(projectId: string, folderId?: string): void {
    moveProjectsToFolder([projectId], folderId);
  }

  function updateSelectedProjectStatus(status: ProjectWorkflowStatus): void {
    if (!selectedProjectIds.length) return;
    setProjectWorkflowStatus(selectedProjectIds, status);
    setFolderTick((current) => current + 1);
  }

  function updateProjectStatus(projectId: string, status: ProjectWorkflowStatus): void {
    setProjectWorkflowStatus([projectId], status);
    setFolderTick((current) => current + 1);
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

  async function duplicateSelectedProjects(): Promise<void> {
    for (const project of selectedProjects) {
      await projectSession.handleDuplicateProject(project.id);
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
    recordProjectVisit(currentUser?.id, projectId);
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

  async function createProjectDraft(): Promise<void> {
    await projectSession.handleCreateProject();
  }

  const stats = {
    totalProjects: clientProjects.length,
    mine: clientProjects.filter((project) => project.ownerUserId === currentUser?.id && !project.archivedAt).length,
    shared: clientProjects.filter((project) => project.ownerUserId !== currentUser?.id && !project.archivedAt).length,
    inactive: decoratedProjects.filter((project) => project.inactive).length,
    active: decoratedProjects.filter((project) => !project.inactive).length,
    clientCount: visibleClients.length,
  };

  const ownerOptions = useMemo(() => {
    const ids = Array.from(new Set(activeClient?.memberUserIds ?? []));
    return ids.map((userId) => ({
      userId,
      label: userId === currentUser?.id ? `${currentUser.name} (you)` : userId,
    }));
  }, [activeClient?.memberUserIds, currentUser?.id, currentUser?.name]);

  const campaignFolders = useMemo(
    () => projectFolders.map((folder) => ({
      ...folder,
      count: clientProjects.filter((project) => folderAssignments[project.id] === folder.id).length,
    })),
    [clientProjects, folderAssignments, projectFolders],
  );

  const folderOptions = useMemo(
    () => [
      { id: 'all', name: 'Todos los proyectos', count: clientProjects.length },
      { id: 'root', name: 'Sin carpeta', count: clientProjects.filter((project) => !folderAssignments[project.id]).length },
      ...campaignFolders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        count: folder.count,
      })),
    ],
    [campaignFolders, clientProjects, folderAssignments],
  );

  return {
    topBar,
    workspace,
    projectSession,
    snapshot,
    activeClient,
    clients: visibleClients,
    search,
    setSearch,
    selectedProjectIds,
    selectedProjects,
    allVisibleSelected,
    someVisibleSelected,
    toggleProjectSelection,
    clearSelection,
    replaceSelectedProjectIds,
    selectAllVisible,
    deleteSelectedProjects,
    archiveSelectedProjects,
    restoreSelectedProjects,
    duplicateSelectedProjects,
    projectFilter,
    setProjectFilter,
    stateFilter,
    setStateFilter,
    sortMode,
    setSortMode,
    viewMode,
    setViewMode,
    page: safePage,
    setPage,
    pageCount,
    pageItems,
    filteredProjects,
    decoratedProjects,
    pageSize,
    activeFolderId,
    setActiveFolderId,
    newFolderName,
    setNewFolderName,
    projectFolders,
    folderOptions,
    campaignFolders,
    folderAssignments,
    workflowStatuses,
    openProject,
    duplicateProjectCard,
    archiveProjectCard,
    restoreProjectCard,
    changeProjectOwner,
    createProjectDraft,
    createFolderDraft,
    moveProjectToFolder,
    moveSelectedProjectsToFolder,
    updateProjectStatus,
    updateSelectedProjectStatus,
    stats,
    templateCount: listTemplates().length,
    ownerOptions,
    canvasPresets: CANVAS_PRESETS,
    currentPreset: getCanvasPresetById(snapshot.canvasPresetId),
  };
}
