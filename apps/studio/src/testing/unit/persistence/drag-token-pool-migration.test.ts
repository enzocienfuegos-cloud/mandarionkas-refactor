import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { normalizeStudioState } from '../../../domain/document/normalize-state';

describe('drag-token-pool legacy migration', () => {
  it('migrates legacy JSON string tokens and CSV disabled ids', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0]?.id ?? 'scene_1';
    state.document.widgets.pool = {
      id: 'pool',
      type: 'drag-token-pool',
      name: 'Pool',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 280, height: 96, rotation: 0 },
      props: {
        tokens: '[{"id":"a","label":"X"}]',
        disabledIds: 'a,b',
      },
      style: {},
      timeline: { startMs: 0, endMs: 15000 },
    };

    const normalized = normalizeStudioState(state);
    const widget = normalized.document.widgets.pool;

    expect(widget.props.tokens).toEqual([{ id: 'a', label: 'X' }]);
    expect(widget.props.disabledIds).toEqual(['a', 'b']);
  });
});
