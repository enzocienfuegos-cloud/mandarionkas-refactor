import { beforeEach, describe, expect, it } from 'vitest';
import { readPlatformState } from '../../../platform/repository';
import { hydratePlatformState } from '../../../platform/state';
import { platformStore } from '../../../platform/store';

function resetPlatform(): void {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  hydratePlatformState();
}

describe('platform session persistence', () => {
  beforeEach(() => {
    resetPlatform();
  });

  it('rehydrates remembered sessions from localStorage', () => {
    const login = platformStore.login('admin@smx.studio', 'demo123', { remember: true });
    expect(login.ok).toBe(true);

    const persisted = readPlatformState();
    expect(persisted.session.isAuthenticated).toBe(true);
    expect(persisted.session.currentUser?.email).toBe('admin@smx.studio');
    expect(globalThis.localStorage.getItem('smx-studio-v4:platform-session')).toContain('sessionId');
  });

  it('stores ephemeral sessions in sessionStorage only', () => {
    const login = platformStore.login('editor@smx.studio', 'demo123', { remember: false });
    expect(login.ok).toBe(true);

    expect(globalThis.localStorage.getItem('smx-studio-v4:platform-session')).toBeNull();
    expect(globalThis.sessionStorage.getItem('smx-studio-v4:platform-session')).toContain('sessionId');
  });
});
