import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DonutChart } from '../charts/DonutChart';

describe('DonutChart', () => {
  it('renders segment legend and percentages', () => {
    render(
      <DonutChart
        segments={[
          { id: 'live', label: 'Live', value: 6, tone: 'success' },
          { id: 'review', label: 'Review', value: 4, tone: 'warning' },
        ]}
      />,
    );
    expect(screen.getByText(/Live/)).toBeTruthy();
    expect(screen.getByText(/6 · 60%/)).toBeTruthy();
  });

  it('skips zero-value segments', () => {
    render(
      <DonutChart
        segments={[
          { id: 'live', label: 'Live', value: 6 },
          { id: 'zero', label: 'Zero', value: 0 },
        ]}
      />,
    );
    expect(screen.queryByText('Zero')).toBeNull();
  });

  it('renders empty state for all-zero data', () => {
    render(
      <DonutChart
        segments={[
          { id: 'live', label: 'Live', value: 0 },
          { id: 'review', label: 'Review', value: 0 },
        ]}
      />,
    );
    expect(screen.getByText('No distribution data yet')).toBeTruthy();
  });

  it('renders center labels and svg a11y metadata', () => {
    const { container } = render(
      <DonutChart
        title="Status mix"
        description="Campaign distribution"
        centerLabel="10"
        centerSubLabel="campaigns"
        segments={[{ id: 'live', label: 'Live', value: 10 }]}
      />,
    );
    expect(screen.getByText('10')).toBeTruthy();
    expect(container.querySelector('title')?.textContent).toBe('Status mix');
    expect(container.querySelector('desc')?.textContent).toBe('Campaign distribution');
  });
});
