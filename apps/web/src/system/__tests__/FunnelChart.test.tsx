import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FunnelChart } from '../charts/FunnelChart';

describe('FunnelChart', () => {
  it('renders stages and values', () => {
    render(
      <FunnelChart
        stages={[
          { id: 'impressions', label: 'Impressions', value: 10000 },
          { id: 'clicks', label: 'Clicks', value: 320 },
        ]}
      />,
    );
    expect(screen.getByText('Impressions')).toBeTruthy();
    expect(screen.getByText('320')).toBeTruthy();
  });

  it('shows drop-off chips by default', () => {
    render(
      <FunnelChart
        stages={[
          { id: 'impressions', label: 'Impressions', value: 10000 },
          { id: 'clicks', label: 'Clicks', value: 320 },
        ]}
      />,
    );
    expect(screen.getByText(/drop-off/)).toBeTruthy();
  });

  it('renders empty state when base value is zero', () => {
    render(
      <FunnelChart
        stages={[{ id: 'impressions', label: 'Impressions', value: 0 }]}
      />,
    );
    expect(screen.getByText('No funnel data yet')).toBeTruthy();
  });
});
