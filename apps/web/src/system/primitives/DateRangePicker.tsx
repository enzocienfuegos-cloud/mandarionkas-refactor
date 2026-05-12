import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from '../icons';
import { cn } from '../cn';
import { Button } from './Button';
import { Popover } from './Popover';
import { Panel } from './Panel';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  showPresets?: boolean;
  presets?: Array<{ label: string; from: Date; to: Date }>;
  showComparison?: boolean;
  comparisonValue?: DateRange;
  onComparisonChange?: (range: DateRange) => void;
  minDate?: Date;
  maxDate?: Date;
  locale?: string;
  weekStartsOn?: 0 | 1;
  triggerLabel?: (range: DateRange) => string;
}

type CalendarDay = {
  date: Date;
  inMonth: boolean;
};

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function isSameDay(left: Date | null, right: Date | null) {
  if (!left || !right) return false;
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

function isBetween(value: Date, from: Date | null, to: Date | null) {
  if (!from || !to) return false;
  const target = startOfDay(value).getTime();
  return target > startOfDay(from).getTime() && target < startOfDay(to).getTime();
}

function clampDate(value: Date, minDate?: Date, maxDate?: Date) {
  const next = startOfDay(value);
  if (minDate && next < startOfDay(minDate)) return startOfDay(minDate);
  if (maxDate && next > startOfDay(maxDate)) return startOfDay(maxDate);
  return next;
}

function monthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, delta: number) {
  return new Date(value.getFullYear(), value.getMonth() + delta, 1);
}

function buildMonthGrid(baseDate: Date, weekStartsOn = 0): CalendarDay[] {
  const first = monthStart(baseDate);
  const startOffset = (first.getDay() - weekStartsOn + 7) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      inMonth: date.getMonth() === baseDate.getMonth(),
    };
  });
}

function getQuarterRange(baseDate: Date) {
  const quarter = Math.floor(baseDate.getMonth() / 3);
  const from = new Date(baseDate.getFullYear(), quarter * 3, 1);
  const to = new Date(baseDate.getFullYear(), quarter * 3 + 3, 0);
  return { from, to };
}

function getLastQuarterRange(baseDate: Date) {
  const currentQuarter = Math.floor(baseDate.getMonth() / 3);
  const quarterStartMonth = (currentQuarter - 1 + 4) % 4 * 3;
  const year = currentQuarter === 0 ? baseDate.getFullYear() - 1 : baseDate.getFullYear();
  return {
    from: new Date(year, quarterStartMonth, 1),
    to: new Date(year, quarterStartMonth + 3, 0),
  };
}

function defaultPresets(now = new Date()) {
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const last7 = new Date(today);
  last7.setDate(today.getDate() - 6);
  const last14 = new Date(today);
  last14.setDate(today.getDate() - 13);
  const last30 = new Date(today);
  last30.setDate(today.getDate() - 29);
  const thisMonth = {
    from: new Date(today.getFullYear(), today.getMonth(), 1),
    to: new Date(today.getFullYear(), today.getMonth() + 1, 0),
  };
  const lastMonth = {
    from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
    to: new Date(today.getFullYear(), today.getMonth(), 0),
  };
  return [
    { label: 'Today', from: today, to: today },
    { label: 'Yesterday', from: yesterday, to: yesterday },
    { label: 'Last 7 days', from: last7, to: today },
    { label: 'Last 14 days', from: last14, to: today },
    { label: 'Last 30 days', from: last30, to: today },
    { label: 'This month', from: thisMonth.from, to: thisMonth.to },
    { label: 'Last month', from: lastMonth.from, to: lastMonth.to },
    { label: 'This quarter', ...getQuarterRange(today) },
    { label: 'Last quarter', ...getLastQuarterRange(today) },
  ];
}

function toRangeLabel(range: DateRange, formatter: Intl.DateTimeFormat) {
  if (!range.from && !range.to) return 'Select range';
  if (range.from && !range.to) return `From ${formatter.format(range.from)}`;
  if (!range.from && range.to) return `Until ${formatter.format(range.to)}`;
  return `${formatter.format(range.from!)} - ${formatter.format(range.to!)}`;
}

function renderWeekdayLabels(locale: string, weekStartsOn: 0 | 1) {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const sunday = weekStartsOn === 1 ? new Date(2026, 0, 5) : new Date(2026, 0, 4);
  return Array.from({ length: 7 }, (_, index) => {
    const value = new Date(sunday);
    value.setDate(sunday.getDate() + index);
    return formatter.format(value);
  });
}

function normalizeRange(range: DateRange, minDate?: Date, maxDate?: Date): DateRange {
  const from = range.from ? clampDate(range.from, minDate, maxDate) : null;
  const to = range.to ? clampDate(range.to, minDate, maxDate) : null;
  if (from && to && to < from) {
    return { from: to, to: from };
  }
  return { from, to };
}

export function DateRangePicker({
  value,
  onChange,
  showPresets = true,
  presets,
  showComparison = false,
  comparisonValue,
  onComparisonChange,
  minDate,
  maxDate,
  locale = 'en-US',
  weekStartsOn = 0,
  triggerLabel,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [selectingComparison, setSelectingComparison] = useState(false);
  const [dragAnchor, setDragAnchor] = useState<Date | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const ignoreClickRef = useRef(false);

  const baseDate = value.from ?? new Date();
  const [visibleMonth, setVisibleMonth] = useState(monthStart(baseDate));
  const rightMonth = useMemo(() => addMonths(visibleMonth, 1), [visibleMonth]);
  const activePresets = useMemo(() => presets ?? defaultPresets(), [presets]);
  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }),
    [locale],
  );
  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
    [locale],
  );
  const weekdayLabels = useMemo(() => renderWeekdayLabels(locale, weekStartsOn), [locale, weekStartsOn]);
  const label = triggerLabel ? triggerLabel(value) : toRangeLabel(value, formatter);

  const draftRange = useMemo(() => {
    if (dragAnchor && hoverDate) {
      return hoverDate < dragAnchor
        ? { from: hoverDate, to: dragAnchor }
        : { from: dragAnchor, to: hoverDate };
    }
    if (!value.from || value.to || !hoverDate) return value;
    return hoverDate < value.from
      ? { from: hoverDate, to: value.from }
      : { from: value.from, to: hoverDate };
  }, [dragAnchor, hoverDate, value]);

  const commitRange = (next: DateRange, options: { preserveInteraction?: boolean } = {}) => {
    const normalizedNext = normalizeRange(next, minDate, maxDate);
    const nextAnchorMonth = normalizedNext.from ?? normalizedNext.to ?? new Date();
    setVisibleMonth(monthStart(nextAnchorMonth));
    if (!options.preserveInteraction) {
      setHoverDate(null);
      setDragAnchor(null);
      setIsDragging(false);
    }
    if (selectingComparison && onComparisonChange) {
      onComparisonChange(normalizedNext);
    } else {
      onChange(normalizedNext);
    }
  };

  const activeRange = selectingComparison ? (comparisonValue ?? { from: null, to: null }) : value;

  const selectDate = (nextDate: Date) => {
    const next = clampDate(nextDate, minDate, maxDate);
    const current = activeRange;

    if (!current.from || (current.from && current.to)) {
      commitRange({ from: next, to: null });
      return;
    }

    if (next < current.from) {
      commitRange({ from: next, to: current.from });
      return;
    }

    commitRange({ from: current.from, to: next });
  };

  const finishDragSelection = (nextDate?: Date) => {
    if (!dragAnchor) return;

    const target = clampDate(nextDate ?? hoverDate ?? dragAnchor, minDate, maxDate);
    const nextRange = target < dragAnchor
      ? { from: target, to: dragAnchor }
      : { from: dragAnchor, to: target };

    commitRange(nextRange);
    ignoreClickRef.current = true;
    setDragAnchor(null);
    setHoverDate(null);
    setIsDragging(false);
  };

  useEffect(() => {
    if (!isDragging) return undefined;

    const handleMouseUp = () => finishDragSelection();
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging, hoverDate, dragAnchor]);

  useEffect(() => {
    if (!open) return;
    setVisibleMonth(monthStart(value.from ?? value.to ?? new Date()));
  }, [open, value.from, value.to]);

  const renderCalendar = (monthDate: Date) => {
    const days = buildMonthGrid(monthDate, weekStartsOn);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">{monthFormatter.format(monthDate)}</p>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-kicker text-text-soft">
          {weekdayLabels.map((labelEntry) => (
            <span key={labelEntry}>{labelEntry}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const disabled = (minDate && day.date < startOfDay(minDate)) || (maxDate && day.date > startOfDay(maxDate));
            const selectedStart = isSameDay(day.date, draftRange.from);
            const selectedEnd = isSameDay(day.date, draftRange.to);
            const inRange = isBetween(day.date, draftRange.from, draftRange.to);

            return (
              <button
                key={day.date.toISOString()}
                type="button"
                disabled={disabled}
                onMouseDown={(event) => {
                  if (disabled || event.button !== 0) return;
                  const next = clampDate(day.date, minDate, maxDate);
                  setDragAnchor(next);
                  setHoverDate(next);
                  setIsDragging(true);
                  commitRange({ from: next, to: null }, { preserveInteraction: true });
                }}
                onMouseEnter={() => {
                  if (disabled) return;
                  setHoverDate(day.date);
                }}
                onMouseLeave={() => {
                  if (!isDragging) {
                    setHoverDate(null);
                  }
                }}
                onMouseUp={() => {
                  if (!disabled && isDragging) {
                    finishDragSelection(day.date);
                  }
                }}
                onClick={() => {
                  if (ignoreClickRef.current) {
                    ignoreClickRef.current = false;
                    return;
                  }
                  selectDate(day.date);
                }}
                className={cn(
                  'flex h-9 items-center justify-center rounded-lg text-sm transition-colors',
                  !day.inMonth && 'text-text-soft',
                  day.inMonth && 'text-text-secondary',
                  (selectedStart || selectedEnd) && 'bg-brand-500 text-text-inverse',
                  inRange && 'bg-[color:var(--dusk-surface-active)] text-text-primary',
                  !disabled && !(selectedStart || selectedEnd) && !inRange && 'hover:bg-surface-hover hover:text-text-primary',
                  disabled && 'cursor-not-allowed opacity-40',
                )}
                aria-pressed={selectedStart || selectedEnd}
              >
                {day.date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="relative inline-flex">
      <Button
        ref={anchorRef}
        variant="secondary"
        leadingIcon={<CalendarDays />}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </Button>

      <Popover
        open={open}
        anchorRef={anchorRef}
        onClose={() => {
          setOpen(false);
          setHoverDate(null);
          setDragAnchor(null);
          setIsDragging(false);
        }}
        className="w-[min(980px,calc(100vw-2rem))]"
      >
        <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
          {showPresets ? (
            <div className="space-y-3 border-b border-border-subtle pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-4">
              <div>
                <p className="text-sm font-semibold text-text-primary">Presets</p>
                <p className="mt-1 text-xs text-text-muted">Jump to common reporting windows.</p>
              </div>
              <div className="space-y-1">
                {activePresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => commitRange({ from: preset.from, to: preset.to })}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {showComparison && onComparisonChange ? (
                <Panel padding="sm" className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Comparison</p>
                      <p className="text-xs text-text-muted">
                        {toRangeLabel(comparisonValue ?? { from: null, to: null }, formatter)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={selectingComparison ? 'primary' : 'ghost'}
                      onClick={() => setSelectingComparison((current) => !current)}
                    >
                      {selectingComparison ? 'Editing' : 'Edit'}
                    </Button>
                  </div>
                </Panel>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {selectingComparison ? 'Select comparison range' : 'Select primary range'}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {toRangeLabel(activeRange, formatter)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" leadingIcon={<ChevronLeft />} onClick={() => setVisibleMonth((current) => addMonths(current, -1))}>
                  Prev
                </Button>
                <Button variant="ghost" size="sm" trailingIcon={<ChevronRight />} onClick={() => setVisibleMonth((current) => addMonths(current, 1))}>
                  Next
                </Button>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {renderCalendar(visibleMonth)}
              {renderCalendar(rightMonth)}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
              <div className="text-xs text-text-muted">
                Click once to set start, again to set end, or drag across dates to select a range.
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => commitRange({ from: null, to: null })}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setOpen(false)}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Popover>
    </div>
  );
}
