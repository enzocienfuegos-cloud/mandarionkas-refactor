import React from 'react';
import type { ReportingKpi } from '../reporting.types';
import { KpiCard } from './KpiCard';

export function KpiGrid({ kpis }: { kpis: ReportingKpi[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      {kpis.map((item) => (
        <KpiCard key={item.id} item={item} />
      ))}
    </section>
  );
}
