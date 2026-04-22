import { useEffect, useMemo, useState } from 'react';
import { useTopBarController } from '../../app/shell/topbar/use-top-bar-controller';
import { getProjectInsightMap, listFavoriteProjects, listMostVisitedProjects, listRecentProjects, recordProjectVisit, toggleFavoriteProject } from './project-insights-store';
import { readAgencyShellPreferences, writeAgencyShellPreferences, type AgencyProjectFilter, type AgencySortMode } from './agency-shell-preferences';

export function useAgencyShellController() {
  const topBar = useTopBarController();
  const { workspace, projectSession } = topBar;
  const { visibleClients, currentUser } = workspace;
  const [insightTick, setInsightTick] = useState(0);
  const [preferences, setPreferences] = useState(() => readAgencyShellPreferences());
  const [page, setPage] = useState(1);
  const pageSize = 9;

  const projects = useMemo(
    () => [...projectSession.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projectSession.projects],
  );

  const projectInsights = useMemo(
    () => getProjectInsightMap(currentUser?.id),
    [currentUser?.id, insightTick],
  );

  const recentProjects = useMemo(
    () => listRecentProjects(projects, currentUser?.id, 8),
    [currentUser?.id, insightTick, projects],
  );

  const favoriteProjects = useMemo(
    () => listFavoriteProjects(projects, currentUser?.id, 6),
    [currentUser?.id, insightTick, projects],
  );

  const mostVisitedProjects = useMemo(
    () => listMostVisitedProjects(projects, currentUser?.id, 8),
    [currentUser?.id, insightTick, projects],
  );

  useEffect(() => {
    writeAgencyShellPreferences(preferences);
  }, [preferences]);

  const filteredProjects = useMemo(() => {
    const loweredSearch = preferences.search.trim().toLowerCase();
    const next = projects.filter((project) => {
      if (preferences.activeClientId !== 'all' && project.clientId !== preferences.activeClientId) return false;
      if (preferences.projectFilter === 'favorites' && !projectInsights[project.id]?.isFavorite) return false;
      if (preferences.projectFilter === 'shared' && project.ownerUserId === currentUser?.id) return false;
      if (preferences.projectFilter === 'archived' && !project.archivedAt) return false;
      if (!loweredSearch) return true;
      const haystack = [project.name, project.brandName, project.campaignName, project.ownerName, project.ownerUserId, project.clientId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(loweredSearch);
    });

    next.sort((a, b) => {
      if (preferences.sortMode === 'name') return a.name.localeCompare(b.name);
      if (preferences.sortMode === 'most-visited') {
        const bVisits = projectInsights[b.id]?.visitCount ?? 0;
        const aVisits = projectInsights[a.id]?.visitCount ?? 0;
        if (bVisits !== aVisits) return bVisits - aVisits;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    return next;
  }, [currentUser?.id, preferences, projectInsights, projects]);

  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paginatedProjects = filteredProjects.slice((safePage - 1) * pageSize, safePage * pageSize);

  const clientCards = useMemo(() => (
    visibleClients.map((client) => {
      const clientProjects = projects.filter((project) => project.clientId === client.id);
      const activeProjects = clientProjects.filter((project) => !project.archivedAt);
      const recent = clientProjects[0];
      return {
        client,
        projectCount: clientProjects.length,
        activeCount: activeProjects.length,
        archivedCount: clientProjects.length - activeProjects.length,
        sharedCount: activeProjects.filter((project) => project.ownerUserId !== currentUser?.id).length,
        recentProjectName: recent?.name ?? 'No recent projects',
        recentUpdatedAt: recent?.updatedAt,
      };
    })
  ), [currentUser?.id, projects, visibleClients]);

  const stats = {
    clientCount: visibleClients.length,
    totalProjects: projects.length,
    activeProjects: projects.filter((project) => !project.archivedAt).length,
    archivedProjects: projects.filter((project) => Boolean(project.archivedAt)).length,
    sharedProjects: projects.filter((project) => project.ownerUserId !== currentUser?.id && !project.archivedAt).length,
  };

  const efficiency = {
    averageWidgetsPerProject: projects.length
      ? Math.round(projects.reduce((sum, project) => sum + (project.widgetCount ?? 0), 0) / projects.length)
      : 0,
    averageScenesPerProject: projects.length
      ? Number((projects.reduce((sum, project) => sum + (project.sceneCount ?? 1), 0) / projects.length).toFixed(1))
      : 0,
    busiestClientName: clientCards.slice().sort((a, b) => b.activeCount - a.activeCount)[0]?.client.name ?? 'No clients yet',
  };

  function markProjectOpened(projectId: string): void {
    recordProjectVisit(currentUser?.id, projectId);
    setInsightTick((current) => current + 1);
  }

  function toggleProjectFavorite(projectId: string): void {
    toggleFavoriteProject(currentUser?.id, projectId);
    setInsightTick((current) => current + 1);
  }

  function setSearch(value: string): void {
    setPage(1);
    setPreferences((current) => ({ ...current, search: value }));
  }

  function setActiveClientId(value: string): void {
    setPage(1);
    setPreferences((current) => ({ ...current, activeClientId: value }));
  }

  function setProjectFilter(value: AgencyProjectFilter): void {
    setPage(1);
    setPreferences((current) => ({ ...current, projectFilter: value }));
  }

  function setSortMode(value: AgencySortMode): void {
    setPreferences((current) => ({ ...current, sortMode: value }));
  }

  return {
    topBar,
    workspace,
    projectSession,
    visibleClients,
    projectInsights,
    recentProjects,
    favoriteProjects,
    mostVisitedProjects,
    filteredProjects,
    paginatedProjects,
    clientCards,
    stats,
    efficiency,
    preferences,
    search: preferences.search,
    activeClientFilter: preferences.activeClientId,
    projectFilter: preferences.projectFilter,
    sortMode: preferences.sortMode,
    setSearch,
    setActiveClientId,
    setProjectFilter,
    setSortMode,
    page: safePage,
    setPage,
    pageCount,
    markProjectOpened,
    toggleProjectFavorite,
  };
}
