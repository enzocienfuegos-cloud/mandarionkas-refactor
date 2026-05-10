// apps/portal/src/shared/session.ts
//
// All session/auth API calls for apps/portal.
// productAccess is always resolved by the backend — this layer reads it,
// never infers it.

import type { PlatformRole, ProductAccess } from '../../../../packages/contracts/src/platform';
import { resolveProductAccess } from '../../../../packages/contracts/src/platform';

export interface WorkspaceOption {
  id: string;
  name: string;
  slug?: string;
  product_access?: ProductAccess | null;
}

export interface PortalUser {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
}

export interface PortalSession {
  user: PortalUser;
  workspace: WorkspaceOption | null;
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string | null;
  /** Resolved effective access — never inferred client-side. */
  productAccess: ProductAccess;
}

// ---------------------------------------------------------------------------
// Internal fetch
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
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
// Session payload shape from /v1/auth/session
// ---------------------------------------------------------------------------

interface SessionPayload {
  ok: boolean;
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    name?: string | null;
    role?: string | null;
  } | null;
  activeWorkspaceId?: string | null;
  workspaces?: WorkspaceOption[];
  /** Resolved by backend — preferred source. */
  productAccess?: ProductAccess | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loadPortalSession(): Promise<PortalSession> {
  const payload = await fetchJson<SessionPayload>('/v1/auth/session');

  if (!payload.authenticated || !payload.user) {
    const err = new Error('Authentication required') as Error & { status: number };
    err.status = 401;
    throw err;
  }

  const workspaces      = payload.workspaces ?? [];
  const activeWorkspaceId = payload.activeWorkspaceId ?? workspaces[0]?.id ?? null;
  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId) ?? workspaces[0] ?? null;

  // Prefer the backend-resolved productAccess. Fall back to the workspace
  // row, then resolve via contracts helper (applies the role ceiling).
  const role = (payload.user.role ?? 'reviewer') as PlatformRole;
  const productAccess: ProductAccess =
    payload.productAccess ??
    resolveProductAccess(role, activeWorkspace?.product_access ?? null);

  return {
    user: {
      id:    payload.user.id,
      email: payload.user.email,
      name:  payload.user.name ?? payload.user.email.split('@')[0] ?? 'User',
      role,
    },
    workspace:       activeWorkspace,
    workspaces,
    activeWorkspaceId,
    productAccess,
  };
}

export async function login(input: {
  email: string;
  password: string;
  remember: boolean;
}) {
  return fetchJson('/v1/auth/login', {
    method: 'POST',
    body:   JSON.stringify(input),
  });
}

export async function register(input: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  workspaceName: string;
}) {
  return fetchJson('/v1/auth/register', {
    method: 'POST',
    body:   JSON.stringify(input),
  });
}

export async function logout() {
  await fetch('/v1/auth/logout', { method: 'POST', credentials: 'include' });
}

export async function switchWorkspace(workspaceId: string): Promise<PortalSession> {
  await fetchJson('/v1/clients/active', {
    method: 'POST',
    body:   JSON.stringify({ workspaceId }),
  });
  // Always re-load the full session after a switch so productAccess is
  // re-resolved by the backend, not derived client-side.
  return loadPortalSession();
}
