import React from 'react';
import { Badge, EmptyState } from '../../../system';
import type { InventorySourceRow } from '../reporting.types';
import { WidgetPanel } from './WidgetPanel';

export function InventorySources({ rows }: { rows: InventorySourceRow[] }) {
  return (
    <WidgetPanel title="Sites & apps" icon="geo" tone="slate">
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={`${row.kind}:${row.name}`}
              className="flex flex-col gap-3 rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-start gap-2">
                  <p
                    className="min-w-0 max-w-full break-words font-semibold leading-snug text-[color:var(--dusk-text-primary)]"
                    title={row.name}
                  >
                    {row.name}
                  </p>
                  <Badge tone={row.kind === 'App' ? 'info' : 'neutral'} size="sm">{row.kind}</Badge>
                </div>
                <p
                  className="mt-1 break-words text-xs leading-relaxed text-[color:var(--dusk-text-soft)]"
                  title={row.detail}
                >
                  {row.impressions.toLocaleString()} impressions{row.detail ? ` · ${row.detail}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="font-bold text-[color:var(--dusk-text-primary)]">{row.metric}</p>
                <p className="text-xs text-[color:var(--dusk-text-soft)]">{row.metricLabel ?? 'Metric'} · {row.share} share</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No site or app signal yet"
          description="Domain and app data will appear once the selected reporting scope records inventory context."
        />
      )}
    </WidgetPanel>
  );
}
