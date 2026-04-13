import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { platformStore } from '../../../platform/store';
import { localProjectRepository } from '../../../repositories/project/local';

const STORAGE_KEY_PREFIX = 'smx-studio-v4:';

describe('local project repository', () => {
  beforeEach(() => {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(STORAGE_KEY_PREFIX));
    keys.forEach((key) => localStorage.removeItem(key));
    platformStore.login('admin@smx.studio', 'demo123');
  });

  it('saves and loads projects', async () => {
    const state = createInitialState();
    state.document.name = 'Project State';

    const project = await localProjectRepository.save(state);
    const loaded = await localProjectRepository.load(project.id);
    expect(loaded?.document.name).toBe('Project State');

    const listed = await localProjectRepository.list();
    expect(listed.some((item) => item.id === project.id)).toBe(true);
  });
});
