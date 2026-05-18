import type { StudioCommand } from '../../../commands/types';
import type { StudioState, WidgetFrame } from '../../../../domain/document/types';
import { buildResolvedWidgetsById, resolveWidgetForCanvasVariant } from '../../../../domain/document/canvas-variants';
import { rebuildWidgetMotionKeyframes } from '../../../../motion/motion-template-keyframes';
import { withDirty } from './shared';

function pruneFrameOverride(frame: WidgetFrame, baseFrame: WidgetFrame): Partial<WidgetFrame> | undefined {
  const patch = Object.fromEntries(
    Object.entries(frame).filter(([key, value]) => value !== baseFrame[key as keyof typeof baseFrame]),
  ) as Partial<WidgetFrame>;
  return Object.keys(patch).length ? patch : undefined;
}

function isMasterVariant(state: StudioState): boolean {
  return state.document.canvasVariants.find((variant) => variant.id === state.document.activeCanvasVariantId)?.isMaster ?? true;
}

export function writeFrameOverride(
  state: StudioState,
  widgetId: string,
  nextFrame: NonNullable<StudioState['document']['widgets'][string]>['frame'],
): StudioState['document']['widgetOverrides'] {
  const baseWidget = state.document.widgets[widgetId];
  if (!baseWidget) return state.document.widgetOverrides;
  const variantId = state.document.activeCanvasVariantId;
  const frameOverride = pruneFrameOverride(nextFrame, baseWidget.frame);
  const currentVariantOverrides = { ...(state.document.widgetOverrides[variantId] ?? {}) };
  const currentWidgetOverride = { ...(currentVariantOverrides[widgetId] ?? {}) };
  if (frameOverride) currentVariantOverrides[widgetId] = { ...currentWidgetOverride, frame: frameOverride };
  else if (Object.keys(currentWidgetOverride).filter((key) => key !== 'frame').length) currentVariantOverrides[widgetId] = Object.fromEntries(Object.entries(currentWidgetOverride).filter(([key]) => key !== 'frame'));
  else delete currentVariantOverrides[widgetId];

  if (!Object.keys(currentVariantOverrides).length) {
    const nextOverrides = { ...state.document.widgetOverrides };
    delete nextOverrides[variantId];
    return nextOverrides;
  }
  return {
    ...state.document.widgetOverrides,
    [variantId]: currentVariantOverrides,
  };
}

export function writeSharedSceneFrameOverride(
  state: StudioState,
  widgetId: string,
  nextFrame: WidgetFrame,
): StudioState['document']['sharedLayers'] {
  const widget = state.document.widgets[widgetId];
  if (!widget?.sharedLayerId) return state.document.sharedLayers;
  const sharedLayer = state.document.sharedLayers[widget.sharedLayerId];
  if (!sharedLayer || sharedLayer.baseWidgetId === widgetId) return state.document.sharedLayers;
  const baseWidget = state.document.widgets[sharedLayer.baseWidgetId];
  if (!baseWidget) return state.document.sharedLayers;

  const baseResolved = resolveWidgetForCanvasVariant(state.document, baseWidget, state.document.activeCanvasVariantId) ?? baseWidget;
  const frameOverride = pruneFrameOverride(nextFrame, baseResolved.frame);
  const currentSceneOverride = { ...(sharedLayer.perSceneOverrides[widget.sceneId] ?? {}) };
  const nextPerSceneOverrides = { ...sharedLayer.perSceneOverrides };

  if (frameOverride) {
    nextPerSceneOverrides[widget.sceneId] = { ...currentSceneOverride, frame: frameOverride };
  } else {
    const remainingOverride = Object.fromEntries(Object.entries(currentSceneOverride).filter(([key]) => key !== 'frame'));
    if (Object.keys(remainingOverride).length) nextPerSceneOverrides[widget.sceneId] = remainingOverride;
    else delete nextPerSceneOverrides[widget.sceneId];
  }

  return {
    ...state.document.sharedLayers,
    [sharedLayer.id]: {
      ...sharedLayer,
      perSceneOverrides: nextPerSceneOverrides,
    },
  };
}

function applyFramePatch(
  state: StudioState,
  widgetId: string,
  patch: Partial<WidgetFrame>,
): StudioState {
  const resolvedWidgets = buildResolvedWidgetsById(state.document);
  const target = resolvedWidgets[widgetId];
  if (!target) return state;
  const nextFrame = { ...target.frame, ...patch };
  const rawTarget = state.document.widgets[widgetId];

  if (rawTarget?.sharedLayerId) {
    const sharedLayer = state.document.sharedLayers[rawTarget.sharedLayerId];
    if (sharedLayer && sharedLayer.baseWidgetId !== rawTarget.id) {
      return withDirty({
        ...state,
        document: {
          ...state.document,
          sharedLayers: writeSharedSceneFrameOverride(state, widgetId, nextFrame),
        },
      });
    }
  }

  if (!isMasterVariant(state)) {
    return withDirty({
      ...state,
      document: {
        ...state.document,
        widgetOverrides: writeFrameOverride(state, widgetId, nextFrame),
      },
    });
  }

  const baseTarget = state.document.widgets[widgetId];
  if (!baseTarget) return state;
  return withDirty({
    ...state,
    document: {
      ...state.document,
      widgets: {
        ...state.document.widgets,
        [baseTarget.id]: {
          ...baseTarget,
          frame: nextFrame,
          timeline: {
            ...baseTarget.timeline,
            keyframes: rebuildWidgetMotionKeyframes(
              { ...baseTarget, frame: nextFrame, timeline: baseTarget.timeline },
              baseTarget.motion,
              baseTarget.timeline.keyframes ?? [],
            ),
          },
        },
      },
    },
  });
}

export function widgetFrameReducer(state: StudioState, command: StudioCommand): StudioState {
  switch (command.type) {
    case 'UPDATE_WIDGET_FRAME': {
      return applyFramePatch(state, command.widgetId, command.patch);
    }
    case 'UPDATE_WIDGET_FRAMES': {
      if (!command.patches.length) return state;
      const resolvedWidgets = buildResolvedWidgetsById(state.document);
      const queuedPatches = new Map(command.patches.map(({ widgetId, patch }) => [widgetId, patch]));
      command.patches.forEach(({ widgetId }) => {
        const target = resolvedWidgets[widgetId];
        if (!target || target.type !== 'group' || !target.childIds?.length) return;
        const patch = queuedPatches.get(widgetId);
        if (!patch) return;
        const nextFrame = { ...target.frame, ...patch };
        const dx = nextFrame.x - target.frame.x;
        const dy = nextFrame.y - target.frame.y;
        target.childIds.forEach((childId) => {
          const child = resolvedWidgets[childId];
          if (!child) return;
          const childPatch = queuedPatches.get(childId) ?? {};
          queuedPatches.set(childId, {
            ...childPatch,
            x: child.frame.x + dx,
            y: child.frame.y + dy,
          });
        });
      });
      let nextState = state;
      for (const [widgetId, patch] of queuedPatches.entries()) {
        nextState = applyFramePatch(nextState, widgetId, patch);
      }
      return nextState;
    }
    default:
      return state;
  }
}
