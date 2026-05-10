import {
  isCarouselAssetWidgetType,
  isClickthroughRequiredWidgetType,
  isDirectAssetWidgetType,
  isDynamicMapWidgetType,
  isImageAssetWidgetType,
  isInteractiveGalleryAssetWidgetType,
  isPosterFallbackWidgetType,
  isSceneMediaWidgetType,
  isVideoAssetWidgetType,
  isVideoHeroWidgetType,
} from '../domain/document/widget-type-groups';
import type { WidgetType } from '../domain/document/types';
import type { PortableExportProject } from './portable';

type WidgetLike = {
  type: WidgetType;
  props?: Record<string, unknown>;
};

export function widgetRequestsUserLocation(widget: WidgetLike): boolean {
  return isDynamicMapWidgetType(widget.type) && Boolean(widget.props?.requestUserLocation ?? false);
}

export function projectRequiresMraidLocation(project: PortableExportProject): boolean {
  return project.scenes.some((scene) => scene.widgets.some(widgetRequestsUserLocation));
}

export {
  isCarouselAssetWidgetType,
  isClickthroughRequiredWidgetType,
  isDirectAssetWidgetType,
  isImageAssetWidgetType,
  isInteractiveGalleryAssetWidgetType,
  isPosterFallbackWidgetType,
  isSceneMediaWidgetType,
  isVideoAssetWidgetType,
  isVideoHeroWidgetType,
};
