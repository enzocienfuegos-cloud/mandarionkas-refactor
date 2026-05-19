import { describe, expect, it, vi } from 'vitest';
import { createHistoryManager } from '../../core/history/history-manager';

describe('createHistoryManager', () => {
  it('stores immutable snapshots by reference', () => {
    const history = createHistoryManager<{ count: number; nested: { ok: boolean } }>(5);
    const snap1 = { count: 1, nested: { ok: true } };
    const snap2 = { count: 2, nested: { ok: false } };
    history.record(snap1);
    history.record(snap2);

    const prev = history.undo();
    expect(prev).toBe(snap1);

    const redo = history.redo();
    expect(redo).toBe(snap2);
  });

  it('never calls structuredClone while recording or navigating history', () => {
    const cloneSpy = vi.spyOn(globalThis, 'structuredClone');
    const history = createHistoryManager<{ id: number }>(5);

    history.record({ id: 1 });
    history.record({ id: 2 });
    history.record({ id: 3 });
    history.undo();
    history.undo();
    history.redo();

    expect(cloneSpy).not.toHaveBeenCalled();
    cloneSpy.mockRestore();
  });

  it('respects max entries', () => {
    const history = createHistoryManager<{ step: number }>(2);
    history.record({ step: 1 });
    history.record({ step: 2 });
    history.record({ step: 3 });

    expect(history.canUndo()).toBe(true);
    expect(history.undo()).toEqual({ step: 2 });
    expect(history.undo()).toBeNull();
  });

  it('resets history around a new seed snapshot', () => {
    const history = createHistoryManager<{ step: number }>(5);
    history.record({ step: 1 });
    history.record({ step: 2 });

    history.reset({ step: 9 });

    expect(history.canUndo()).toBe(false);
    expect(history.undo()).toBeNull();
    history.record({ step: 10 });
    expect(history.undo()).toEqual({ step: 9 });
  });
});
