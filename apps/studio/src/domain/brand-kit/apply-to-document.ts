import { syncDocumentCanvasToVariant } from '../document/canvas-variants';
import type { StudioDocument, WidgetNode } from '../document/types';
import { resolveBrandKitTokens } from './resolve-tokens';
import type { BrandKit, BrandKitTargetSlot, ResolvedBrandKitTokens } from './types';

export type ApplyBrandKitMode = 'replace' | 'merge';

export type ApplyBrandKitOptions = {
  mode?: ApplyBrandKitMode;
  applyCanvasBackground?: boolean;
  targetSlots?: BrandKitTargetSlot[];
};

const DEFAULT_TARGET_SLOTS: BrandKitTargetSlot[] = [
  'backgroundColor',
  'surfaceColor',
  'textColor',
  'accentColor',
  'borderColor',
  'fontFamily',
  'headingFontFamily',
  'bodyFontFamily',
  'borderRadius',
  'animationDurationMs',
  'animationEasing',
];

const WIDGET_STYLE_SLOT_MAP: Partial<Record<BrandKitTargetSlot, keyof WidgetNode['style']>> = {
  backgroundColor: 'backgroundColor',
  surfaceColor: 'backgroundColor',
  textColor: 'color',
  accentColor: 'accentColor',
  borderColor: 'borderColor',
  fontFamily: 'fontFamily',
  borderRadius: 'borderRadius',
  animationDurationMs: 'animationDurationMs',
  animationEasing: 'animationEasing',
};

function shouldWriteValue(currentValue: unknown, mode: ApplyBrandKitMode): boolean {
  if (mode === 'replace') return true;
  if (currentValue == null) return true;
  return typeof currentValue === 'string' ? currentValue.trim().length === 0 : false;
}

function setStyleValue(
  style: Record<string, unknown>,
  key: string,
  value: string | number | undefined,
  mode: ApplyBrandKitMode,
): Record<string, unknown> {
  if (value == null) return style;
  if (!shouldWriteValue(style[key], mode)) return style;
  return {
    ...style,
    [key]: value,
  };
}

function resolveTokenValue(tokens: ResolvedBrandKitTokens, slot: BrandKitTargetSlot): string | number | undefined {
  switch (slot) {
    case 'backgroundColor':
      return tokens.backgroundColor;
    case 'surfaceColor':
      return tokens.surfaceColor;
    case 'textColor':
      return tokens.textColor;
    case 'accentColor':
      return tokens.accentColor;
    case 'borderColor':
      return tokens.borderColor;
    case 'fontFamily':
      return tokens.fontFamily;
    case 'headingFontFamily':
      return tokens.headingFontFamily;
    case 'bodyFontFamily':
      return tokens.bodyFontFamily;
    case 'borderRadius':
      return tokens.borderRadius;
    case 'animationDurationMs':
      return tokens.animationDurationMs;
    case 'animationEasing':
      return tokens.animationEasing;
    default:
      return undefined;
  }
}

function applyTokensToWidget(
  widget: WidgetNode,
  tokens: ResolvedBrandKitTokens,
  targetSlots: BrandKitTargetSlot[],
  mode: ApplyBrandKitMode,
): WidgetNode {
  let nextStyle = widget.style;

  for (const slot of targetSlots) {
    if (slot === 'headingFontFamily' || slot === 'bodyFontFamily') continue;
    const styleKey = WIDGET_STYLE_SLOT_MAP[slot];
    if (!styleKey) continue;
    nextStyle = setStyleValue(nextStyle, styleKey, resolveTokenValue(tokens, slot), mode);
  }

  return nextStyle === widget.style ? widget : { ...widget, style: nextStyle };
}

function applyCanvasBackground(document: StudioDocument, backgroundColor: string | undefined, mode: ApplyBrandKitMode): StudioDocument {
  if (!backgroundColor) return document;
  if (!shouldWriteValue(document.canvas.backgroundColor, mode)) return document;

  return syncDocumentCanvasToVariant({
    ...document,
    canvas: {
      ...document.canvas,
      backgroundColor,
    },
    canvasVariants: document.canvasVariants.map((variant) => ({
      ...variant,
      backgroundColor: shouldWriteValue(variant.backgroundColor, mode) ? backgroundColor : variant.backgroundColor,
    })),
  });
}

export function applyBrandKitToDocument(
  document: StudioDocument,
  brandKit: BrandKit,
  options: ApplyBrandKitOptions = {},
): StudioDocument {
  const mode = options.mode ?? 'replace';
  const targetSlots = options.targetSlots?.length ? options.targetSlots : DEFAULT_TARGET_SLOTS;
  const tokens = resolveBrandKitTokens(brandKit);

  let nextDocument = document;

  if (options.applyCanvasBackground !== false && targetSlots.includes('backgroundColor')) {
    nextDocument = applyCanvasBackground(nextDocument, tokens.backgroundColor, mode);
  }

  const nextWidgets = Object.fromEntries(
    Object.entries(nextDocument.widgets).map(([widgetId, widget]) => [
      widgetId,
      applyTokensToWidget(widget, tokens, targetSlots, mode),
    ]),
  );

  return {
    ...nextDocument,
    widgets: nextWidgets,
    metadata: {
      ...nextDocument.metadata,
      dirty: true,
      platform: {
        ...(nextDocument.metadata.platform ?? {}),
        brandKitId: brandKit.id,
        brandKitName: brandKit.name,
        brandId: brandKit.brandId ?? nextDocument.metadata.platform?.brandId,
        brandName: brandKit.brandName ?? brandKit.name,
      },
    },
  };
}
