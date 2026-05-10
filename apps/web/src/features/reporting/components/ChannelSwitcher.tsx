import React from 'react';
import { Button } from '../../../system';
import { Eye, Film, LayoutDashboard, Users } from '../../../system/icons';
import type { ReportingMode, Tone } from '../reporting.types';

const reportingModes: Array<{ id: ReportingMode; label: string; Icon: React.ComponentType<{ className?: string }>; tone: Tone }> = [
  { id: 'all', label: 'All Channels', Icon: LayoutDashboard, tone: 'fuchsia' },
  { id: 'display', label: 'Display', Icon: Eye, tone: 'fuchsia' },
  { id: 'video', label: 'Video', Icon: Film, tone: 'blue' },
  { id: 'identity', label: 'Identity', Icon: Users, tone: 'emerald' },
];

export function ChannelSwitcher({ mode, onModeChange }: { mode: ReportingMode; onModeChange: (mode: ReportingMode) => void }) {
  return (
    <div className="flex flex-wrap rounded-2xl border border-[color:var(--dusk-border-default)] bg-surface-1 p-1 text-sm font-bold text-[color:var(--dusk-text-muted)]">
      {reportingModes.map((item) => {
        const active = item.id === mode;
        return (
          <Button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onModeChange(item.id)}
            size="sm"
            variant={active ? 'secondary' : 'ghost'}
            className={[
              '!h-10 rounded-xl',
              active ? 'border border-brand-500/40 bg-[color:var(--dusk-surface-active)] text-[color:var(--dusk-text-primary)] shadow-brand' : 'hover:bg-surface-hover hover:text-[color:var(--dusk-text-primary)]',
            ].join(' ')}
          >
            <item.Icon className="h-3.5 w-3.5" />
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}
