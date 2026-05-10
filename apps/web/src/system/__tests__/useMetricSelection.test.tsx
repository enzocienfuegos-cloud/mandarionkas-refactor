import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMetricSelection } from '../metrics/useMetricSelection';
import type { MetricScope } from '../metrics/registry';

const scope: MetricScope<{ enabled: boolean }> = {
  id: 'test-scope',
  defaultIds: ['one', 'two'],
  metrics: [
    {
      id: 'one',
      label: 'One',
      group: 'A',
      tone: 'brand',
      compute: () => ({ id: 'one', label: 'One', value: '1', tone: 'brand' }),
    },
    {
      id: 'two',
      label: 'Two',
      group: 'A',
      tone: 'info',
      compute: ({ enabled }) => enabled ? ({ id: 'two', label: 'Two', value: '2', tone: 'info' }) : null,
    },
  ],
};

describe('useMetricSelection', () => {
  it('loads defaults when nothing is saved', () => {
    window.localStorage.clear();
    const { result } = renderHook(() => useMetricSelection(scope, { enabled: true }));
    expect(result.current.selectedIds).toEqual(['one', 'two']);
    expect(result.current.cards.map((card) => card.id)).toEqual(['one', 'two']);
  });

  it('filters unavailable metrics from cards', () => {
    window.localStorage.clear();
    const { result } = renderHook(() => useMetricSelection(scope, { enabled: false }));
    expect(result.current.available.map((entry) => entry.definition.id)).toEqual(['one']);
    expect(result.current.cards.map((card) => card.id)).toEqual(['one']);
  });

  it('persists toggles and reset', () => {
    window.localStorage.clear();
    const { result } = renderHook(() => useMetricSelection(scope, { enabled: true }));

    act(() => {
      result.current.toggle('two');
    });
    expect(result.current.selectedIds).toEqual(['one']);

    act(() => {
      result.current.reset();
    });
    expect(result.current.selectedIds).toEqual(['one', 'two']);
  });
});
