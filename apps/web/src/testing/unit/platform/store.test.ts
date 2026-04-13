import { beforeEach, describe, expect, it } from 'vitest';
import { hydratePlatformState } from '../../../platform/state';
import { platformStore } from '../../../platform/store';

function resetPlatform(): void {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  hydratePlatformState();
}

describe('platform store', () => {
  beforeEach(() => {
    resetPlatform();
  });

  it('logs in demo admin and exposes permissions', () => {
    const result = platformStore.login('admin@smx.studio', 'demo123');
    expect(result.ok).toBe(true);
    expect(platformStore.getState().session.isAuthenticated).toBe(true);
    expect(platformStore.getState().session.permissions.length).toBeGreaterThan(0);
    expect(platformStore.getState().auditLog[0]?.action).toBe('session.login');
  });

  it('creates a client workspace for authorized user', () => {
    platformStore.login('admin@smx.studio', 'demo123');
    const created = platformStore.createClient('Client QA');
    expect(created?.name).toBe('Client QA');
    expect(platformStore.getState().session.activeClientId).toBe(created?.id);
    expect(platformStore.getState().auditLog[0]?.action).toBe('client.create');
  });
});
