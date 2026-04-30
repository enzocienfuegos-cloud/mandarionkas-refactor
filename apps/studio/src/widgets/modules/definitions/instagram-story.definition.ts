import { createModuleDefinition } from '../module-definition-factory';
import { renderInstagramStoryStage, renderInstagramStoryInspector } from '../instagram-story.renderer';

export const InstagramStoryDefinition = createModuleDefinition({
  type: 'instagram-story',
  label: 'Instagram Story',
  category: 'interactive',
  frame: { x: 20, y: 20, width: 300, height: 533, rotation: 0 },
  props: {
    username: 'yourbrand',
    avatarSrc: '',
    avatarAssetId: '',
    slide1Src: '',
    slide1AssetId: '',
    slide1Kind: 'image',
    slide1DurationMs: 5000,
    slide2Src: '',
    slide2AssetId: '',
    slide2Kind: 'image',
    slide2DurationMs: 5000,
    slide3Src: '',
    slide3AssetId: '',
    slide3Kind: 'image',
    slide3DurationMs: 5000,
    muted: true,
  },
  style: { backgroundColor: '#000000' },
  renderStage: renderInstagramStoryStage,
  renderInspector: renderInstagramStoryInspector,
  exportDetail: 'Instagram Story · 3 slides',
});
