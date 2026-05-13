import React from 'react';
import { Badge } from '../../../system';
import { WidgetPanel } from './WidgetPanel';

const methodologyCards = [
  {
    title: 'Current attribution',
    badge: 'Click + recency',
    body: 'The current windows start from exposed identities and mark users as clicked when a click beacon is observed in the selected reporting scope. Post-view exposure is represented by recency buckets, not by a conversion pixel yet.',
  },
  {
    title: 'Supported models',
    badge: 'Roadmap-ready',
    body: 'The data model can support last-click, first-click, linear, time-decay, post-view, and hybrid click-plus-view attribution once conversion events or advertiser outcomes are connected.',
  },
  {
    title: 'Audience clusters',
    badge: 'Computed live',
    body: 'Clusters such as clicked users and high-frequency exposed users are generated from the current filters. They are export-ready cohorts, but should be saved as audiences before treating them as persistent segments.',
  },
  {
    title: 'User deduplication',
    badge: 'Identity graph',
    body: 'Users are deduplicated with resolved identity edges when available. Otherwise the system falls back to device_id, then a soft fingerprint from IP and user agent for reporting-only continuity.',
  },
];

export function IdentityMethodology() {
  return (
    <WidgetPanel title="Identity methodology" icon="identity" tone="emerald">
      <div className="grid gap-3 md:grid-cols-2">
        {methodologyCards.map((card) => (
          <div key={card.title} className="rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-[color:var(--dusk-text-primary)]">{card.title}</p>
              <Badge tone="success" size="sm">{card.badge}</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--dusk-text-muted)]">{card.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-[color:var(--dusk-text-soft)]">
        Practical read: today identity reporting is exposure, click and frequency intelligence. True post-view conversion attribution needs a conversion/event feed so the model can connect outcomes back to prior impressions.
      </p>
    </WidgetPanel>
  );
}
