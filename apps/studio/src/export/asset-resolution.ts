import type { StudioState, WidgetNode } from '../domain/document/types';
import { resolveAssetDeliveryUrl } from '../assets/policy';
import { getAsset } from '../repositories/asset';
import type { AssetQualityPreference, AssetRecord } from '../assets/types';
import { buildShoppableProductsValue, parseShoppableProducts } from '../widgets/modules/shoppable-sidebar.shared';
import {
  isCarouselAssetWidgetType,
  isDirectAssetWidgetType,
  isInteractiveGalleryAssetWidgetType,
  isVideoAssetWidgetType,
} from './widget-type-groups';

function readWidgetAssetId(node: WidgetNode): string | undefined {
  return typeof node.props.assetId === 'string' && node.props.assetId.trim() ? node.props.assetId : undefined;
}

function readWidgetAssetQualityPreference(node: WidgetNode): AssetQualityPreference | undefined {
  const value = node.props.assetQualityPreference;
  return value === 'auto' || value === 'low' || value === 'mid' || value === 'high' ? value : undefined;
}

function readAssetId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readAssetQualityPreference(value: unknown): AssetQualityPreference | undefined {
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

type AssetPropBinding = {
  assetIdKey: string;
  srcKey: string;
  qualityPreferenceKey?: string;
};

const ASSET_PROP_BINDINGS: AssetPropBinding[] = [
  { assetIdKey: 'assetId', srcKey: 'src', qualityPreferenceKey: 'assetQualityPreference' },
  { assetIdKey: 'posterAssetId', srcKey: 'posterSrc', qualityPreferenceKey: 'posterAssetQualityPreference' },
  { assetIdKey: 'fontAssetId', srcKey: 'fontAssetSrc' },
  { assetIdKey: 'maskAssetId', srcKey: 'maskSrc' },
  { assetIdKey: 'beforeAssetId', srcKey: 'beforeImage' },
  { assetIdKey: 'afterAssetId', srcKey: 'afterImage' },
  { assetIdKey: 'heroImageAssetId', srcKey: 'heroImage' },
  { assetIdKey: 'logoImageAssetId', srcKey: 'logoImage' },
  { assetIdKey: 'logoAssetId', srcKey: 'logoSrc' },
  { assetIdKey: 'heroAssetId', srcKey: 'heroSrc' },
  { assetIdKey: 'avatarAssetId', srcKey: 'avatarSrc' },
  { assetIdKey: 'videoAssetId', srcKey: 'videoSrc' },
  { assetIdKey: 'slide1AssetId', srcKey: 'slide1Src' },
  { assetIdKey: 'slide2AssetId', srcKey: 'slide2Src' },
  { assetIdKey: 'slide3AssetId', srcKey: 'slide3Src' },
  { assetIdKey: 'row1AssetId', srcKey: 'row1Src' },
  { assetIdKey: 'row2AssetId', srcKey: 'row2Src' },
  { assetIdKey: 'row3AssetId', srcKey: 'row3Src' },
  { assetIdKey: 'upImageAssetId', srcKey: 'upImageSrc' },
  { assetIdKey: 'downImageAssetId', srcKey: 'downImageSrc' },
  { assetIdKey: 'leftImageAssetId', srcKey: 'leftImageSrc' },
  { assetIdKey: 'rightImageAssetId', srcKey: 'rightImageSrc' },
];

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

function resolveAssetBoundProps(
  node: WidgetNode,
  assetById: Map<string, AssetRecord>,
  targetChannel: StudioState['document']['metadata']['release']['targetChannel'],
): Record<string, unknown> {
  let nextProps: Record<string, unknown> | null = null;

  ASSET_PROP_BINDINGS.forEach(({ assetIdKey, srcKey, qualityPreferenceKey }) => {
    const assetId = readAssetId(node.props[assetIdKey]);
    if (!assetId) return;
    const asset = assetById.get(assetId);
    if (!asset) return;
    const qualityPreference = qualityPreferenceKey
      ? readAssetQualityPreference(node.props[qualityPreferenceKey]) ?? asset.qualityPreference ?? 'auto'
      : asset.qualityPreference ?? 'auto';
    const resolvedSrc = resolveAssetDeliveryUrl(asset, targetChannel, qualityPreference);
    if (String(node.props[srcKey] ?? '') === resolvedSrc) return;
    nextProps ??= { ...node.props };
    nextProps[srcKey] = resolvedSrc;
  });

  return nextProps ?? node.props;
}

function resolvePreparedWidgetProps(node: WidgetNode, asset: AssetRecord, targetChannel: StudioState['document']['metadata']['release']['targetChannel']): Record<string, unknown> {
  const qualityPreference = readWidgetAssetQualityPreference(node) ?? asset.qualityPreference ?? 'auto';
  const resolvedSrc = resolveAssetDeliveryUrl(asset, targetChannel, qualityPreference);
  const boundProps = resolveAssetBoundProps(node, new Map([[asset.id, asset]]), targetChannel);
  if (isVideoAssetWidgetType(node.type)) {
    return {
      ...boundProps,
      src: resolvedSrc,
      posterSrc: asset.derivatives?.poster?.src ?? asset.posterSrc ?? boundProps.posterSrc,
    };
  }
  if (isDirectAssetWidgetType(node.type)) {
    return {
      ...boundProps,
      src: resolvedSrc,
    };
  }
  return boundProps;
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

function resolvePreparedShoppableProps(
  node: WidgetNode,
  assetById: Map<string, AssetRecord>,
  targetChannel: StudioState['document']['metadata']['release']['targetChannel'],
): Record<string, unknown> {
  const resolvedProducts = parseShoppableProducts(node.props.products)
    .map((product) => {
      if (!product.assetId) return product;
      const asset = assetById.get(product.assetId);
      if (!asset) return product;
      return {
        ...product,
        src: resolveAssetDeliveryUrl(asset, targetChannel, asset.qualityPreference ?? 'auto'),
      };
    });

  if (!resolvedProducts.length) return node.props;

  return {
    ...node.props,
    products: buildShoppableProductsValue(resolvedProducts),
  };
}

export async function prepareExportStateWithResolvedAssets(state: StudioState): Promise<StudioState> {
  const targetChannel = state.document.metadata.release.targetChannel;
  const assetIds = [...new Set(
    Object.values(state.document.widgets)
      .flatMap((widget) => {
        const directAssetId = readWidgetAssetId(widget);
        const boundAssetIds = ASSET_PROP_BINDINGS
          .map(({ assetIdKey }) => readAssetId(widget.props[assetIdKey]))
          .filter((assetId): assetId is string => Boolean(assetId));
        const slideAssetIds = isCarouselAssetWidgetType(widget.type)
          ? parseCarouselSlideSpecs(widget.props.slides).map((slide) => slide.assetId).filter((assetId): assetId is string => Boolean(assetId))
          : [];
        const galleryAssetIds = isInteractiveGalleryAssetWidgetType(widget.type)
          ? parseGalleryItemSpecs(widget.props.items).map((item) => item.assetId).filter((assetId): assetId is string => Boolean(assetId))
          : [];
        const shoppableAssetIds = typeof widget.props.products === 'string'
          ? parseShoppableProducts(widget.props.products).map((product) => product.assetId).filter((assetId): assetId is string => Boolean(assetId))
          : [];
        return [...(directAssetId ? [directAssetId] : []), ...boundAssetIds, ...slideAssetIds, ...galleryAssetIds, ...shoppableAssetIds];
      }),
  )];

  if (!assetIds.length) return state;

  const entries = await Promise.all(assetIds.map(async (assetId) => [assetId, await getAsset(assetId)] as const));
  const assetById = new Map(entries.filter((entry): entry is readonly [string, AssetRecord] => Boolean(entry[1])));

  if (!assetById.size) return state;

  const widgets = Object.fromEntries(
    Object.entries(state.document.widgets).map(([widgetId, widget]) => {
      const assetId = readWidgetAssetId(widget);
      const assetBoundWidget = {
        ...widget,
        props: resolveAssetBoundProps(widget, assetById, targetChannel),
      };
      if (isCarouselAssetWidgetType(widget.type)) {
        return [
          widgetId,
          {
            ...assetBoundWidget,
            props: resolvePreparedCarouselProps(assetBoundWidget, assetById, targetChannel),
          },
        ];
      }
      if (isInteractiveGalleryAssetWidgetType(widget.type)) {
        return [
          widgetId,
          {
            ...assetBoundWidget,
            props: resolvePreparedInteractiveGalleryProps(assetBoundWidget, assetById, targetChannel),
          },
        ];
      }
      if (typeof widget.props.products === 'string' && widget.props.products.trim()) {
        return [
          widgetId,
          {
            ...assetBoundWidget,
            props: resolvePreparedShoppableProps(assetBoundWidget, assetById, targetChannel),
          },
        ];
      }
      if (!assetId) return [widgetId, assetBoundWidget];
      const asset = assetById.get(assetId);
      if (!asset) return [widgetId, assetBoundWidget];
      return [
        widgetId,
        {
          ...assetBoundWidget,
          props: resolvePreparedWidgetProps(assetBoundWidget, asset, targetChannel),
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
