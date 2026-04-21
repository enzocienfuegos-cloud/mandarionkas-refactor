import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydratePlatformState } from '../../../platform/state';
import { platformStore } from '../../../platform/store';
import {
  setPlatformApiBase,
  buildLoginResponse,
  buildCreateClientResponse,
  makeFetchMock,
} from '../../helpers/api-mocks';

function resetPlatform(): void {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  hydratePlatformState();
}

describe('platform store', () => {
  beforeEach(() => {
    resetPlatform();
    setPlatformApiBase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs in demo admin and exposes permissions', async () => {
    vi.stubGlobal('fetch', makeFetchMock([buildLoginResponse('owner')]));
    const result = await platformStore.login('admin@smx.studio', 'demo123');
    expect(result.ok).toBe(true);
    expect(platformStore.getState().session.isAuthenticated).toBe(true);
    expect(platformStore.getState().session.permissions.length).toBeGreaterThan(0);
    expect(platformStore.getState().auditLog[0]?.action).toBe('session.login');
  });

  it('creates a client workspace for authorized user', async () => {
    vi.stubGlobal('fetch', makeFetchMock([
      buildLoginResponse('owner'),
      buildCreateClientResponse('Client QA'),
    ]));
    await platformStore.login('admin@smx.studio', 'demo123');
    const created = await platformStore.createClient('Client QA');
    expect(created?.name).toBe('Client QA');
    expect(platformStore.getState().session.activeClientId).toBe(created?.id);
    expect(platformStore.getState().auditLog.some((e) => e.action === 'client.create')).toBe(true);
  });
});
