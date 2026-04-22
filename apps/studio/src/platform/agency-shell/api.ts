import { getRepositoryApiBase } from '../../repositories/api-config';
import { fetchOptionalJson } from '../../shared/net/http-json';

export type AgencyHubOverview = {
  workspaceMetrics: Array<{
    workspaceId: string;
    name: string;
    projectCount: number;
    openCount: number;
    saveCount: number;
    versionSaveCount: number;
  }>;
  topProjects: Array<{
    id: string;
    workspaceId: string;
    workspaceName: string;
    name: string;
    brandName?: string;
    campaignName?: string;
    ownerUserId: string;
    ownerName?: string;
    updatedAt: string;
    archivedAt?: string;
    canvasPresetId?: string;
    sceneCount: number;
    widgetCount: number;
    openCount: number;
  }>;
  recentActivity: Array<{
    id: string;
    workspaceId: string;
    workspaceName: string;
    projectId: string;
    projectName: string;
    actorUserId: string | null;
    actorName: string | null;
    action: string;
    createdAt: string;
  }>;
  contributorLeaderboard: Array<{
    actorUserId: string;
    actorName: string;
    projectCount: number;
    openCount: number;
    saveCount: number;
    versionSaveCount: number;
  }>;
  clientLeaderboard: Array<{
    workspaceId: string;
    workspaceName: string;
    projectCount: number;
    openCount: number;
    saveCount: number;
    versionSaveCount: number;
  }>;
  efficiency: {
    totalOpenEvents: number;
    totalSaveEvents: number;
    totalVersionSaveEvents: number;
    averageOpenToSaveMinutes: number | null;
  };
};

function getBaseUrl(): string {
  return getRepositoryApiBase('smx-studio-v4:project-api-base');
}

export async function fetchAgencyHubOverview(): Promise<AgencyHubOverview | null> {
  const base = getBaseUrl().trim();
  if (!base) return null;
  const response = await fetchOptionalJson<{ overview?: AgencyHubOverview }>(
    `${base.replace(/\/$/, '')}/hub/overview`,
  );
  return response?.overview ?? null;
}
