// apps/web/src/shared/workspaces.ts
//
// All API calls that touch session/workspace state from apps/web.
// No role inference here — roles come from the backend, not from this layer.

import type { PlatformRole, ProductAccess } from '../../../../packages/contracts/src/platform';

export interface WorkspaceOption {
  id: string;
  name: string;
  slug?: string;
  plan?: string;
  logo_url?: string | null;
  /** Resolved effective access for the current user in this workspace. */
  product_access: ProductAccess;
}

export function getWorkspaceProductLabel(
  workspace: { product_access?: ProductAccess | null } | null | undefined,
): string {
  const access = workspace?.product_access;
  if (!access) return 'Ad Server + Studio';
  if (access.ad_server && access.studio) return 'Ad Server + Studio';
  if (access.ad_server) return 'Ad Server only';
  if (access.studio) return 'Studio only';
  return 'No product access';
}

// ---------------------------------------------------------------------------
// Auth / session shape returned by /v1/auth/session
// ---------------------------------------------------------------------------

export interface AuthMeUser {
  id: string;
  email: string;
  name?: string | null;
  /** Always a valid PlatformRole — normalised by the backend. */
  role: PlatformRole;
}

export interface AuthMeResponse {
  user: AuthMeUser;
  workspace: WorkspaceOption | null;
  /** Resolved effective product access for the active workspace. */
  productAccess: ProductAccess;
  permissions: string[];
}

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

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
    const err = new Error(
      (payload as any)?.message ?? `Request failed (${response.status})`,
    ) as Error & { status: number };
    err.status = response.status;
    throw err;
  }
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

interface SessionPayload {
  ok: boolean;
  authenticated: boolean;
  permissions?: string[];
  user?: AuthMeUser | null;
  activeWorkspaceId?: string | null;
  workspaces?: WorkspaceOption[];
  productAccess?: ProductAccess | null;
}

/**
 * Loads the current session from /v1/auth/session.
 * Throws with status 401 if unauthenticated.
 */
export async function loadAuthMe(): Promise<AuthMeResponse> {
  const payload = await fetchJson<SessionPayload>('/v1/auth/session');

  if (!payload.authenticated || !payload.user) {
    const err = new Error('Authentication required') as Error & { status: number };
    err.status = 401;
    throw err;
  }

  const workspaces      = payload.workspaces ?? [];
  const activeWorkspace =
    workspaces.find((ws) => ws.id === payload.activeWorkspaceId) ??
    workspaces[0] ??
    null;

  // productAccess is resolved by the backend.
  // If missing (old backend), fall back to what the workspace row says.
  const productAccess: ProductAccess =
    payload.productAccess ??
    activeWorkspace?.product_access ?? { ad_server: true, studio: true };

  return {
    user: {
      id:    payload.user.id,
      email: payload.user.email,
      name:  payload.user.name ?? payload.user.email.split('@')[0] ?? null,
      role:  payload.user.role,
    },
    workspace:     activeWorkspace,
    productAccess,
    permissions:   payload.permissions ?? [],
  };
}

/**
 * Returns workspaces visible to the current user.
 * Filtering is advisory — the backend already enforces access.
 */
export async function loadWorkspaces(
  product: 'ad_server' | 'studio' | 'all' = 'all',
): Promise<WorkspaceOption[]> {
  const payload = await fetchJson<{ workspaces?: WorkspaceOption[] }>('/v1/workspaces');
  const workspaces = payload.workspaces ?? [];

  if (product === 'all') return workspaces;

  return workspaces.filter((ws) => {
    const access = ws.product_access;
    if (!access) return true;
    return product === 'ad_server'
      ? access.ad_server !== false
      : access.studio !== false;
  });
}

export async function switchWorkspace(workspaceId: string): Promise<AuthMeResponse> {
  await fetchJson('/v1/clients/active', {
    method: 'POST',
    body:   JSON.stringify({ workspaceId }),
  });
  // Re-fetch the full session after the switch so the component always gets
  // a consistent, backend-resolved payload.
  return loadAuthMe();
}

export async function createClientWorkspace(
  input: { name: string; website?: string } | string,
) {
  const payload = typeof input === 'string'
    ? { name: input }
    : { name: input.name, website: input.website ?? '' };

  return fetchJson<{
    ok: boolean;
    client?: WorkspaceOption | null;
    activeWorkspaceId?: string;
    workspaces?: WorkspaceOption[];
  }>('/v1/clients', { method: 'POST', body: JSON.stringify(payload) });
}

// ---------------------------------------------------------------------------
// Client access management
// ---------------------------------------------------------------------------

export interface ClientAccessUser {
  id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  assignments: Array<{
    workspace_id: string;
    workspace_name: string;
    role: string;
    product_access: ProductAccess;
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
    if ((error as any)?.status === 404) return { clients: [], users: [] };
    throw error;
  }
}

export async function grantClientAccess(input: {
  email: string;
  role: PlatformRole;
  workspaceIds: string[];
  productAccess: ProductAccess;
}) {
  return fetchJson<{ ok: boolean; message?: string }>('/v1/clients/access', {
    method: 'POST',
    body:   JSON.stringify(input),
  });
}

export async function removeClientAccess(clientId: string, userId: string) {
  const response = await fetch(`/v1/clients/${clientId}/access/${userId}`, {
    method:      'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as any)?.message ?? `Request failed (${response.status})`);
  }
}

export async function updateClientAccess(input: {
  clientId: string;
  userId: string;
  role: PlatformRole;
  productAccess: ProductAccess;
}) {
  return fetchJson<{ ok: boolean; message?: string }>(
    `/v1/clients/${input.clientId}/access/${input.userId}`,
    {
      method: 'PUT',
      body:   JSON.stringify({ role: input.role, productAccess: input.productAccess }),
    },
  );
}
