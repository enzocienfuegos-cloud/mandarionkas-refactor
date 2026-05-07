import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Heatmap } from '../charts/Heatmap';

describe('Heatmap', () => {
  it('renders the full grid dimensions', () => {
    render(
      <Heatmap
        xLabels={['Mon', 'Tue']}
        yLabels={['Publisher A', 'Publisher B']}
        cells={[{ x: 'Mon', y: 'Publisher A', value: 1 }]}
      />,
    );
    expect(screen.getByText('Publisher A')).toBeTruthy();
    expect(screen.getByText('Tue')).toBeTruthy();
    expect(screen.getAllByRole('button').length).toBe(4);
  });

  it('renders empty state for all-zero data', () => {
    render(
      <Heatmap
        xLabels={['Mon']}
        yLabels={['Publisher A']}
        cells={[{ x: 'Mon', y: 'Publisher A', value: 0 }]}
      />,
    );
    expect(screen.getByText('No heatmap data yet')).toBeTruthy();
  });

  it('shows tooltip content on hover', () => {
    vi.useFakeTimers();
    render(
      <Heatmap
        xLabels={['Mon']}
        yLabels={['Publisher A']}
        cells={[{ x: 'Mon', y: 'Publisher A', value: 0.8 }]}
        format={(value) => `${value.toFixed(1)}%`}
      />,
    );
    const cell = screen.getByRole('button', { name: 'Publisher A Mon 0.8%' });
    fireEvent.mouseEnter(cell);
    act(() => {
      vi.advanceTimersByTime(210);
    });
    expect(screen.getByRole('tooltip').textContent).toContain('Publisher A · Mon: 0.8%');
    vi.useRealTimers();
  });
});
