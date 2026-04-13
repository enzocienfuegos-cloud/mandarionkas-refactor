import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';

describe('createInitialState', () => {
  it('starts as a blank project instead of demo content', () => {
    const state = createInitialState();
    expect(state.document.name).toBe('Untitled Project');
    expect(state.document.canvas.presetId).toBe('custom');
    expect(state.document.canvas.backgroundColor).toBe('#ffffff');
    expect(state.document.collaboration.comments).toHaveLength(0);
    expect(state.document.collaboration.approvals).toHaveLength(0);
    expect(state.document.widgets).toEqual({});
  });

  it('can seed a project from a selected preset', () => {
    const state = createInitialState({ canvasPresetId: 'story-vertical', name: 'Launch story' });
    expect(state.document.name).toBe('Launch story');
    expect(state.document.canvas.width).toBe(1080);
    expect(state.document.canvas.height).toBe(1920);
    expect(state.document.canvas.presetId).toBe('story-vertical');
  });
});
