import React from 'react';
import type { ReportingKpi, Tone } from '../reporting.types';
import { Sparkline as DuskSparkline } from '../../../system';
import { BrandIcon } from '../icons/BrandIcon';

const toneText: Record<Tone, string> = {
  fuchsia: 'text-text-brand',
  violet: 'text-[color:var(--dusk-status-info-fg)]',
  blue: 'text-[color:var(--dusk-status-info-fg)]',
  cyan: 'text-[color:var(--dusk-status-info-fg)]',
  emerald: 'text-[color:var(--dusk-status-success-fg)]',
  amber: 'text-[color:var(--dusk-status-warning-fg)]',
  rose: 'text-[color:var(--dusk-status-critical-fg)]',
  slate: 'text-[color:var(--dusk-text-secondary)]',
};

export function KpiCard({ item }: { item: ReportingKpi }) {
  return (
    <section className="rounded-[18px] border border-[color:var(--dusk-border-default)] bg-surface-1 p-4 shadow-2 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <BrandIcon name={item.icon as any} tone={item.tone} compact size={15} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-[color:var(--dusk-text-muted)]">{item.label}</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-[color:var(--dusk-text-primary)]">{item.value}</p>
        </div>
      </div>
      {item.delta ? (
        <p className={`mt-2 text-xs font-bold ${item.direction === 'down' ? 'text-[color:var(--dusk-status-critical-fg)]' : item.direction === 'flat' ? 'text-[color:var(--dusk-text-secondary)]' : 'text-[color:var(--dusk-status-success-fg)]'}`}>
          {item.delta}
          <span className="ml-1 font-medium text-[color:var(--dusk-text-soft)]">{item.comparisonLabel}</span>
        </p>
      ) : null}
      {item.sparkline ? (
        <DuskSparkline
          series={item.sparkline}
          tone={
            item.tone === 'fuchsia'
              ? 'brand'
              : item.tone === 'emerald'
                ? 'success'
                : item.tone === 'amber'
                  ? 'warning'
                  : item.tone === 'rose'
                    ? 'critical'
                    : item.tone === 'blue' || item.tone === 'cyan' || item.tone === 'violet'
                      ? 'info'
                      : 'neutral'
          }
          className={`mt-3 h-8 w-full ${toneText[item.tone]}`}
        />
      ) : null}
      {item.helper ? <p className="mt-2 text-xs text-[color:var(--dusk-text-soft)]">{item.helper}</p> : null}
    </section>
  );
}
