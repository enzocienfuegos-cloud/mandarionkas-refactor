import { describe, expect, it } from 'vitest';
import { createHistoryManager } from '../../core/history/history-manager';

describe('createHistoryManager', () => {
  it('undos and redoes snapshots safely', () => {
    const history = createHistoryManager<{ count: number; nested: { ok: boolean } }>(5);
    history.record({ count: 1, nested: { ok: true } });
    history.record({ count: 2, nested: { ok: false } });

    const prev = history.undo();
    expect(prev).toEqual({ count: 1, nested: { ok: true } });

    prev!.nested.ok = false;
    const redo = history.redo();
    expect(redo).toEqual({ count: 2, nested: { ok: false } });
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
