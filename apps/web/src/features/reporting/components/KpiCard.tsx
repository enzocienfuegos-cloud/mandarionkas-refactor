import React from 'react';
import type { ReportingKpi, Tone } from '../reporting.types';
import { Sparkline as DuskSparkline } from '../../../system';
import { BrandIcon } from '../icons/BrandIcon';

const toneText: Record<Tone, string> = {
  fuchsia: 'text-fuchsia-300',
  violet: 'text-violet-300',
  blue: 'text-blue-300',
  cyan: 'text-cyan-300',
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
  slate: 'text-slate-300',
};

export function KpiCard({ item }: { item: ReportingKpi }) {
  return (
    <section className="rounded-[18px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.032))] p-4 shadow-[0_24px_80px_rgba(0,0,0,.23)] backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <BrandIcon name={item.icon as any} tone={item.tone} compact size={15} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-400">{item.label}</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-white">{item.value}</p>
        </div>
      </div>
      {item.delta ? (
        <p className={`mt-2 text-xs font-bold ${item.direction === 'down' ? 'text-rose-300' : item.direction === 'flat' ? 'text-slate-300' : 'text-emerald-300'}`}>
          {item.delta}
          <span className="ml-1 font-medium text-slate-500">{item.comparisonLabel}</span>
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
      {item.helper ? <p className="mt-2 text-xs text-slate-500">{item.helper}</p> : null}
    </section>
  );
}
