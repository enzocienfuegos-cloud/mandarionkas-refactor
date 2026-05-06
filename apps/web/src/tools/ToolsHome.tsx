import React from 'react';
import { Link } from 'react-router-dom';
import { Panel, Button, Kicker } from '../system';
import { ArrowRight, CheckCircle2, Target } from '../system/icons';

const cards = [
  {
    title: 'VAST Validator',
    description: 'Validate VAST XML before trafficking it to a DSP, SSP, or player.',
    href: '/tools/vast-validator',
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  {
    title: 'Chain Validator',
    description: 'Inspect wrapper chains and catch broken hops before launch.',
    href: '/tools/chain-validator',
    icon: <Target className="h-5 w-5" />,
  },
];

export default function ToolsHome() {
  return (
    <div className="space-y-8">
      <div className="dusk-page-header">
        <div>
          <Kicker>System utilities</Kicker>
          <h1 className="dusk-title">Operational tools for launch QA</h1>
          <p className="dusk-copy">Validation and QA utilities for trafficking workflows, wrapper debugging and preflight review.</p>
        </div>
        <Button variant="secondary" disabled className="justify-center">
          Run validation pack
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {cards.map(card => (
          <Panel key={card.title} className="p-6">
            <Link to={card.href} className="group block">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-secondary)]">
                  {card.icon}
                </div>
                <Kicker>{card.title.includes('Chain') ? 'Wrapper analysis' : 'Creative validation'}</Kicker>
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[color:var(--dusk-text-secondary)]">{card.description}</p>
              <div className="mt-6 flex items-center justify-between border-t border-[color:var(--dusk-border-default)] pt-4 text-sm font-medium text-[color:var(--dusk-text-secondary)]">
                <span>Open tool</span>
                <ArrowRight className="h-4 w-4 text-text-brand transition group-hover:translate-x-1" />
              </div>
            </Link>
          </Panel>
        ))}
      </div>
    </div>
  );
}
