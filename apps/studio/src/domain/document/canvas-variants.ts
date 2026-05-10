import { getCanvasPresetById, getPresetForSize, type CanvasPreset } from './canvas-presets';
import type { CanvasNode, CanvasVariant, StudioDocument, WidgetNode, WidgetNodeOverride } from './types';

function createCanvasVariantId(): string {
  return `cv_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatCanvasVariantLabel(width: number, height: number): string {
  return `${width}×${height}`;
}

export function createCanvasVariantFromCanvas(canvas: CanvasNode, options: { label?: string; isMaster?: boolean } = {}): CanvasVariant {
  return {
    id: createCanvasVariantId(),
    label: options.label ?? formatCanvasVariantLabel(canvas.width, canvas.height),
    width: canvas.width,
    height: canvas.height,
    presetId: canvas.presetId ?? getPresetForSize(canvas.width, canvas.height)?.id ?? 'custom',
    backgroundColor: canvas.backgroundColor,
    isMaster: options.isMaster ?? false,
  };
}

export function createCanvasVariantFromPreset(presetId: string, fallbackBackgroundColor: string, options: { isMaster?: boolean } = {}): CanvasVariant | undefined {
  const preset = getCanvasPresetById(presetId);
  if (!preset) return undefined;
  return createCanvasVariantFromPresetData(preset, fallbackBackgroundColor, options);
}

export function createCanvasVariantFromPresetData(preset: CanvasPreset, fallbackBackgroundColor: string, options: { isMaster?: boolean } = {}): CanvasVariant {
  return {
    id: createCanvasVariantId(),
    label: formatCanvasVariantLabel(preset.width, preset.height),
    width: preset.width,
    height: preset.height,
    presetId: preset.id,
    backgroundColor: preset.backgroundColor ?? fallbackBackgroundColor,
    isMaster: options.isMaster ?? false,
  };
}

export function syncDocumentCanvasToVariant(document: StudioDocument, variantId = document.activeCanvasVariantId): StudioDocument {
  const activeVariant = document.canvasVariants.find((variant) => variant.id === variantId) ?? document.canvasVariants[0];
  if (!activeVariant) return document;
  return {
    ...document,
    activeCanvasVariantId: activeVariant.id,
    canvas: {
      ...document.canvas,
      width: activeVariant.width,
      height: activeVariant.height,
      backgroundColor: activeVariant.backgroundColor,
      presetId: activeVariant.presetId ?? 'custom',
    },
  };
}

export function ensureSingleMasterVariant(variants: CanvasVariant[], preferredMasterId?: string): CanvasVariant[] {
  const masterId = preferredMasterId ?? variants.find((variant) => variant.isMaster)?.id ?? variants[0]?.id;
  return variants.map((variant) => ({ ...variant, isMaster: variant.id === masterId }));
}

export function mergeWidgetOverride(widget: WidgetNode, override: WidgetNodeOverride | undefined): WidgetNode {
  if (!override) return widget;
  return {
    ...widget,
    ...override,
    frame: override.frame ? { ...widget.frame, ...override.frame } : widget.frame,
    props: override.props ? { ...widget.props, ...override.props } : widget.props,
    style: override.style ? { ...widget.style, ...override.style } : widget.style,
    bindings: override.bindings ? { ...(widget.bindings ?? {}), ...override.bindings } : widget.bindings,
    timeline: override.timeline ? { ...widget.timeline, ...override.timeline } : widget.timeline,
    variants: override.variants ? { ...(widget.variants ?? {}), ...override.variants } : widget.variants,
    conditions: override.conditions ? { ...(widget.conditions ?? {}), ...override.conditions } : widget.conditions,
  };
}

function resolveSharedLayerWidget(
  document: StudioDocument,
  widget: WidgetNode,
  variantId: string,
): WidgetNode {
  if (!widget.sharedLayerId) return resolveWidgetForCanvasVariant(document, widget, variantId) ?? widget;
  const sharedLayer = document.sharedLayers[widget.sharedLayerId];
  if (!sharedLayer) return resolveWidgetForCanvasVariant(document, widget, variantId) ?? widget;
  const baseWidget = document.widgets[sharedLayer.baseWidgetId];
  if (!baseWidget) return resolveWidgetForCanvasVariant(document, widget, variantId) ?? widget;

  const baseResolved = resolveWidgetForCanvasVariant(document, baseWidget, variantId) ?? baseWidget;
  const sceneOverride = sharedLayer.perSceneOverrides[widget.sceneId];
  const merged = mergeWidgetOverride(baseResolved, sceneOverride);

  return {
    ...merged,
    id: widget.id,
    sceneId: widget.sceneId,
    zIndex: widget.zIndex,
    parentId: widget.parentId,
    childIds: widget.childIds,
    sharedLayerId: widget.sharedLayerId,
  };
}

export function resolveWidgetForCanvasVariant(
  document: StudioDocument,
  widget: WidgetNode | undefined,
  variantId = document.activeCanvasVariantId,
): WidgetNode | undefined {
  if (!widget) return undefined;
  const override = document.widgetOverrides[variantId]?.[widget.id];
  return mergeWidgetOverride(widget, override);
}

export function buildResolvedWidgetsById(
  document: StudioDocument,
  variantId = document.activeCanvasVariantId,
): Record<string, WidgetNode> {
  return Object.fromEntries(
    Object.entries(document.widgets).map(([widgetId, widget]) => [
      widgetId,
      resolveSharedLayerWidget(document, widget, variantId),
    ]),
  );
}
