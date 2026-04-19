import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydratePlatformState } from '../../../platform/state';
import { platformStore } from '../../../platform/store';
import {
  setPlatformApiBase,
  buildLoginResponse,
  buildInviteResponse,
  DEMO_WORKSPACES,
  makeFetchMock,
} from '../../helpers/api-mocks';

function resetPlatform(): void {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  hydratePlatformState();
}

describe('platform auth flows', () => {
  beforeEach(async () => {
    resetPlatform();
    setPlatformApiBase();
    vi.stubGlobal('fetch', makeFetchMock([buildLoginResponse('admin')]));
    await platformStore.login('admin@smx.studio', 'demo123');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invites a new pending member to the active workspace', async () => {
    const clientId = DEMO_WORKSPACES[0].id;
    const inviteResp = buildInviteResponse(clientId, 'new.user@example.com', 'reviewer', false);
    vi.stubGlobal('fetch', makeFetchMock([inviteResp]));

    const result = await platformStore.inviteMember(clientId, 'new.user@example.com', 'reviewer');
    expect(result.ok).toBe(true);

    const client = platformStore.getState().clients.find((c) => c.id === clientId);
    expect(client?.invites?.some((inv) => inv.email === 'new.user@example.com' && inv.status === 'pending')).toBe(true);
    expect(platformStore.getState().auditLog.some((e) => e.action === 'client.member.invite')).toBe(true);
  });

  it('adds an existing user directly as member to the workspace', async () => {
    const clientId = DEMO_WORKSPACES[0].id;
    const inviteResp = buildInviteResponse(clientId, 'reviewer@smx.studio', 'reviewer', true);
    vi.stubGlobal('fetch', makeFetchMock([inviteResp]));

    const result = await platformStore.inviteMember(clientId, 'reviewer@smx.studio', 'reviewer');
    expect(result.ok).toBe(true);

    const client = platformStore.getState().clients.find((c) => c.id === clientId);
    expect(client?.memberUserIds.includes('user_reviewer')).toBe(true);
  });
});
