import { beforeEach, describe, expect, it } from 'vitest';
import { hydratePlatformState } from '../../../platform/state';
import { platformStore } from '../../../platform/store';

function resetPlatform(): void {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  hydratePlatformState();
}

function getRetailClientId(): string {
  const retail = platformStore.getState().clients.find((client) => client.name === 'Retail Group');
  if (!retail) throw new Error('Retail Group client not found');
  return retail.id;
}

describe('platform auth flows', () => {
  beforeEach(() => {
    resetPlatform();
    platformStore.login('admin@smx.studio', 'demo123');
  });

  it('invites a new pending member to the active workspace', () => {
    const clientId = getRetailClientId();
    platformStore.setActiveClient(clientId);
    const result = platformStore.inviteMember(clientId, 'new.user@example.com', 'reviewer');

    expect(result.ok).toBe(true);
    const client = platformStore.getState().clients.find((item) => item.id === clientId);
    expect(client?.invites?.some((invite) => invite.email === 'new.user@example.com' && invite.status === 'pending')).toBe(true);
    expect(platformStore.getState().auditLog[0]?.action).toBe('client.member.invite');
  });

  it('adds an existing reviewer user directly to the workspace', () => {
    const clientId = getRetailClientId();
    platformStore.setActiveClient(clientId);
    const result = platformStore.inviteMember(clientId, 'reviewer@smx.studio', 'reviewer');

    expect(result.ok).toBe(true);
    const client = platformStore.getState().clients.find((item) => item.id === clientId);
    const reviewer = platformStore.getState().users.find((user) => user.email === 'reviewer@smx.studio');
    expect(client?.memberUserIds.includes(reviewer!.id)).toBe(true);
    expect(platformStore.workspaceRole(clientId)).toBe('owner');
  });
});
