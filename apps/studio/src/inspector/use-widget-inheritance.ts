import { useMemo } from 'react';
import type { WidgetNode } from '../domain/document/types';
import { resolveWidgetForCanvasVariant } from '../domain/document/canvas-variants';
import { shallowEqual, useStudioStore } from '../core/store/use-studio-store';

export type InheritanceBadgeState = 'local' | 'shared' | 'master' | 'none';

export function badgeStateFromInheritance(input: {
  sceneLocal: boolean;
  variantLocal: boolean;
  sharedClone: boolean;
  isMasterVariant: boolean;
}): InheritanceBadgeState {
  if (input.sceneLocal || input.variantLocal) return 'local';
  if (input.sharedClone) return 'shared';
  if (!input.isMasterVariant) return 'master';
  return 'none';
}

export function useWidgetInheritance(widget: WidgetNode) {
  const snapshot = useStudioStore((state) => {
    const activeVariantId = state.document.activeCanvasVariantId;
    const activeVariant = state.document.canvasVariants.find((variant) => variant.id === activeVariantId);
    const rawWidget = state.document.widgets[widget.id];
    const variantOverride = state.document.widgetOverrides[activeVariantId]?.[widget.id];
    const sharedLayer = rawWidget?.sharedLayerId ? state.document.sharedLayers[rawWidget.sharedLayerId] : undefined;
    const isSharedLayerBase = Boolean(sharedLayer && sharedLayer.baseWidgetId === rawWidget?.id);
    const isSharedLayerClone = Boolean(sharedLayer && sharedLayer.baseWidgetId !== rawWidget?.id);
    const sharedBaseWidget = sharedLayer ? state.document.widgets[sharedLayer.baseWidgetId] : undefined;
    const inheritedSharedBaseWidget = sharedBaseWidget
      ? (resolveWidgetForCanvasVariant(state.document, sharedBaseWidget, activeVariantId) ?? sharedBaseWidget)
      : undefined;
    const sceneOverride = isSharedLayerClone ? sharedLayer?.perSceneOverrides[widget.sceneId] : undefined;

    return {
      baseWidget: rawWidget,
      inheritedSharedBaseWidget,
      isMasterVariant: activeVariant?.isMaster ?? true,
      isSharedLayerBase,
      isSharedLayerClone,
      localVariantFrameOverride: variantOverride?.frame,
      localVariantStyleOverride: variantOverride?.style,
      localVariantPropsOverride: variantOverride?.props,
      localSceneFrameOverride: sceneOverride?.frame,
      localSceneStyleOverride: sceneOverride?.style,
      localScenePropsOverride: sceneOverride?.props,
    };
  }, shallowEqual);

  return useMemo(() => ({
    baseWidget: snapshot.baseWidget,
    inheritedSharedBaseWidget: snapshot.inheritedSharedBaseWidget,
    isMasterVariant: snapshot.isMasterVariant,
    isSharedLayerBase: snapshot.isSharedLayerBase,
    isSharedLayerClone: snapshot.isSharedLayerClone,
    localVariantFrameOverrideKeys: new Set(Object.keys(snapshot.localVariantFrameOverride ?? {})),
    localVariantStyleOverrideKeys: new Set(Object.keys(snapshot.localVariantStyleOverride ?? {})),
    localVariantPropsOverrideKeys: new Set(Object.keys(snapshot.localVariantPropsOverride ?? {})),
    localSceneFrameOverrideKeys: new Set(Object.keys(snapshot.localSceneFrameOverride ?? {})),
    localSceneStyleOverrideKeys: new Set(Object.keys(snapshot.localSceneStyleOverride ?? {})),
    localScenePropsOverrideKeys: new Set(Object.keys(snapshot.localScenePropsOverride ?? {})),
  }), [snapshot]);
}
