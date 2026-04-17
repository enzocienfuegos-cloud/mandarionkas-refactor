import type { StudioState, WidgetNode, WidgetType } from '../domain/document/types';
import type { ExportCapability, ExportCapabilitySummary, InteractionTier, ResolvedWidgetCapability } from './types';
import { getInteractionPolicy } from './interaction-policy';

const TIER_RANK: Record<InteractionTier, number> = {
  'banner-runtime': 1,
  'advanced-interactive': 2,
  'playable-runtime': 3,
};

const BASE_CAPABILITIES: Record<WidgetType, ExportCapability> = {
  text: { widgetType: 'text', status: 'supported', exportKind: 'dom', minimumTier: 'banner-runtime', supportsMultipleExits: false },
  shape: { widgetType: 'shape', status: 'supported', exportKind: 'dom', minimumTier: 'banner-runtime', supportsMultipleExits: false },
  cta: { widgetType: 'cta', status: 'supported', exportKind: 'dom', minimumTier: 'banner-runtime', supportsMultipleExits: true, notes: ['CTA widgets should resolve to one or more neutral exits.'] },
  buttons: { widgetType: 'buttons', status: 'supported', exportKind: 'dom', minimumTier: 'banner-runtime', supportsMultipleExits: true, notes: ['Each button may generate a distinct exit.'] },
  image: { widgetType: 'image', status: 'supported', exportKind: 'media', minimumTier: 'banner-runtime', supportsMultipleExits: true, notes: ['Image widgets should export actual media assets.'] },
  'hero-image': { widgetType: 'hero-image', status: 'supported', exportKind: 'media', minimumTier: 'banner-runtime', supportsMultipleExits: true, notes: ['Hero images should preserve focal-point-aware export.'] },
  badge: { widgetType: 'badge', status: 'supported', exportKind: 'dom', minimumTier: 'banner-runtime', supportsMultipleExits: true, degradationStrategy: 'static-dom' },
  'qr-code': { widgetType: 'qr-code', status: 'supported', exportKind: 'media', minimumTier: 'banner-runtime', supportsMultipleExits: true, degradationStrategy: 'flatten-to-image' },
  group: { widgetType: 'group', status: 'supported', exportKind: 'composition', minimumTier: 'banner-runtime', supportsMultipleExits: true, notes: ['Groups inherit behavior from child widgets.'] },
  'interactive-hotspot': { widgetType: 'interactive-hotspot', status: 'supported', exportKind: 'hotspot', minimumTier: 'banner-runtime', supportsMultipleExits: true },
  'video-hero': { widgetType: 'video-hero', status: 'degraded', exportKind: 'media', minimumTier: 'advanced-interactive', supportsMultipleExits: true, degradationStrategy: 'poster-fallback', notes: ['Video should fall back to poster or snapshot when policy disallows full playback.'] },
  countdown: { widgetType: 'countdown', status: 'degraded', exportKind: 'dom', minimumTier: 'advanced-interactive', supportsMultipleExits: true, degradationStrategy: 'static-dom' },
  slider: { widgetType: 'slider', status: 'degraded', exportKind: 'dom', minimumTier: 'advanced-interactive', supportsMultipleExits: true, degradationStrategy: 'first-state' },
  'range-slider': { widgetType: 'range-slider', status: 'degraded', exportKind: 'dom', minimumTier: 'advanced-interactive', supportsMultipleExits: true, degradationStrategy: 'static-dom' },
  'image-carousel': { widgetType: 'image-carousel', status: 'degraded', exportKind: 'media', minimumTier: 'advanced-interactive', supportsMultipleExits: true, degradationStrategy: 'first-state' },
  'scratch-reveal': { widgetType: 'scratch-reveal', status: 'degraded', exportKind: 'snapshot', minimumTier: 'advanced-interactive', supportsMultipleExits: true, degradationStrategy: 'flatten-to-image' },
  'interactive-gallery': { widgetType: 'interactive-gallery', status: 'degraded', exportKind: 'snapshot', minimumTier: 'advanced-interactive', supportsMultipleExits: true, degradationStrategy: 'first-state' },
  'dynamic-map': { widgetType: 'dynamic-map', status: 'unsupported', exportKind: 'omit', minimumTier: 'advanced-interactive', supportsMultipleExits: true, degradationStrategy: 'flatten-to-image', notes: ['Dynamic map requires explicit snapshot or alternate creative strategy.'] },
  'weather-conditions': { widgetType: 'weather-conditions', status: 'degraded', exportKind: 'dom', minimumTier: 'advanced-interactive', supportsMultipleExits: true, degradationStrategy: 'static-dom' },
  'travel-deal': { widgetType: 'travel-deal', status: 'degraded', exportKind: 'dom', minimumTier: 'advanced-interactive', supportsMultipleExits: true, degradationStrategy: 'static-dom' },
  'shoppable-sidebar': { widgetType: 'shoppable-sidebar', status: 'degraded', exportKind: 'dom', minimumTier: 'advanced-interactive', supportsMultipleExits: true, degradationStrategy: 'static-dom' },
  form: { widgetType: 'form', status: 'unsupported', exportKind: 'omit', minimumTier: 'playable-runtime', supportsMultipleExits: true, degradationStrategy: 'omit', notes: ['Forms need a dedicated submission/export policy.'] },
  'speed-test': { widgetType: 'speed-test', status: 'unsupported', exportKind: 'omit', minimumTier: 'playable-runtime', supportsMultipleExits: true, degradationStrategy: 'omit', notes: ['Speed test logic is beyond baseline banner export runtime.'] },
  'add-to-calendar': { widgetType: 'add-to-calendar', status: 'degraded', exportKind: 'dom', minimumTier: 'advanced-interactive', supportsMultipleExits: true, degradationStrategy: 'static-dom' },
  'gen-ai-image': { widgetType: 'gen-ai-image', status: 'degraded', exportKind: 'media', minimumTier: 'advanced-interactive', supportsMultipleExits: true, degradationStrategy: 'flatten-to-image' },
};

function resolveCapabilityForWidget(widget: WidgetNode): ResolvedWidgetCapability {
  const capability = BASE_CAPABILITIES[widget.type];
  return {
    ...capability,
    widgetId: widget.id,
    widgetName: widget.name,
  };
}

function getHigherTier(a: InteractionTier, b: InteractionTier): InteractionTier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

function exceedsTier(required: InteractionTier, selected: InteractionTier): boolean {
  return TIER_RANK[required] > TIER_RANK[selected];
}

export function resolveExportCapabilities(state: StudioState): ExportCapabilitySummary {
  const policy = getInteractionPolicy(state.document.metadata.release.targetChannel);
  const selectedTier = policy.tier;
  let highestRequiredTier: InteractionTier = selectedTier;
  const blockers: ResolvedWidgetCapability[] = [];
  const degraded: ResolvedWidgetCapability[] = [];
  const supported: ResolvedWidgetCapability[] = [];

  Object.values(state.document.widgets).forEach((widget) => {
    const capability = resolveCapabilityForWidget(widget);
    highestRequiredTier = getHigherTier(highestRequiredTier, capability.minimumTier);

    if (capability.status === 'unsupported') {
      blockers.push(capability);
      return;
    }

    if (capability.status === 'degraded' || exceedsTier(capability.minimumTier, selectedTier)) {
      degraded.push(capability);
      return;
    }

    supported.push(capability);
  });

  return {
    selectedTier,
    highestRequiredTier,
    blockers,
    degraded,
    supported,
  };
}
