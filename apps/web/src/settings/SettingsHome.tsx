import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Panel, SectionKicker } from '../shared/dusk-ui';

const cards: Array<{
  title: string;
  description: string;
  href: string;
  permission?: string;
}> = [
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
    permission: 'audit:read',
  },
  {
    title: 'Webhooks',
    description: 'Configure outbound notifications for external systems.',
    href: '/settings/webhooks',
  },
];

export default function SettingsHome() {
  const { user } = useOutletContext<{ user?: { permissions?: string[] } }>();
  const visibleCards = cards.filter((card) => !card.permission || user?.permissions?.includes(card.permission));

  return (
    <div className="space-y-8">
      <div>
        <SectionKicker>Platform controls</SectionKicker>
        <h1 className="dusk-title">Settings for access, audit and delivery setup</h1>
        <p className="dusk-copy">Agency-level controls and operational setup for teams, integrations and outbound notifications.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {visibleCards.map(card => (
          <Panel key={card.title} className="p-6">
            <Link to={card.href} className="group block">
              <SectionKicker>{card.permission ? 'Protected area' : 'Workspace setup'}</SectionKicker>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-white/62">{card.description}</p>
              <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-sm font-medium text-slate-500 dark:border-white/8 dark:text-white/48">
                <span>Open settings</span>
                <span className="text-[#f1008b] transition group-hover:translate-x-1">→</span>
              </div>
            </Link>
          </Panel>
        ))}
      </div>
    </div>
  );
}
