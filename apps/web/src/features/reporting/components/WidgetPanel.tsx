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
    <section className="rounded-[18px] border border-[color:var(--dusk-border-default)] bg-surface-1 shadow-2 backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-[color:var(--dusk-border-subtle)] p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-[color:var(--dusk-border-subtle)] p-1.5 text-[color:var(--dusk-text-soft)]">
            <IconGlyph name="more" size={12} className="rotate-90" />
          </span>
          {icon ? <BrandIcon name={icon} tone={tone} compact size={14} /> : null}
          <h3 className="font-black text-[color:var(--dusk-text-primary)]">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button type="button" className="rounded-lg border border-[color:var(--dusk-border-subtle)] p-1.5 text-[color:var(--dusk-text-soft)] transition hover:bg-surface-hover hover:text-[color:var(--dusk-text-primary)]">
            <IconGlyph name="more" size={16} />
          </button>
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
