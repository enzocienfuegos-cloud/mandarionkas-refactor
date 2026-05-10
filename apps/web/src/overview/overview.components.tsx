import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Badge, Button, DataTable, Kicker, Panel, type ColumnDef } from '../system';
export { MetricIcon } from '../system/metrics/icons';
import {
  type AttentionItem,
  type AttentionSeverity,
  type AudienceRow,
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

export function OverviewSidebar({
  attentionItems,
  liveCampaignCount,
  readyCreativeCount,
  draftSetupCount,
}: {
  attentionItems: AttentionItem[];
  liveCampaignCount: number;
  readyCreativeCount: number;
  draftSetupCount: number;
}) {
  return (
    <Panel className="p-6">
      <div className="space-y-8">
        <section>
          <Kicker>Today blockers</Kicker>
          <div className="mt-4 space-y-3">
            {attentionItems.slice(0, 3).map((item) => (
              <Panel key={item.id} className="px-4 py-3">
                <p className="font-semibold text-text-primary">{item.title}</p>
                <p className="mt-1 text-sm text-text-secondary">{item.detail}</p>
              </Panel>
            ))}
          </div>
        </section>
        <section>
          <Kicker>Launch readiness</Kicker>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <Panel className="px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-text-soft">Live campaigns</p>
              <p className="mt-2 text-2xl font-semibold text-text-primary">{liveCampaignCount}</p>
            </Panel>
            <Panel className="px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-text-soft">Ready creatives</p>
              <p className="mt-2 text-2xl font-semibold text-text-primary">{readyCreativeCount}</p>
            </Panel>
            <Panel className="px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-text-soft">Draft setup</p>
              <p className="mt-2 text-2xl font-semibold text-text-primary">{draftSetupCount}</p>
            </Panel>
          </div>
        </section>
        <section>
          <Kicker>Quick ops</Kicker>
          <div className="mt-4 grid gap-3">
            <Link to="/campaigns" className="dusk-card-link p-4">
              <p className="font-semibold text-text-primary">Campaign operations</p>
              <p className="mt-1 text-sm text-text-secondary">Move from pacing and delivery issues into action.</p>
            </Link>
            <Link to="/tags" className="dusk-card-link p-4">
              <p className="font-semibold text-text-primary">Tag firing health</p>
              <p className="mt-1 text-sm text-text-secondary">Review implementation, cachebusters, and firing quality.</p>
            </Link>
            <Link to="/creatives" className="dusk-card-link p-4">
              <p className="font-semibold text-text-primary">Creative QA</p>
              <p className="mt-1 text-sm text-text-secondary">Handle approvals, previews, and assignment gaps.</p>
            </Link>
          </div>
        </section>
      </div>
    </Panel>
  );
}

export function AttentionCard({ item }: { item: AttentionItem }) {
  const severityMap: Record<AttentionSeverity, { tone: 'critical' | 'warning' | 'info' | 'success'; shell: string }> = {
    critical: {
      tone: 'critical',
      shell: 'bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)] border-[color:var(--dusk-status-critical-border)]',
    },
    warning: {
      tone: 'warning',
      shell: 'bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)] border-[color:var(--dusk-status-warning-border)]',
    },
    notice: {
      tone: 'info',
      shell: 'bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)] border-[color:var(--dusk-status-info-border)]',
    },
    healthy: {
      tone: 'success',
      shell: 'bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)] border-[color:var(--dusk-status-success-border)]',
    },
  };
  const theme = severityMap[item.severity];
  return (
    <article className="rounded-[26px] border border-border-default bg-surface-1 p-5">
      <div className={classNames('flex h-12 w-12 items-center justify-center rounded-2xl border', theme.shell)}>
        <AlertTriangleIcon className="h-5 w-5" />
      </div>
      <div className="mt-4 min-w-0">
        <div className="mb-2">
          <Badge tone={theme.tone} size="sm">{item.severity}</Badge>
        </div>
        <p className="text-lg font-semibold leading-tight text-text-primary">{item.title}</p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{item.detail}</p>
      </div>
      <Link to={item.actionHref} className="mt-5 inline-flex">
        <Button variant={item.severity === 'critical' ? 'danger' : 'secondary'}>
          {item.actionLabel}
        </Button>
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
        <Link to="/campaigns" className="inline-flex">
          <Button variant="ghost" size="sm">View all campaigns</Button>
        </Link>
      </div>
      <div className="mt-6 overflow-hidden rounded-3xl border border-border-default">
        <DataTable
          columns={[
            {
              id: 'campaign',
              header: 'Campaign',
              sortAccessor: (row) => row.name,
              cell: (row) => <span className="font-medium text-text-primary">{row.name}</span>,
            },
            {
              id: 'spend',
              header: 'Spend',
              align: 'right',
              sortAccessor: (row) => Number(row.spend.replace(/[^0-9.-]/g, '')),
              cell: (row) => row.spend,
            },
            {
              id: 'ctr',
              header: 'CTR',
              align: 'right',
              sortAccessor: (row) => Number(row.ctr.replace(/[^0-9.-]/g, '')),
              cell: (row) => row.ctr,
            },
            {
              id: 'status',
              header: 'Status',
              sortAccessor: (row) => row.status,
              cell: (row) => <CampaignStatusBadge status={row.status} />,
            },
          ] as ColumnDef<TopCampaignRow>[]}
          data={rows}
          rowKey={(row) => row.id}
          bordered={false}
          density="comfortable"
          emptyState={null}
        />
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
  const toneClassMap: Record<string, string> = {
    brand: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-surface-active)] text-text-brand',
    critical: 'border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)]',
    warning: 'border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]',
    info: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]',
    success: 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]',
  };
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
              <div className={classNames('flex h-14 w-14 items-center justify-center rounded-2xl border', toneClassMap[item.tone] ?? toneClassMap.info)}>
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
        <Link to="/reporting" className="inline-flex">
          <Button variant="ghost" size="sm">View system status</Button>
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
        <Link to="/reporting" className="inline-flex">
          <Button variant="ghost" size="sm">Explore all segments</Button>
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
      <div className="mt-6 overflow-hidden rounded-3xl border border-border-default">
        <DataTable
          columns={[
            {
              id: 'stage',
              header: 'Stage',
              sortAccessor: (row) => row.stage,
              cell: (row) => (
                <Badge tone={row.severity === 'critical' ? 'critical' : row.severity === 'warning' ? 'warning' : row.severity === 'healthy' ? 'success' : 'info'}>
                  {row.stage}
                </Badge>
              ),
            },
            {
              id: 'issue',
              header: 'Issue',
              sortAccessor: (row) => row.issue,
              cell: (row) => <span className="font-semibold text-text-primary">{row.issue}</span>,
            },
            {
              id: 'advertiser',
              header: 'Advertiser',
              sortAccessor: (row) => row.advertiser,
              cell: (row) => row.advertiser,
            },
            {
              id: 'owner',
              header: 'Owner',
              sortAccessor: (row) => row.owner,
              cell: (row) => (
                <div className="flex items-center gap-2">
                  <Avatar name={row.owner} size="xs" />
                  <span>{row.owner}</span>
                </div>
              ),
            },
            {
              id: 'due',
              header: 'Due',
              sortAccessor: (row) => row.due,
              cell: (row) => <span className="tabular">{row.due}</span>,
            },
            {
              id: 'action',
              header: 'Action',
              align: 'right',
              cell: (row) => (
                <Link to={row.actionHref} className="inline-flex">
                  <Button variant="ghost" size="sm">{row.actionLabel}</Button>
                </Link>
              ),
            },
          ] as ColumnDef<WorkQueueRow>[]}
          data={rows}
          rowKey={(row) => row.id}
          bordered={false}
          density="comfortable"
          emptyState={null}
        />
      </div>
    </Panel>
  );
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
