import { describe, expect, it } from 'vitest';
import type { ActionNode } from '../../../domain/document/types';
import {
  getTimelineActions,
  getTimelineEnterActions,
  getTimelineExitActions,
  getWidgetActions,
} from '../../../actions/runtime';

function makeState(actions: ActionNode[], widgets: Record<string, { timeline: { startMs: number; endMs?: number } }>) {
  return {
    document: {
      actions: Object.fromEntries(actions.map((action) => [action.id, action])),
      widgets,
    },
  } as any;
}

function makeAction(overrides: Partial<ActionNode> & Pick<ActionNode, 'id' | 'widgetId' | 'trigger' | 'type'>): ActionNode {
  return { ...overrides } as ActionNode;
}

describe('timeline action runtime helpers', () => {
  it('fires timeline-enter when crossing widget start', () => {
    const state = makeState([
      makeAction({ id: 'enter-1', widgetId: 'w1', trigger: 'timeline-enter', type: 'open-url', url: 'https://example.com' }),
    ], {
      w1: { timeline: { startMs: 500 } },
    });

    const result = getTimelineEnterActions(state, 600, 400);
    expect(result.map((action) => action.id)).toEqual(['enter-1']);
  });

  it('fires timeline-exit when crossing widget end', () => {
    const state = makeState([
      makeAction({ id: 'exit-1', widgetId: 'w1', trigger: 'timeline-exit', type: 'pause-video' }),
    ], {
      w1: { timeline: { startMs: 0, endMs: 3000 } },
    });

    const result = getTimelineExitActions(state, 3100, 2900);
    expect(result.map((action) => action.id)).toEqual(['exit-1']);
  });

  it('combines enter and exit actions in a single pass', () => {
    const state = makeState([
      makeAction({ id: 'enter-1', widgetId: 'w1', trigger: 'timeline-enter', type: 'play-video' }),
      makeAction({ id: 'exit-1', widgetId: 'w2', trigger: 'timeline-exit', type: 'pause-video' }),
    ], {
      w1: { timeline: { startMs: 1000, endMs: 5000 } },
      w2: { timeline: { startMs: 0, endMs: 2000 } },
    });

    const result = getTimelineActions(state, 2100, 900);
    expect(result.map((action) => action.id).sort()).toEqual(['enter-1', 'exit-1']);
  });

  it('skips disabled actions and filters widget triggers exactly', () => {
    const state = makeState([
      makeAction({ id: 'hover-1', widgetId: 'w1', trigger: 'hover-enter', type: 'show-overlay', overlayId: 'ov-1' }),
      makeAction({ id: 'hover-2', widgetId: 'w1', trigger: 'hover-enter', type: 'show-overlay', overlayId: 'ov-2', disabled: true }),
      makeAction({ id: 'hover-3', widgetId: 'w2', trigger: 'hover-enter', type: 'show-overlay', overlayId: 'ov-3' }),
    ], {
      w1: { timeline: { startMs: 0 } },
      w2: { timeline: { startMs: 0 } },
    });

    const result = getWidgetActions(state, 'w1', 'hover-enter');
    expect(result.map((action) => action.id)).toEqual(['hover-1']);
  });
});
