/**
 * Test-only helpers: build fetch mock responses that match the real API
 * contract shapes the frontend expects. All platform state flows through
 * the API — no localStorage, no offline fallbacks.
 */

import type { AuthSessionPayloadDto, AuthWorkspaceDto, CreateClientResponseDto, InviteMemberResponseDto } from '@smx/contracts';
import { getRolePermissions } from '../../platform/role-permissions';
import type { PlatformPermission } from '../../platform/types';

export const PLATFORM_API_BASE = 'https://api.test.smx.studio';

// ─── Seed localStorage so the platform API module resolves the base URL ───────

export function setPlatformApiBase(): void {
  localStorage.setItem('smx-studio-v4:platform-api-base', PLATFORM_API_BASE);
}

// ─── Demo workspace fixtures ──────────────────────────────────────────────────

export const DEMO_WORKSPACES: AuthWorkspaceDto[] = [
  {
    id: 'ws_retail',
    name: 'Retail Group',
    slug: 'retail-group',
    ownerUserId: 'user_admin',
    memberUserIds: ['user_admin', 'user_editor'],
    members: [
      { userId: 'user_admin', role: 'owner', addedAt: '2026-01-01T00:00:00.000Z' },
      { userId: 'user_editor', role: 'editor', addedAt: '2026-01-01T00:00:00.000Z' },
    ],
    invites: [],
    brands: [],
  },
  {
    id: 'ws_demo',
    name: 'Demo Agency',
    slug: 'demo-agency',
    ownerUserId: 'user_admin',
    memberUserIds: ['user_admin'],
    members: [{ userId: 'user_admin', role: 'owner', addedAt: '2026-01-01T00:00:00.000Z' }],
    invites: [],
    brands: [],
  },
];

// ─── Response builders ────────────────────────────────────────────────────────

export function buildLoginResponse(
  role: 'admin' | 'editor' | 'reviewer' = 'admin',
): AuthSessionPayloadDto {
  const users = {
    admin: { id: 'user_admin', name: 'Admin User', email: 'admin@smx.studio', role: 'admin' as const },
    editor: { id: 'user_editor', name: 'Editor User', email: 'editor@smx.studio', role: 'editor' as const },
    reviewer: { id: 'user_reviewer', name: 'Reviewer User', email: 'reviewer@smx.studio', role: 'reviewer' as const },
  };
  const user = users[role];
  return {
    ok: true,
    authenticated: true,
    session: {
      sessionId: `sess_${role}_demo`,
      persistenceMode: 'session',
      issuedAt: '2026-04-18T00:00:00.000Z',
      expiresAt: '2026-04-18T12:00:00.000Z',
    },
    user,
    activeClientId: DEMO_WORKSPACES[0].id,
    activeWorkspaceId: DEMO_WORKSPACES[0].id,
    permissions: getRolePermissions(user.role) as PlatformPermission[],
    clients: DEMO_WORKSPACES,
    workspaces: DEMO_WORKSPACES,
  };
}

export function buildCreateClientResponse(name: string): CreateClientResponseDto {
  const newClient: AuthWorkspaceDto = {
    id: `ws_${name.toLowerCase().replace(/\s+/g, '_')}`,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    ownerUserId: 'user_admin',
    memberUserIds: ['user_admin'],
    members: [{ userId: 'user_admin', role: 'owner', addedAt: new Date().toISOString() }],
    invites: [],
    brands: [],
  };
  const allClients = [...DEMO_WORKSPACES, newClient];
  return {
    ok: true,
    client: newClient,
    workspace: newClient,
    activeClientId: newClient.id,
    activeWorkspaceId: newClient.id,
    clients: allClients,
    workspaces: allClients,
  };
}

export function buildInviteResponse(
  clientId: string,
  email: string,
  role: 'editor' | 'reviewer',
  asExistingUser = false,
): InviteMemberResponseDto {
  const targetClient = DEMO_WORKSPACES.find((ws) => ws.id === clientId)!;
  const updatedClient: AuthWorkspaceDto = asExistingUser
    ? {
        ...targetClient,
        memberUserIds: [...targetClient.memberUserIds, 'user_reviewer'],
        members: [
          ...(targetClient.members ?? []),
          { userId: 'user_reviewer', role, addedAt: new Date().toISOString() },
        ],
      }
    : {
        ...targetClient,
        invites: [
          ...(targetClient.invites ?? []),
          {
            id: `invite_${Date.now()}`,
            email,
            role,
            status: 'pending',
            invitedAt: new Date().toISOString(),
          },
        ],
      };

  const allClients = DEMO_WORKSPACES.map((ws) => (ws.id === clientId ? updatedClient : ws));
  return {
    ok: true,
    message: asExistingUser ? `${email} added as member` : `Invitation sent to ${email}`,
    client: updatedClient,
    workspace: updatedClient,
    clients: allClients,
    workspaces: allClients,
  };
}

// ─── Fetch mock helper ────────────────────────────────────────────────────────

export function makeFetchMock(responses: Array<unknown>) {
  let callIndex = 0;
  return function mockFetch(_url: string, _init?: RequestInit): Promise<Response> {
    const body = responses[callIndex++] ?? { ok: false };
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(body),
    } as unknown as Response);
  };
}
