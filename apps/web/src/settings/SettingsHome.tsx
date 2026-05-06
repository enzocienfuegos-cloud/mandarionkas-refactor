import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Panel, Kicker, EmptyState } from '../system';
import { ArrowRight, Settings2 } from '../system/icons';

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

  if (visibleCards.length === 0) {
    return (
      <EmptyState
        icon={<Settings2 />}
        kicker="Settings"
        title="No settings areas available"
        description="Your account does not currently expose any workspace or platform settings sections."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Kicker>Platform controls</Kicker>
        <h1 className="dusk-title">Settings for access, audit and delivery setup</h1>
        <p className="dusk-copy">Agency-level controls and operational setup for teams, integrations and outbound notifications.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {visibleCards.map(card => (
          <Panel key={card.title} className="p-6">
            <Link to={card.href} className="group block">
              <Kicker>{card.permission ? 'Protected area' : 'Workspace setup'}</Kicker>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[color:var(--dusk-text-secondary)]">{card.description}</p>
              <div className="mt-6 flex items-center justify-between border-t border-[color:var(--dusk-border-default)] pt-4 text-sm font-medium text-[color:var(--dusk-text-secondary)]">
                <span>Open settings</span>
                <ArrowRight className="h-4 w-4 text-text-brand transition group-hover:translate-x-1" />
              </div>
            </Link>
          </Panel>
        ))}
      </div>
    </div>
  );
}
