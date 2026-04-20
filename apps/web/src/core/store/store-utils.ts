import type { ActionNode, SceneNode, StudioState, WidgetFrame, WidgetNode } from '../../domain/document/types';
import { createId } from '../../domain/document/factories';
import { resolveNextSceneId } from '../../domain/document/resolvers';

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function currentScene(state: StudioState): SceneNode | undefined {
  return state.document.scenes.find((scene) => scene.id === state.document.selection.activeSceneId) ?? state.document.scenes[0];
}

export function withDirty(state: StudioState): StudioState {
  return {
    ...state,
    document: {
      ...state.document,
      metadata: {
        ...state.document.metadata,
        dirty: true,
      },
    },
  };
}

export function getSelectedWidgets(state: StudioState): WidgetNode[] {
  return state.document.selection.widgetIds.map((widgetId) => state.document.widgets[widgetId]).filter(Boolean);
}

export function getWidgetWithChildren(state: StudioState, widgetId: string): WidgetNode[] {
  const widget = state.document.widgets[widgetId];
  if (!widget) return [];
  return [widget, ...(widget.childIds ?? []).map((id) => state.document.widgets[id]).filter(Boolean)];
}

export function expandSelectionIds(state: StudioState, widgetIds: string[]): string[] {
  const seen = new Set<string>();
  widgetIds.forEach((widgetId) => getWidgetWithChildren(state, widgetId).forEach((widget) => seen.add(widget.id)));
  return [...seen];
}

export function computeGroupFrame(widgets: WidgetNode[]): WidgetNode['frame'] {
  const minX = Math.min(...widgets.map((widget) => widget.frame.x));
  const minY = Math.min(...widgets.map((widget) => widget.frame.y));
  const maxX = Math.max(...widgets.map((widget) => widget.frame.x + widget.frame.width));
  const maxY = Math.max(...widgets.map((widget) => widget.frame.y + widget.frame.height));
  return { x: minX - 12, y: minY - 12, width: maxX - minX + 24, height: maxY - minY + 24, rotation: 0 };
}

export function normalizeSceneOrdering(scene: SceneNode, widgets: Record<string, WidgetNode>): { scene: SceneNode; widgets: Record<string, WidgetNode> } {
  const nextWidgets = { ...widgets };
  scene.widgetIds.forEach((widgetId, index) => {
    const widget = nextWidgets[widgetId];
    if (!widget) return;
    nextWidgets[widgetId] = { ...widget, zIndex: index };
  });
  return { scene, widgets: nextWidgets };
}

export function getSmartPlacedFrame(state: StudioState, sceneId: string, frame: WidgetFrame): WidgetFrame {
  const scene = state.document.scenes.find((item) => item.id === sceneId);
  if (!scene) return frame;
  const widgets = scene.widgetIds.map((id) => state.document.widgets[id]).filter(Boolean);
  const padding = 20;
  const step = 28;
  let next = { ...frame };
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const collides = widgets.some((widget) => {
      const other = widget.frame;
      return next.x < other.x + other.width + 12 && next.x + next.width + 12 > other.x && next.y < other.y + other.height + 12 && next.y + next.height + 12 > other.y;
    });
    if (!collides) break;
    next = {
      ...next,
      x: Math.min(Math.max(padding, next.x + step), Math.max(padding, state.document.canvas.width - next.width - padding)),
      y: Math.min(Math.max(padding, next.y + step), Math.max(padding, state.document.canvas.height - next.height - padding)),
    };
  }
  return next;
}

export function getPlacedFrameForPoint(frame: WidgetFrame, point: { x: number; y: number }, canvas: { width: number; height: number }, anchor: 'center' | 'top-left' = 'center'): WidgetFrame {
  const width = Math.min(frame.width, canvas.width);
  const height = Math.min(frame.height, canvas.height);
  const rawX = anchor === 'center' ? point.x - width / 2 : point.x;
  const rawY = anchor === 'center' ? point.y - height / 2 : point.y;
  const maxX = Math.max(0, canvas.width - width);
  const maxY = Math.max(0, canvas.height - height);
  return {
    ...frame,
    x: Math.round(Math.min(maxX, Math.max(0, rawX))),
    y: Math.round(Math.min(maxY, Math.max(0, rawY))),
    width,
    height,
  };
}

export function reduceExecutedAction(state: StudioState, action: ActionNode): StudioState {
  let next = state;
  switch (action.type) {
    case 'open-url': {
      break;
    }
    case 'show-widget':
    case 'hide-widget':
    case 'toggle-widget': {
      if (action.targetWidgetId && next.document.widgets[action.targetWidgetId]) {
        const target = next.document.widgets[action.targetWidgetId];
        const hidden = action.type === 'show-widget' ? false : action.type === 'hide-widget' ? true : !target.hidden;
        next = withDirty({
          ...next,
          document: {
            ...next.document,
            widgets: {
              ...next.document.widgets,
              [target.id]: { ...target, hidden },
            },
          },
        });
      }
      break;
    }
    case 'set-text': {
      if (action.targetWidgetId && next.document.widgets[action.targetWidgetId]) {
        const target = next.document.widgets[action.targetWidgetId];
        next = withDirty({
          ...next,
          document: {
            ...next.document,
            widgets: {
              ...next.document.widgets,
              [target.id]: {
                ...target,
                props: {
                  ...target.props,
                  text: action.text ?? target.props.text,
                },
              },
            },
          },
        });
      }
      break;
    }
    case 'go-to-scene': {
      const targetSceneId = action.targetSceneId || resolveNextSceneId(next, next.document.selection.activeSceneId);
      if (targetSceneId && next.document.scenes.some((scene) => scene.id === targetSceneId)) {
        next = {
          ...next,
          document: {
            ...next.document,
            selection: {
              ...next.document.selection,
              activeSceneId: targetSceneId,
              widgetIds: [],
              primaryWidgetId: undefined,
            },
          },
          ui: {
            ...next.ui,
            playheadMs: 0,
            hoveredWidgetId: undefined,
            activeWidgetId: undefined,
          },
        };
      }
      break;
    }
    case 'play-video':
    case 'pause-video':
    case 'seek-video':
    case 'mute-video':
    case 'unmute-video':
    case 'show-overlay':
    case 'hide-overlay':
    case 'fire-tracking-url':
    case 'emit-analytics-event': {
      break;
    }
  }

  return {
    ...next,
    ui: {
      ...next.ui,
      activeWidgetId: action.widgetId,
      lastTriggeredActionLabel: action.label ?? `${action.trigger} → ${action.type}`,
    },
  };
}

export function createCommentId() {
  return createId('comment');
}

export function createApprovalId() {
  return createId('approval');
}
