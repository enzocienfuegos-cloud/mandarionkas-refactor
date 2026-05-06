import React from 'react';
import { Link } from 'react-router-dom';
import { Badge, Kicker, Panel } from '../system';
import {
  type AttentionItem,
  type AttentionSeverity,
  type AudienceRow,
  type MetricCardData,
  type QuickNavRow,
  type SystemHealthRow,
  type TopCampaignRow,
  type TrendDirection,
  type WorkQueueRow,
} from './overview.types';
import { classNames } from './overview.utils';

export function TrendBadge({ direction, value }: { direction: TrendDirection; value: string }) {
  const classes =
    direction === 'up'
      ? 'text-success-fg'
      : direction === 'down'
        ? 'text-critical-fg'
        : 'text-text-muted';
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '•';
  return (
    <span className={classNames('inline-flex items-center gap-1 text-sm font-semibold', classes)}>
      <span aria-hidden="true">{arrow}</span>
      {value}
    </span>
  );
}

export function NotificationButton({ count }: { count: number }) {
  return (
    <button
      type="button"
      className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border-default bg-surface-1 text-text-secondary transition hover:border-brand/30 hover:bg-surface-muted"
      aria-label="Notifications"
    >
      <BellIcon className="h-5 w-5" />
      {count > 0 ? (
        <span className="absolute right-2 top-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function AttentionCard({ item }: { item: AttentionItem }) {
  const severityMap: Record<AttentionSeverity, { shell: string; accent: string; button: string }> = {
    critical: {
      shell: 'from-rose-500/16 to-transparent text-rose-300 dark:text-rose-200',
      accent: 'text-rose-500 dark:text-rose-300',
      button: 'border-rose-300/60 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/12 dark:text-rose-100 dark:hover:bg-rose-500/18',
    },
    warning: {
      shell: 'from-amber-500/16 to-transparent text-amber-300 dark:text-amber-200',
      accent: 'text-amber-500 dark:text-amber-300',
      button: 'border-amber-300/60 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/12 dark:text-amber-100 dark:hover:bg-amber-500/18',
    },
    notice: {
      shell: 'from-orange-500/16 to-transparent text-orange-300 dark:text-orange-200',
      accent: 'text-orange-500 dark:text-orange-300',
      button: 'border-orange-300/60 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-100 dark:hover:bg-orange-500/18',
    },
    healthy: {
      shell: 'from-emerald-500/16 to-transparent text-emerald-300 dark:text-emerald-200',
      accent: 'text-emerald-500 dark:text-emerald-300',
      button: 'border-emerald-300/60 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/12 dark:text-emerald-100 dark:hover:bg-emerald-500/18',
    },
  };
  const theme = severityMap[item.severity];
  return (
    <article className="rounded-[26px] border border-border-default bg-surface-1 p-5">
      <div className={classNames('flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br', theme.shell)}>
        <AlertTriangleIcon className={classNames('h-5 w-5', theme.accent)} />
      </div>
      <div className="mt-4 min-w-0">
        <p className={classNames('text-lg font-semibold leading-tight', theme.accent)}>{item.title}</p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{item.detail}</p>
      </div>
      <Link to={item.actionHref} className={classNames('mt-5 inline-flex items-center rounded-xl border px-5 py-3 text-sm font-semibold transition', theme.button)}>
        {item.actionLabel}
      </Link>
    </article>
  );
}

function CampaignStatusBadge({ status }: { status: TopCampaignRow['status'] }) {
  const tone = status === 'Healthy' ? 'success' : status === 'Needs optimization' ? 'warning' : 'critical';
  return <Badge tone={tone}>{status}</Badge>;
}

export function CampaignTable({ rows }: { rows: TopCampaignRow[] }) {
  return (
    <Panel className="overflow-hidden p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Kicker>Top Campaigns</Kicker>
          <p className="mt-3 text-sm text-text-secondary">Campaigns demanding budget, optimization, and pacing attention.</p>
        </div>
        <Link to="/campaigns" className="text-sm font-medium text-text-brand transition hover:opacity-80">
          View all campaigns
        </Link>
      </div>
      <div className="mt-6 overflow-hidden rounded-3xl border border-border-default">
        <table className="min-w-full divide-y divide-[color:var(--dusk-border-subtle)] text-sm">
          <caption className="sr-only">Top campaigns by spend, CTR and operational status</caption>
          <thead className="bg-surface-muted">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.28em] text-text-soft">
              <th scope="col" className="px-6 py-4">Campaign</th>
              <th scope="col" className="px-6 py-4">Spend</th>
              <th scope="col" className="px-6 py-4">CTR</th>
              <th scope="col" className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--dusk-border-subtle)]">
            {rows.map((row) => (
              <tr key={row.id} className="bg-surface-1">
                <th scope="row" className="px-6 py-5 text-left font-medium text-text-primary">{row.name}</th>
                <td className="px-6 py-5 text-text-secondary">{row.spend}</td>
                <td className="px-6 py-5 text-text-secondary">{row.ctr}</td>
                <td className="px-6 py-5">
                  <CampaignStatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function QuickNavIcon({ icon }: { icon: QuickNavRow['icon'] }) {
  switch (icon) {
    case 'campaigns':
      return <CampaignIcon className="h-6 w-6" />;
    case 'creatives':
      return <CreativeIcon className="h-6 w-6" />;
    case 'tags':
      return <TagIcon className="h-6 w-6" />;
    case 'analytics':
      return <ChartIcon className="h-6 w-6" />;
  }
}

export function QuickNavigation({ items }: { items: QuickNavRow[] }) {
  return (
    <Panel className="p-7">
      <Kicker>Quick Navigation</Kicker>
      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            className="group flex items-center justify-between gap-4 rounded-3xl border border-border-default bg-surface-1 px-5 py-4 transition hover:border-brand/30 hover:bg-surface-muted"
          >
            <div className="flex items-center gap-4">
              <div className={classNames('flex h-14 w-14 items-center justify-center rounded-2xl border bg-gradient-to-br', item.tone)}>
                <QuickNavIcon icon={item.icon} />
              </div>
              <div>
                <p className="font-semibold text-text-primary">{item.label}</p>
                <p className="text-sm text-text-secondary">{item.detail}</p>
              </div>
            </div>
            <ArrowRightIcon className="text-text-soft transition group-hover:text-text-brand" />
          </Link>
        ))}
      </div>
    </Panel>
  );
}

export function SystemHealth({ items }: { items: SystemHealthRow[] }) {
  return (
    <Panel className="p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Kicker>Delivery &amp; System Health</Kicker>
        </div>
        <Link to="/reporting" className="text-sm font-medium text-text-brand transition hover:opacity-80">
          View system status
        </Link>
      </div>
      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-3xl border border-border-default bg-surface-1 px-5 py-4">
            <div>
              <p className="font-medium text-text-primary">{item.label}</p>
              <p className="text-sm text-text-secondary">{item.note}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-text-primary">{item.value}</span>
              <Badge
                tone={
                  item.severity === 'positive'
                    ? 'success'
                    : item.severity === 'critical'
                      ? 'critical'
                      : item.severity === 'warning'
                        ? 'warning'
                        : 'info'
                }
              >
                {item.note}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SegmentColumn({ title, items, positive }: { title: string; items: AudienceRow[]; positive: boolean }) {
  return (
    <div>
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={item.id} className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-text-secondary">{item.name}</span>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-text-muted">CTR {item.ctr}</span>
                <TrendBadge direction={item.direction} value={item.delta} />
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-surface-muted">
              <div
                className={classNames(
                  'h-full rounded-full',
                  positive ? 'bg-[linear-gradient(90deg,#22c55e,#86efac)]' : 'bg-[linear-gradient(90deg,#fb7185,#f97316)]',
                )}
                style={{ width: `${Math.max(8, Math.min(item.score, 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AudienceInsights({ topSegments, underperformingSegments }: { topSegments: AudienceRow[]; underperformingSegments: AudienceRow[] }) {
  return (
    <Panel className="p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Kicker>Audience Signal Insights</Kicker>
        </div>
        <Link to="/reporting" className="text-sm font-medium text-text-brand transition hover:opacity-80">
          Explore all segments
        </Link>
      </div>
      <div className="mt-6 grid gap-10 xl:grid-cols-2">
        <SegmentColumn title="Top performing segments" items={topSegments} positive />
        <SegmentColumn title="Underperforming segments" items={underperformingSegments} positive={false} />
      </div>
    </Panel>
  );
}

export function WorkQueueTable({ rows }: { rows: WorkQueueRow[] }) {
  return (
    <Panel className="overflow-hidden p-7">
      <div>
        <Kicker>Ad Ops work queue</Kicker>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">Daily launch, delivery, and QA queue</h2>
        <p className="mt-2 text-sm text-text-secondary">Triage blockers, implementation gaps, and readiness issues from one operational table.</p>
      </div>
      <div className="app-scrollbar mt-6 overflow-auto rounded-3xl border border-border-default">
        <table className="min-w-full divide-y divide-[color:var(--dusk-border-subtle)] text-sm">
          <caption className="sr-only">Daily work queue for launch, delivery and QA blockers</caption>
          <thead className="bg-surface-muted">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-text-soft">
              <th scope="col" className="px-6 py-4">Stage</th>
              <th scope="col" className="px-6 py-4">Issue</th>
              <th scope="col" className="px-6 py-4">Advertiser</th>
              <th scope="col" className="px-6 py-4">Owner</th>
              <th scope="col" className="px-6 py-4">Due</th>
              <th scope="col" className="px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--dusk-border-subtle)]">
            {rows.map((row) => (
              <tr key={row.id} className="bg-surface-1 transition hover:bg-surface-muted">
                <td className="px-6 py-5">
                  <Badge tone={row.severity === 'critical' ? 'critical' : row.severity === 'warning' ? 'warning' : row.severity === 'healthy' ? 'success' : 'info'}>
                    {row.stage}
                  </Badge>
                </td>
                <th scope="row" className="px-6 py-5 text-left font-semibold text-text-primary">{row.issue}</th>
                <td className="px-6 py-5 text-text-secondary">{row.advertiser}</td>
                <td className="px-6 py-5 text-text-secondary">{row.owner}</td>
                <td className="px-6 py-5 tabular-nums text-text-secondary">{row.due}</td>
                <td className="px-6 py-5">
                  <Link to={row.actionHref} className="text-sm font-medium text-text-brand transition hover:opacity-80">
                    {row.actionLabel}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function MetricIcon({ icon }: { icon: MetricCardData['icon'] }) {
  switch (icon) {
    case 'spend':
      return <CurrencyIcon className="h-7 w-7" />;
    case 'impressions':
      return <EyeIcon className="h-7 w-7" />;
    case 'ctr':
      return <TargetIcon className="h-7 w-7" />;
    case 'engagements':
      return <CursorClickIcon className="h-7 w-7" />;
    case 'viewability':
      return <VisibilityIcon className="h-7 w-7" />;
  }
}

function iconProps(className?: string) {
  return { className: classNames('h-5 w-5', className), viewBox: '0 0 24 24', fill: 'none' } as const;
}

export const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}>
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BellIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}>
    <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0h6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AlertTriangleIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}>
    <path d="M12 4 3.5 19h17L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
);

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}>
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SearchIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}>
    <path d="m15.5 15.5 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="7.5" cy="7.5" r="4.5" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const CurrencyIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}>
    <path d="M12 4v16M16 7.5c0-1.9-1.8-3.5-4-3.5s-4 1.6-4 3.5 1.8 3.5 4 3.5 4 1.6 4 3.5-1.8 3.5-4 3.5-4-1.6-4-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const EyeIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const TargetIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}>
    <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 2v3M22 12h-3M12 22v-3M2 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const CursorClickIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}>
    <path d="m8 4 8 8-4 1 1 5-3 1-1-5-3 1V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M16 4v3M19 7h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const VisibilityIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M9 12a3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const CampaignIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}>
    <rect x="4" y="5" width="16" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    <rect x="4" y="11" width="16" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    <rect x="4" y="17" width="10" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const CreativeIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}>
    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="m7 15 3-3 3 2 4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9" cy="9" r="1.5" fill="currentColor" />
  </svg>
);

const TagIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}>
    <path d="M4 10V4h6l8 8-6 6-8-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" />
  </svg>
);

const ChartIcon = ({ className }: { className?: string }) => (
  <svg {...iconProps(className)}>
    <path d="M5 17V9M12 17V5M19 17v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M3 20h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
