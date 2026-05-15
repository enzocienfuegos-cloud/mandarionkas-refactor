import { resolveFontAssetFamily } from '../../../assets/font-family';
import type { AssetQualityPreference, AssetRecord } from '../../../assets/types';
import type { WidgetNode } from '../../../domain/document/types';
import { acceptsAssetKind, getCapability } from '../../../widgets/registry/widget-definition';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';

export type AssetSortMode = 'recent' | 'name' | 'size';

type WidgetActionsLike = {
  updateWidgetProps: (widgetId: string, props: Record<string, unknown>) => void;
  updateWidgetStyle: (widgetId: string, style: Record<string, unknown>) => void;
};

function parseLinkedCarouselSlides(raw: unknown): Array<{ src: string; caption: string; assetId?: string }> {
  const value = String(raw ?? '').trim();
  if (!value) return [];
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item): { src: string; caption: string; assetId?: string } | null => {
            if (!item || typeof item !== 'object') return null;
            const src = typeof (item as { src?: unknown }).src === 'string' ? (item as { src: string }).src.trim() : '';
            const caption = typeof (item as { caption?: unknown }).caption === 'string' ? (item as { caption: string }).caption.trim() : '';
            const assetId = typeof (item as { assetId?: unknown }).assetId === 'string' ? (item as { assetId: string }).assetId.trim() : undefined;
            return src ? { src, caption, assetId: assetId || undefined } : null;
          })
          .filter((item): item is { src: string; caption: string; assetId?: string } => Boolean(item));
      }
    } catch {
      // Fall through to legacy parser.
    }
  }
  return value.split(';').map((item) => item.trim()).filter(Boolean).map((item) => {
    const [src, caption] = item.split('|');
    return { src: (src ?? '').trim(), caption: (caption ?? '').trim() };
  }).filter((item) => item.src);
}

function parseInteractiveGalleryItems(raw: unknown): Array<{ src: string; title: string; subtitle?: string; assetId?: string }> {
  const value = String(raw ?? '').trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item): { src: string; title: string; subtitle?: string; assetId?: string } | null => {
          if (!item || typeof item !== 'object') return null;
          const src = typeof (item as { src?: unknown }).src === 'string' ? (item as { src: string }).src.trim() : '';
          const title = typeof (item as { title?: unknown }).title === 'string' ? (item as { title: string }).title.trim() : '';
          const subtitle = typeof (item as { subtitle?: unknown }).subtitle === 'string' ? (item as { subtitle: string }).subtitle.trim() : undefined;
          const assetId = typeof (item as { assetId?: unknown }).assetId === 'string' ? (item as { assetId: string }).assetId.trim() : undefined;
          return src ? { src, title, subtitle, assetId: assetId || undefined } : null;
        })
        .filter((item): item is { src: string; title: string; subtitle?: string; assetId?: string } => Boolean(item));
    }
  } catch {
    return [];
  }
  return [];
}

export function sortAssets(assets: AssetRecord[], mode: AssetSortMode): AssetRecord[] {
  const sorted = [...assets];
  if (mode === 'name') return sorted.sort((a, b) => a.name.localeCompare(b.name));
  if (mode === 'size') return sorted.sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0));
  return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function widgetAcceptsAssetSwap(primaryWidget: WidgetNode | undefined): boolean {
  return primaryWidget
    ? primaryWidget.type === 'scratch-reveal' || Boolean(getCapability(getWidgetDefinition(primaryWidget.type), 'acceptsAssetSwap'))
    : false;
}

export function assignAssetToWidget({
  asset,
  primaryWidget,
  widgetActions,
  resolveAssetPreviewUrl,
  getAssetQualityPreference,
}: {
  asset: AssetRecord;
  primaryWidget: WidgetNode | undefined;
  widgetActions: WidgetActionsLike;
  resolveAssetPreviewUrl: (asset: AssetRecord) => string;
  getAssetQualityPreference: (asset?: AssetRecord) => AssetQualityPreference;
}): void {
  if (!primaryWidget) return;
  const definition = getWidgetDefinition(primaryWidget.type);
  const supportsScratchRevealImage = primaryWidget.type === 'scratch-reveal' && asset.kind === 'image';
  if (!supportsScratchRevealImage && !acceptsAssetKind(definition, asset.kind as 'image' | 'video' | 'font')) return;

  const resolvedSrc = resolveAssetPreviewUrl(asset);
  if (primaryWidget.type === 'scratch-reveal') {
    const currentAfter = String(primaryWidget.props.afterImage ?? '').trim();
    const currentBefore = String(primaryWidget.props.beforeImage ?? '').trim();
    widgetActions.updateWidgetProps(primaryWidget.id, !currentAfter
      ? { afterAssetId: asset.id, afterImage: resolvedSrc }
      : !currentBefore
        ? { beforeAssetId: asset.id, beforeImage: resolvedSrc }
        : { afterAssetId: asset.id, afterImage: resolvedSrc });
    return;
  }

  if (primaryWidget.type === 'image' || primaryWidget.type === 'hero-image') {
    widgetActions.updateWidgetProps(primaryWidget.id, {
      src: resolvedSrc,
      assetId: asset.id,
      assetQualityPreference: getAssetQualityPreference(asset),
      alt: asset.name,
    });
    return;
  }

  if (primaryWidget.type === 'video-hero' || primaryWidget.type === 'interactive-video') {
    widgetActions.updateWidgetProps(primaryWidget.id, {
      src: resolvedSrc,
      assetId: asset.id,
      assetQualityPreference: getAssetQualityPreference(asset),
      posterSrc: asset.derivatives?.poster?.src ?? asset.posterSrc ?? primaryWidget.props.posterSrc,
    });
    return;
  }

  if (primaryWidget.type === 'image-carousel') {
    const currentSlides = parseLinkedCarouselSlides(primaryWidget.props.slides);
    widgetActions.updateWidgetProps(primaryWidget.id, {
      slides: JSON.stringify([...currentSlides, { src: asset.src, caption: asset.name, assetId: asset.id }]),
      itemCount: currentSlides.length + 1,
      activeIndex: 1,
    });
    return;
  }

  if (primaryWidget.type === 'interactive-gallery') {
    const currentItems = parseInteractiveGalleryItems(primaryWidget.props.items);
    widgetActions.updateWidgetProps(primaryWidget.id, {
      items: JSON.stringify([...currentItems, { src: asset.src, title: asset.name, subtitle: '', assetId: asset.id }]),
      itemCount: currentItems.length + 1,
      activeIndex: 1,
    });
    return;
  }

  if (primaryWidget.type === 'shoppable-sidebar') {
    const currentProducts = String(primaryWidget.props.products ?? '')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
    const nextProducts = [...currentProducts, `${asset.src}|${asset.name}||$0|4|Shop now|`].join(';');
    const currentAssetIds = String(primaryWidget.props.assetIdsCsv ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    widgetActions.updateWidgetProps(primaryWidget.id, {
      products: nextProducts,
      assetIdsCsv: [...currentAssetIds, asset.id].join(','),
      itemCount: currentProducts.length + 1,
      activeIndex: 1,
    });
    return;
  }

  if (getCapability(definition, 'acceptsFontAsset')) {
    widgetActions.updateWidgetProps(primaryWidget.id, { fontAssetId: asset.id, fontAssetSrc: asset.publicUrl ?? asset.src });
    widgetActions.updateWidgetStyle(primaryWidget.id, { fontFamily: resolveFontAssetFamily(asset) });
  }
}
