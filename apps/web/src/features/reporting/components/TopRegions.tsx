import React from 'react';
import { topRegionsRows } from '../reporting.mock';
import { WidgetPanel } from './WidgetPanel';

export function TopRegions() {
  return (
    <WidgetPanel title="Top regions" icon="geo" tone="violet">
      <div className="space-y-3">
        {topRegionsRows.map((row) => (
          <div key={row.name} className="flex items-center justify-between rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3">
            <div>
              <p className="font-semibold text-[color:var(--dusk-text-primary)]">{row.name}</p>
              <p className="text-xs text-[color:var(--dusk-text-soft)]">{row.impressions.toLocaleString()} impressions</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-[color:var(--dusk-text-primary)]">{row.ctr}</p>
              <p className="text-xs text-[color:var(--dusk-text-soft)]">{row.share} share</p>
            </div>
          </div>
        ))}
      </div>
    </WidgetPanel>
  );
}
