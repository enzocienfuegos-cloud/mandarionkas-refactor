import React from 'react';
import { IconGlyph } from '../icons/IconGlyph';

export function ReportingTopBar() {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm font-semibold text-white transition hover:border-fuchsia-400/30 hover:bg-white/[0.055]">
          All advertisers
        </button>
        <button type="button" className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm font-semibold text-white transition hover:border-fuchsia-400/30 hover:bg-white/[0.055]">
          Last 30 days
        </button>
        <button type="button" className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm font-semibold text-white transition hover:border-fuchsia-400/30 hover:bg-white/[0.055]">
          Active campaigns
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block min-w-[260px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><IconGlyph name="search" size={15} /></span>
          <input
            placeholder="Search campaign, creative, region"
            className="min-h-[46px] w-full rounded-xl border border-white/[0.08] bg-white/[0.035] pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-fuchsia-400/30 focus:bg-white/[0.05]"
          />
        </label>
        <button type="button" className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm font-semibold text-slate-300 transition hover:border-fuchsia-400/30 hover:bg-white/[0.055]">
          <IconGlyph name="settings" size={15} />
          Customize widgets
        </button>
      </div>
    </div>
  );
}
