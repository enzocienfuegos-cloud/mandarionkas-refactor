import React from 'react';
import type { Tone } from '../reporting.types';
import { BrandIcon } from '../icons/BrandIcon';
import { IconGlyph } from '../icons/IconGlyph';

export function WidgetPanel({
  title,
  icon,
  tone = 'fuchsia',
  action,
  children,
}: {
  title: string;
  icon?: Parameters<typeof BrandIcon>[0]['name'];
  tone?: Tone;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.032))] shadow-[0_24px_80px_rgba(0,0,0,.23)] backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-white/10 p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-white/10 p-1.5 text-slate-500">
            <IconGlyph name="more" size={12} className="rotate-90" />
          </span>
          {icon ? <BrandIcon name={icon} tone={tone} compact size={14} /> : null}
          <h3 className="font-black text-white">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button type="button" className="rounded-lg border border-white/10 p-1.5 text-slate-500">
            <IconGlyph name="more" size={16} />
          </button>
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
