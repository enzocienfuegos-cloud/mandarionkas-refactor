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
  role?: 'admin' | 'designer' | 'ad_ops' | 'reviewer' | string | null;
}

export interface AuthMeResponse {
  user: AuthMeUser;
  workspace: WorkspaceOption | null;
  role?: 'admin' | 'designer' | 'ad_ops' | 'reviewer' | string | null;
  permissions?: string[];
  productAccess?: {
    ad_server: boolean;
    studio: boolean;
  } | null;
}

interface SessionWorkspacePayload {
  ok: boolean;
  authenticated: boolean;
  permissions?: string[];
  user?: {
    id: string;
    email: string;
    name?: string | null;
    role?: string | null;
  } | null;
  activeWorkspaceId?: string | null;
  workspaces?: WorkspaceOption[];
}

interface WorkspaceListPayload {
  workspaces?: WorkspaceOption[];
  activeWorkspaceId?: string | null;
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

function getMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function loadAuthMe() {
  const payload = await fetchJson<SessionWorkspacePayload>('/v1/auth/session');
  if (!payload.authenticated || !payload.user) {
    throw new Error('Authentication required');
  }

  const workspaces = payload.workspaces ?? [];
  const activeWorkspace = workspaces.find((workspace) => workspace.id === payload.activeWorkspaceId) ?? workspaces[0] ?? null;

  return {
    user: {
      id: payload.user.id,
      email: payload.user.email,
      display_name: payload.user.name ?? payload.user.email.split('@')[0] ?? null,
      avatar_url: null,
      role: payload.user.role ?? null,
    },
    workspace: activeWorkspace,
    role: payload.user.role ?? null,
    permissions: payload.permissions ?? [],
    productAccess: activeWorkspace?.product_access ?? null,
  } satisfies AuthMeResponse;
}

export async function loadWorkspaces(product: 'ad_server' | 'studio' | 'all' = 'ad_server') {
  const payload = await fetchJson<WorkspaceListPayload>('/v1/workspaces');
  const workspaces = payload.workspaces ?? [];
  if (product === 'all') return workspaces;
  return workspaces.filter((workspace) => {
    const access = workspace.product_access;
    if (!access) return true;
    return product === 'ad_server' ? access.ad_server !== false : access.studio !== false;
  });
}

export async function switchWorkspace(workspaceId: string) {
  const payload = await fetchJson<{
    workspaces?: WorkspaceOption[];
    activeWorkspaceId?: string | null;
  }>('/v1/clients/active', {
    method: 'POST',
    body: JSON.stringify({ workspaceId }),
  });
  const workspace = (payload.workspaces ?? []).find((item) => item.id === payload.activeWorkspaceId) ?? null;
  return {
    workspace,
    role: null,
    productAccess: workspace?.product_access ?? null,
  };
}

export async function createClientWorkspace(input: { name: string; website?: string } | string) {
  const payload = typeof input === 'string'
    ? { name: input }
    : {
      name: input.name,
      website: input.website ?? '',
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
  try {
    return await fetchJson<{
      clients: Array<{ id: string; name: string; role: string }>;
      users: ClientAccessUser[];
    }>('/v1/clients/access');
  } catch (error) {
    if (getMessage(error, '').includes('(404)')) {
      return { clients: [], users: [] };
    }
    throw error;
  }
}

export async function grantClientAccess(input: {
  email: string;
  role: 'admin' | 'designer' | 'ad_ops' | 'reviewer';
  workspaceIds: string[];
  productAccess: { ad_server: boolean; studio: boolean };
}) {
  try {
    return await fetchJson<{ ok: boolean; message?: string }>('/v1/clients/access', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch (error) {
    throw new Error(getMessage(error, 'Client access management is unavailable in this environment.'));
  }
}

export async function removeClientAccess(clientId: string, userId: string) {
  try {
    return await fetch(`/v1/clients/${clientId}/access/${userId}`, {
      method: 'DELETE',
      credentials: 'include',
    }).then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? `Request failed (${response.status})`);
      }
    });
  } catch (error) {
    throw new Error(getMessage(error, 'Client access management is unavailable in this environment.'));
  }
}

export async function updateClientAccess(input: {
  clientId: string;
  userId: string;
  role: 'admin' | 'designer' | 'ad_ops' | 'reviewer';
  productAccess: { ad_server: boolean; studio: boolean };
}) {
  try {
    return await fetchJson<{ ok: boolean; message?: string }>(`/v1/clients/${input.clientId}/access/${input.userId}`, {
      method: 'PUT',
      body: JSON.stringify({
        role: input.role,
        productAccess: input.productAccess,
      }),
    });
  } catch (error) {
    throw new Error(getMessage(error, 'Client access management is unavailable in this environment.'));
  }
}
