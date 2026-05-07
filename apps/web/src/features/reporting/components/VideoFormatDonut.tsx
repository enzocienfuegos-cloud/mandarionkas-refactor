import React from 'react';
import { EmptyState } from '../../../system';
import type { VideoFormatRow } from '../reporting.types';
import { WidgetPanel } from './WidgetPanel';

const toneText = {
  blue: 'text-[color:var(--dusk-status-info-fg)]',
  fuchsia: 'text-text-brand',
  emerald: 'text-[color:var(--dusk-status-success-fg)]',
  amber: 'text-[color:var(--dusk-status-warning-fg)]',
};

export function VideoFormatDonut({ rows }: { rows: VideoFormatRow[] }) {
  return (
    <WidgetPanel title="Video by format" icon="video" tone="blue">
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3">
              <div>
                <p className="font-semibold text-[color:var(--dusk-text-primary)]">{row.label}</p>
                <p className="text-xs text-[color:var(--dusk-text-soft)]">{row.starts.toLocaleString()} starts</p>
              </div>
              <span className={`text-sm font-bold ${toneText[row.tone as keyof typeof toneText]}`}>{row.percentage.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No video format mix yet"
          description="Format distribution will appear here once the selected scope records video inventory or playback events."
        />
      )}
    </WidgetPanel>
  );
}
