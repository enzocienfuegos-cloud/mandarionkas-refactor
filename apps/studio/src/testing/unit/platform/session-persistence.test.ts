import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatformState, hydratePlatformState } from '../../../platform/state';
import { platformStore } from '../../../platform/store';
import { readPlatformState } from '../../../platform/repository';
import { getDocumentRepositoryMode, getProjectRepositoryMode } from '../../../repositories/mode';
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
    vi.stubGlobal('fetch', makeFetchMock([buildLoginResponse('owner')]));
    const result = await platformStore.login('admin@smx.studio', 'demo123', { remember: true });
    expect(result.ok).toBe(true);
    const state = getPlatformState();
    expect(state.session.isAuthenticated).toBe(true);
    expect(state.session.currentUser?.email).toBe('admin@smx.studio');
    expect(state.session.sessionId).toBe('sess_owner_demo');
  });

  it('editor login sets correct role and restricted permissions', async () => {
    vi.stubGlobal('fetch', makeFetchMock([buildLoginResponse('editor')]));
    await platformStore.login('editor@smx.studio', 'demo123', { remember: false });
    const state = getPlatformState();
    expect(state.session.isAuthenticated).toBe(true);
    expect(state.session.currentUser?.role).toBe('editor');
    expect(state.session.sessionId).toBe('sess_editor_demo');
  });

  it('restores a remembered session from browser storage on reload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));
    await platformStore.login('admin@smx.studio', 'demo123', { remember: true });

    const restored = readPlatformState();

    expect(restored.session.isAuthenticated).toBe(true);
    expect(restored.session.currentUser?.email).toBe('admin@smx.studio');
    expect(restored.session.persistenceMode).toBe('local');
  });

  it('falls back to local demo login in development when the platform API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));

    const result = await platformStore.login('admin@smx.studio', 'demo123', { remember: true });

    expect(result.ok).toBe(true);
    const state = getPlatformState();
    expect(state.session.isAuthenticated).toBe(true);
    expect(state.session.currentUser?.email).toBe('admin@smx.studio');
    expect(state.session.sessionId).toBe('sess_owner_dev_fallback');
    expect(state.clients.length).toBeGreaterThan(0);
    expect(getProjectRepositoryMode()).toBe('local');
    expect(getDocumentRepositoryMode()).toBe('local');
  });

  it('logout clears the in-memory session', async () => {
    vi.stubGlobal('fetch', makeFetchMock([
      buildLoginResponse('owner'),
      { ok: true }, // logout response
    ]));
    await platformStore.login('admin@smx.studio', 'demo123');
    expect(getPlatformState().session.isAuthenticated).toBe(true);
    await platformStore.logout();
    expect(getPlatformState().session.isAuthenticated).toBe(false);
    expect(getPlatformState().session.currentUser).toBeUndefined();
  });
});
