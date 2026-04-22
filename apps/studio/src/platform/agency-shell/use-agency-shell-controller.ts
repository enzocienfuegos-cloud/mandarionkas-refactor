import { useMemo } from 'react';
import { useTopBarController } from '../../app/shell/topbar/use-top-bar-controller';

export function useAgencyShellController() {
  const topBar = useTopBarController();
  const { workspace, projectSession } = topBar;
  const { visibleClients, currentUser } = workspace;

  const projects = useMemo(
    () => [...projectSession.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projectSession.projects],
  );

  const recentProjects = projects.slice(0, 8);
  const mostVisitedProjects = [...projects]
    .sort((a, b) => (b.widgetCount ?? 0) + (b.sceneCount ?? 0) - ((a.widgetCount ?? 0) + (a.sceneCount ?? 0)))
    .slice(0, 8);

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

  return {
    topBar,
    workspace,
    projectSession,
    visibleClients,
    recentProjects,
    mostVisitedProjects,
    clientCards,
    stats,
    efficiency,
  };
}
