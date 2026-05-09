import { createSimpleTemplate } from '../helpers/simple-template-builder';

export const CUSTOM_EDITORIAL_STORY_TEMPLATE = createSimpleTemplate({
  metadata: {
    id: 'custom-editorial-story',
    name: 'Editorial Storyframe',
    description: 'Flexible custom template for premium story-led campaigns across multiple sectors.',
    vertical: 'custom',
    canvasPresetId: 'leaderboard',
  },
  palette: {
    background: '#faf7f2',
    surface: '#fffdfa',
    accent: '#7c3aed',
    text: '#18181b',
    muted: '#6d6674',
  },
  badge: 'EDITORIAL',
  eyebrow: 'Flexible system',
  headline: 'Start with a story-led composition instead of a blank banner.',
  subhead: 'Useful as a neutral premium base for concepting before the vertical-specific pass.',
  supporting: 'Best for early pitching, internal review and premium content modules.',
  cta: 'Open concept',
  imageLabel: 'Storyframe',
});
