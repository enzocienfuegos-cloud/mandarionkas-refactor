import React from 'react';
import { EmptyState } from '../primitives/EmptyState';
import { Tooltip } from '../primitives/Tooltip';
import { cn } from '../cn';

export interface HeatmapCell {
  /** X-axis category (e.g. date string). */
  x: string;
  /** Y-axis category (e.g. source/publisher). */
  y: string;
  /** Numeric value (intensity). */
  value: number;
}

export interface HeatmapProps {
  /** Cells to render. Missing (x,y) combos render as empty. */
  cells: HeatmapCell[];
  /** X-axis labels in order. */
  xLabels: string[];
  /** Y-axis labels in order. */
  yLabels: string[];
  /** Color tone. Default 'brand'. */
  tone?: 'brand' | 'success' | 'warning' | 'critical';
  /** Format function for cell value (used in tooltip). */
  format?: (value: number) => string;
  /** Cell height in px. Default 28. */
  cellHeight?: number;
  /** Title (a11y). */
  title?: string;
  description?: string;
  className?: string;
}

const colorVarMap: Record<NonNullable<HeatmapProps['tone']>, string> = {
  brand: 'var(--dusk-brand-500)',
  success: 'var(--dusk-status-success-fg)',
  warning: 'var(--dusk-status-warning-fg)',
  critical: 'var(--dusk-status-critical-fg)',
};

/**
 * Category × day heatmap for spotting repeated operational anomalies without
 * inventing nonexistent granularity. Best used for source/publisher variance,
 * not for fake hour-by-hour telemetry.
 */
export function Heatmap({
  cells,
  xLabels,
  yLabels,
  tone = 'brand',
  format = (value) => value.toLocaleString(),
  cellHeight = 28,
  title,
  description,
  className,
}: HeatmapProps) {
  const max = Math.max(...cells.map((cell) => Math.abs(cell.value)), 0);

  if (cells.length === 0 || max === 0) {
    return (
      <div className={cn('rounded-2xl border border-border-subtle bg-surface-2 p-4', className)}>
        <EmptyState
          title="No heatmap data yet"
          description="This view appears once the current range has non-zero values across sources and dates."
        />
      </div>
    );
  }

  const cellMap = new Map(cells.map((cell) => [`${cell.y}::${cell.x}`, cell.value]));

  return (
    <div
      role="img"
      aria-label={title}
      aria-describedby={description ? `${title ?? 'heatmap'}-desc` : undefined}
      className={cn('overflow-x-auto', className)}
    >
      {description ? <span id={`${title ?? 'heatmap'}-desc`} className="sr-only">{description}</span> : null}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `minmax(132px, auto) repeat(${xLabels.length}, minmax(48px, 1fr))` }}
      >
        <div />
        {xLabels.map((label) => (
          <div key={label} className="px-1 text-center text-[11px] font-medium uppercase tracking-kicker text-text-soft">
            {label}
          </div>
        ))}
        {yLabels.map((yLabel) => (
          <React.Fragment key={yLabel}>
            <div className="flex items-center pr-3 text-sm text-text-secondary">{yLabel}</div>
            {xLabels.map((xLabel) => {
              const value = cellMap.get(`${yLabel}::${xLabel}`) ?? null;
              const intensity = value == null ? 0 : Math.max(0.05, Math.abs(value) / max);
              const background = value == null
                ? 'var(--dusk-surface-muted)'
                : `color-mix(in oklch, ${colorVarMap[tone]} ${(intensity * 100).toFixed(1)}%, transparent)`;
              return (
                <Tooltip
                  key={`${yLabel}-${xLabel}`}
                  content={`${yLabel} · ${xLabel}: ${value == null ? 'No data' : format(value)}`}
                  disabled={false}
                >
                  <button
                    type="button"
                    className="w-full rounded-md border border-border-subtle"
                    style={{ height: `${cellHeight}px`, background }}
                    aria-label={`${yLabel} ${xLabel} ${value == null ? 'No data' : format(value)}`}
                  />
                </Tooltip>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
