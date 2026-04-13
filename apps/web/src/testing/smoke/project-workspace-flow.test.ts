import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../../domain/document/factories';
import { reduceBySlices } from '../../core/store/reducers';
import { platformStore } from '../../platform/store';
import { localProjectRepository } from '../../repositories/project/local';


describe('workspace project smoke path', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    platformStore.logout();
  });

  it('creates a client workspace, saves a project, lists it, and loads it back', async () => {
    const login = platformStore.login('admin@smx.studio', 'demo123');
    expect(login.ok).toBe(true);

    const client = platformStore.createClient('Smoke Workspace');
    expect(client?.name).toBe('Smoke Workspace');
    platformStore.setActiveClient(client!.id);

    let state = createInitialState();
    state = reduceBySlices(state, { type: 'UPDATE_DOCUMENT_NAME', name: 'Workspace Smoke Project' });
    state = reduceBySlices(state, {
      type: 'UPDATE_DOCUMENT_PLATFORM_METADATA',
      patch: {
        clientId: client!.id,
        clientName: client!.name,
        brandName: 'SignalMix',
        campaignName: 'Smoke Campaign',
        accessScope: 'client',
      },
    });

    const summary = await localProjectRepository.save(state);
    expect(summary.name).toBe('Workspace Smoke Project');

    const listed = await localProjectRepository.list();
    expect(listed.some((item) => item.id === summary.id)).toBe(true);

    const loaded = await localProjectRepository.load(summary.id);
    expect(loaded?.document.name).toBe('Workspace Smoke Project');
    expect(loaded?.document.metadata.platform.clientId).toBe(client!.id);
    expect(loaded?.document.metadata.platform.campaignName).toBe('Smoke Campaign');
  });
});
