import type { WidgetType } from '../../domain/document/types';
import {
  WIDGET_LIBRARY_GROUP_LABELS,
  type WidgetDefinition,
  type WidgetLibraryGroup,
} from './widget-definition';

type WidgetLibraryMetadata = Pick<WidgetDefinition, 'libraryGroup' | 'libraryTags' | 'libraryRank' | 'description'>;

const WIDGET_LIBRARY_METADATA: Partial<Record<WidgetType, WidgetLibraryMetadata>> = {
  text: {
    libraryGroup: 'essentials',
    libraryRank: 1,
    libraryTags: ['copy', 'headline', 'body'],
    description: 'Headlines, body copy, disclaimers and dynamic text blocks.',
  },
  image: {
    libraryGroup: 'essentials',
    libraryRank: 2,
    libraryTags: ['hero', 'asset', 'photo'],
  },
  cta: {
    libraryGroup: 'essentials',
    libraryRank: 3,
    libraryTags: ['button', 'action', 'clickthrough'],
    description: 'Primary call-to-action button with premium styling and export parity.',
  },
  badge: {
    libraryGroup: 'essentials',
    libraryRank: 4,
    libraryTags: ['label', 'offer', 'promo'],
  },
  shape: {
    libraryGroup: 'essentials',
    libraryRank: 5,
    libraryTags: ['background', 'frame', 'divider'],
    description: 'Flexible geometric layer for panels, dividers and decorative surfaces.',
  },
  group: {
    libraryGroup: 'essentials',
    libraryRank: 6,
    libraryTags: ['container', 'stack', 'organize'],
    description: 'Group layers so they move, align and animate as one unit.',
  },
  'hero-image': {
    libraryGroup: 'essentials',
    libraryRank: 7,
    libraryTags: ['hero', 'cover', 'campaign'],
  },
  buttons: {
    libraryGroup: 'interactive',
    libraryRank: 18,
    libraryTags: ['multi-cta', 'choice', 'actions'],
    description: 'Multi-button action row for branching, offers and call-to-action sets.',
  },
  'shoppable-sidebar': {
    libraryGroup: 'commerce',
    libraryRank: 8,
    libraryTags: ['catalog', 'shop', 'products'],
  },
  'meta-carousel': {
    libraryGroup: 'commerce',
    libraryRank: 9,
    libraryTags: ['carousel', 'catalog', 'social'],
  },
  'qr-code': {
    libraryGroup: 'commerce',
    libraryRank: 10,
    libraryTags: ['scan', 'store', 'offline'],
    description: 'Generate scannable QR codes for landing pages, app installs or offers.',
  },
  'add-to-calendar': {
    libraryGroup: 'commerce',
    libraryRank: 11,
    libraryTags: ['event', 'reminder', 'conversion'],
  },
  'travel-deal': {
    libraryGroup: 'commerce',
    libraryRank: 12,
    libraryTags: ['offer', 'pricing', 'travel'],
  },
  'teads-layout1': {
    libraryGroup: 'commerce',
    libraryRank: 13,
    libraryTags: ['sponsored', 'native', 'teads'],
  },
  'teads-layout2': {
    libraryGroup: 'commerce',
    libraryRank: 14,
    libraryTags: ['sponsored', 'native', 'teads'],
  },
  'tiktok-video': {
    libraryGroup: 'video-social',
    libraryRank: 15,
    libraryTags: ['social', 'vertical', 'video'],
  },
  'instagram-story': {
    libraryGroup: 'video-social',
    libraryRank: 16,
    libraryTags: ['story', 'social', 'vertical'],
  },
  'interactive-video': {
    libraryGroup: 'video-social',
    libraryRank: 17,
    libraryTags: ['video', 'hotspots', 'storytelling'],
  },
  'video-hero': {
    libraryGroup: 'video-social',
    libraryRank: 19,
    libraryTags: ['video', 'hero', 'autoplay'],
    description: 'Hero video block for motion-first campaign openings and loops.',
  },
  'image-carousel': {
    libraryGroup: 'video-social',
    libraryRank: 20,
    libraryTags: ['swipe', 'gallery', 'slides'],
  },
  'interactive-gallery': {
    libraryGroup: 'interactive',
    libraryRank: 21,
    libraryTags: ['gallery', 'browse', 'engagement'],
  },
  'interactive-hotspot': {
    libraryGroup: 'interactive',
    libraryRank: 22,
    libraryTags: ['hotspot', 'tap', 'reveal'],
  },
  'scratch-reveal': {
    libraryGroup: 'interactive',
    libraryRank: 23,
    libraryTags: ['scratch', 'reveal', 'game'],
  },
  slider: {
    libraryGroup: 'interactive',
    libraryRank: 24,
    libraryTags: ['compare', 'drag', 'before-after'],
  },
  'range-slider': {
    libraryGroup: 'interactive',
    libraryRank: 25,
    libraryTags: ['range', 'filter', 'tuning'],
  },
  'drag-token-pool': {
    libraryGroup: 'interactive',
    libraryRank: 26,
    libraryTags: ['drag', 'game', 'classification'],
  },
  'drop-zone': {
    libraryGroup: 'interactive',
    libraryRank: 27,
    libraryTags: ['drop', 'upload', 'target'],
  },
  form: {
    libraryGroup: 'interactive',
    libraryRank: 28,
    libraryTags: ['lead', 'signup', 'inputs'],
  },
  'dynamic-map': {
    libraryGroup: 'data-utility',
    libraryRank: 29,
    libraryTags: ['map', 'locations', 'geography'],
  },
  'weather-conditions': {
    libraryGroup: 'data-utility',
    libraryRank: 30,
    libraryTags: ['weather', 'api', 'conditions'],
  },
  'speed-test': {
    libraryGroup: 'data-utility',
    libraryRank: 31,
    libraryTags: ['performance', 'meter', 'utility'],
  },
  countdown: {
    libraryGroup: 'data-utility',
    libraryRank: 32,
    libraryTags: ['timer', 'urgency', 'offer'],
  },
  'timer-bar': {
    libraryGroup: 'data-utility',
    libraryRank: 33,
    libraryTags: ['progress', 'time', 'urgency'],
  },
  'step-indicator': {
    libraryGroup: 'data-utility',
    libraryRank: 34,
    libraryTags: ['steps', 'progress', 'journey'],
  },
  'gen-ai-image': {
    libraryGroup: 'premium-fx',
    libraryRank: 35,
    libraryTags: ['ai', 'visual', 'creative'],
  },
  'particle-halo': {
    libraryGroup: 'premium-fx',
    libraryRank: 36,
    libraryTags: ['particles', 'glow', 'ambient'],
  },
  'four-faces': {
    libraryGroup: 'premium-fx',
    libraryRank: 37,
    libraryTags: ['storytelling', 'multi-panel', 'premium'],
  },
  'vertical-accordion': {
    libraryGroup: 'premium-fx',
    libraryRank: 38,
    libraryTags: ['accordion', 'stack', 'reveal'],
  },
};

function fallbackLibraryGroup(definition: WidgetDefinition): WidgetLibraryGroup {
  if (definition.category === 'media') return 'video-social';
  if (definition.category === 'interactive') return 'interactive';
  return 'essentials';
}

export function withWidgetLibraryMetadata(definition: WidgetDefinition): WidgetDefinition {
  const metadata = WIDGET_LIBRARY_METADATA[definition.type];
  const libraryGroup = definition.libraryGroup ?? metadata?.libraryGroup ?? fallbackLibraryGroup(definition);
  const libraryTags = definition.libraryTags ?? metadata?.libraryTags ?? [];
  const libraryRank = definition.libraryRank ?? metadata?.libraryRank;
  const description = definition.description ?? metadata?.description;
  return {
    ...definition,
    libraryGroup,
    libraryTags,
    libraryRank,
    description,
  };
}

export function getWidgetLibraryGroupLabel(group: WidgetLibraryGroup): string {
  return WIDGET_LIBRARY_GROUP_LABELS[group];
}
