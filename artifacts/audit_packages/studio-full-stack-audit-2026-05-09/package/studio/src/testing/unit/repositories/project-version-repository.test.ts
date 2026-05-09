import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { localProjectVersionRepository } from '../../../repositories/project-versions/local';
import { localProjectRepository } from '../../../repositories/project/local';
import { configureRepositoryContextResolver, resetRepositoryContextResolver } from '../../../repositories/context';

const projectId = 'proj_test_versions';

describe('localProjectVersionRepository', () => {
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
    await localProjectRepository.save(state, projectId);
    const first = await localProjectVersionRepository.save(projectId, state, 'Initial checkpoint');

    const nextState = createInitialState({ name: 'Versioned Project v2' });
    const second = await localProjectVersionRepository.save(projectId, nextState, 'Second checkpoint');

    const items = await localProjectVersionRepository.list(projectId);
    expect(items).toHaveLength(2);
    expect(items[0]?.id).toBe(second.id);
    expect(items[1]?.id).toBe(first.id);

    const restored = await localProjectVersionRepository.load(projectId, first.id);
    expect(restored?.document.name).toBe('Versioned Project');
    expect(restored?.document.version).toBe(1);
  });
});
