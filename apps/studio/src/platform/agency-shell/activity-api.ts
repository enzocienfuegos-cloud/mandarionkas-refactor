import { getRepositoryApiBase } from '../../repositories/api-config';
import { fetchVoid } from '../../shared/net/http-json';

export type HubProjectActivityAction = 'exported' | 'shared';

function getBaseUrl(): string {
  return getRepositoryApiBase('smx-studio-v4:project-api-base');
}

export async function recordHubProjectActivity(
  projectId: string,
  action: HubProjectActivityAction,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const base = getBaseUrl().trim();
  if (!base || !projectId) return;
  await fetchVoid(`${base.replace(/\/$/, '')}/hub/projects/${projectId}/activity`, {
    method: 'POST',
    body: JSON.stringify({ action, metadata: metadata ?? {} }),
  });
}
