import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Tooltip } from '../primitives/Tooltip';

describe('Tooltip', () => {
  it('stays hidden until hover', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Last sync 2 minutes ago">
        <button type="button">Status</button>
      </Tooltip>,
    );

    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Status' }));
    act(() => {
      vi.advanceTimersByTime(210);
    });
    expect(screen.getByRole('tooltip').textContent).toContain('Last sync 2 minutes ago');
    vi.useRealTimers();
  });

  it('dismisses on mouse leave', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Last sync 2 minutes ago">
        <button type="button">Status</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Status' });
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(210);
    });
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
    vi.useRealTimers();
  });

  it('does not render when disabled', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Hidden" disabled>
        <button type="button">Status</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Status' }));
    act(() => {
      vi.advanceTimersByTime(210);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
    vi.useRealTimers();
  });

  it('appears on keyboard focus', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Keyboard hint">
        <button type="button">Status</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole('button', { name: 'Status' }));
    act(() => {
      vi.advanceTimersByTime(210);
    });
    expect(screen.getByRole('tooltip').textContent).toContain('Keyboard hint');
    vi.useRealTimers();
  });
});
