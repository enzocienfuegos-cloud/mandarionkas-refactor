/** @vitest-environment jsdom */

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { reduceBySlices } from '../../../core/store/reducers';
import { replaceStudioState, studioStore } from '../../../core/store/studio-store';

const saveAutosaveDraftMock = vi.fn(async () => {});

vi.mock('../../../repositories/document', () => ({
  saveAutosaveDraft: (...args: unknown[]) => saveAutosaveDraftMock(...args),
}));

import { AutosaveGate } from '../../../persistence/autosave/AutosaveGate';

describe('AutosaveGate stringify guardrail', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    saveAutosaveDraftMock.mockReset();
    saveAutosaveDraftMock.mockResolvedValue(undefined);
    replaceStudioState(createInitialState());
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    replaceStudioState(createInitialState());
  });

  it('does not call JSON.stringify on non-persisted dispatches', () => {
    const stringifySpy = vi.spyOn(JSON, 'stringify');
    render(<AutosaveGate />);
    stringifySpy.mockClear();

    act(() => {
      for (let index = 0; index < 100; index += 1) {
        studioStore.dispatch({ type: 'SET_HOVERED_WIDGET', widgetId: `widget_${index}` });
      }
    });

    expect(stringifySpy.mock.calls.length).toBeLessThanOrEqual(2);
    expect(saveAutosaveDraftMock).not.toHaveBeenCalled();
  });

  it('autosaves after document reference changes without selector-path stringify', async () => {
    let state = createInitialState();
    state = reduceBySlices(state, { type: 'CREATE_WIDGET', widgetType: 'text' });
    const widgetId = state.document.selection.primaryWidgetId!;
    replaceStudioState(state);

    const stringifySpy = vi.spyOn(JSON, 'stringify');
    render(<AutosaveGate />);
    stringifySpy.mockClear();

    act(() => {
      studioStore.dispatch({ type: 'UPDATE_WIDGET_PROPS', widgetId, patch: { text: 'hello autosave' } });
    });

    expect(stringifySpy.mock.calls.length).toBeLessThanOrEqual(2);
    expect(saveAutosaveDraftMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });

    expect(saveAutosaveDraftMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(saveAutosaveDraftMock.mock.calls.length).toBeLessThanOrEqual(2);
    expect(stringifySpy.mock.calls.length).toBeLessThanOrEqual(2);

    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });

    expect(saveAutosaveDraftMock.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
