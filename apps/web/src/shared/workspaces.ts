export interface WorkspaceOption {
  id: string;
  name: string;
  slug?: string;
  plan?: string;
  logo_url?: string | null;
  product_access?: {
    ad_server: boolean;
    studio: boolean;
  };
}

export function getWorkspaceProductLabel(workspace: Pick<WorkspaceOption, 'product_access'> | null | undefined) {
  const access = workspace?.product_access;
  if (!access) return 'Ad Server + Studio';
  if (access.ad_server && access.studio) return 'Ad Server + Studio';
  if (access.ad_server) return 'Ad Server only';
  if (access.studio) return 'Studio only';
  return 'No product access';
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
  productAccess?: {
    ad_server: boolean;
    studio: boolean;
  } | null;
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

export async function loadWorkspaces(product: 'ad_server' | 'studio' | 'all' = 'ad_server') {
  const suffix = product === 'all' ? '' : `?product=${product}`;
  const payload = await fetchJson<{ workspaces: WorkspaceOption[] }>(`/v1/auth/workspaces${suffix}`);
  return payload.workspaces ?? [];
}

export async function switchWorkspace(workspaceId: string) {
  return fetchJson<{ workspace: WorkspaceOption; role?: string | null; productAccess?: { ad_server: boolean; studio: boolean } | null }>('/v1/auth/switch', {
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

export interface ClientAccessUser {
  id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  assignments: Array<{
    workspace_id: string;
    workspace_name: string;
    role: string;
    product_access: {
      ad_server: boolean;
      studio: boolean;
    };
    status: string;
    invited_at?: string | null;
    joined_at?: string | null;
  }>;
}

export async function loadClientAccess() {
  return fetchJson<{
    clients: Array<{ id: string; name: string; role: string }>;
    users: ClientAccessUser[];
  }>('/v1/clients/access');
}

export async function grantClientAccess(input: {
  email: string;
  role: 'owner' | 'editor' | 'reviewer';
  workspaceIds: string[];
  productAccess: { ad_server: boolean; studio: boolean };
}) {
  return fetchJson<{ ok: boolean; message?: string }>('/v1/clients/access', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function removeClientAccess(clientId: string, userId: string) {
  return fetch(`/v1/clients/${clientId}/access/${userId}`, {
    method: 'DELETE',
    credentials: 'include',
  }).then(async (response) => {
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.message ?? `Request failed (${response.status})`);
    }
  });
}

export async function updateClientAccess(input: {
  clientId: string;
  userId: string;
  role: 'owner' | 'editor' | 'reviewer';
  productAccess: { ad_server: boolean; studio: boolean };
}) {
  return fetchJson<{ ok: boolean; message?: string }>(`/v1/clients/${input.clientId}/access/${input.userId}`, {
    method: 'PUT',
    body: JSON.stringify({
      role: input.role,
      productAccess: input.productAccess,
    }),
  });
}
