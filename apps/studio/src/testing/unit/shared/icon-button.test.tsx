import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IconButton } from '../../../shared/ui/IconButton';

describe('IconButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not expose aria-pressed unless explicitly provided', () => {
    const root = create(
      <IconButton
        label="Go back"
        icon={<span aria-hidden="true">x</span>}
      />,
    );

    expect(root.root.findByType('button').props['aria-pressed']).toBeUndefined();
  });

  it('exposes aria-pressed when used as a toggle control', () => {
    const root = create(
      <IconButton
        label="Toggle rulers"
        pressed
        isActive
        icon={<span aria-hidden="true">x</span>}
      />,
    );

    expect(root.root.findByType('button').props['aria-pressed']).toBe(true);
  });

  it('passes tooltip placement through to the shared tooltip shell', () => {
    let root: ReactTestRenderer;

    act(() => {
      root = create(
        <IconButton
          label="Zoom in"
          tooltipPlacement="bottom"
          icon={<span aria-hidden="true">+</span>}
        />,
      );
    });

    const button = root!.root.findByType('button');

    act(() => {
      button.props.onPointerEnter({ pointerType: 'mouse' });
      vi.advanceTimersByTime(400);
    });

    const tooltip = root!.root.findByProps({ role: 'tooltip' });
    expect(tooltip.props.className).toContain('tooltip-bubble--bottom');
    expect(tooltip.props.hidden).toBe(false);
  });
});
