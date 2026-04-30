import type { StudioCommand } from '../../../commands/types';
import type { StudioState } from '../../../../domain/document/types';
import { currentScene, getPlacedFrameForPoint, getSmartPlacedFrame, getWidgetDefinition, withDirty } from './shared';

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
      const target = state.document.widgets[command.widgetId];
      if (!target) return state;
      return withDirty({ ...state, document: { ...state.document, widgets: { ...state.document.widgets, [target.id]: { ...target, props: { ...target.props, ...command.patch } } } } });
    }
    case 'UPDATE_WIDGET_STYLE': {
      const target = state.document.widgets[command.widgetId];
      if (!target) return state;
      return withDirty({ ...state, document: { ...state.document, widgets: { ...state.document.widgets, [target.id]: { ...target, style: { ...target.style, ...command.patch } } } } });
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
