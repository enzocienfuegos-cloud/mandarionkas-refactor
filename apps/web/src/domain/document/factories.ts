import type {
  KeyframeProperty,
  SceneNode,
  StudioDocument,
  StudioState,
  WidgetNode,
  WidgetType,
  FeedCatalog,
} from './types';
import { getCanvasPresetById } from './canvas-presets';

export const createId = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;


export function createDefaultFeedCatalog(): FeedCatalog {
  return {
    product: [
      { id: 'product_summer', label: 'Summer Drop', values: { title: 'Summer Drop 2026', subtitle: 'Limited release for early access', price: '$49', cta: 'Shop now', image: 'hero-product.jpg', url: 'https://example.com/shop', badge: 'Summer', availability: 'In stock' } },
      { id: 'product_clearance', label: 'Clearance Push', values: { title: 'Clearance Sale', subtitle: 'Last units available', price: '$29', cta: 'Buy today', image: 'clearance.jpg', url: 'https://example.com/clearance', badge: 'Sale', availability: 'Low stock' } },
      { id: 'product_premium', label: 'Premium Tier', values: { title: 'Premium Edition', subtitle: 'Members get early shipping', price: '$99', cta: 'Reserve now', image: 'premium.jpg', url: 'https://example.com/premium', badge: 'Premium', availability: 'Preorder' } },
    ],
    weather: [
      { id: 'weather_sunny', label: 'Sunny Day', values: { condition: 'Sunny', temperature: '29', location: 'San Salvador', icon: 'sunny', recommendation: 'Perfect for outdoor deals' } },
      { id: 'weather_rain', label: 'Rainy Day', values: { condition: 'Rain', temperature: '22', location: 'San Salvador', icon: 'rain', recommendation: 'Push delivery offer' } },
      { id: 'weather_windy', label: 'Windy Day', values: { condition: 'Windy', temperature: '25', location: 'Santa Ana', icon: 'wind', recommendation: 'Use shelter creative' } },
    ],
    location: [
      { id: 'location_wtc', label: 'WTC', values: { city: 'San Salvador', venue: 'WTC', address: '89 Av Norte', district: 'Escalón' } },
      { id: 'location_multiplaza', label: 'Multiplaza', values: { city: 'Antiguo Cuscatlán', venue: 'Multiplaza', address: 'Carretera Panamericana', district: 'La Libertad' } },
      { id: 'location_sanmiguel', label: 'San Miguel', values: { city: 'San Miguel', venue: 'Metrocentro', address: 'Av Roosevelt', district: 'Oriente' } },
    ],
    custom: [
      { id: 'custom_campaign_a', label: 'Campaign A', values: { headline: 'Custom headline', body: 'Custom mapped body copy', segment: 'A', promoCode: 'SMX10' } },
      { id: 'custom_campaign_b', label: 'Campaign B', values: { headline: 'Alternate headline', body: 'Secondary custom copy', segment: 'B', promoCode: 'VIP20' } },
    ],
  };
}

export function createScene(order = 0, name?: string): SceneNode {
  return {
    id: createId('scene'),
    name: name ?? `Scene ${order + 1}`,
    order,
    widgetIds: [],
    durationMs: 15000,
    conditions: {},
    flow: {},
    transition: { type: 'fade', durationMs: 450 },
  };
}

export type InitialDocumentOptions = {
  name?: string;
  canvasPresetId?: string;
  backgroundColor?: string;
};

function createCanvasSeed(options: InitialDocumentOptions = {}) {
  const preset = getCanvasPresetById(options.canvasPresetId ?? 'custom') ?? getCanvasPresetById('custom');
  return {
    width: preset?.width ?? 970,
    height: preset?.height ?? 250,
    backgroundColor: options.backgroundColor ?? preset?.backgroundColor ?? '#ffffff',
    presetId: preset?.id ?? 'custom',
  };
}

export function createEmptyDocument(options: InitialDocumentOptions = {}): StudioDocument {
  const scene = createScene();
  return {
    id: createId('doc'),
    name: options.name?.trim() || 'Untitled Project',
    version: 1,
    canvas: createCanvasSeed(options),
    scenes: [scene],
    widgets: {},
    actions: {},
    feeds: createDefaultFeedCatalog(),
    collaboration: {
      comments: [],
      approvals: [],
    },
    selection: {
      widgetIds: [],
      primaryWidgetId: undefined,
      activeSceneId: scene.id,
    },
    metadata: {
      dirty: false,
      release: {
        targetChannel: 'generic-html5',
        qaStatus: 'draft',
        notes: '',
      },
      platform: {
        clientId: undefined,
        clientName: '',
        brandId: undefined,
        brandName: '',
        campaignName: '',
        accessScope: 'client',
      },
    },
  };
}

export function createInitialState(options: InitialDocumentOptions = {}): StudioState {
  return {
    document: createEmptyDocument(options),
    ui: {
      zoom: 1,
      playheadMs: 0,
      isPlaying: false,
      previewMode: false,
      hoveredWidgetId: undefined,
      activeWidgetId: undefined,
      lastTriggeredActionLabel: undefined,
      activeVariant: 'default',
      activeFeedSource: 'product',
      activeFeedRecordId: 'product_summer',
      activeProjectId: undefined,
      activeLeftTab: 'widgets',
      stageBackdrop: 'dark',
      showStageRulers: true,
      showWidgetBadges: true,
    },
  };
}

export function cloneWidget(node: WidgetNode, name?: string, options?: { preserveFrame?: boolean; offset?: { x: number; y: number } }): WidgetNode {
  const preserveFrame = Boolean(options?.preserveFrame);
  const offsetX = preserveFrame ? 0 : (options?.offset?.x ?? 20);
  const offsetY = preserveFrame ? 0 : (options?.offset?.y ?? 20);
  return {
    ...node,
    id: createId(node.type),
    name: name ?? `${node.name} Copy`,
    frame: {
      ...node.frame,
      x: node.frame.x + offsetX,
      y: node.frame.y + offsetY,
    },
    timeline: {
      ...node.timeline,
      keyframes: node.timeline.keyframes?.map((keyframe) => ({ ...keyframe, id: createId('kf') })) ?? [],
    },
  };
}

export function isWidgetType(value: string): value is WidgetType {
  return ['text', 'image', 'hero-image', 'video-hero', 'cta', 'shape', 'group', 'countdown', 'add-to-calendar', 'shoppable-sidebar', 'speed-test', 'scratch-reveal', 'form', 'dynamic-map', 'weather-conditions', 'range-slider', 'interactive-hotspot', 'slider', 'qr-code', 'travel-deal', 'interactive-gallery', 'gen-ai-image', 'buttons'].includes(value);
}

export function defaultKeyframeValue(widget: WidgetNode, property: KeyframeProperty): number {
  if (property === 'opacity') {
    return Number(widget.style.opacity ?? 1);
  }
  return Number(widget.frame[property]);
}
