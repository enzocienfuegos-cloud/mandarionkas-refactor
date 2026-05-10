import { createInitialState } from '../../../domain/document/factories';
import type { StudioDocument, WidgetType } from '../../../domain/document/types';
import { registerBuiltins } from '../../../widgets/registry/register-builtins';
import { getWidgetDefinition } from '../../../widgets/registry/widget-registry';

export function createParityDocument(
  type: WidgetType,
  patch?: Partial<StudioDocument['widgets'][string]>,
): { document: StudioDocument; widgetId: string } {
  registerBuiltins();
  const state = createInitialState();
  const sceneId = state.document.scenes[0].id;
  const widget = {
    ...getWidgetDefinition(type).defaults(sceneId, 1),
    ...patch,
    frame: {
      ...getWidgetDefinition(type).defaults(sceneId, 1).frame,
      ...(patch?.frame ?? {}),
    },
    props: {
      ...getWidgetDefinition(type).defaults(sceneId, 1).props,
      ...(patch?.props ?? {}),
    },
    style: {
      ...getWidgetDefinition(type).defaults(sceneId, 1).style,
      ...(patch?.style ?? {}),
    },
  };

  state.document.widgets = {
    [widget.id]: widget,
  };
  state.document.scenes[0].widgetIds = [widget.id];

  return {
    document: state.document,
    widgetId: widget.id,
  };
}
