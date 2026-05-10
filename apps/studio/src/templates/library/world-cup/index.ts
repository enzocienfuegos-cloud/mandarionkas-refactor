import type { StudioTemplate } from '../types';
import { buildWorldCupTemplateDocument } from './document';
import { BocadeliWorldCupPreview } from './library-preview';

export const WORLD_CUP_TEMPLATE: StudioTemplate = {
  metadata: {
    id: 'bocadeli-worldcup',
    name: 'Bocadeli World Cup starter',
    description: 'Seeds the World Cup interactive layout with configurable game widgets on 320x480.',
    vertical: 'sports',
    canvasPresetId: 'interstitial',
    featured: true,
    featuredLabel: 'Flagship starter',
    curationRank: 100,
    sceneCount: 4,
    moduleHighlights: ['Interactive flow', 'Live score moments', 'Reward end card'],
    recommendedFor: 'Event activations, sweepstakes and branded mini-games',
    previewComponent: BocadeliWorldCupPreview,
    tags: ['Sports', 'Live data', '4 scenes', 'Reward end card'],
  },
  buildDocument: buildWorldCupTemplateDocument,
};
