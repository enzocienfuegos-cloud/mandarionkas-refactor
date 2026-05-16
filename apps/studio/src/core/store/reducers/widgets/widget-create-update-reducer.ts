import type { StudioCommand } from '../../../commands/types';
import type { StudioState } from '../../../../domain/document/types';
import { buildResolvedWidgetsById, resolveWidgetForCanvasVariant } from '../../../../domain/document/canvas-variants';
import { currentScene, getPlacedFrameForPoint, getSmartPlacedFrame, getWidgetDefinition, withDirty } from './shared';

function isMasterVariant(state: StudioState): boolean {
  return state.document.canvasVariants.find((variant) => variant.id === state.document.activeCanvasVariantId)?.isMaster ?? true;
}

function pruneOverridePatch<T extends Record<string, unknown>>(nextValue: T, baseValue: T): Partial<T> | undefined {
  const patch = Object.fromEntries(
    Object.entries(nextValue).filter(([key, value]) => value !== baseValue[key as keyof T]),
  ) as Partial<T>;
  return Object.keys(patch).length ? patch : undefined;
}

function writeObjectOverride<K extends 'props' | 'style'>(
  state: StudioState,
  widgetId: string,
  area: K,
  nextValue: StudioState['document']['widgets'][string][K],
): StudioState['document']['widgetOverrides'] {
  const baseWidget = state.document.widgets[widgetId];
  if (!baseWidget) return state.document.widgetOverrides;
  const variantId = state.document.activeCanvasVariantId;
  const overridePatch = pruneOverridePatch(nextValue, baseWidget[area]);
  const currentVariantOverrides = { ...(state.document.widgetOverrides[variantId] ?? {}) };
  const currentWidgetOverride = { ...(currentVariantOverrides[widgetId] ?? {}) };
  if (overridePatch) currentVariantOverrides[widgetId] = { ...currentWidgetOverride, [area]: overridePatch };
  else if (Object.keys(currentWidgetOverride).filter((key) => key !== area).length) currentVariantOverrides[widgetId] = Object.fromEntries(Object.entries(currentWidgetOverride).filter(([key]) => key !== area));
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

function writeSharedSceneObjectOverride<K extends 'props' | 'style'>(
  state: StudioState,
  widgetId: string,
  area: K,
  nextValue: StudioState['document']['widgets'][string][K],
): StudioState['document']['sharedLayers'] {
  const widget = state.document.widgets[widgetId];
  if (!widget?.sharedLayerId) return state.document.sharedLayers;
  const sharedLayer = state.document.sharedLayers[widget.sharedLayerId];
  if (!sharedLayer || sharedLayer.baseWidgetId === widgetId) return state.document.sharedLayers;
  const baseWidget = state.document.widgets[sharedLayer.baseWidgetId];
  if (!baseWidget) return state.document.sharedLayers;

  const baseResolved = resolveWidgetForCanvasVariant(state.document, baseWidget, state.document.activeCanvasVariantId) ?? baseWidget;
  const overridePatch = pruneOverridePatch(nextValue, baseResolved[area]);
  const currentSceneOverride = { ...(sharedLayer.perSceneOverrides[widget.sceneId] ?? {}) };
  const nextPerSceneOverrides = { ...sharedLayer.perSceneOverrides };

  if (overridePatch) {
    nextPerSceneOverrides[widget.sceneId] = { ...currentSceneOverride, [area]: overridePatch };
  } else {
    const remainingOverride = Object.fromEntries(Object.entries(currentSceneOverride).filter(([key]) => key !== area));
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

export function widgetCreateUpdateReducer(state: StudioState, command: StudioCommand): StudioState {
  switch (command.type) {
    case 'CREATE_WIDGET': {
      const scene = currentScene(state);
      if (!scene) return state;
      const definition = getWidgetDefinition(command.widgetType);
      const widget = definition.defaults(scene.id, scene.widgetIds.length);
      const nextFrame = command.placement
        ? getPlacedFrameForPoint(widget.frame, command.placement, state.document.canvas, command.placement.anchor ?? 'center')
        : getSmartPlacedFrame(state, scene.id, widget.frame);
      const placedWidget = {
        ...widget,
        frame: nextFrame,
        props: command.initialProps ? { ...widget.props, ...command.initialProps } : widget.props,
        style: command.initialStyle ? { ...widget.style, ...command.initialStyle } : widget.style,
      };
      return withDirty({
        ...state,
        document: {
          ...state.document,
          widgets: { ...state.document.widgets, [placedWidget.id]: placedWidget },
          scenes: state.document.scenes.map((item) => item.id === scene.id ? { ...item, widgetIds: [...item.widgetIds, placedWidget.id] } : item),
          selection: { ...state.document.selection, widgetIds: [placedWidget.id], primaryWidgetId: placedWidget.id },
        },
      });
    }
    case 'UPDATE_WIDGET_NAME': {
      const target = state.document.widgets[command.widgetId];
      if (!target) return state;
      return withDirty({ ...state, document: { ...state.document, widgets: { ...state.document.widgets, [target.id]: { ...target, name: command.name } } } });
    }
    case 'UPDATE_WIDGET_PROPS': {
      const resolvedWidgets = buildResolvedWidgetsById(state.document);
      const target = resolvedWidgets[command.widgetId];
      if (!target) return state;
      const nextProps = { ...target.props, ...command.patch };
      const rawTarget = state.document.widgets[command.widgetId];
      if (rawTarget?.sharedLayerId) {
        const sharedLayer = state.document.sharedLayers[rawTarget.sharedLayerId];
        if (sharedLayer && sharedLayer.baseWidgetId !== rawTarget.id) {
          return withDirty({
            ...state,
            document: {
              ...state.document,
              sharedLayers: writeSharedSceneObjectOverride(state, command.widgetId, 'props', nextProps),
            },
          });
        }
      }
      if (isMasterVariant(state)) {
        const baseTarget = state.document.widgets[command.widgetId];
        if (!baseTarget) return state;
        return withDirty({ ...state, document: { ...state.document, widgets: { ...state.document.widgets, [baseTarget.id]: { ...baseTarget, props: nextProps } } } });
      }
      return withDirty({
        ...state,
        document: {
          ...state.document,
          widgetOverrides: writeObjectOverride(state, command.widgetId, 'props', nextProps),
        },
      });
    }
    case 'UPDATE_WIDGET_STYLE': {
      const resolvedWidgets = buildResolvedWidgetsById(state.document);
      const target = resolvedWidgets[command.widgetId];
      if (!target) return state;
      const nextStyle = { ...target.style, ...command.patch };
      const rawTarget = state.document.widgets[command.widgetId];
      if (rawTarget?.sharedLayerId) {
        const sharedLayer = state.document.sharedLayers[rawTarget.sharedLayerId];
        if (sharedLayer && sharedLayer.baseWidgetId !== rawTarget.id) {
          return withDirty({
            ...state,
            document: {
              ...state.document,
              sharedLayers: writeSharedSceneObjectOverride(state, command.widgetId, 'style', nextStyle),
            },
          });
        }
      }
      if (isMasterVariant(state)) {
        const baseTarget = state.document.widgets[command.widgetId];
        if (!baseTarget) return state;
        return withDirty({ ...state, document: { ...state.document, widgets: { ...state.document.widgets, [baseTarget.id]: { ...baseTarget, style: nextStyle } } } });
      }
      return withDirty({
        ...state,
        document: {
          ...state.document,
          widgetOverrides: writeObjectOverride(state, command.widgetId, 'style', nextStyle),
        },
      });
    }
    case 'APPLY_WIDGET_PROPERTY_CLIPBOARD': {
      const resolvedWidgets = buildResolvedWidgetsById(state.document);
      const target = resolvedWidgets[command.widgetId];
      if (!target) return state;
      const rawTarget = state.document.widgets[command.widgetId];
      const sameType = target.type === command.clipboard.widgetType;
      const nextProps = sameType ? { ...command.clipboard.props } : target.props;
      const nextStyle = sameType ? { ...command.clipboard.style } : { ...target.style, ...command.clipboard.style };

      if (rawTarget?.sharedLayerId) {
        const sharedLayer = state.document.sharedLayers[rawTarget.sharedLayerId];
        if (sharedLayer && sharedLayer.baseWidgetId !== rawTarget.id) {
          let nextSharedLayers = state.document.sharedLayers;
          if (sameType) nextSharedLayers = writeSharedSceneObjectOverride(state, command.widgetId, 'props', nextProps);
          const intermediateState = nextSharedLayers === state.document.sharedLayers
            ? state
            : { ...state, document: { ...state.document, sharedLayers: nextSharedLayers } };
          return withDirty({
            ...intermediateState,
            document: {
              ...intermediateState.document,
              sharedLayers: writeSharedSceneObjectOverride(intermediateState, command.widgetId, 'style', nextStyle),
            },
          });
        }
      }

      if (isMasterVariant(state)) {
        const baseTarget = state.document.widgets[command.widgetId];
        if (!baseTarget) return state;
        return withDirty({
          ...state,
          document: {
            ...state.document,
            widgets: {
              ...state.document.widgets,
              [baseTarget.id]: {
                ...baseTarget,
                props: sameType ? nextProps : baseTarget.props,
                style: nextStyle,
              },
            },
          },
        });
      }

      const nextDocument = {
        ...state.document,
        widgetOverrides: sameType
          ? writeObjectOverride(state, command.widgetId, 'props', nextProps)
          : state.document.widgetOverrides,
      };
      const intermediateState = sameType ? { ...state, document: nextDocument } : state;
      return withDirty({
        ...intermediateState,
        document: {
          ...intermediateState.document,
          widgetOverrides: writeObjectOverride(intermediateState, command.widgetId, 'style', nextStyle),
        },
      });
    }
    case 'UPDATE_WIDGET_BINDING': {
      const target = state.document.widgets[command.widgetId];
      if (!target) return state;
      const nextBindings = { ...(target.bindings ?? {}) };
      if (command.binding) nextBindings[command.key] = command.binding;
      else delete nextBindings[command.key];
      return withDirty({ ...state, document: { ...state.document, widgets: { ...state.document.widgets, [target.id]: { ...target, bindings: nextBindings } } } });
    }
    case 'UPDATE_WIDGET_VARIANT': {
      const target = state.document.widgets[command.widgetId];
      if (!target) return state;
      const currentVariant = target.variants?.[command.variant] ?? {};
      const nextVariant = { ...currentVariant, [command.area]: { ...(currentVariant[command.area] ?? {}), ...command.patch } };
      return withDirty({ ...state, document: { ...state.document, widgets: { ...state.document.widgets, [target.id]: { ...target, variants: { ...(target.variants ?? {}), [command.variant]: nextVariant } } } } });
    }
    case 'UPDATE_WIDGET_CONDITIONS': {
      const target = state.document.widgets[command.widgetId];
      if (!target) return state;
      return withDirty({ ...state, document: { ...state.document, widgets: { ...state.document.widgets, [target.id]: { ...target, conditions: { ...(target.conditions ?? {}), ...command.patch } } } } });
    }
    default:
      return state;
  }
}
