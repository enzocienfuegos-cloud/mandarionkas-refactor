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
              <span className="font-semibold text-white">{row.label}</span>
              <span className="text-slate-400">{row.value.toLocaleString()} · {row.rate.toFixed(1)}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-blue-400" style={{ width: `${row.rate}%` }} />
            </div>
          </div>
        ))}
      </div>
    </WidgetPanel>
  );
}
