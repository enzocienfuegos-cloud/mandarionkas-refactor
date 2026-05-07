export type SavedView = {
  id: string;
  name: string;
  surface: string;
  filters: Record<string, unknown>;
  sort: Record<string, unknown> | null;
  columns: string[];
  isShared: boolean;
  workspaceId?: string | null;
  userId?: string | null;
  canDelete?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CreateSavedViewInput = {
  surface: string;
  name: string;
  filters: Record<string, unknown>;
  sort?: Record<string, unknown> | null;
  columns?: string[];
  isShared?: boolean;
};

export type UpdateSavedViewInput = Partial<CreateSavedViewInput>;

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { message?: string })?.message ?? 'Request failed.');
  }
  return payload as T;
}

export async function listSavedViews(surface: string) {
  const params = new URLSearchParams({ surface });
  const response = await fetch(`/v1/saved-views?${params.toString()}`, { credentials: 'include' });
  const payload = await parseJson<{ views?: SavedView[] }>(response);
  return payload.views ?? [];
}

export async function getSavedView(id: string) {
  const response = await fetch(`/v1/saved-views/${id}`, { credentials: 'include' });
  const payload = await parseJson<{ view?: SavedView }>(response);
  return payload.view ?? null;
}

export async function createSavedView(input: CreateSavedViewInput) {
  const response = await fetch('/v1/saved-views', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await parseJson<{ view?: SavedView }>(response);
  return payload.view ?? null;
}

export async function updateSavedView(id: string, input: UpdateSavedViewInput) {
  const response = await fetch(`/v1/saved-views/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await parseJson<{ view?: SavedView }>(response);
  return payload.view ?? null;
}

export async function deleteSavedView(id: string) {
  const response = await fetch(`/v1/saved-views/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await parseJson(response);
}

export function buildSavedViewUrl(id: string, pathname = window.location.pathname) {
  const url = new URL(window.location.origin);
  url.pathname = pathname;
  url.searchParams.set('view', id);
  return url.toString();
}
