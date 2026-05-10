import { readScopedStorageItem, writeScopedStorageItem } from '../../shared/browser/storage';
import type { ProjectSummary } from '../../repositories/types';

const STORAGE_KEY = 'smx-studio-v4:agency-project-insights';

type ProjectInsightRecord = {
  projectId: string;
  lastOpenedAt?: string;
  visitCount: number;
  isFavorite?: boolean;
};

type StoredState = {
  byUser: Record<string, Record<string, ProjectInsightRecord>>;
};

function readState(): StoredState {
  try {
    const raw = readScopedStorageItem(STORAGE_KEY);
    if (!raw) return { byUser: {} };
    const parsed = JSON.parse(raw) as StoredState;
    return parsed && parsed.byUser && typeof parsed.byUser === 'object'
      ? parsed
      : { byUser: {} };
  } catch {
    return { byUser: {} };
  }
}

function writeState(state: StoredState): void {
  writeScopedStorageItem(STORAGE_KEY, JSON.stringify(state));
}

function getUserRecords(userId?: string): Record<string, ProjectInsightRecord> {
  if (!userId) return {};
  return readState().byUser[userId] ?? {};
}

function patchUserRecords(userId: string, updater: (current: Record<string, ProjectInsightRecord>) => Record<string, ProjectInsightRecord>): void {
  const state = readState();
  const current = state.byUser[userId] ?? {};
  writeState({
    ...state,
    byUser: {
      ...state.byUser,
      [userId]: updater(current),
    },
  });
}

export function recordProjectVisit(userId: string | undefined, projectId: string): void {
  if (!userId) return;
  patchUserRecords(userId, (current) => {
    const existing = current[projectId];
    return {
      ...current,
      [projectId]: {
        projectId,
        visitCount: (existing?.visitCount ?? 0) + 1,
        isFavorite: existing?.isFavorite,
        lastOpenedAt: new Date().toISOString(),
      },
    };
  });
}

export function toggleFavoriteProject(userId: string | undefined, projectId: string): void {
  if (!userId) return;
  patchUserRecords(userId, (current) => {
    const existing = current[projectId];
    return {
      ...current,
      [projectId]: {
        projectId,
        visitCount: existing?.visitCount ?? 0,
        lastOpenedAt: existing?.lastOpenedAt,
        isFavorite: !existing?.isFavorite,
      },
    };
  });
}

export function getProjectInsightMap(userId?: string): Record<string, ProjectInsightRecord> {
  return getUserRecords(userId);
}

function sortByRecent(projects: ProjectSummary[], insights: Record<string, ProjectInsightRecord>): ProjectSummary[] {
  return [...projects].sort((a, b) => {
    const aRecent = insights[a.id]?.lastOpenedAt ?? '';
    const bRecent = insights[b.id]?.lastOpenedAt ?? '';
    if (aRecent && bRecent) return bRecent.localeCompare(aRecent);
    if (aRecent) return -1;
    if (bRecent) return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function listRecentProjects(projects: ProjectSummary[], userId?: string, limit = 8): ProjectSummary[] {
  const insights = getUserRecords(userId);
  return sortByRecent(projects, insights)
    .filter((project) => Boolean(insights[project.id]?.lastOpenedAt))
    .slice(0, limit);
}

export function listFavoriteProjects(projects: ProjectSummary[], userId?: string, limit = 8): ProjectSummary[] {
  const insights = getUserRecords(userId);
  return sortByRecent(projects, insights)
    .filter((project) => Boolean(insights[project.id]?.isFavorite))
    .slice(0, limit);
}

export function listMostVisitedProjects(projects: ProjectSummary[], userId?: string, limit = 8): ProjectSummary[] {
  const insights = getUserRecords(userId);
  return [...projects]
    .sort((a, b) => {
      const bVisits = insights[b.id]?.visitCount ?? 0;
      const aVisits = insights[a.id]?.visitCount ?? 0;
      if (bVisits !== aVisits) return bVisits - aVisits;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .filter((project) => (insights[project.id]?.visitCount ?? 0) > 0)
    .slice(0, limit);
}
