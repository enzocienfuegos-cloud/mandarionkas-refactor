import React from 'react';
import { Link } from 'react-router-dom';

const cards = [
  {
    title: 'Manage Clients',
    description: 'Create clients and maintain basic account setup outside trafficking screens.',
    href: '/clients',
  },
  {
    title: 'API Keys',
    description: 'Create and revoke API keys for integrations and automation.',
    href: '/settings/api-keys',
  },
  {
    title: 'Audit Log',
    description: 'Inspect platform activity and operational changes.',
    href: '/settings/audit-log',
  },
  {
    title: 'Webhooks',
    description: 'Configure outbound notifications for external systems.',
    href: '/settings/webhooks',
  },
];

export default function SettingsHome() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Agency-level controls and operational setup.</p>
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
