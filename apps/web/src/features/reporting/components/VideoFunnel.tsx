import React from 'react';
import { videoFunnelRows } from '../reporting.mock';
import { WidgetPanel } from './WidgetPanel';

export function VideoFunnel() {
  return (
    <WidgetPanel title="Video completion funnel" icon="video" tone="blue">
      <div className="space-y-3">
        {videoFunnelRows.map((row) => (
          <div key={row.id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-semibold text-[color:var(--dusk-text-primary)]">{row.label}</span>
              <span className="text-[color:var(--dusk-text-muted)]">{row.value.toLocaleString()} · {row.rate.toFixed(1)}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[color:var(--dusk-surface-muted)]">
              <div className="h-full rounded-full bg-blue-400" style={{ width: `${row.rate}%` }} />
            </div>
          </div>
        ))}
      </div>
    </WidgetPanel>
  );
}
