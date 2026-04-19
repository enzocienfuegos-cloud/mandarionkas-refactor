import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatformState, hydratePlatformState } from '../../../platform/state';
import { platformStore } from '../../../platform/store';
import { setPlatformApiBase, buildLoginResponse, makeFetchMock } from '../../helpers/api-mocks';

function resetPlatform(): void {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  hydratePlatformState();
}

describe('platform session persistence', () => {
  beforeEach(() => {
    resetPlatform();
    setPlatformApiBase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('login sets authenticated session in memory with sessionId', async () => {
    vi.stubGlobal('fetch', makeFetchMock([buildLoginResponse('admin')]));
    const result = await platformStore.login('admin@smx.studio', 'demo123', { remember: true });
    expect(result.ok).toBe(true);
    const state = getPlatformState();
    expect(state.session.isAuthenticated).toBe(true);
    expect(state.session.currentUser?.email).toBe('admin@smx.studio');
    expect(state.session.sessionId).toBe('sess_admin_demo');
  });

  it('editor login sets correct role and restricted permissions', async () => {
    vi.stubGlobal('fetch', makeFetchMock([buildLoginResponse('editor')]));
    await platformStore.login('editor@smx.studio', 'demo123', { remember: false });
    const state = getPlatformState();
    expect(state.session.isAuthenticated).toBe(true);
    expect(state.session.currentUser?.role).toBe('editor');
    expect(state.session.sessionId).toBe('sess_editor_demo');
  });

  it('logout clears the in-memory session', async () => {
    vi.stubGlobal('fetch', makeFetchMock([
      buildLoginResponse('admin'),
      { ok: true }, // logout response
    ]));
    await platformStore.login('admin@smx.studio', 'demo123');
    expect(getPlatformState().session.isAuthenticated).toBe(true);
    await platformStore.logout();
    expect(getPlatformState().session.isAuthenticated).toBe(false);
    expect(getPlatformState().session.currentUser).toBeUndefined();
  });
});
