import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip, resolveTooltipPosition } from '../../../shared/ui/Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows after the configured delay and hides on pointer leave', () => {
    let root: ReactTestRenderer;

    act(() => {
      root = create(
        <Tooltip content="Helpful hint">
          <button type="button">Hover me</button>
        </Tooltip>,
      );
    });

    const button = root!.root.findByType('button');
    const initialTooltip = root!.root.findByProps({ role: 'tooltip' });
    expect(initialTooltip.props.hidden).toBe(true);
    expect(button.props['aria-describedby']).toBeUndefined();

    act(() => {
      button.props.onPointerEnter({ pointerType: 'mouse' });
    });

    expect(root!.root.findByProps({ role: 'tooltip' }).props.hidden).toBe(true);

    act(() => {
      vi.advanceTimersByTime(399);
    });

    expect(root!.root.findByProps({ role: 'tooltip' }).props.hidden).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const tooltip = root!.root.findByProps({ role: 'tooltip' });
    expect(tooltip.props.className).toContain('tooltip-bubble--top');
    expect(tooltip.props.hidden).toBe(false);
    expect(tooltip.children).toEqual(['Helpful hint']);
    expect(root!.root.findByType('button').props['aria-describedby']).toBeTruthy();

    act(() => {
      button.props.onPointerLeave({ pointerType: 'mouse' });
    });

    expect(root!.root.findByProps({ role: 'tooltip' }).props.hidden).toBe(true);
  });

  it('does not open on touch pointer enter by default', () => {
    const root = create(
      <Tooltip content="Helpful hint">
        <button type="button">Tap me</button>
      </Tooltip>,
    );

    const button = root.root.findByType('button');

    act(() => {
      button.props.onPointerEnter({ pointerType: 'touch' });
      vi.runAllTimers();
    });

    expect(root.root.findByProps({ role: 'tooltip' }).props.hidden).toBe(true);
  });

  it('returns the child unchanged when disabled', () => {
    const root = create(
      <Tooltip content="Helpful hint" disabled>
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    expect(root.root.findByType('button').children).toEqual(['Hover me']);
    expect(root.root.findAllByProps({ role: 'tooltip' })).toHaveLength(0);
  });

  it('resolves tooltip placement within the viewport', () => {
    expect(resolveTooltipPosition(
      { left: 100, top: 10, right: 140, bottom: 30, width: 40, height: 20 },
      { width: 120, height: 32 },
      'top',
      { width: 320, height: 240 },
    )).toEqual({
      left: 60,
      top: 38,
      placement: 'bottom',
    });
  });
});
