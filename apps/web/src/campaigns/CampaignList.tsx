import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loadAuthMe, loadWorkspaces, switchWorkspace } from '../shared/workspaces';
import { useConfirm, useToast } from '../system';

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'warning' | 'notice' | 'healthy';
type TrendDirection = 'up' | 'down' | 'flat';
type Tone = 'fuchsia' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
type IconProps = { className?: string };
type CampaignStatus = 'Live' | 'Limited' | 'Blocked' | 'Ready' | 'Draft';

interface Campaign {
  id: string;
  workspace_id?: string;
  workspace_name?: string;
  name: string;
  advertiser?: { id: string; name: string };
  metadata?: { dsp?: string | null };
  status: 'active' | 'paused' | 'archived' | 'draft';
  startDate: string | null;
  endDate: string | null;
  start_date?: string | null;
  end_date?: string | null;
  impressionGoal: number | null;
  impression_goal?: number | null;
  dailyBudget: number | null;
  impressions?: number | string | null;
  clicks?: number | string | null;
  ctr?: number | string | null;
  engagement_rate?: number | string | null;
  engagementRate?: number | string | null;
  viewability_rate?: number | string | null;
  viewabilityRate?: number | string | null;
  total_hover_duration_ms?: number | string | null;
  totalHoverDurationMs?: number | string | null;
}

type CampaignRow = {
  id: string;
  campaign: string;
  advertiser: string;
  status: CampaignStatus;
  pacing: string;
  spend: string;
  budget: string;
  tagHealth: string;
  creativeStatus: string;
  issues: number;
  owner: string;
  flight: string;
  raw: Campaign;
};

type Metric = {
  id: string;
  label: string;
  value: string;
  delta: string;
  direction: TrendDirection;
  helper: string;
  tone: Tone;
  series: number[];
};

type NavItem = {
  label: string;
  icon: JSX.Element;
  active?: boolean;
  badge?: string;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function iconProps(className?: string) {
  return {
    className: classNames('h-5 w-5', className),
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  } as const;
}

const toNumber = (val: unknown) => {
  const n = Number(val ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const formatCompactMoney = (value: number) => {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value);
};

const formatDateRange = (start?: string | null, end?: string | null) => {
  const fmt = (val?: string | null) =>
    val ? new Date(val).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }) : null;
  const s = fmt(start);
  const e = fmt(end);
  if (s && e) return `${s} - ${e}`;
  if (s) return `${s} - …`;
  return 'Always on';
};

const computeDelta = (current: number, previous: number) => {
  if (previous <= 0 && current <= 0) return { direction: 'flat' as TrendDirection, label: '0%' };
  if (previous <= 0) return { direction: 'up' as TrendDirection, label: '+100%' };
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.1) return { direction: 'flat' as TrendDirection, label: '0%' };
  return {
    direction: change > 0 ? 'up' as TrendDirection : 'down' as TrendDirection,
    label: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`,
  };
};

// ─── Icons ────────────────────────────────────────────────────────────────────

const AlertTriangleIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M12 4 3.5 19h17L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
);

const SearchIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" />
    <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const FilterIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const GaugeIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M4 15a8 8 0 1 1 16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="m12 15 4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8 19h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const ReportIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M6 19V9M12 19V5M18 19v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const TableIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 10h16M10 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const MoreIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
  </svg>
);


// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={classNames(
        'rounded-[28px] border border-border-default bg-surface-1/85 shadow-[0_18px_60px_rgba(28,18,41,0.08)] backdrop-blur-xl',
        'dark:border-white/[0.07] dark:bg-surface-1/[0.035] dark:shadow-[0_22px_70px_rgba(0,0,0,0.28)]',
        className,
      )}
    >
      {children}
    </section>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted dark:text-white/42">{children}</p>;
}

// ─── Tone helpers ─────────────────────────────────────────────────────────────

function toneClass(tone: Tone) {
  const map: Record<Tone, string> = {
    fuchsia: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-500/18 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/18 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/18 dark:bg-amber-500/10 dark:text-amber-300',
    rose: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/18 dark:bg-rose-500/10 dark:text-rose-300',
    sky: 'border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-500/18 dark:bg-sky-500/10 dark:text-sky-300',
    slate: 'border-border-default bg-[color:var(--dusk-surface-muted)] text-text-muted dark:border-white/8 dark:bg-surface-1/[0.04] dark:text-white/70',
  };
  return map[tone];
}

function statusBadge(status: CampaignStatus) {
  const map: Record<CampaignStatus, string> = {
    Live: 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/25 dark:text-emerald-300',
    Limited: 'border-amber-300/70 bg-amber-50 text-[color:var(--dusk-status-warning-fg)] dark:border-amber-500/40 dark:bg-amber-500/25 dark:text-amber-300',
    Blocked: 'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/25 dark:text-rose-300',
    Ready: 'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/25 dark:text-sky-300',
    Draft: 'border-border-strong/70 bg-[color:var(--dusk-surface-muted)] text-text-secondary dark:border-white/20 dark:bg-surface-1/[0.12] dark:text-white/70',
  };
  return map[status];
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ series, className }: { series: number[]; className?: string }) {
  const width = 170;
  const height = 54;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = Math.max(max - min, 1);
  const points = series.map((value, index) => {
    const x = (index / Math.max(series.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true">
      <polyline points={`${points.join(' ')} ${width},${height} 0,${height}`} fill="currentColor" opacity="0.12" />
      <polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendBadge({ direction, value }: { direction: TrendDirection; value: string }) {
  const classes =
    direction === 'up'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
      : direction === 'down'
        ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
        : 'border-border-default bg-[color:var(--dusk-surface-muted)] text-text-muted dark:border-white/8 dark:bg-surface-1/[0.03] dark:text-white/58';
  return <span className={classNames('rounded-full border px-2.5 py-1 text-xs font-semibold', classes)}>{value}</span>;
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({ metric }: { metric: Metric }) {
  const sparkColor =
    metric.tone === 'fuchsia' ? 'text-fuchsia-500 dark:text-fuchsia-300'
      : metric.tone === 'emerald' ? 'text-emerald-500 dark:text-emerald-300'
        : metric.tone === 'amber' ? 'text-amber-500 dark:text-amber-300'
          : metric.tone === 'rose' ? 'text-rose-500 dark:text-rose-300'
            : metric.tone === 'sky' ? 'text-sky-500 dark:text-sky-300'
              : 'text-text-muted dark:text-white/50';
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionKicker>{metric.label}</SectionKicker>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-3xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">{metric.value}</span>
            <TrendBadge direction={metric.direction} value={metric.delta} />
          </div>
          <p className="mt-2 text-sm text-text-muted dark:text-white/56">{metric.helper}</p>
        </div>
        <div className={classNames('flex h-12 w-12 items-center justify-center rounded-2xl border', toneClass(metric.tone))}>
          {metric.id === 'live' ? <GaugeIcon /> : metric.id === 'blocked' ? <AlertTriangleIcon /> : metric.id === 'spend' ? <ReportIcon /> : <TableIcon />}
        </div>
      </div>
      <Sparkline series={metric.series} className={classNames('mt-5 h-14 w-full', sparkColor)} />
    </Panel>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function CampaignStatusCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4 dark:border-white/8 dark:bg-surface-1/[0.025]">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted dark:text-white/40">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">{value}</p>
      <p className="mt-1 text-sm text-text-muted dark:text-white/52">{helper}</p>
    </div>
  );
}

// ─── Campaigns table ──────────────────────────────────────────────────────────

function CampaignsTable({
  campaignRows,
  liveCampaigns,
  blockedOrLimited,
  draftSetup,
  onEdit,
  onDelete,
  deletingId,
}: {
  campaignRows: CampaignRow[];
  liveCampaigns: number;
  blockedOrLimited: number;
  draftSetup: number;
  onEdit: (row: CampaignRow) => void;
  onDelete: (row: CampaignRow) => void;
  deletingId: string | null;
}) {
  return (
    <Panel className="overflow-hidden p-6">
      <div className="flex flex-col gap-4 border-b border-border-default pb-5 dark:border-white/8 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <SectionKicker>Campaign workspace</SectionKicker>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">Active &amp; setup campaigns</h2>
          <p className="mt-2 text-sm text-text-muted dark:text-white/56">Operational view for pacing, tag health, creative QA and launch readiness.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-1 px-3 py-2 text-sm font-medium text-text-secondary transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/8 dark:bg-surface-1/[0.03] dark:text-white/72 dark:hover:border-fuchsia-500/28 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-200">
            <FilterIcon className="h-4 w-4" />
            Filters
          </button>
          <Link to="/campaigns/new" className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#F1008B,#c026d3)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(241,0,139,0.24)]">
            New campaign
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <CampaignStatusCard title="Total" value={String(campaignRows.length)} helper="campaigns in workspace" />
        <CampaignStatusCard title="Live" value={String(liveCampaigns)} helper="eligible to deliver" />
        <CampaignStatusCard title="Needs attention" value={String(blockedOrLimited)} helper="blocked or limited" />
        <CampaignStatusCard title="Draft setup" value={String(draftSetup)} helper="missing setup steps" />
      </div>

      {campaignRows.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-border-default bg-surface-1/42 px-6 py-20 text-center dark:border-white/8 dark:bg-surface-1/[0.025]">
          <SectionKicker>Empty view</SectionKicker>
          <h3 className="mt-3 text-lg font-semibold text-[color:var(--dusk-text-primary)]">No campaigns match this view</h3>
          <p className="mt-2 text-sm text-text-muted dark:text-white/42">Try another advertiser filter or create a new campaign.</p>
        </div>
      ) : (
        <div className="app-scrollbar mt-6 overflow-auto rounded-3xl border border-border-default dark:border-white/8">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/8">
            <thead className="bg-[color:var(--dusk-surface-muted)]/80 dark:bg-surface-1/[0.02]">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted dark:text-white/42">
                <th className="px-5 py-4">Campaign</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Pacing</th>
                <th className="px-5 py-4">Spend</th>
                <th className="px-5 py-4">Tags</th>
                <th className="px-5 py-4">Creatives</th>
                <th className="px-5 py-4">Issues</th>
                <th className="px-5 py-4">Owner</th>
                <th className="px-5 py-4" aria-label="Actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/8">
              {campaignRows.map((campaign) => (
                <tr key={campaign.id} className="bg-surface-1/42 transition hover:bg-fuchsia-50/45 dark:bg-transparent dark:hover:bg-surface-1/[0.04]">
                  <td className="px-5 py-5">
                    <p className="font-semibold text-[color:var(--dusk-text-primary)]">{campaign.campaign}</p>
                    <p className="mt-1 text-xs text-text-muted dark:text-white/48">{campaign.advertiser} · {campaign.flight}</p>
                  </td>
                  <td className="px-5 py-5"><span className={classNames('inline-flex rounded-full border px-3 py-1 text-xs font-semibold', statusBadge(campaign.status))}>{campaign.status}</span></td>
                  <td className="px-5 py-5 font-medium text-text-secondary dark:text-white/72">{campaign.pacing}</td>
                  <td className="px-5 py-5 tabular-nums text-text-secondary dark:text-white/72"><span className="font-medium">{campaign.spend}</span><span className="text-[color:var(--dusk-text-soft)] dark:text-white/36"> / {campaign.budget}</span></td>
                  <td className="px-5 py-5 text-text-muted dark:text-white/62">{campaign.tagHealth}</td>
                  <td className="px-5 py-5 text-text-muted dark:text-white/62">{campaign.creativeStatus}</td>
                  <td className="px-5 py-5">
                    <span className={classNames('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', campaign.issues > 0 ? 'bg-amber-100 text-[color:var(--dusk-status-warning-fg)] dark:bg-amber-500/12 dark:text-amber-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-200')}>
                      {campaign.issues}
                    </span>
                  </td>
                  <td className="px-5 py-5 text-text-muted dark:text-white/62">{campaign.owner}</td>
                  <td className="px-5 py-5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(campaign)}
                        aria-label={`Edit ${campaign.campaign}`}
                        className="rounded-xl border border-transparent p-2 text-[color:var(--dusk-text-soft)] transition hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-600 dark:text-white/36 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
                      >
                        <MoreIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(campaign)}
                        disabled={deletingId === campaign.id}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:hover:bg-rose-500/10"
                      >
                        {deletingId === campaign.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function CampaignList() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQueryParam = searchParams.get('search') ?? '';
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [search, setSearch] = useState(() => searchQueryParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/v1/campaigns?scope=all', { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load campaigns');
        return r.json();
      }),
      loadWorkspaces(),
      loadAuthMe(),
    ])
      .then(([campaignData, workspaceData, authMe]) => {
        setCampaigns(campaignData?.campaigns ?? campaignData ?? []);
        setClients(workspaceData ?? []);
        setActiveWorkspaceId(authMe.workspace?.id ?? '');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => { setSearch(searchQueryParam); }, [searchQueryParam]);

  const filteredCampaigns = useMemo(() => campaigns.filter((campaign) => {
    const clientMatch = !selectedClientIds.length || selectedClientIds.includes(campaign.workspace_id ?? '');
    const needle = search.trim().toLowerCase();
    const searchMatch = !needle
      || campaign.name.toLowerCase().includes(needle)
      || (campaign.workspace_name ?? '').toLowerCase().includes(needle)
      || (campaign.advertiser?.name ?? '').toLowerCase().includes(needle)
      || (campaign.metadata?.dsp ?? '').toLowerCase().includes(needle);
    return clientMatch && searchMatch;
  }), [campaigns, search, selectedClientIds]);

  const campaignRows = useMemo<CampaignRow[]>(() => filteredCampaigns.map((campaign) => {
    const impressions = toNumber(campaign.impressions);
    const ctr = toNumber(campaign.ctr);
    const hoverMs = toNumber(campaign.totalHoverDurationMs ?? campaign.total_hover_duration_ms);
    let status: CampaignStatus = 'Draft';
    if (campaign.status === 'draft') status = 'Draft';
    else if (campaign.status === 'archived') status = 'Draft';
    else if (campaign.status === 'paused') status = impressions > 0 ? 'Limited' : 'Blocked';
    else if (impressions === 0 && hoverMs === 0) status = 'Ready';
    else if (ctr < 0.35 || impressions < 100) status = 'Limited';
    else status = 'Live';

    const issues =
      (status === 'Blocked' ? 2 : 0)
      + (status === 'Limited' ? 1 : 0)
      + (campaign.status === 'draft' ? 1 : 0)
      + (ctr === 0 && impressions > 0 ? 1 : 0);

    return {
      id: campaign.id,
      campaign: campaign.name,
      advertiser: campaign.workspace_name ?? campaign.advertiser?.name ?? 'Workspace',
      status,
      pacing: status === 'Ready' ? 'Not live' : status === 'Draft' ? 'Setup' : `${Math.max(0, Math.min(130, Math.round(ctr * 100)))}%`,
      spend: formatCompactMoney(toNumber(campaign.dailyBudget) * 7),
      budget: formatCompactMoney(toNumber(campaign.dailyBudget) * 10),
      tagHealth: impressions > 0 ? 'Healthy' : campaign.status === 'draft' ? 'Not generated' : 'Low firing',
      creativeStatus: hoverMs > 0 ? 'Approved' : campaign.status === 'draft' ? 'Not uploaded' : 'Pending QA',
      issues,
      owner: campaign.metadata?.dsp ?? 'Ad Ops',
      flight: formatDateRange(campaign.startDate ?? campaign.start_date, campaign.endDate ?? campaign.end_date),
      raw: campaign,
    };
  }), [filteredCampaigns]);

  const liveCampaigns = campaignRows.filter((c) => c.status === 'Live').length;
  const blockedOrLimited = campaignRows.filter((c) => c.status === 'Blocked' || c.status === 'Limited').length;
  const draftSetup = campaignRows.filter((c) => c.status === 'Draft' || c.status === 'Ready').length;
  const openIssues = campaignRows.reduce((sum, c) => sum + c.issues, 0);
  const trackedSpend = campaignRows.reduce((sum, c) => sum + toNumber(c.raw.dailyBudget) * 7, 0);
  const previousTrackedSpend = trackedSpend * 0.92;
  const needsAttentionRows = campaignRows.filter((c) => c.status === 'Blocked' || c.status === 'Limited').slice(0, 3);

  const metrics: Metric[] = [
    { id: 'live', label: 'Live campaigns', value: String(liveCampaigns), delta: `+${Math.max(0, liveCampaigns - 1)}`, direction: 'up', helper: 'currently eligible to deliver', tone: 'fuchsia', series: [1, 1, 2, 2, liveCampaigns || 1, liveCampaigns || 1, liveCampaigns || 1] },
    { id: 'blocked', label: 'Blocked / limited', value: String(blockedOrLimited), delta: `+${Math.max(0, blockedOrLimited - 1)}`, direction: blockedOrLimited > 0 ? 'up' : 'flat', helper: 'need delivery review', tone: 'amber', series: [0, 1, 1, 1, blockedOrLimited || 1, blockedOrLimited || 1, blockedOrLimited || 1] },
    { id: 'spend', label: 'Spend tracked', value: formatCompactMoney(trackedSpend), delta: computeDelta(trackedSpend, previousTrackedSpend).label, direction: computeDelta(trackedSpend, previousTrackedSpend).direction, helper: 'against active campaign budgets', tone: 'emerald', series: [18, 22, 26, 31, 34, 37, 42].map((n) => n * Math.max(trackedSpend / 15300, 0.2)) },
    { id: 'issues', label: 'Open issues', value: String(openIssues), delta: `+${Math.max(0, openIssues - 7)}`, direction: openIssues > 0 ? 'up' : 'flat', helper: 'tags, creatives and pacing', tone: 'rose', series: [4, 5, 5, 7, 8, 9, Math.max(openIssues, 1)] },
  ];

  const handleDelete = async (campaign: CampaignRow) => {
    const confirmed = await confirm({
      title: `Delete campaign "${campaign.campaign}"?`,
      description: 'This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
      requireTypeToConfirm: campaign.campaign,
    });
    if (!confirmed) return;
    setDeletingId(campaign.id);
    try {
      if (campaign.raw.workspace_id && campaign.raw.workspace_id !== activeWorkspaceId) {
        await switchWorkspace(campaign.raw.workspace_id);
        setActiveWorkspaceId(campaign.raw.workspace_id);
      }
      const res = await fetch(`/v1/campaigns/${campaign.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as any)?.message ?? 'Delete failed');
      }
      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      toast({ tone: 'warning', title: `Campaign "${campaign.campaign}" deleted` });
    } catch (deleteError: any) {
      toast({ tone: 'critical', title: deleteError.message ?? 'Failed to delete campaign.' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = async (campaign: CampaignRow) => {
    try {
      if (campaign.raw.workspace_id && campaign.raw.workspace_id !== activeWorkspaceId) {
        await switchWorkspace(campaign.raw.workspace_id);
        setActiveWorkspaceId(campaign.raw.workspace_id);
      }
      navigate(`/campaigns/${campaign.id}`);
    } catch {
      toast({ tone: 'critical', title: 'Failed to open campaign in its client workspace.' });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-fuchsia-500" />
      </div>
    );
  }

  if (error) {
    return (
      <Panel className="border-rose-200 bg-rose-50/70 p-4 text-rose-700 dark:border-rose-500/22 dark:bg-rose-500/10 dark:text-rose-300">
        <p className="font-medium">Error loading campaigns</p>
        <p className="mt-1 text-sm">{error}</p>
        <button onClick={load} className="mt-3 text-sm font-semibold text-rose-600 underline dark:text-rose-300">Retry</button>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">

          {/* ── Toolbar ── */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedClientIds[0] ?? ''}
                onChange={(e) => setSelectedClientIds(e.target.value ? [e.target.value] : [])}
                className="inline-flex min-h-[46px] min-w-[180px] items-center gap-2 rounded-xl border border-border-default/80 bg-[rgba(252,251,255,0.82)] px-4 text-sm font-medium text-text-secondary outline-none transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-surface-1/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:hover:bg-surface-1/[0.045]"
              >
                <option value="">All advertisers</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
              <button type="button" className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-border-default/80 bg-[rgba(252,251,255,0.82)] px-4 text-sm font-medium text-text-secondary transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-surface-1/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:hover:bg-surface-1/[0.045]">
                Active + setup
              </button>
              <label className="relative block min-w-[300px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--dusk-text-soft)] dark:text-white/40"><SearchIcon /></span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-h-[46px] w-full rounded-xl border border-border-default/80 bg-[rgba(252,251,255,0.82)] pl-10 pr-3 text-sm text-text-primary outline-none placeholder:text-[color:var(--dusk-text-soft)] transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/[0.06] dark:bg-surface-1/[0.025] dark:text-white dark:placeholder:text-white/30 dark:focus:border-fuchsia-500/30"
                  placeholder="Search campaign, advertiser, owner"
                />
              </label>
            </div>
            <Link
              to="/campaigns/new"
              className="inline-flex min-h-[46px] items-center rounded-xl bg-[linear-gradient(135deg,#F1008B,#c026d3)] px-5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(241,0,139,0.28)] transition hover:translate-y-[-1px] hover:shadow-[0_18px_42px_rgba(241,0,139,0.34)]"
            >
              New campaign
            </Link>
          </div>

          {/* ── Header ── */}
          <header className="grid gap-6 xl:grid-cols-[1.4fr_1fr] xl:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:border-fuchsia-500/15 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
                Campaigns
                <span className="h-1 w-1 rounded-full bg-current opacity-60" />
                Delivery workspace
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)] md:text-5xl">Campaign operations without the noise</h1>
              <p className="mt-3 max-w-3xl text-lg leading-8 text-text-muted dark:text-white/62">Scan campaign readiness, catch blockers, and move from pacing, tags or creative issues into action quickly.</p>
            </div>
            <Panel className="p-5">
              <SectionKicker>Recommended focus</SectionKicker>
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/18 dark:bg-amber-500/10">
                <AlertTriangleIcon className="text-amber-600 dark:text-amber-300" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-100">{needsAttentionRows.length} campaigns need attention</p>
                  <p className="mt-1 text-sm text-[color:var(--dusk-status-warning-fg)]/72 dark:text-amber-100/62">Review blocked delivery and limited pacing before making new trafficking changes.</p>
                </div>
              </div>
            </Panel>
          </header>

          {/* ── Metrics ── */}
          <div className="grid gap-5 xl:grid-cols-4">
            {metrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}
          </div>

          {/* ── Campaigns table ── */}
          <CampaignsTable
            campaignRows={campaignRows}
            liveCampaigns={liveCampaigns}
            blockedOrLimited={blockedOrLimited}
            draftSetup={draftSetup}
            onEdit={(row) => void handleEdit(row)}
            onDelete={(row) => void handleDelete(row)}
            deletingId={deletingId}
          />
    </div>
  );
}
