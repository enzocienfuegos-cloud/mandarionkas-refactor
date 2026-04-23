export interface WorkspaceOption {
  id: string;
  name: string;
  slug?: string;
  plan?: string;
  logo_url?: string | null;
}

export interface AuthMeUser {
  id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface AuthMeResponse {
  user: AuthMeUser;
  workspace: WorkspaceOption | null;
  role?: string | null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function loadAuthMe() {
  return fetchJson<AuthMeResponse>('/v1/auth/me');
}

export async function loadWorkspaces() {
  const payload = await fetchJson<{ workspaces: WorkspaceOption[] }>('/v1/auth/workspaces');
  return payload.workspaces ?? [];
}

export async function switchWorkspace(workspaceId: string) {
  return fetchJson<{ workspace: WorkspaceOption; role?: string | null }>('/v1/auth/switch', {
    method: 'POST',
    body: JSON.stringify({ workspaceId }),
  });
}

export async function createClientWorkspace(input: { name: string; website?: string; dsp?: string } | string) {
  const payload = typeof input === 'string'
    ? { name: input }
    : {
      name: input.name,
      website: input.website ?? '',
      dsp: input.dsp ?? '',
    };
  return fetchJson<{
    ok: boolean;
    client?: WorkspaceOption | null;
    workspace?: WorkspaceOption | null;
    activeWorkspaceId?: string;
    workspaces?: WorkspaceOption[];
  }>('/v1/clients', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
