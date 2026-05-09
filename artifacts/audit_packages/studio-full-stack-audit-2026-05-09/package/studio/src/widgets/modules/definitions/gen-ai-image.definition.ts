import { createModuleDefinition } from '../module-definition-factory';
import { renderGenAiImageStage } from '../gen-ai-image.renderer';
import { GenAiImageThumb } from '../../registry/widget-thumbnails';

export const GenAiImageDefinition = createModuleDefinition({
  type: 'gen-ai-image',
  label: 'Gen AI Image',
  category: 'interactive',
  thumbnail: GenAiImageThumb,
  frame: { x: 80, y: 60, width: 240, height: 128, rotation: 0 },
  props: { title: 'Gen AI Image', prompt: 'Luxury portrait with warm light', variationCount: 4 },
  style: { backgroundColor: '#111827', accentColor: '#22d3ee', color: '#ffffff' },
  capabilities: {
    performsNetworkIo: true,
    worksOffline: false,
    hasRuntimeRandomness: true,
  },
  renderStage: renderGenAiImageStage,
});
