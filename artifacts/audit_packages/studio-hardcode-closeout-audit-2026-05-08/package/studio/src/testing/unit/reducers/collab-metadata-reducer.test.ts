import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { collabMetadataReducer } from '../../../core/store/reducers/collab-metadata-reducer';

describe('collabMetadataReducer', () => {
  it('adds a comment', () => {
    const state = createInitialState();
    const next = collabMetadataReducer(state, { type: 'ADD_COMMENT', anchor: { type: 'document' }, message: 'Needs review' });
    expect(next.document.collaboration.comments[0].message).toBe('Needs review');
  });

  it('updates release settings', () => {
    const state = createInitialState();
    const next = collabMetadataReducer(state, { type: 'UPDATE_RELEASE_SETTINGS', patch: { qaStatus: 'ready-for-qa' } as any });
    expect(next.document.metadata.release.qaStatus).toBe('ready-for-qa');
  });
});
