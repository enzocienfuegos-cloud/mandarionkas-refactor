import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { reduceBySlices } from '../../../core/store/reducers';
import type { StudioCommand } from '../../../core/commands/types';
import type { StudioState } from '../../../domain/document/types';

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);
  Object.freeze(value);
  Object.values(value as Record<string, unknown>).forEach((child) => deepFreeze(child, seen));
  return value;
}

type Scenario = {
  label: string;
  setup: () => { state: StudioState; command: StudioCommand };
  assert: (before: StudioState, next: StudioState) => void;
};

describe('store reducer immutability (required by S60)', () => {
  const scenarios: Scenario[] = [
    {
      label: 'UPDATE_DOCUMENT_NAME',
      setup: () => ({
        state: createInitialState(),
        command: { type: 'UPDATE_DOCUMENT_NAME', name: 'Immutable Title' },
      }),
      assert: (before, next) => {
        expect(next).not.toBe(before);
        expect(next.document).not.toBe(before.document);
        expect(before.document.name).toBe('Untitled Project');
      },
    },
    {
      label: 'ADD_SCENE',
      setup: () => ({
        state: createInitialState(),
        command: { type: 'ADD_SCENE' },
      }),
      assert: (before, next) => {
        expect(next.document.scenes).not.toBe(before.document.scenes);
        expect(before.document.scenes).toHaveLength(1);
      },
    },
    {
      label: 'SET_PLAYHEAD',
      setup: () => ({
        state: createInitialState(),
        command: { type: 'SET_PLAYHEAD', playheadMs: 500 },
      }),
      assert: (before, next) => {
        expect(next.ui).not.toBe(before.ui);
        expect(before.ui.playheadMs).toBe(0);
      },
    },
    {
      label: 'SET_HOVERED_WIDGET',
      setup: () => ({
        state: createInitialState(),
        command: { type: 'SET_HOVERED_WIDGET', widgetId: 'widget_test' },
      }),
      assert: (before, next) => {
        expect(next.ui).not.toBe(before.ui);
        expect(before.ui.hoveredWidgetId).toBeUndefined();
      },
    },
    {
      label: 'UPDATE_WIDGET_FRAME',
      setup: () => {
        let state = createInitialState();
        state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
        const widgetId = Object.keys(state.document.widgets)[0];
        return {
          state,
          command: { type: 'UPDATE_WIDGET_FRAME', widgetId, patch: { x: 240, y: 180 } },
        };
      },
      assert: (before, next) => {
        const widgetId = Object.keys(before.document.widgets)[0];
        expect(next.document.widgets).not.toBe(before.document.widgets);
        expect(next.document.widgets[widgetId]).not.toBe(before.document.widgets[widgetId]);
        expect(before.document.widgets[widgetId].frame.x).not.toBe(240);
        expect(before.document.widgets[widgetId].frame.y).not.toBe(180);
      },
    },
    {
      label: 'UPDATE_WIDGET_PROPS',
      setup: () => {
        let state = createInitialState();
        state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
        const widgetId = Object.keys(state.document.widgets)[0];
        return {
          state,
          command: { type: 'UPDATE_WIDGET_PROPS', widgetId, patch: { text: 'Immutable copy' } },
        };
      },
      assert: (before, next) => {
        const widgetId = Object.keys(before.document.widgets)[0];
        expect(next.document.widgets[widgetId]).not.toBe(before.document.widgets[widgetId]);
        expect(before.document.widgets[widgetId].props.text).not.toBe('Immutable copy');
      },
    },
  ];

  scenarios.forEach(({ label, setup, assert }) => {
    it(`${label} does not mutate the previous state`, () => {
      const { state, command } = setup();
      const beforeDocument = state.document;
      const beforeWidgets = state.document.widgets;
      const beforeScenes = state.document.scenes;
      const beforeUi = state.ui;
      deepFreeze(state);

      const next = reduceBySlices(state, command);

      expect(state.document).toBe(beforeDocument);
      expect(state.document.widgets).toBe(beforeWidgets);
      expect(state.document.scenes).toBe(beforeScenes);
      expect(state.ui).toBe(beforeUi);
      assert(state, next);
    });
  });
});
