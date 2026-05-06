import React from 'react';
import { identityTypeRows } from '../reporting.mock';
import { WidgetPanel } from './WidgetPanel';

export function IdentityInsights() {
  return (
    <WidgetPanel title="Identity insights" icon="identity" tone="emerald">
      <div className="space-y-3">
        {identityTypeRows.map((row) => (
          <div key={row.key} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-3">
            <div>
              <p className="font-semibold text-white">{row.key.replace(/_/g, ' ')}</p>
              <p className="text-xs text-slate-500">{row.value.toLocaleString()} matched events</p>
            </div>
            <span className="text-sm font-bold text-emerald-300">{row.percentage}%</span>
          </div>
        ))}
      </div>
    </WidgetPanel>
  );
}
