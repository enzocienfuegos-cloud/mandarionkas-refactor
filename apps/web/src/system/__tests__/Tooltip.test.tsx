import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Tooltip } from '../primitives/Tooltip';
import { DataTable, type ColumnDef } from '../data-table/DataTable';

describe('Tooltip', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

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
  });

  it('appears on keyboard focus', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Keyboard hint">
        Status
      </Tooltip>,
    );
    fireEvent.focus(screen.getByText('Status'));
    act(() => {
      vi.advanceTimersByTime(210);
    });
    expect(screen.getByRole('tooltip').textContent).toContain('Keyboard hint');
  });

  it('supports asChild without introducing a wrapper', () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Action help" asChild>
        <button type="button">Action</button>
      </Tooltip>,
    );

    const button = screen.getByRole('button', { name: 'Action' });
    expect(button.parentElement?.tagName).not.toBe('SPAN');

    fireEvent.mouseEnter(button);
    act(() => {
      vi.advanceTimersByTime(210);
    });
    expect(screen.getByRole('tooltip').textContent).toContain('Action help');
  });

  it('renders a tooltip from inside a horizontally scrollable DataTable without clipping', () => {
    vi.useFakeTimers();
    const columns: ColumnDef<{ id: string; name: string }>[] = [
      {
        id: 'name',
        header: 'Name',
        width: '420px',
        cell: (row) => (
          <Tooltip content={`Row ${row.name}`} asChild>
            <button type="button">{row.name}</button>
          </Tooltip>
        ),
      },
      {
        id: 'secondary',
        header: 'Secondary',
        width: '420px',
        cell: () => 'Filler',
      },
    ];

    const { container } = render(
      <div style={{ width: 320 }}>
        <DataTable
          columns={columns}
          data={[{ id: '1', name: 'Alpha' }]}
          rowKey={(row) => row.id}
        />
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'Alpha' });
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(210);
    });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Row Alpha');
    expect(container.contains(tooltip)).toBe(false);
  });
});
