import React from 'react';
import { EmptyState } from '../../../system';
import type { IdentityTypeRow } from '../reporting.types';
import { WidgetPanel } from './WidgetPanel';

export function IdentityInsights({ rows }: { rows: IdentityTypeRow[] }) {
  return (
    <WidgetPanel title="Identity insights" icon="identity" tone="emerald">
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3">
              <div>
                <p className="font-semibold text-[color:var(--dusk-text-primary)]">{row.key.replace(/_/g, ' ')}</p>
                <p className="text-xs text-[color:var(--dusk-text-soft)]">{row.value.toLocaleString()} matched events</p>
              </div>
              <span className="text-sm font-bold text-[color:var(--dusk-status-success-fg)]">{row.percentage}%</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No identity insights yet"
          description="Identity keys will appear here once the selected scope records resolvable user signals."
        />
      )}
    </WidgetPanel>
  );
}
