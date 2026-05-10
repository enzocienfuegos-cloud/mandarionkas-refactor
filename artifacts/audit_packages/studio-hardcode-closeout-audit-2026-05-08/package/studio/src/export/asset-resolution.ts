import type { StudioState, WidgetNode } from '../domain/document/types';
import { resolveAssetDeliveryUrl } from '../assets/policy';
import { getAsset } from '../repositories/asset';
import type { AssetQualityPreference, AssetRecord } from '../assets/types';

function readWidgetAssetId(node: WidgetNode): string | undefined {
  return typeof node.props.assetId === 'string' && node.props.assetId.trim() ? node.props.assetId : undefined;
}

function readWidgetAssetQualityPreference(node: WidgetNode): AssetQualityPreference | undefined {
  const value = node.props.assetQualityPreference;
  return value === 'auto' || value === 'low' || value === 'mid' || value === 'high' ? value : undefined;
}

type CarouselSlideSpec = {
  src?: string;
  caption?: string;
  assetId?: string;
  qualityPreference?: AssetQualityPreference;
};

type GalleryItemSpec = {
  src?: string;
  title?: string;
  subtitle?: string;
  assetId?: string;
  qualityPreference?: AssetQualityPreference;
};

function parseCarouselSlideSpecs(raw: unknown): CarouselSlideSpec[] {
  if (Array.isArray(raw)) return raw.filter((item): item is CarouselSlideSpec => Boolean(item && typeof item === 'object'));
  const value = String(raw ?? '').trim();
  if (!value) return [];
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((item): item is CarouselSlideSpec => Boolean(item && typeof item === 'object'));
    } catch {
      // Fall back to legacy syntax below.
    }
  }
  return value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const [src, caption] = item.split('|');
      const trimmedSrc = (src ?? '').trim();
      const assetId = trimmedSrc.startsWith('asset://') ? trimmedSrc.slice('asset://'.length).trim() : undefined;
      return {
        src: assetId ? undefined : trimmedSrc,
        assetId,
        caption: (caption ?? `Slide ${index + 1}`).trim(),
      };
    });
}

function stringifyCarouselSlides(slides: Array<{ src: string; caption: string }>): string {
  return slides.map((slide) => `${slide.src}|${slide.caption}`).join(';');
}

function parseGalleryItemSpecs(raw: unknown): GalleryItemSpec[] {
  if (Array.isArray(raw)) return raw.filter((item): item is GalleryItemSpec => Boolean(item && typeof item === 'object'));
  const value = String(raw ?? '').trim();
  if (!value) return [];
  if (!value.startsWith('[')) {
    return value
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item, index) => {
        const [src, title] = item.split('|');
        const trimmedSrc = (src ?? '').trim();
        const assetId = trimmedSrc.startsWith('asset://') ? trimmedSrc.slice('asset://'.length).trim() : undefined;
        return {
          src: assetId ? undefined : trimmedSrc,
          assetId,
          title: (title ?? `Item ${index + 1}`).trim(),
        };
      });
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is GalleryItemSpec => Boolean(item && typeof item === 'object')) : [];
  } catch {
    return [];
  }
}

function stringifyGalleryItems(items: Array<{ src: string; title: string; subtitle?: string }>): string {
  return JSON.stringify(items);
}

function resolvePreparedWidgetProps(node: WidgetNode, asset: AssetRecord, targetChannel: StudioState['document']['metadata']['release']['targetChannel']): Record<string, unknown> {
  const qualityPreference = readWidgetAssetQualityPreference(node) ?? asset.qualityPreference ?? 'auto';
  const resolvedSrc = resolveAssetDeliveryUrl(asset, targetChannel, qualityPreference);
  if (node.type === 'video-hero' || node.type === 'interactive-video') {
    return {
      ...node.props,
      src: resolvedSrc,
      posterSrc: asset.derivatives?.poster?.src ?? asset.posterSrc ?? node.props.posterSrc,
    };
  }
  if (node.type === 'image' || node.type === 'hero-image') {
    return {
      ...node.props,
      src: resolvedSrc,
    };
  }
  return node.props;
}

function resolvePreparedCarouselProps(
  node: WidgetNode,
  assetById: Map<string, AssetRecord>,
  targetChannel: StudioState['document']['metadata']['release']['targetChannel'],
): Record<string, unknown> {
  const resolvedSlides = parseCarouselSlideSpecs(node.props.slides)
    .map((slide, index) => {
      if (!slide.assetId) {
        const src = String(slide.src ?? '').trim();
        return src ? { src, caption: (slide.caption ?? `Slide ${index + 1}`).trim() } : null;
      }
      const asset = assetById.get(slide.assetId);
      if (!asset) return null;
      return {
        src: resolveAssetDeliveryUrl(asset, targetChannel, slide.qualityPreference ?? asset.qualityPreference ?? 'auto'),
        caption: (slide.caption ?? asset.name ?? `Slide ${index + 1}`).trim(),
      };
    })
    .filter((slide): slide is { src: string; caption: string } => Boolean(slide));

  if (!resolvedSlides.length) return node.props;

  return {
    ...node.props,
    slides: stringifyCarouselSlides(resolvedSlides),
  };
}

function resolvePreparedInteractiveGalleryProps(
  node: WidgetNode,
  assetById: Map<string, AssetRecord>,
  targetChannel: StudioState['document']['metadata']['release']['targetChannel'],
): Record<string, unknown> {
  const resolvedItems = parseGalleryItemSpecs(node.props.items)
    .map((item, index): { src: string; title: string; subtitle?: string } | null => {
      if (!item.assetId) {
        const src = String(item.src ?? '').trim();
        return src ? { src, title: String(item.title ?? `Item ${index + 1}`).trim(), subtitle: item.subtitle?.trim() } : null;
      }
      const asset = assetById.get(item.assetId);
      if (!asset) return null;
      return {
        src: resolveAssetDeliveryUrl(asset, targetChannel, item.qualityPreference ?? asset.qualityPreference ?? 'auto'),
        title: String(item.title ?? asset.name ?? `Item ${index + 1}`).trim(),
        subtitle: item.subtitle?.trim(),
      };
    })
    .filter((item): item is { src: string; title: string; subtitle?: string } => Boolean(item));

  if (!resolvedItems.length) return node.props;

  return {
    ...node.props,
    items: stringifyGalleryItems(resolvedItems),
    itemCount: resolvedItems.length,
  };
}

export async function prepareExportStateWithResolvedAssets(state: StudioState): Promise<StudioState> {
  const targetChannel = state.document.metadata.release.targetChannel;
  const assetIds = [...new Set(
    Object.values(state.document.widgets)
      .flatMap((widget) => {
        const directAssetId = readWidgetAssetId(widget);
        const slideAssetIds = widget.type === 'image-carousel'
          ? parseCarouselSlideSpecs(widget.props.slides).map((slide) => slide.assetId).filter((assetId): assetId is string => Boolean(assetId))
          : [];
        const galleryAssetIds = widget.type === 'interactive-gallery'
          ? parseGalleryItemSpecs(widget.props.items).map((item) => item.assetId).filter((assetId): assetId is string => Boolean(assetId))
          : [];
        return [...(directAssetId ? [directAssetId] : []), ...slideAssetIds, ...galleryAssetIds];
      }),
  )];

  if (!assetIds.length) return state;

  const entries = await Promise.all(assetIds.map(async (assetId) => [assetId, await getAsset(assetId)] as const));
  const assetById = new Map(entries.filter((entry): entry is readonly [string, AssetRecord] => Boolean(entry[1])));

  if (!assetById.size) return state;

  const widgets = Object.fromEntries(
    Object.entries(state.document.widgets).map(([widgetId, widget]) => {
      const assetId = readWidgetAssetId(widget);
      if (widget.type === 'image-carousel') {
        return [
          widgetId,
          {
            ...widget,
            props: resolvePreparedCarouselProps(widget, assetById, targetChannel),
          },
        ];
      }
      if (widget.type === 'interactive-gallery') {
        return [
          widgetId,
          {
            ...widget,
            props: resolvePreparedInteractiveGalleryProps(widget, assetById, targetChannel),
          },
        ];
      }
      if (!assetId) return [widgetId, widget];
      const asset = assetById.get(assetId);
      if (!asset) return [widgetId, widget];
      return [
        widgetId,
        {
          ...widget,
          props: resolvePreparedWidgetProps(widget, asset, targetChannel),
        },
      ];
    }),
  );

  return {
    ...state,
    document: {
      ...state.document,
      widgets,
    },
  };
}
