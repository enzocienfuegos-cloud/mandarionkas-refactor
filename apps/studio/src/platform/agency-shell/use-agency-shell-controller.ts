import { useEffect, useMemo, useState } from 'react';
import { useTopBarController } from '../../app/shell/topbar/use-top-bar-controller';
import type { ClientWorkspace } from '../types';
import type { ProjectSummary } from '../../repositories/types';
import { recordProjectVisit } from './project-insights-store';
import { readAgencyShellPreferences, writeAgencyShellPreferences, type AgencySortMode } from './agency-shell-preferences';
import { getProjectWorkflowStatuses, type ProjectWorkflowStatusRecord } from '../client-workspace/project-folder-store';
import { useToast } from '../../shared/ui/ToastProvider';

const PROJECT_PAGE_SIZE = 5;

type AgencyProjectStatus = 'draft' | 'review' | 'ready' | 'exported' | 'archived';

export type AgencyProjectRow = ProjectSummary & {
  clientName: string;
  status: AgencyProjectStatus;
  statusLabel: string;
};

export type AgencyClientCard = {
  client: ClientWorkspace;
  projectCount: number;
  sharedProjectCount: number;
  activeProjectCount: number;
  recentProjectName: string;
  recentProjectId?: string;
  recentUpdatedAt?: string;
  latestActivityAt?: string;
  brandKitCount: number;
  palette: string[];
  statusLabel: 'Shared' | 'Active' | 'Idle';
};

function slugifyClientName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveProjectStatus(
  project: ProjectSummary,
  workflowStatuses: Record<string, ProjectWorkflowStatusRecord | undefined>,
): AgencyProjectStatus {
  if (project.archivedAt || project.isArchived) return 'archived';
  return workflowStatuses[project.id]?.value ?? 'draft';
}

function getProjectStatusLabel(status: AgencyProjectStatus): string {
  switch (status) {
    case 'review':
      return 'In review';
    case 'ready':
      return 'Ready';
    case 'exported':
      return 'Delivered';
    case 'archived':
      return 'Archived';
    case 'draft':
    default:
      return 'Design';
  }
}

function getClientNameMap(clients: ClientWorkspace[]): Map<string, string> {
  return new Map(clients.map((client) => [client.id, client.name]));
}

function matchesProjectSearch(project: ProjectSummary, clientName: string, query: string): boolean {
  if (!query) return true;
  const haystack = [
    project.name,
    clientName,
    project.brandName,
    project.campaignName,
    project.ownerName,
    project.ownerUserId,
    project.channel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function matchesClientSearch(client: ClientWorkspace, recentProjectName: string, query: string): boolean {
  if (!query) return true;
  return `${client.name} ${client.slug} ${recentProjectName}`.toLowerCase().includes(query);
}

export function useAgencyShellController() {
  const topBar = useTopBarController();
  const { workspace, projectSession } = topBar;
  const { visibleClients, currentUser } = workspace;
  const { pushToast } = useToast();
  const [preferences, setPreferences] = useState(() => readAgencyShellPreferences());
  const [page, setPage] = useState(1);
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [createClientName, setCreateClientName] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [createClientError, setCreateClientError] = useState<string | null>(null);

  useEffect(() => {
    writeAgencyShellPreferences(preferences);
  }, [preferences]);

  const workflowStatuses = useMemo(
    () => getProjectWorkflowStatuses(),
    [projectSession.projects.length],
  );

  const projects = useMemo(
    () => [...projectSession.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projectSession.projects],
  );

  const clientNameMap = useMemo(
    () => getClientNameMap(visibleClients),
    [visibleClients],
  );

  const activeProjects = useMemo(
    () => projects.filter((project) => !(project.archivedAt || project.isArchived)),
    [projects],
  );

  const filteredProjects = useMemo(() => {
    const loweredSearch = preferences.search.trim().toLowerCase();
    const next = activeProjects
      .filter((project) => {
        if (preferences.activeClientId !== 'all' && project.clientId !== preferences.activeClientId) {
          return false;
        }
        const clientName = clientNameMap.get(project.clientId) ?? 'Unnamed client';
        return matchesProjectSearch(project, clientName, loweredSearch);
      })
      .map<AgencyProjectRow>((project) => {
        const status = resolveProjectStatus(project, workflowStatuses);
        return {
          ...project,
          clientName: clientNameMap.get(project.clientId) ?? 'Unnamed client',
          status,
          statusLabel: getProjectStatusLabel(status),
        };
      });

    next.sort((a, b) => (
      preferences.sortMode === 'oldest'
        ? a.updatedAt.localeCompare(b.updatedAt)
        : b.updatedAt.localeCompare(a.updatedAt)
    ));

    return next;
  }, [activeProjects, clientNameMap, preferences.activeClientId, preferences.search, preferences.sortMode, workflowStatuses]);

  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / PROJECT_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paginatedProjects = filteredProjects.slice((safePage - 1) * PROJECT_PAGE_SIZE, safePage * PROJECT_PAGE_SIZE);

  const visibleClientCards = useMemo(() => {
    const loweredSearch = preferences.search.trim().toLowerCase();
    return visibleClients
      .map<AgencyClientCard>((client) => {
        const clientProjects = activeProjects.filter((project) => project.clientId === client.id);
        const recentProject = clientProjects[0];
        const sharedProjectCount = clientProjects.filter((project) => project.ownerUserId && project.ownerUserId !== currentUser?.id).length;
        const activeProjectCount = clientProjects.length;
        const palette = [
          client.brandColor,
          client.brands?.[0]?.primaryColor,
          client.brands?.[0]?.secondaryColor,
          client.brands?.[0]?.accentColor,
        ].filter((color): color is string => Boolean(color));
        const statusLabel = sharedProjectCount > 0 ? 'Shared' : activeProjectCount > 0 ? 'Active' : 'Idle';
        return {
          client,
          projectCount: clientProjects.length,
          sharedProjectCount,
          activeProjectCount,
          recentProjectName: recentProject?.name ?? 'No recent projects',
          recentProjectId: recentProject?.id,
          recentUpdatedAt: recentProject?.updatedAt,
          latestActivityAt: recentProject?.updatedAt,
          brandKitCount: client.brands?.length ?? 0,
          palette: Array.from(new Set(palette)).slice(0, 3),
          statusLabel,
        };
      })
      .filter((entry) => matchesClientSearch(entry.client, entry.recentProjectName, loweredSearch))
      .sort((a, b) => (b.recentUpdatedAt ?? '').localeCompare(a.recentUpdatedAt ?? ''));
  }, [activeProjects, currentUser?.id, preferences.search, visibleClients]);

  const clientFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All clients' },
      ...visibleClients.map((client) => ({ value: client.id, label: client.name })),
    ],
    [visibleClients],
  );

  const summary = useMemo(() => {
    const latestUpdatedAt = activeProjects[0]?.updatedAt;
    const brandKitCount = visibleClients.reduce((total, client) => total + (client.brands?.length ?? 0), 0);
    const clientsWithoutBrandKit = visibleClients.filter((client) => (client.brands?.length ?? 0) === 0).length;
    return {
      activeClientCount: visibleClients.length,
      activeProjectCount: activeProjects.length,
      brandKitCount,
      clientsWithoutBrandKit,
      latestUpdatedAt,
    };
  }, [activeProjects, visibleClients.length]);

  function markProjectOpened(projectId: string): void {
    recordProjectVisit(currentUser?.id, projectId);
  }

  function setSearch(value: string): void {
    setPage(1);
    setPreferences((current) => ({ ...current, search: value }));
  }

  function setActiveClientId(value: string): void {
    setPage(1);
    setPreferences((current) => ({ ...current, activeClientId: value }));
  }

  function setSortMode(value: AgencySortMode): void {
    setPage(1);
    setPreferences((current) => ({ ...current, sortMode: value }));
  }

  function openCreateClientModal(): void {
    if (!workspace.canCreateClient) return;
    setCreateClientName('');
    setCreateClientError(null);
    setIsCreateClientOpen(true);
  }

  function closeCreateClientModal(): void {
    if (isCreatingClient) return;
    setIsCreateClientOpen(false);
    setCreateClientError(null);
  }

  async function submitCreateClient(): Promise<ClientWorkspace | null> {
    const nextName = createClientName.trim();
    if (!nextName) {
      setCreateClientError('Enter a client name to create the account.');
      return null;
    }
    if (!workspace.canCreateClient) {
      setCreateClientError('Your account does not have permission to create clients.');
      return null;
    }

    setIsCreatingClient(true);
    setCreateClientError(null);
    try {
      const createdClient = await workspace.handleCreateClient(nextName);
      if (!createdClient) {
        setCreateClientError('Could not create the client. Please try again.');
        pushToast({
          title: 'Client creation failed',
          description: 'Check the name and try again.',
          tone: 'danger',
        });
        return null;
      }
      setIsCreateClientOpen(false);
      setCreateClientName('');
      pushToast({
        title: 'Client created',
        description: `${createdClient.name} is now available in the hub.`,
        tone: 'success',
      });
      return createdClient;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create the client.';
      setCreateClientError(message);
      pushToast({
        title: 'Client creation failed',
        description: message,
        tone: 'danger',
      });
      return null;
    } finally {
      setIsCreatingClient(false);
    }
  }

  return {
    topBar,
    workspace,
    projectSession,
    summary,
    filteredProjects,
    paginatedProjects,
    visibleClientCards,
    clientFilterOptions,
    pageSize: PROJECT_PAGE_SIZE,
    search: preferences.search,
    activeClientFilter: preferences.activeClientId,
    sortMode: preferences.sortMode,
    page: safePage,
    setPage,
    pageCount,
    setSearch,
    setActiveClientId,
    setSortMode,
    markProjectOpened,
    isCreateClientOpen,
    openCreateClientModal,
    closeCreateClientModal,
    createClientName,
    setCreateClientName,
    createClientSlug: slugifyClientName(createClientName),
    createClientError,
    isCreatingClient,
    submitCreateClient,
  };
}
