import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { applyTheme, getInitialTheme, persistTheme, type ThemeMode } from '../shared/theme';

type AttentionSeverity = 'critical' | 'warning' | 'notice';
type TrendDirection = 'up' | 'down';
type CampaignHealth = 'Healthy' | 'Needs optimization' | 'Critical';

type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
  severity: AttentionSeverity;
};

type Metric = {
  label: string;
  value: string;
  delta: string;
  direction: TrendDirection;
  icon: 'spend' | 'impressions' | 'ctr' | 'conversions' | 'viewability';
  tone: string;
  series: number[];
};

type TopCampaign = {
  name: string;
  spend: string;
  ctr: string;
  status: CampaignHealth;
};

type QuickNavItem = {
  label: string;
  detail: string;
  to: string;
  icon: 'campaigns' | 'creatives' | 'tags' | 'analytics';
  accent: string;
};

type SystemHealthItem = {
  label: string;
  value: string;
  note: string;
  severity: AttentionSeverity | 'positive';
};

type AudienceSegment = {
  name: string;
  ctr: string;
  delta: string;
  direction: TrendDirection;
  score: number;
};

const attentionItems: AttentionItem[] = [
  {
    id: 'savings-push',
    title: 'Campaign “Savings Push”',
    detail: 'CTR 0.4% (-30%)',
    actionLabel: 'Fix now',
    severity: 'critical',
  },
  {
    id: 'creative-impressions',
    title: '2 creatives without impressions',
    detail: 'Review performance',
    actionLabel: 'Review',
    severity: 'warning',
  },
  {
    id: 'homepage-tag',
    title: 'Tag “Homepage_728x90” inactive',
    detail: 'Last delivery: 3 days ago',
    actionLabel: 'Fix now',
    severity: 'notice',
  },
];

const metrics: Metric[] = [
  {
    label: 'Spend',
    value: '$12.4K',
    delta: '+8%',
    direction: 'up',
    icon: 'spend',
    tone: 'from-emerald-400/20 via-emerald-500/12 to-transparent text-emerald-300',
    series: [18, 20, 19, 22, 21, 20, 23, 28, 27, 29, 30, 31, 30, 32, 29, 27, 30, 28, 31, 29],
  },
  {
    label: 'Impressions',
    value: '2.4M',
    delta: '+12%',
    direction: 'up',
    icon: 'impressions',
    tone: 'from-sky-400/20 via-sky-500/12 to-transparent text-sky-300',
    series: [14, 15, 16, 15, 18, 16, 17, 21, 19, 20, 19, 18, 19, 16, 18, 17, 15, 16, 14, 13],
  },
  {
    label: 'CTR',
    value: '0.92%',
    delta: '-12%',
    direction: 'down',
    icon: 'ctr',
    tone: 'from-fuchsia-400/20 via-fuchsia-500/12 to-transparent text-fuchsia-300',
    series: [24, 23, 25, 22, 23, 21, 20, 21, 19, 22, 20, 19, 18, 19, 17, 18, 16, 15, 14, 13],
  },
  {
    label: 'Conversions',
    value: '134',
    delta: '+5%',
    direction: 'up',
    icon: 'conversions',
    tone: 'from-violet-400/20 via-violet-500/12 to-transparent text-violet-300',
    series: [10, 11, 10, 12, 11, 13, 15, 13, 13, 14, 13, 13, 15, 14, 13, 12, 13, 12, 11, 10],
  },
  {
    label: 'Viewability',
    value: '64%',
    delta: '-6%',
    direction: 'down',
    icon: 'viewability',
    tone: 'from-amber-400/20 via-orange-500/12 to-transparent text-amber-300',
    series: [16, 17, 19, 18, 20, 19, 19, 18, 18, 20, 19, 21, 20, 19, 18, 18, 17, 16, 15, 14],
  },
];

const topCampaigns: TopCampaign[] = [
  { name: 'Loans Always On', spend: '$3,100', ctr: '1.3%', status: 'Healthy' },
  { name: 'Credit Cards Q2', spend: '$4,200', ctr: '0.6%', status: 'Needs optimization' },
  { name: 'Savings Push', spend: '$2,000', ctr: '0.4%', status: 'Critical' },
  { name: 'Brand Awareness', spend: '$1,100', ctr: '1.1%', status: 'Healthy' },
];

const quickNavigationItems: QuickNavItem[] = [
  { label: 'Campaigns', detail: '4 active / 2 issues', to: '/campaigns', icon: 'campaigns', accent: 'from-violet-500/30 to-fuchsia-500/10 text-violet-200' },
  { label: 'Creatives', detail: '12 active / 5 low CTR', to: '/creatives', icon: 'creatives', accent: 'from-fuchsia-500/30 to-rose-500/10 text-fuchsia-200' },
  { label: 'Tags', detail: '8 live / 2 inactive', to: '/tags', icon: 'tags', accent: 'from-amber-500/30 to-orange-500/10 text-amber-200' },
  { label: 'Analytics', detail: 'Full reporting & insights', to: '/reporting', icon: 'analytics', accent: 'from-sky-500/30 to-cyan-500/10 text-sky-200' },
];

const systemHealthItems: SystemHealthItem[] = [
  { label: 'Tags live', value: '8/10', note: '2 inactive', severity: 'notice' },
  { label: 'Creatives live', value: '12', note: '2 without delivery', severity: 'warning' },
  { label: 'Fill rate', value: '78%', note: 'Below expected', severity: 'critical' },
  { label: 'Ad requests', value: '3.2M', note: '+10%', severity: 'positive' },
  { label: 'Errors', value: '0.02%', note: 'Low', severity: 'positive' },
];

const topSegments: AudienceSegment[] = [
  { name: 'Frequent online buyers', ctr: '1.8%', delta: '+24%', direction: 'up', score: 82 },
  { name: 'New parents', ctr: '1.4%', delta: '+18%', direction: 'up', score: 64 },
  { name: 'High value shoppers', ctr: '1.2%', delta: '+12%', direction: 'up', score: 52 },
];

const underperformingSegments: AudienceSegment[] = [
  { name: 'Broad audience', ctr: '0.3%', delta: '-28%', direction: 'down', score: 18 },
  { name: 'General interest', ctr: '0.4%', delta: '-15%', direction: 'down', score: 28 },
  { name: 'Retargeting 30d', ctr: '0.5%', delta: '-10%', direction: 'down', score: 36 },
];

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/38">
      {children}
    </p>
  );
}

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={classNames(
        'rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(17,24,39,0.88),rgba(9,13,24,0.94))] shadow-[0_22px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </section>
  );
}

function TrendBadge({ direction, value }: { direction: TrendDirection; value: string }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1 text-sm font-semibold',
        direction === 'up' ? 'text-emerald-400' : 'text-rose-400',
      )}
    >
      <span aria-hidden="true">{direction === 'up' ? '↑' : '↓'}</span>
      {value}
    </span>
  );
}

function SelectChip({
  label,
  icon,
  trailingIcon = true,
}: {
  label: string;
  icon?: React.ReactNode;
  trailingIcon?: boolean;
}) {
  return (
    <button
      type="button"
      className="inline-flex min-h-[46px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white/86 transition hover:border-fuchsia-500/30 hover:bg-white/[0.05]"
    >
      {icon}
      <span>{label}</span>
      {trailingIcon ? <ChevronDownIcon className="ml-1 text-white/40" /> : null}
    </button>
  );
}

function NotificationButton() {
  return (
    <button
      type="button"
      className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/80 transition hover:border-fuchsia-500/30 hover:bg-white/[0.05]"
      aria-label="Notifications"
    >
      <BellIcon className="h-5 w-5" />
      <span className="absolute right-2 top-2 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
        3
      </span>
    </button>
  );
}

function UserChip() {
  return (
    <div className="inline-flex min-h-[46px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white/86">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(180deg,#a855f7,#7c3aed)] text-sm font-semibold text-white">
        AU
      </span>
      <span className="font-medium">Admin User</span>
      <ChevronDownIcon className="text-white/36" />
    </div>
  );
}

function AttentionCard({ item }: { item: AttentionItem }) {
  const severityMap: Record<AttentionSeverity, { shell: string; accent: string; button: string }> = {
    critical: {
      shell: 'from-rose-500/16 to-transparent text-rose-200',
      accent: 'text-rose-300',
      button: 'border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/18',
    },
    warning: {
      shell: 'from-amber-500/16 to-transparent text-amber-200',
      accent: 'text-amber-300',
      button: 'border-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/18',
    },
    notice: {
      shell: 'from-orange-500/14 to-transparent text-orange-200',
      accent: 'text-orange-300',
      button: 'border-orange-400/20 bg-orange-500/10 text-orange-100 hover:bg-orange-500/18',
    },
  };

  const theme = severityMap[item.severity];

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
      <div className={classNames('inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br', theme.shell)}>
        <AlertIcon className={classNames('h-6 w-6', theme.accent)} />
      </div>
      <div className="min-w-0">
        <p className={classNames('text-base font-semibold', theme.accent)}>{item.title}</p>
        <p className="mt-1 text-sm text-white/56">{item.detail}</p>
      </div>
      <button
        type="button"
        className={classNames(
          'rounded-xl border px-4 py-2 text-sm font-medium transition',
          theme.button,
        )}
      >
        {item.actionLabel}
      </button>
    </div>
  );
}

function Sparkline({
  points,
  stroke,
  glow,
}: {
  points: number[];
  stroke: string;
  glow: string;
}) {
  const path = useMemo(() => {
    if (!points.length) return '';
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;
    return points
      .map((point, index) => {
        const x = (index / (points.length - 1 || 1)) * 100;
        const y = 42 - ((point - min) / range) * 32;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }, [points]);

  return (
    <svg viewBox="0 0 100 48" className="mt-4 h-14 w-full overflow-visible">
      <defs>
        <filter id={glow} x="-40%" y="-80%" width="180%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={path} fill="none" stroke={stroke} strokeWidth="2.1" strokeLinecap="round" filter={`url(#${glow})`} />
    </svg>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionKicker>{metric.label}</SectionKicker>
          <div className="mt-4 flex items-end gap-3">
            <div className="text-[2.25rem] font-semibold tracking-[-0.04em] text-white">{metric.value}</div>
            <TrendBadge direction={metric.direction} value={metric.delta} />
          </div>
          <p className="mt-1 text-sm text-white/48">vs previous 7 days</p>
        </div>
        <div className={classNames('inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/6 bg-gradient-to-br', metric.tone)}>
          <MetricIcon name={metric.icon} className="h-6 w-6" />
        </div>
      </div>
      <Sparkline
        points={metric.series}
        stroke={
          metric.icon === 'spend'
            ? '#4ade80'
            : metric.icon === 'impressions'
              ? '#38bdf8'
              : metric.icon === 'ctr'
                ? '#f472b6'
                : metric.icon === 'conversions'
                  ? '#a855f7'
                  : '#f59e0b'
        }
        glow={`glow-${metric.icon}`}
      />
    </Panel>
  );
}

function CampaignStatusBadge({ status }: { status: CampaignHealth }) {
  const tone =
    status === 'Healthy'
      ? 'border-emerald-500/16 bg-emerald-500/12 text-emerald-300'
      : status === 'Needs optimization'
        ? 'border-amber-500/16 bg-amber-500/12 text-amber-300'
        : 'border-rose-500/16 bg-rose-500/12 text-rose-300';

  return <span className={classNames('rounded-full border px-2.5 py-1 text-xs font-semibold', tone)}>{status}</span>;
}

function CampaignTable({ campaigns }: { campaigns: TopCampaign[] }) {
  return (
    <Panel className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <SectionKicker>Top Campaigns</SectionKicker>
          <p className="mt-3 text-sm text-white/48">Campaigns demanding budget, optimization, and pacing attention.</p>
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-white/6 bg-white/[0.02]">
        <div className="grid grid-cols-[1.5fr_0.7fr_0.5fr_0.8fr] gap-3 border-b border-white/6 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/34">
          <span>Campaign</span>
          <span>Spend</span>
          <span>CTR</span>
          <span>Status</span>
        </div>
        {campaigns.map((campaign) => (
          <div key={campaign.name} className="grid grid-cols-[1.5fr_0.7fr_0.5fr_0.8fr] items-center gap-3 border-b border-white/6 px-5 py-4 last:border-b-0">
            <div className="flex items-center gap-3">
              <span
                className={classNames(
                  'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/6 bg-white/[0.03]',
                  campaign.status === 'Healthy'
                    ? 'text-emerald-300'
                    : campaign.status === 'Needs optimization'
                      ? 'text-amber-300'
                      : 'text-rose-300',
                )}
              >
                <TrendingBadgeIcon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium text-white/88">{campaign.name}</span>
            </div>
            <span className="text-sm text-white/72">{campaign.spend}</span>
            <span className="text-sm text-white/72">{campaign.ctr}</span>
            <CampaignStatusBadge status={campaign.status} />
          </div>
        ))}
      </div>
      <Link to="/campaigns" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-fuchsia-300 transition hover:text-fuchsia-200">
        View all campaigns
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </Panel>
  );
}

function QuickNavigation({ items }: { items: QuickNavItem[] }) {
  return (
    <Panel className="flex h-full flex-col p-5">
      <SectionKicker>Quick Navigation</SectionKicker>
      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="group flex items-center justify-between gap-4 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-4 transition hover:border-fuchsia-500/26 hover:bg-white/[0.04]"
          >
            <div className="flex items-center gap-4">
              <span className={classNames('inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/6 bg-gradient-to-br', item.accent)}>
                <QuickNavIcon name={item.icon} className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white/86">{item.label}</p>
                <p className="mt-1 text-sm text-white/46">{item.detail}</p>
              </div>
            </div>
            <ArrowRightIcon className="h-5 w-5 text-white/30 transition group-hover:translate-x-1 group-hover:text-fuchsia-300" />
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function SystemHealth({ items }: { items: SystemHealthItem[] }) {
  return (
    <Panel className="flex h-full flex-col p-5">
      <SectionKicker>Delivery &amp; System Health</SectionKicker>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-4">
            <div>
              <p className="text-sm font-medium text-white/84">{item.label}</p>
              <p className="mt-1 text-xs text-white/42">{item.note}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{item.value}</p>
              <span
                className={classNames(
                  'mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                  item.severity === 'positive'
                    ? 'border-emerald-500/16 bg-emerald-500/12 text-emerald-300'
                    : item.severity === 'critical'
                      ? 'border-rose-500/16 bg-rose-500/12 text-rose-300'
                      : item.severity === 'warning'
                        ? 'border-amber-500/16 bg-amber-500/12 text-amber-300'
                        : 'border-orange-500/16 bg-orange-500/12 text-orange-300',
                )}
              >
                {item.note}
              </span>
            </div>
          </div>
        ))}
      </div>
      <Link to="/tags" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-fuchsia-300 transition hover:text-fuchsia-200">
        View system status
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </Panel>
  );
}

function AudienceInsights({
  top,
  underperforming,
}: {
  top: AudienceSegment[];
  underperforming: AudienceSegment[];
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionKicker>Audience Signal Insights</SectionKicker>
          <p className="mt-3 text-sm text-white/48">Quick read on which audiences are overperforming and where targeting needs tightening.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-8 xl:grid-cols-2">
        <SegmentColumn title="Top performing segments" segments={top} positive />
        <SegmentColumn title="Underperforming segments" segments={underperforming} positive={false} />
      </div>
    </Panel>
  );
}

function SegmentColumn({
  title,
  segments,
  positive,
}: {
  title: string;
  segments: AudienceSegment[];
  positive: boolean;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold text-white/88">{title}</h3>
      <div className="mt-5 space-y-5">
        {segments.map((segment) => (
          <div key={segment.name} className="grid grid-cols-[1.6fr_0.5fr_0.45fr_1fr] items-center gap-4">
            <span className="text-sm text-white/76">{segment.name}</span>
            <span className="text-sm text-white/78">CTR {segment.ctr}</span>
            <TrendBadge direction={segment.direction} value={segment.delta} />
            <div className="h-2 rounded-full bg-white/8">
              <div
                className={classNames(
                  'h-2 rounded-full',
                  positive ? 'bg-[linear-gradient(90deg,#4ade80,#22c55e)]' : 'bg-[linear-gradient(90deg,#fb7185,#ef4444)]',
                )}
                style={{ width: `${segment.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricIcon({ name, className }: { name: Metric['icon']; className?: string }) {
  switch (name) {
    case 'spend':
      return <CurrencyIcon className={className} />;
    case 'impressions':
      return <EyeIcon className={className} />;
    case 'ctr':
      return <TargetIcon className={className} />;
    case 'conversions':
      return <CartIcon className={className} />;
    case 'viewability':
      return <VisibilityIcon className={className} />;
  }
}

function QuickNavIcon({ name, className }: { name: QuickNavItem['icon']; className?: string }) {
  switch (name) {
    case 'campaigns':
      return <CampaignsIcon className={className} />;
    case 'creatives':
      return <CreativesIcon className={className} />;
    case 'tags':
      return <TagsIcon className={className} />;
    case 'analytics':
      return <AnalyticsIcon className={className} />;
  }
}

function BaseIcon({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="m6 9 6 6 6-6" />
    </BaseIcon>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M15 17H5.5a1 1 0 0 1-.8-1.6L6 13.7V10a6 6 0 1 1 12 0v3.7l1.3 1.7a1 1 0 0 1-.8 1.6H17" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </BaseIcon>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M12 4 4 19h16L12 4Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </BaseIcon>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </BaseIcon>
  );
}

function TrendingBadgeIcon({ className }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="m5 15 4-4 3 3 5-7" />
    </BaseIcon>
  );
}

function CurrencyIcon({ className }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M12 4v16" />
      <path d="M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.5 2.5 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3" />
    </BaseIcon>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.8" />
    </BaseIcon>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
      <path d="M18.5 5.5 15 9" />
    </BaseIcon>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M4 5h2l1.2 7.2a1 1 0 0 0 1 .8h7.6a1 1 0 0 0 1-.8L18 8H7.2" />
      <circle cx="10" cy="18" r="1.4" />
      <circle cx="16" cy="18" r="1.4" />
    </BaseIcon>
  );
}

function VisibilityIcon({ className }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <path d="M9.4 12a2.6 2.6 0 1 0 5.2 0 2.6 2.6 0 0 0-5.2 0Z" />
    </BaseIcon>
  );
}

function CampaignsIcon({ className }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9h8" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </BaseIcon>
  );
}

function CreativesIcon({ className }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m7.5 15 3.2-3.3 2.4 2.3 2.9-3.5" />
      <circle cx="9" cy="9" r="1.2" />
    </BaseIcon>
  );
}

function TagsIcon({ className }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M5 8V4.5h4L18.5 14 14 18.5 5 9.5Z" />
      <circle cx="8.1" cy="7.1" r="1.1" />
    </BaseIcon>
  );
}

function AnalyticsIcon({ className }: { className?: string }) {
  return (
    <BaseIcon className={className}>
      <path d="M5 18V11" />
      <path d="M10 18V7" />
      <path d="M15 18v-5" />
      <path d="M20 18V4" />
    </BaseIcon>
  );
}

export default function AdOpsOverview() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  return (
    <div className="mandarion-shell space-y-6 text-white">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <SelectChip label="Bancoagrícola" icon={<TagsIcon className="h-4 w-4 text-fuchsia-300" />} />
            <SelectChip label="Last 7 days" icon={<CampaignsIcon className="h-4 w-4 text-white/46" />} />
            <SelectChip label="All campaigns" icon={<CreativesIcon className="h-4 w-4 text-white/46" />} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              className="inline-flex min-h-[46px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white/86 transition hover:border-fuchsia-500/30 hover:bg-white/[0.05]"
            >
              <VisibilityIcon className="h-4 w-4 text-white/54" />
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <NotificationButton />
            <UserChip />
            <Link
              to="/campaigns/new"
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[linear-gradient(180deg,#8b5cf6,#7c3aed_35%,#6d28d9)] px-5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(124,58,237,0.35)] transition hover:brightness-110"
            >
              <span className="text-base leading-none">+</span>
              New campaign
            </Link>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-[2.35rem] font-semibold tracking-[-0.05em] text-white">Good morning, Admin</h1>
          <p className="text-lg text-white/54">Here’s what’s happening with your campaigns today.</p>
        </div>

        <Panel className="p-5">
          <div className="flex items-start justify-between gap-6">
            <SectionKicker>What needs attention</SectionKicker>
            <button type="button" className="hidden text-sm font-medium text-fuchsia-300 transition hover:text-fuchsia-200 lg:inline-flex">
              View all issues (4)
            </button>
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-3">
            {attentionItems.map((item) => (
              <div key={item.id} className="xl:border-r xl:border-white/8 xl:pr-5 last:xl:border-r-0 last:xl:pr-0">
                <AttentionCard item={item} />
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-5">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr_1fr]">
          <CampaignTable campaigns={topCampaigns} />
          <QuickNavigation items={quickNavigationItems} />
          <SystemHealth items={systemHealthItems} />
        </div>

        <AudienceInsights top={topSegments} underperforming={underperformingSegments} />
      </div>
    </div>
  );
}
