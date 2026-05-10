import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DateRangePicker, type DateRange } from '../primitives/DateRangePicker';

const MAY_1 = new Date('2026-05-01T12:00:00.000Z');
const MAY_7 = new Date('2026-05-07T12:00:00.000Z');
const APR_1 = new Date('2026-04-01T12:00:00.000Z');
const APR_7 = new Date('2026-04-07T12:00:00.000Z');

function DateRangeHarness({
  initialValue,
  showComparison = false,
  presets,
  weekStartsOn,
}: {
  initialValue: DateRange;
  showComparison?: boolean;
  presets?: Array<{ label: string; from: Date; to: Date }>;
  weekStartsOn?: 0 | 1;
}) {
  const [value, setValue] = useState<DateRange>(initialValue);
  const [comparisonValue, setComparisonValue] = useState<DateRange>({
    from: APR_1,
    to: APR_7,
  });

  return (
    <DateRangePicker
      value={value}
      onChange={setValue}
      showComparison={showComparison}
      presets={presets}
      weekStartsOn={weekStartsOn}
      comparisonValue={comparisonValue}
      onComparisonChange={setComparisonValue}
    />
  );
}

describe('DateRangePicker', () => {
  it('applies preset ranges from the left rail', () => {
    render(
      <DateRangeHarness
        initialValue={{
          from: MAY_1,
          to: MAY_7,
        }}
        presets={[{ label: 'Custom window', from: new Date('2026-05-20T12:00:00.000Z'), to: new Date('2026-05-22T12:00:00.000Z') }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /may 1, 2026 - may 7, 2026/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Custom window' }));

    expect(screen.getByRole('button', { name: /may 20, 2026 - may 22, 2026/i })).toBeTruthy();
  });

  it('supports drag selection across days', () => {
    render(
      <DateRangeHarness
        initialValue={{
          from: MAY_1,
          to: MAY_7,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /may 1, 2026 - may 7, 2026/i }));

    const twelves = screen.getAllByRole('button', { name: '12' });
    const fourteens = screen.getAllByRole('button', { name: '14' });

    fireEvent.mouseDown(twelves[0], { button: 0 });
    fireEvent.mouseEnter(fourteens[0]);
    fireEvent.mouseUp(fourteens[0]);

    expect(screen.getByRole('button', { name: /may 12, 2026 - may 14, 2026/i })).toBeTruthy();
  });

  it('routes edits to the comparison range when comparison mode is active', () => {
    render(
      <DateRangeHarness
        showComparison
        initialValue={{
          from: MAY_1,
          to: MAY_7,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /may 1, 2026 - may 7, 2026/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Last 30 days' }));

    expect(screen.queryByText(/apr 1, 2026 - apr 7, 2026/i)).toBeNull();
    expect(screen.getAllByText(/comparison/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /may 1, 2026 - may 7, 2026/i })).toBeTruthy();
  });

  it('supports monday-first weekday labels', () => {
    render(
      <DateRangeHarness
        initialValue={{
          from: MAY_1,
          to: MAY_7,
        }}
        weekStartsOn={1}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /may 1, 2026 - may 7, 2026/i }));
    const weekdayHeaders = screen
      .getAllByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/)
      .map((entry) => entry.textContent);

    expect(weekdayHeaders[0]).toBe('Mon');
  });
});
