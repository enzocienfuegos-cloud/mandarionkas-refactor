import { getRepositoryApiBase } from '../api-config';
import { fetchJson, fetchOptionalJson } from '../../shared/net/http-json';

export type VideoAnalyticsEventRecord = {
  id: string;
  workspaceId: string;
  actorUserId?: string;
  projectId?: string;
  sceneId?: string;
  widgetId?: string;
  eventName: string;
  sessionId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type VideoAnalyticsSummary = {
  totalEvents: number;
  widgetCount: number;
  sceneCount: number;
  updatedAt?: string;
  topEvents: Array<{ eventName: string; count: number }>;
  topWidgets: Array<{ widgetId: string; count: number }>;
  hourlySeries: Array<{ bucket: string; count: number }>;
  dailySeries: Array<{ bucket: string; count: number }>;
};

function getBaseUrl(): string {
  return getRepositoryApiBase('smx-studio-v4:project-api-base');
}

export async function postVideoAnalyticsEvent(payload: {
  projectId?: string;
  sceneId?: string;
  widgetId?: string;
  eventName: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const base = getBaseUrl().trim();
  if (!base) return;
  await fetchJson<unknown>(`${base.replace(/\/$/, '')}/video-analytics/events`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listVideoAnalyticsEvents(params: {
  projectId?: string;
  widgetId?: string;
  eventName?: string;
  limit?: number;
} = {}): Promise<VideoAnalyticsEventRecord[]> {
  const base = getBaseUrl().trim();
  if (!base) return [];
  const url = new URL(`${base.replace(/\/$/, '')}/video-analytics/events`);
  if (params.projectId) url.searchParams.set('projectId', params.projectId);
  if (params.widgetId) url.searchParams.set('widgetId', params.widgetId);
  if (params.eventName) url.searchParams.set('eventName', params.eventName);
  if (typeof params.limit === 'number') url.searchParams.set('limit', String(params.limit));
  const response = await fetchOptionalJson<{ ok: boolean; events: VideoAnalyticsEventRecord[] }>(url.toString());
  return response?.events ?? [];
}

export async function getVideoAnalyticsSummary(params: {
  projectId?: string;
  widgetId?: string;
  sceneId?: string;
  eventName?: string;
} = {}): Promise<VideoAnalyticsSummary | null> {
  const base = getBaseUrl().trim();
  if (!base) return null;
  const url = new URL(`${base.replace(/\/$/, '')}/video-analytics/summary`);
  if (params.projectId) url.searchParams.set('projectId', params.projectId);
  if (params.widgetId) url.searchParams.set('widgetId', params.widgetId);
  if (params.sceneId) url.searchParams.set('sceneId', params.sceneId);
  if (params.eventName) url.searchParams.set('eventName', params.eventName);
  const response = await fetchOptionalJson<{ ok: boolean; summary: VideoAnalyticsSummary }>(url.toString());
  return response?.summary ?? null;
}
