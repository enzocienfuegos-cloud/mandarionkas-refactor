import type { WidgetType } from './types';

const IMAGE_ASSET_WIDGET_TYPES = new Set<WidgetType>(['image', 'hero-image']);
const VIDEO_ASSET_WIDGET_TYPES = new Set<WidgetType>(['video-hero', 'interactive-video']);
const POSTER_FALLBACK_WIDGET_TYPES = new Set<WidgetType>(['image', 'hero-image']);
const SCENE_MEDIA_WIDGET_TYPES = new Set<WidgetType>(['image', 'hero-image', 'video-hero']);
const CLICKTHROUGH_REQUIRED_WIDGET_TYPES = new Set<WidgetType>(['cta', 'buttons']);
const CTA_WIDGET_TYPES = new Set<WidgetType>(['cta']);
const VIDEO_HERO_WIDGET_TYPES = new Set<WidgetType>(['video-hero']);
const CAROUSEL_ASSET_WIDGET_TYPES = new Set<WidgetType>(['image-carousel']);
const INTERACTIVE_GALLERY_WIDGET_TYPES = new Set<WidgetType>(['interactive-gallery']);
const DROP_ZONE_WIDGET_TYPES = new Set<WidgetType>(['drop-zone']);
const DYNAMIC_MAP_WIDGET_TYPES = new Set<WidgetType>(['dynamic-map']);
const NATIVE_STAGE_DRAG_WIDGET_TYPES = new Set<WidgetType>(['drag-token-pool', 'drop-zone']);

export function isImageAssetWidgetType(type: WidgetType): boolean {
  return IMAGE_ASSET_WIDGET_TYPES.has(type);
}

export function isVideoAssetWidgetType(type: WidgetType): boolean {
  return VIDEO_ASSET_WIDGET_TYPES.has(type);
}

export function isDirectAssetWidgetType(type: WidgetType): boolean {
  return isImageAssetWidgetType(type) || isVideoAssetWidgetType(type);
}

export function isCarouselAssetWidgetType(type: WidgetType): boolean {
  return CAROUSEL_ASSET_WIDGET_TYPES.has(type);
}

export function isInteractiveGalleryAssetWidgetType(type: WidgetType): boolean {
  return INTERACTIVE_GALLERY_WIDGET_TYPES.has(type);
}

export function isPosterFallbackWidgetType(type: WidgetType): boolean {
  return POSTER_FALLBACK_WIDGET_TYPES.has(type);
}

export function isSceneMediaWidgetType(type: WidgetType): boolean {
  return SCENE_MEDIA_WIDGET_TYPES.has(type);
}

export function isClickthroughRequiredWidgetType(type: WidgetType): boolean {
  return CLICKTHROUGH_REQUIRED_WIDGET_TYPES.has(type);
}

export function isCtaWidgetType(type: WidgetType): boolean {
  return CTA_WIDGET_TYPES.has(type);
}

export function isVideoHeroWidgetType(type: WidgetType): boolean {
  return VIDEO_HERO_WIDGET_TYPES.has(type);
}

export function isDropZoneWidgetType(type: WidgetType): boolean {
  return DROP_ZONE_WIDGET_TYPES.has(type);
}

export function isDynamicMapWidgetType(type: WidgetType): boolean {
  return DYNAMIC_MAP_WIDGET_TYPES.has(type);
}

export function isNativeStageDragWidgetType(type: WidgetType): boolean {
  return NATIVE_STAGE_DRAG_WIDGET_TYPES.has(type);
}
