import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureRepositoryContextResolver, resetRepositoryContextResolver } from '../../../repositories/context';
import { localBrandKitRepository } from '../../../repositories/brand-kit/local';

describe('local brand-kit repository', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    configureRepositoryContextResolver(() => ({
      clientId: 'client_1',
      ownerUserId: 'user_1',
      clientName: 'Client One',
      currentUserRole: 'owner',
      can(permission) {
        return permission === 'brandkits:manage';
      },
    }));
  });

  afterEach(() => {
    resetRepositoryContextResolver();
  });

  it('saves and lists workspace-scoped brand kits', async () => {
    const saved = await localBrandKitRepository.save({
      name: 'Client One Brand Kit',
      brandName: 'Client One',
      colors: { accent: '#ff6600' },
      typography: { fontFamily: 'Avenir Next' },
    });

    const listed = await localBrandKitRepository.list();
    expect(saved.workspaceId).toBe('client_1');
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe('Client One Brand Kit');
  });

  it('deletes an existing brand kit', async () => {
    const saved = await localBrandKitRepository.save({ name: 'Delete Me' });
    await localBrandKitRepository.delete(saved.id);
    await expect(localBrandKitRepository.get(saved.id)).resolves.toBeUndefined();
  });
});
