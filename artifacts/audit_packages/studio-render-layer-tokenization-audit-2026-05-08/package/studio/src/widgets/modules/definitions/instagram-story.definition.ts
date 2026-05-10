import { createModuleDefinition } from '../module-definition-factory';
import { INSTAGRAM_STORY_DEFAULT_PROPS } from '../instagram-story.shared';
import { renderInstagramStoryStage, renderInstagramStoryInspector } from '../instagram-story.renderer';
import { StoryThumb } from '../../registry/widget-thumbnails';

export const InstagramStoryDefinition = createModuleDefinition({
  type: 'instagram-story',
  label: 'Instagram Story',
  category: 'interactive',
  thumbnail: StoryThumb,
  frame: { x: 20, y: 20, width: 300, height: 533, rotation: 0 },
  props: INSTAGRAM_STORY_DEFAULT_PROPS,
  style: { backgroundColor: '#000000' },
  renderStage: renderInstagramStoryStage,
  renderInspector: renderInstagramStoryInspector,
  exportDetail: 'Instagram Story · 3 slides',
});
