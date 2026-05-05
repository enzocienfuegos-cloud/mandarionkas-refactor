import React from 'react';
import { Link } from 'react-router-dom';
import { Panel, PrimaryButton, SectionKicker } from '../shared/dusk-ui';

const cards = [
  {
    title: 'VAST Validator',
    description: 'Validate VAST XML before trafficking it to a DSP, SSP, or player.',
    href: '/tools/vast-validator',
  },
  {
    title: 'Chain Validator',
    description: 'Inspect wrapper chains and catch broken hops before launch.',
    href: '/tools/chain-validator',
  },
];

export default function ToolsHome() {
  return (
    <div className="space-y-8">
      <div className="dusk-page-header">
        <div>
          <SectionKicker>System utilities</SectionKicker>
          <h1 className="dusk-title">Operational tools for launch QA</h1>
          <p className="dusk-copy">Validation and QA utilities for trafficking workflows, wrapper debugging and preflight review.</p>
        </div>
        <PrimaryButton disabled className="justify-center">
          Run validation pack
        </PrimaryButton>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {cards.map(card => (
          <Panel key={card.title} className="p-6">
            <Link to={card.href} className="group block">
              <SectionKicker>{card.title.includes('Chain') ? 'Wrapper analysis' : 'Creative validation'}</SectionKicker>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-white/62">{card.description}</p>
              <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-sm font-medium text-slate-500 dark:border-white/8 dark:text-white/48">
                <span>Open tool</span>
                <span className="text-[#f1008b] transition group-hover:translate-x-1">→</span>
              </div>
            </Link>
          </Panel>
        ))}
      </div>
    </div>
  );
}
