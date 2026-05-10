import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../../domain/document/factories';
import { reduceBySlices } from '../../core/store/reducers';
import { configureRepositoryServices, resetRepositoryServices } from '../../repositories/services';
import { createInMemoryRepositoryServices } from '../fakes/in-memory-repositories';
import { clearAutosaveDraft, hasAutosaveDraft, loadAutosaveDraft, saveAutosaveDraft } from '../../repositories/document';
import { getAsset, listAssets, renameAsset, saveAsset } from '../../repositories/asset';
import { deleteProject, listProjects, loadProject, saveProject } from '../../repositories/project';


describe('repository backend swap smoke path', () => {
  beforeEach(() => {
    const services = createInMemoryRepositoryServices();
    configureRepositoryServices(() => services);
  });

  afterEach(() => {
    resetRepositoryServices();
  });

  it('swaps persistence backends behind public repository APIs without changing editor flows', async () => {
    let state = createInitialState();
    state = reduceBySlices(state, { type: 'UPDATE_DOCUMENT_NAME', name: 'Memory-backed Studio' });
    state = reduceBySlices(state, {
      type: 'UPDATE_DOCUMENT_PLATFORM_METADATA',
      patch: {
        clientId: 'memory-client',
        clientName: 'Memory Workspace',
        brandName: 'SignalMix',
        campaignName: 'Sprint 77',
        accessScope: 'client',
      },
    });

    await saveAutosaveDraft(state);
    expect(await hasAutosaveDraft()).toBe(true);
    expect((await loadAutosaveDraft())?.document.name).toBe('Memory-backed Studio');

    const summary = await saveProject(state);
    expect(summary.id).toContain('memory-project-');
    expect((await loadProject(summary.id))?.document.metadata.platform?.campaignName).toBe('Sprint 77');
    expect((await listProjects())).toHaveLength(1);

    const asset = await saveAsset({
      name: 'Hero Poster',
      kind: 'image',
      src: 'https://example.com/poster.png',
      publicUrl: 'https://example.com/poster.png',
      originUrl: 'https://example.com/poster.png',
      mimeType: 'image/png',
      sourceType: 'url',
      storageMode: 'remote-url',
      sizeBytes: 1024,
      width: 1200,
      height: 628,
      accessScope: 'client',
      tags: ['hero'],
      fingerprint: 'hero-poster-remote',
    });
    expect((await listAssets())).toHaveLength(1);
    await renameAsset(asset.id, 'Hero Poster Final');
    expect((await getAsset(asset.id))?.name).toBe('Hero Poster Final');

    await deleteProject(summary.id);
    expect(await listProjects()).toHaveLength(0);
    await clearAutosaveDraft();
    expect(await hasAutosaveDraft()).toBe(false);
  });
});
