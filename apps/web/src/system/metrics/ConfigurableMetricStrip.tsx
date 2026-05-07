import React from 'react';
import { MetricCard } from '../primitives/MetricCard';
import type { MetricScope } from './registry';
import { MetricIcon } from './icons';
import { MetricPicker } from './MetricPicker';
import { useMetricSelection } from './useMetricSelection';

export interface ConfigurableMetricStripProps<TData> {
  scope: MetricScope<TData>;
  data: TData;
  className?: string;
  maxSelected?: number;
  showPicker?: boolean;
}

export function ConfigurableMetricStrip<TData>({
  scope,
  data,
  className,
  maxSelected = 6,
  showPicker = true,
}: ConfigurableMetricStripProps<TData>) {
  const { cards, available, selectedIds, toggle, reset, isCustomized } = useMetricSelection(scope, data);

  const gridClass = cards.length <= 4
    ? 'grid gap-5 xl:grid-cols-4'
    : cards.length === 5
      ? 'grid gap-4 xl:grid-cols-5'
      : 'grid gap-4 xl:grid-cols-6';

  return (
    <div className={className}>
      {showPicker ? (
        <div className="mb-3 flex items-center justify-end">
          <MetricPicker
            available={available}
            selectedIds={selectedIds}
            onToggle={toggle}
            onReset={reset}
            isCustomized={isCustomized}
            maxSelected={maxSelected}
          />
        </div>
      ) : null}
      <div className={gridClass}>
        {cards.map((card) => (
          <MetricCard
            key={card.id}
            label={card.label}
            value={card.value}
            delta={card.delta}
            trend={card.direction}
            context={card.context}
            series={card.series}
            tone={card.tone}
            icon={card.icon ? <MetricIcon icon={card.icon} /> : undefined}
          />
        ))}
      </div>
    </div>
  );
}
