import React from 'react';
import { videoFormatRows } from '../reporting.mock';
import { WidgetPanel } from './WidgetPanel';

const toneText = {
  blue: 'text-blue-300',
  fuchsia: 'text-fuchsia-300',
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
};

export function VideoFormatDonut() {
  return (
    <WidgetPanel title="Video by format" icon="video" tone="blue">
      <div className="space-y-3">
        {videoFormatRows.map((row) => (
          <div key={row.id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-3">
            <div>
              <p className="font-semibold text-white">{row.label}</p>
              <p className="text-xs text-slate-500">{row.starts.toLocaleString()} starts</p>
            </div>
            <span className={`text-sm font-bold ${toneText[row.tone as keyof typeof toneText]}`}>{row.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </WidgetPanel>
  );
}
