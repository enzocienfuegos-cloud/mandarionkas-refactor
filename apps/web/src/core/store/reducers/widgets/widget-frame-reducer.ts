import type { StudioCommand } from '../../../commands/types';
import type { StudioState } from '../../../../domain/document/types';
import { withDirty } from './shared';

export function widgetFrameReducer(state: StudioState, command: StudioCommand): StudioState {
  switch (command.type) {
    case 'UPDATE_WIDGET_FRAME': {
      const target = state.document.widgets[command.widgetId];
      if (!target) return state;
      return withDirty({ ...state, document: { ...state.document, widgets: { ...state.document.widgets, [target.id]: { ...target, frame: { ...target.frame, ...command.patch } } } } });
    }
    case 'UPDATE_WIDGET_FRAMES': {
      if (!command.patches.length) return state;
      const widgets = { ...state.document.widgets };
      command.patches.forEach(({ widgetId, patch }) => {
        const target = widgets[widgetId];
        if (!target) return;
        const previousFrame = target.frame;
        const nextFrame = { ...target.frame, ...patch };
        widgets[widgetId] = { ...target, frame: nextFrame };
        if (target.type === 'group' && target.childIds?.length) {
          const dx = nextFrame.x - previousFrame.x;
          const dy = nextFrame.y - previousFrame.y;
          target.childIds.forEach((childId) => {
            const child = widgets[childId];
            if (!child) return;
            widgets[childId] = { ...child, frame: { ...child.frame, x: child.frame.x + dx, y: child.frame.y + dy } };
          });
        }
      });
      return withDirty({ ...state, document: { ...state.document, widgets } });
    }
    default:
      return state;
  }
}
