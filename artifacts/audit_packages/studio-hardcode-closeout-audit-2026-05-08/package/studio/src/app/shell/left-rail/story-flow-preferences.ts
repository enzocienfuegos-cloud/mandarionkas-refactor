import { readScopedStorageItem, writeScopedStorageItem } from '../../../shared/browser/storage';

export const STORY_FLOW_VIEW_STORAGE_KEY = 'smx.studio.storyFlow.view.v1';

export type StoryFlowViewMode = 'list' | 'canvas';

export function readStoryFlowViewPreference(fallback: StoryFlowViewMode = 'list'): StoryFlowViewMode {
  const raw = readScopedStorageItem(STORY_FLOW_VIEW_STORAGE_KEY, fallback, 'persistent');
  return raw === 'canvas' ? 'canvas' : 'list';
}

export function writeStoryFlowViewPreference(view: StoryFlowViewMode): void {
  writeScopedStorageItem(STORY_FLOW_VIEW_STORAGE_KEY, view, 'persistent');
}
