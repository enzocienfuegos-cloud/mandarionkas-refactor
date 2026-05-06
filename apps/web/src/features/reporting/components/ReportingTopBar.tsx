import React from 'react';
import { IconGlyph } from '../icons/IconGlyph';

export function ReportingTopBar() {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-1 px-4 text-sm font-semibold text-[color:var(--dusk-text-primary)] transition hover:border-fuchsia-400/30 hover:bg-surface-hover">
          All advertisers
        </button>
        <button type="button" className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-1 px-4 text-sm font-semibold text-[color:var(--dusk-text-primary)] transition hover:border-fuchsia-400/30 hover:bg-surface-hover">
          Last 30 days
        </button>
        <button type="button" className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-1 px-4 text-sm font-semibold text-[color:var(--dusk-text-primary)] transition hover:border-fuchsia-400/30 hover:bg-surface-hover">
          Active campaigns
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block min-w-[260px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--dusk-text-soft)]"><IconGlyph name="search" size={15} /></span>
          <input
            placeholder="Search campaign, creative, region"
            className="min-h-[46px] w-full rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-1 pl-10 pr-3 text-sm text-[color:var(--dusk-text-primary)] outline-none placeholder:text-[color:var(--dusk-text-soft)] focus:border-fuchsia-400/30 focus:bg-surface-hover"
          />
        </label>
        <button type="button" className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-1 px-4 text-sm font-semibold text-[color:var(--dusk-text-secondary)] transition hover:border-fuchsia-400/30 hover:bg-surface-hover hover:text-[color:var(--dusk-text-primary)]">
          <IconGlyph name="settings" size={15} />
          Customize widgets
        </button>
      </div>
    </div>
  );
}
