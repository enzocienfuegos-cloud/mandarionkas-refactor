import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreflightTray } from '../../../app/shell/PreflightTray';
import { createInitialState } from '../../../domain/document/factories';
import * as preflightModule from '../../../export/preflight';
import { replaceStudioState, studioStore } from '../../../core/store/studio-store';

describe('PreflightTray perf', () => {
  let root: ReactTestRenderer | undefined;

  beforeEach(() => {
    replaceStudioState(createInitialState());
  });

  afterEach(() => {
    root?.unmount();
    root = undefined;
    vi.restoreAllMocks();
  });

  it('does not recompute preflight when only ui state changes', () => {
    const spy = vi.spyOn(preflightModule, 'buildExportPreflight');

    act(() => {
      root = create(<PreflightTray />);
    });

    expect(spy).toHaveBeenCalledTimes(1);

    act(() => {
      studioStore.dispatch({ type: 'SET_PLAYHEAD', playheadMs: 800 });
    });

    expect(spy).toHaveBeenCalledTimes(1);

    act(() => {
      studioStore.dispatch({ type: 'UPDATE_DOCUMENT_NAME', name: 'Renamed project' });
    });

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
