import { createSimpleTemplate } from '../helpers/simple-template-builder';

export const CPG_FLAVOR_SPOTLIGHT_TEMPLATE = createSimpleTemplate({
  metadata: {
    id: 'cpg-flavor-spotlight',
    name: 'Flavor Spotlight',
    description: 'CPG launch template for flavor pushes, packaging reveals and rotation campaigns.',
    vertical: 'cpg',
    canvasPresetId: 'leaderboard',
    featuredLabel: 'Launch favorite',
    curationRank: 74,
    sceneCount: 1,
    moduleHighlights: ['Pack-led visual system', 'Retail-ready CTA'],
    recommendedFor: 'Flavor launches, seasonal rotations and pack reveals',
  },
  palette: {
    background: '#fff9e8',
    surface: '#fffdf7',
    accent: '#ff9f1c',
    text: '#271803',
    muted: '#7a5b2d',
  },
  badge: 'NEW FLAVOR',
  eyebrow: 'CPG hero moment',
  headline: 'Turn the pack into the campaign centerpiece.',
  subhead: 'A bold, bright system for flavor stories, taste claims and nationwide availability pushes.',
  supporting: 'Ideal for launch phases, retail support and omnichannel creative refreshes.',
  cta: 'Taste it now',
  imageLabel: 'Flavor Drop',
});

export const CPG_RETAIL_WIN_TEMPLATE = createSimpleTemplate({
  metadata: {
    id: 'cpg-retail-win',
    name: 'Retail Win Banner',
    description: 'Retail-ready banner system for promo weeks, shelf callouts and local store campaigns.',
    vertical: 'cpg',
    canvasPresetId: 'leaderboard',
    curationRank: 64,
    sceneCount: 1,
    moduleHighlights: ['Retail callouts', 'Promo framing'],
    recommendedFor: 'Retail media, shelf support and promo weeks',
  },
  palette: {
    background: '#f0fff7',
    surface: '#ffffff',
    accent: '#16a34a',
    text: '#11261b',
    muted: '#4e6b5b',
  },
  badge: 'IN STORES',
  eyebrow: 'Retail support',
  headline: 'Own the aisle with clearer promo storytelling.',
  subhead: 'Balanced template for pack image, retailer callouts and discount framing.',
  supporting: 'Strong fit for chain-specific messaging and short seasonal bursts.',
  cta: 'Find a store',
  imageLabel: 'Retail Win',
});
