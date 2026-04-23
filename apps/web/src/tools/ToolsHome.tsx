import React from 'react';
import { Link } from 'react-router-dom';

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Tools</h1>
        <p className="mt-1 text-sm text-slate-500">Validation and QA utilities for trafficking workflows.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map(card => (
          <Link
            key={card.title}
            to={card.href}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <h2 className="text-lg font-semibold text-slate-900">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
