import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { browserStorageProjectVersionRepository } from '../../fakes/browser-storage-project-version-repository';
import { browserStorageProjectRepository } from '../../fakes/browser-storage-project-repository';
import { configureRepositoryContextResolver, resetRepositoryContextResolver } from '../../../repositories/context';

const projectId = 'proj_test_versions';

describe('browserStorageProjectVersionRepository', () => {
  beforeEach(async () => {
    localStorage.clear();
    configureRepositoryContextResolver(() => ({
      clientId: 'client_test',
      ownerUserId: 'user_test',
      clientName: 'Test Client',
      currentUserRole: 'admin',
      can: () => true,
    }));
  });

  afterEach(() => {
    resetRepositoryContextResolver();
  });

  it('records manual versions and loads them back', async () => {
    const state = createInitialState({ name: 'Versioned Project' });
    await browserStorageProjectRepository.save(state, projectId);
    const first = await browserStorageProjectVersionRepository.save(projectId, state, 'Initial checkpoint');

    const nextState = createInitialState({ name: 'Versioned Project v2' });
    const second = await browserStorageProjectVersionRepository.save(projectId, nextState, 'Second checkpoint');

    const items = await browserStorageProjectVersionRepository.list(projectId);
    expect(items).toHaveLength(2);
    expect(items[0]?.id).toBe(second.id);
    expect(items[1]?.id).toBe(first.id);

    const restored = await browserStorageProjectVersionRepository.load(projectId, first.id);
    expect(restored?.document.name).toBe('Versioned Project');
    expect(restored?.document.version).toBe(1);
  });
});
