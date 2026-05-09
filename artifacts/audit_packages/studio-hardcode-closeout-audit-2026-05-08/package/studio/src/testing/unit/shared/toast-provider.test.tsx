import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../../../shared/ui/ToastProvider';

function ToastConsumer({ onReady }: { onReady: ReturnType<typeof vi.fn> }): JSX.Element {
  const toast = useToast();
  onReady(toast);
  return null;
}

describe('ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws when useToast is used outside the provider', () => {
    expect(() => create(<ToastConsumer onReady={vi.fn()} />)).toThrow('useToast must be used within a ToastProvider');
  });

  it('renders and auto-dismisses pushed toasts', () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    let root: ReactTestRenderer;

    act(() => {
      root = create(
        <ToastProvider>
          <ToastConsumer onReady={onReady} />
        </ToastProvider>,
      );
    });

    const controls = onReady.mock.calls.at(-1)?.[0] as ReturnType<typeof useToast>;

    act(() => {
      controls.pushToast({
        title: 'Saved',
        description: 'Project saved successfully.',
        tone: 'success',
        durationMs: 100,
      });
    });

    expect(root!.root.findAllByProps({ role: 'status' })).toHaveLength(1);
    expect(root!.root.findByType('strong').children).toEqual(['Saved']);
    expect(root!.root.findByType('span').children).toEqual(['Project saved successfully.']);
    expect(root!.root.findByProps({ 'aria-label': 'Dismiss notification' })).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(root!.root.findAllByProps({ role: 'status' })).toHaveLength(0);
  });

  it('clears pending timers when the provider unmounts', () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    let root: ReactTestRenderer;

    act(() => {
      root = create(
        <ToastProvider>
          <ToastConsumer onReady={onReady} />
        </ToastProvider>,
      );
    });

    const controls = onReady.mock.calls.at(-1)?.[0] as ReturnType<typeof useToast>;

    act(() => {
      controls.pushToast({
        title: 'Saved',
        durationMs: 1000,
      });
    });

    act(() => {
      root!.unmount();
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
