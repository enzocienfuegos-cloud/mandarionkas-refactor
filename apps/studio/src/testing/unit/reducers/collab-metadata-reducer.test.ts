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

  it('applies matching variant rules and records the last applied context', () => {
    const state = createInitialState();
    state.document.metadata.platform = {
      ...(state.document.metadata.platform ?? {}),
      variantRules: [
        {
          id: 'rule_es',
          name: 'Spanish CTA',
          when: [{ type: 'locale', equals: 'es-SV' }],
          set: [{ path: 'widgets.cta_1.props.label', value: 'Comprar ahora' }],
        },
      ],
    };
    const sceneId = state.document.scenes[0]?.id ?? 'scene_1';
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 240, height: 64, rotation: 0 },
      props: { label: 'Shop now' },
      style: { backgroundColor: '#222222', color: '#ffffff' },
      timeline: { startMs: 0, endMs: 1000 },
    };

    const next = collabMetadataReducer(state, {
      type: 'APPLY_DOCUMENT_VARIANT_RULES',
      context: { locale: 'es-SV', device: 'mobile' },
    });

    expect(next.document.widgets.cta_1?.props.label).toBe('Comprar ahora');
    expect(next.document.metadata.platform?.variantPreviewContext).toEqual({ locale: 'es-SV', device: 'mobile' });
    expect(next.document.metadata.platform?.variantLastAppliedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(next.document.metadata.dirty).toBe(true);
  });
});
