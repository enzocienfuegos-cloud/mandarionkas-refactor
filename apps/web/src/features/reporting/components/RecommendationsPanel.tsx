import React from 'react';
import { Badge, Button, EmptyState } from '../../../system';
import type { Recommendation } from '../reporting.types';
import { WidgetPanel } from './WidgetPanel';

const severityTone = {
  info: 'neutral',
  opportunity: 'success',
  warning: 'warning',
  critical: 'critical',
} as const;

export function RecommendationsPanel({ rows }: { rows: Recommendation[] }) {
  return (
    <WidgetPanel title="Insights & recommendations" icon="health" tone="slate">
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[color:var(--dusk-text-primary)]">{row.title}</p>
                <Badge tone={severityTone[row.severity]} size="sm">{row.severity}</Badge>
              </div>
              <p className="mt-2 text-sm text-[color:var(--dusk-text-muted)]">{row.body}</p>
              {row.actionLabel ? (
                <a href={row.actionHref ?? '#'} className="mt-3 inline-flex">
                  <Button variant="secondary" size="sm">
                    {row.actionLabel}
                  </Button>
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No recommendations right now"
          description="The selected reporting scope is stable. Narrow the filters to inspect a smaller slice."
        />
      )}
    </WidgetPanel>
  );
}
