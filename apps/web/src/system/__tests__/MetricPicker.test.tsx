import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MetricPicker } from '../metrics/MetricPicker';

const available = [
  {
    definition: {
      id: 'spend',
      label: 'Spend',
      description: 'Spend description',
      group: 'Budget',
      tone: 'info' as const,
      compute: () => null,
    },
    resolved: { id: 'spend', label: 'Spend', value: '$10', tone: 'info' as const },
  },
  {
    definition: {
      id: 'impressions',
      label: 'Impressions',
      description: 'Impressions description',
      group: 'Delivery',
      tone: 'brand' as const,
      compute: () => null,
    },
    resolved: { id: 'impressions', label: 'Impressions', value: '100', tone: 'brand' as const },
  },
];

describe('MetricPicker', () => {
  it('opens and toggles items', () => {
    const onToggle = vi.fn();
    render(
      <MetricPicker
        available={available}
        selectedIds={['spend']}
        onToggle={onToggle}
        onReset={() => {}}
        isCustomized={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Customize/i }));
    fireEvent.click(screen.getByRole('button', { name: /Impressions/i }));
    expect(onToggle).toHaveBeenCalledWith('impressions');
  });

  it('resets selection', () => {
    const onReset = vi.fn();
    render(
      <MetricPicker
        available={available}
        selectedIds={['spend']}
        onToggle={() => {}}
        onReset={onReset}
        isCustomized
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Customize/i }));
    fireEvent.click(screen.getByRole('button', { name: /Reset/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
