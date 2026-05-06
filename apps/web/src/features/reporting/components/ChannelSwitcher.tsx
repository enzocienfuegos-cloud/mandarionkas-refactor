import React from 'react';
import type { ReportingMode, Tone } from '../reporting.types';
import { IconGlyph } from '../icons/IconGlyph';

const reportingModes: Array<{ id: ReportingMode; label: string; icon: Parameters<typeof IconGlyph>[0]['name']; tone: Tone }> = [
  { id: 'all', label: 'All Channels', icon: 'dashboard', tone: 'fuchsia' },
  { id: 'display', label: 'Display', icon: 'impressions', tone: 'fuchsia' },
  { id: 'video', label: 'Video', icon: 'video', tone: 'blue' },
  { id: 'identity', label: 'Identity', icon: 'identity', tone: 'emerald' },
];

export function ChannelSwitcher({ mode, onModeChange }: { mode: ReportingMode; onModeChange: (mode: ReportingMode) => void }) {
  return (
    <div className="flex flex-wrap rounded-2xl border border-white/10 bg-white/[0.035] p-1 text-sm font-bold text-slate-400">
      {reportingModes.map((item) => {
        const active = item.id === mode;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onModeChange(item.id)}
            className={[
              'flex items-center gap-2 rounded-xl px-4 py-2 transition',
              active ? 'border border-fuchsia-400/40 bg-fuchsia-500/16 text-white shadow-[0_0_24px_rgba(217,70,239,.16)]' : 'hover:bg-white/[0.045] hover:text-white',
            ].join(' ')}
          >
            <IconGlyph name={item.icon} size={14} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
