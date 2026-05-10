import { describe, expect, it } from 'vitest';
import {
  STORY_FLOW_VIEW_STORAGE_KEY,
  readStoryFlowViewPreference,
  writeStoryFlowViewPreference,
} from '../../../app/shell/left-rail/story-flow-preferences';

describe('story flow preferences', () => {
  it('reads the provided fallback when storage is empty', () => {
    expect(readStoryFlowViewPreference()).toBe('list');
    expect(readStoryFlowViewPreference('canvas')).toBe('canvas');
  });

  it('writes and reads the persisted story flow view mode', () => {
    writeStoryFlowViewPreference('canvas');

    expect(localStorage.getItem(STORY_FLOW_VIEW_STORAGE_KEY)).toBe('canvas');
    expect(readStoryFlowViewPreference()).toBe('canvas');
  });
});
