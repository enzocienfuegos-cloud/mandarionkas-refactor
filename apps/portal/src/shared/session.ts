export interface WorkspaceOption {
  id: string;
  name: string;
  slug?: string;
  product_access?: {
    ad_server: boolean;
    studio: boolean;
  };
}

export interface PortalUser {
  id: string;
  email: string;
  name: string;
  role: string | null;
  legacyRole: string | null;
}

export interface PortalSession {
  user: PortalUser;
  workspace: WorkspaceOption | null;
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string | null;
  productAccess: {
    ad_server: boolean;
    studio: boolean;
  };
}

interface SessionPayload {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    name?: string | null;
    role?: string | null;
    legacyRole?: string | null;
  } | null;
  activeWorkspaceId?: string | null;
  workspaces?: WorkspaceOption[];
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

function defaultProductAccess() {
  return { ad_server: true, studio: true };
}

export async function loadPortalSession(): Promise<PortalSession> {
  const payload = await fetchJson<SessionPayload>('/v1/auth/session');
  if (!payload.authenticated || !payload.user) {
    throw new Error('Authentication required');
  }

  const workspaces = payload.workspaces ?? [];
  const activeWorkspaceId = payload.activeWorkspaceId ?? workspaces[0]?.id ?? null;
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0] ?? null;
  const productAccess = activeWorkspace?.product_access ?? payload.productAccess ?? defaultProductAccess();

  return {
    user: {
      id: payload.user.id,
      email: payload.user.email,
      name: payload.user.name ?? payload.user.email.split('@')[0] ?? 'User',
      role: payload.user.role ?? null,
      legacyRole: payload.user.legacyRole ?? null,
    },
    workspace: activeWorkspace,
    workspaces,
    activeWorkspaceId,
    productAccess,
  };
}

export async function login(input: { email: string; password: string; remember: boolean }) {
  return fetchJson('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
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
    body: JSON.stringify(input),
  });
}

export async function logout() {
  await fetch('/v1/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}

export async function switchWorkspace(workspaceId: string) {
  return fetchJson('/v1/clients/active', {
    method: 'POST',
    body: JSON.stringify({ workspaceId }),
  });
}
