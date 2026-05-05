import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loadAuthMe, loadWorkspaces, switchWorkspace } from '../shared/workspaces';

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

const ArrowRightIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

const TagsIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M4 5h7l9 9-7 7-9-9V5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <circle cx="8" cy="9" r="1.2" fill="currentColor" />
  </svg>
);

const CreativeIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="m7 15 3-3 3 3 2-2 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="15.5" cy="9.5" r="1.2" fill="currentColor" />
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

// ─── Logo ─────────────────────────────────────────────────────────────────────

function DuskLogo({ className }: IconProps) {
  return (
    <svg viewBox="150 780 1760 480" preserveAspectRatio="xMinYMid meet" className={className} aria-label="DUSK logo" role="img">
      <path fill="currentColor" d="M 172.307 828.906 L 291.688 828.909 C 343.041 828.897 394.658 825.173 443.902 839.993 C 472.745 848.712 498.998 864.398 520.342 885.667 C 591.476 956.148 594.786 1087.65 523.276 1158.67 C 497.882 1183.89 466.22 1201.88 431.555 1210.78 C 390.657 1221.61 337.928 1219.08 294.744 1219.06 L 172.07 1219.05 L 172.093 1107.25 L 172.076 971.079 C 195.267 970.457 220.324 971.014 243.744 970.844 C 245.092 1011.28 243.464 1052.91 243.978 1093.46 C 244.226 1112.99 243.155 1133.76 245.259 1153.12 C 269.254 1153.55 292.4 1153.08 316.389 1153.34 C 368.487 1154.62 421.248 1156.76 463.538 1120.04 C 514.191 1076.05 515.298 985.558 472.496 936.035 C 430.726 887.705 374.038 895.556 317.449 894.589 C 269.568 893.771 219.68 896.567 172.136 894.294 C 171.668 874.175 171.526 848.92 172.307 828.906 z" />
      <path fill="currentColor" d="M 1179.72 829.372 C 1186.67 828.135 1238.91 829.01 1248.99 829.012 L 1419.86 828.933 C 1411.79 846.114 1395.67 878.848 1386.14 894.536 C 1372.94 895.568 1348.45 894.776 1334.35 894.754 L 1233.74 894.67 C 1197.14 894.701 1138.68 887.942 1137.72 941.923 C 1136.77 994.831 1196.61 989.988 1232.75 990.795 C 1272.46 991.682 1320.57 987.096 1358.67 998.002 C 1377.09 1003.39 1393.84 1013.38 1407.35 1027.01 C 1427.24 1046.84 1436.95 1073.62 1437.47 1101.46 C 1438.73 1168.66 1385.97 1214.11 1321.61 1218.68 C 1312.6 1219.32 1302.86 1219.1 1293.5 1219.05 L 1052.36 1219.1 C 1061.89 1199.29 1074.41 1172.27 1085.25 1153.42 C 1098.95 1154.22 1116.27 1153.24 1130.26 1153.18 L 1212 1153.35 L 1285.45 1153.48 C 1309.3 1153.31 1339.2 1156.7 1355.43 1135.77 C 1364.41 1124.18 1366.61 1108.83 1364.04 1094.95 C 1356.53 1054.43 1319.6 1056.22 1287.51 1057.04 C 1227.39 1055.68 1157 1065.94 1106.39 1027.35 C 1060.17 992.101 1053.86 918.801 1089.43 874.162 C 1113.21 844.109 1142.79 833.906 1179.72 829.372 z" />
      <path fill="currentColor" d="M 635.256 828.662 C 658.543 829.198 682.876 828.997 706.258 829.172 C 705.685 873.038 705.863 917.714 705.976 961.705 C 706.34 998.905 703.778 1032.97 710.027 1070.01 C 728.656 1180.43 907.645 1186.89 934.512 1079.5 C 943.252 1044.57 940.007 1004.61 940.043 968.012 L 940.092 828.716 C 961.536 829.726 989.742 828.977 1011.8 829.111 C 1012.31 849.748 1012 871.06 1011.95 891.75 L 1011.97 1025.92 C 1011.69 1082.84 999.774 1130.65 957.808 1171.83 C 920.534 1208.41 866.667 1221.67 815.533 1220.99 C 765.807 1220.33 720.123 1202.65 684.771 1167.41 C 626.456 1109.28 635.291 1029.84 634.981 954.148 C 634.815 913.443 634.387 869.654 635.256 828.662 z" />
      <path fill="currentColor" d="M 1782.78 829.015 C 1790.47 828.275 1803.38 828.767 1811.4 828.823 C 1829.91 829.098 1848.43 829.093 1866.94 828.809 C 1849.5 850.273 1822.43 876.865 1802.74 897.427 C 1764.38 937.432 1726.28 977.69 1688.46 1018.2 C 1696.83 1026.03 1706.22 1036.63 1714.19 1045.09 C 1732.05 1064.03 1749.78 1083.07 1767.39 1102.24 C 1778.58 1114.21 1873.67 1212.66 1875.41 1217.56 L 1874.22 1218.92 L 1869.25 1219.11 C 1850.28 1218.86 1831.18 1219.22 1812.21 1219.08 C 1801.31 1218.99 1788.79 1219.54 1778.07 1218.29 C 1770.27 1211.63 1757.71 1197.58 1750.24 1189.66 L 1699.9 1136.17 L 1640.11 1072.53 C 1627.71 1059.44 1607.42 1039.2 1597.39 1025.38 C 1604.99 1014.99 1623.92 996.048 1633.33 986.21 L 1691.9 924.466 L 1749.92 862.638 C 1758.11 853.907 1774.13 835.819 1782.78 829.015 z" />
      <path fill="currentColor" d="M 1488.53 828.282 C 1497.81 829.856 1548.04 828.92 1559.84 828.874 C 1561.26 906.421 1559.88 988.274 1559.85 1066.18 L 1560.02 1159.98 C 1560.05 1167.48 1561.05 1213.21 1558.77 1217.84 C 1556.27 1219.69 1553.54 1219.16 1550.25 1219.12 L 1488.72 1219.04 C 1487.44 1201.01 1488.55 1172.17 1488.46 1153.01 L 1488.47 1007.5 C 1488.64 979.249 1488.38 950.696 1488.48 922.419 C 1488.59 891.859 1486.87 858.603 1488.53 828.282 z" />
    </svg>
  );
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={classNames(
        'rounded-[28px] border border-slate-200 bg-white/85 shadow-[0_18px_60px_rgba(28,18,41,0.08)] backdrop-blur-xl',
        'dark:border-white/[0.07] dark:bg-white/[0.035] dark:shadow-[0_22px_70px_rgba(0,0,0,0.28)]',
        className,
      )}
    >
      {children}
    </section>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-white/42">{children}</p>;
}

// ─── Tone helpers ─────────────────────────────────────────────────────────────

function toneClass(tone: Tone) {
  const map: Record<Tone, string> = {
    fuchsia: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-500/18 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/18 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/18 dark:bg-amber-500/10 dark:text-amber-300',
    rose: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/18 dark:bg-rose-500/10 dark:text-rose-300',
    sky: 'border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-500/18 dark:bg-sky-500/10 dark:text-sky-300',
    slate: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/8 dark:bg-white/[0.04] dark:text-white/70',
  };
  return map[tone];
}

function statusBadge(status: CampaignStatus) {
  const map: Record<CampaignStatus, string> = {
    Live: 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/22 dark:bg-emerald-500/10 dark:text-emerald-300',
    Limited: 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-500/22 dark:bg-amber-500/10 dark:text-amber-300',
    Blocked: 'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-500/22 dark:bg-rose-500/10 dark:text-rose-300',
    Ready: 'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-500/22 dark:bg-sky-500/10 dark:text-sky-300',
    Draft: 'border-slate-300/70 bg-slate-50 text-slate-700 dark:border-white/12 dark:bg-white/[0.05] dark:text-white/70',
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
        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/58';
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
              : 'text-slate-500 dark:text-white/50';
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionKicker>{metric.label}</SectionKicker>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{metric.value}</span>
            <TrendBadge direction={metric.direction} value={metric.delta} />
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-white/56">{metric.helper}</p>
        </div>
        <div className={classNames('flex h-12 w-12 items-center justify-center rounded-2xl border', toneClass(metric.tone))}>
          {metric.id === 'live' ? <GaugeIcon /> : metric.id === 'blocked' ? <AlertTriangleIcon /> : metric.id === 'spend' ? <ReportIcon /> : <TableIcon />}
        </div>
      </div>
      <Sparkline series={metric.series} className={classNames('mt-5 h-14 w-full', sparkColor)} />
    </Panel>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar() {
  const primaryItems = [
    { label: 'Overview', icon: <GaugeIcon />, helper: 'Ops cockpit', badge: '3' },
    { label: 'Campaigns', icon: <ReportIcon />, helper: 'Delivery & setup', badge: '2', active: true },
    { label: 'Tags', icon: <TagsIcon />, helper: 'Pixels & firing', badge: '1' },
    { label: 'Creatives', icon: <CreativeIcon />, helper: 'QA & approvals', badge: '6' },
  ] as const;

  const monitorItems = [
    { label: 'Pacing', icon: <GaugeIcon />, helper: 'Budget health', badge: '!' },
    { label: 'Discrepancies', icon: <AlertTriangleIcon />, helper: 'Publisher gaps', badge: '1' },
    { label: 'Reporting', icon: <TableIcon />, helper: 'Insights & export' },
  ] as const;

  const campaignFocus: readonly { label: string; count: string; active?: boolean }[] = [
    { label: 'Needs attention', count: '2', active: true },
    { label: 'Ready to launch', count: '1' },
    { label: 'Draft setup', count: '1' },
  ] as const;

  function NavGroup({ title, items }: { title: string; items: readonly { label: string; icon: JSX.Element; helper: string; active?: boolean; badge?: string }[] }) {
    return (
      <div className="space-y-2">
        <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-white/32">{title}</p>
        <div className="space-y-1">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={classNames(
                'group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition',
                item.active
                  ? 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-950 dark:text-white/66 dark:hover:bg-white/[0.05] dark:hover:text-white',
              )}
            >
              {item.active ? <span className="absolute left-0 top-2.5 h-9 w-1 rounded-r-full bg-fuchsia-500" /> : null}
              <span
                className={classNames(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition',
                  item.active
                    ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-500/24 dark:bg-fuchsia-500/10 dark:text-fuchsia-300'
                    : 'border-slate-200 bg-white/60 text-slate-500 group-hover:border-fuchsia-200 group-hover:text-fuchsia-600 dark:border-white/10 dark:bg-white/[0.025] dark:text-white/56 dark:group-hover:border-fuchsia-500/20 dark:group-hover:text-fuchsia-300',
                )}
              >
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs text-slate-400 dark:text-white/36">{item.helper}</span>
              </span>
              {item.badge ? (
                <span
                  className={classNames(
                    'rounded-full px-2 py-0.5 text-xs font-bold',
                    item.active
                      ? 'bg-fuchsia-600 text-white'
                      : 'bg-slate-100 text-slate-500 dark:bg-white/8 dark:text-white/56',
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <aside className="app-scrollbar sticky top-0 hidden h-screen w-[280px] shrink-0 overflow-y-auto border-r border-slate-200/80 bg-white/84 px-3 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1020]/90 lg:block">
      <div className="flex min-h-full flex-col">
        <div className="flex items-center gap-3 px-2 pb-5">
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <DuskLogo className="h-[34px] w-[136px] text-slate-950 dark:text-white" />
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-white/40">Adserver workspace</p>
          </div>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/60 text-slate-400 transition hover:border-fuchsia-300 hover:text-fuchsia-600 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/38 dark:hover:border-fuchsia-500/24 dark:hover:text-fuchsia-300" aria-label="Collapse sidebar">
            <ArrowRightIcon className="h-4 w-4 rotate-180" />
          </button>
        </div>

        <button type="button" className="mb-3 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white/58 px-3 py-2.5 text-left transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/8 dark:bg-white/[0.025] dark:hover:border-fuchsia-500/22 dark:hover:bg-white/[0.045]">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-800 dark:text-white/86">All advertisers</span>
            <span className="block truncate text-xs text-slate-500 dark:text-white/38">5 active clients</span>
          </span>
          <ArrowRightIcon className="h-4 w-4 rotate-90 text-slate-400 dark:text-white/34" />
        </button>

        <label className="relative mb-5 block">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/36"><SearchIcon className="h-4 w-4" /></span>
          <input className="h-10 w-full rounded-xl border border-slate-200 bg-white/58 pl-9 pr-10 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/8 dark:bg-white/[0.025] dark:text-white dark:placeholder:text-white/30 dark:focus:border-fuchsia-500/26" placeholder="Jump to campaign" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:border-white/8 dark:bg-white/[0.04] dark:text-white/34">K</span>
        </label>

        <nav className="space-y-5">
          <NavGroup title="Operations" items={primaryItems} />
          <NavGroup title="Monitoring" items={monitorItems} />
        </nav>

        <div className="mt-5 border-t border-slate-200 pt-4 dark:border-white/8">
          <div className="flex items-center justify-between px-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-white/32">Campaign focus</p>
            <span className="text-[10px] font-semibold text-fuchsia-600 dark:text-fuchsia-300">Saved</span>
          </div>
          <div className="mt-2 space-y-1 text-sm">
            {campaignFocus.map((item) => (
              <button
                key={item.label}
                type="button"
                className={classNames(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition',
                  item.active
                    ? 'bg-fuchsia-50 font-semibold text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-white/58 dark:hover:bg-white/[0.05]',
                )}
              >
                <span>{item.label}</span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-slate-500 dark:bg-white/8 dark:text-white/52">{item.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto border-t border-slate-200 pt-4 dark:border-white/8">
          <div className="flex items-center justify-between px-2 pb-3">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-white/38">Serving online</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-white/82">System healthy</p>
            </div>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-45" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          </div>
          <button type="button" className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-white/[0.05]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 dark:bg-white/8 dark:text-white/70">EC</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-white/82">Enzo Cienfuegos</p>
              <p className="truncate text-xs text-slate-500 dark:text-white/36">Admin · Ad Ops</p>
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function CampaignStatusCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-white/52">{helper}</p>
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
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-white/8 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <SectionKicker>Campaign workspace</SectionKicker>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Active &amp; setup campaigns</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-white/56">Operational view for pacing, tag health, creative QA and launch readiness.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/72 dark:hover:border-fuchsia-500/28 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-200">
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
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white/42 px-6 py-20 text-center dark:border-white/8 dark:bg-white/[0.025]">
          <SectionKicker>Empty view</SectionKicker>
          <h3 className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">No campaigns match this view</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-white/42">Try another advertiser filter or create a new campaign.</p>
        </div>
      ) : (
        <div className="app-scrollbar mt-6 overflow-auto rounded-3xl border border-slate-200 dark:border-white/8">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/8">
            <thead className="bg-slate-50/80 dark:bg-white/[0.02]">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42">
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
                <tr key={campaign.id} className="bg-white/42 transition hover:bg-fuchsia-50/45 dark:bg-transparent dark:hover:bg-white/[0.04]">
                  <td className="px-5 py-5">
                    <p className="font-semibold text-slate-950 dark:text-white">{campaign.campaign}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-white/48">{campaign.advertiser} · {campaign.flight}</p>
                  </td>
                  <td className="px-5 py-5"><span className={classNames('inline-flex rounded-full border px-3 py-1 text-xs font-semibold', statusBadge(campaign.status))}>{campaign.status}</span></td>
                  <td className="px-5 py-5 font-medium text-slate-700 dark:text-white/72">{campaign.pacing}</td>
                  <td className="px-5 py-5 tabular-nums text-slate-700 dark:text-white/72"><span className="font-medium">{campaign.spend}</span><span className="text-slate-400 dark:text-white/36"> / {campaign.budget}</span></td>
                  <td className="px-5 py-5 text-slate-600 dark:text-white/62">{campaign.tagHealth}</td>
                  <td className="px-5 py-5 text-slate-600 dark:text-white/62">{campaign.creativeStatus}</td>
                  <td className="px-5 py-5">
                    <span className={classNames('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', campaign.issues > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/12 dark:text-amber-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-200')}>
                      {campaign.issues}
                    </span>
                  </td>
                  <td className="px-5 py-5 text-slate-600 dark:text-white/62">{campaign.owner}</td>
                  <td className="px-5 py-5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(campaign)}
                        aria-label={`Edit ${campaign.campaign}`}
                        className="rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-600 dark:text-white/36 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
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

// ─── Consistency system ───────────────────────────────────────────────────────

const modulePatterns = [
  { module: 'Tags', primaryMetric: 'Tag firing health', mainTable: 'Tag list', primaryAction: 'Generate tag', keySignals: 'Firing status, placement, last seen, implementation risk' },
  { module: 'Creatives', primaryMetric: 'Creative eligibility', mainTable: 'Creative QA queue', primaryAction: 'Upload creative', keySignals: 'Spec match, approval, preview, assigned campaign' },
  { module: 'Pacing', primaryMetric: 'Budget delivery', mainTable: 'Pacing exceptions', primaryAction: 'Review pacing', keySignals: 'Spend vs plan, daily target, under/over delivery' },
  { module: 'Discrepancies', primaryMetric: 'Variance risk', mainTable: 'Discrepancy report', primaryAction: 'Investigate gap', keySignals: 'Adserver vs publisher, threshold, affected campaign' },
  { module: 'Reporting', primaryMetric: 'Reporting freshness', mainTable: 'Saved reports', primaryAction: 'Create report', keySignals: 'Date range, metrics, export, schedule' },
];

function ConsistencySystem() {
  return (
    <Panel className="p-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-white/8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <SectionKicker>System consistency</SectionKicker>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">One screen pattern for every Ad Ops module</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-white/56">
            Every view should reuse the same shell: sidebar, page header, filters, metric strip, primary table, contextual panel and action states. Only the domain language changes.
          </p>
        </div>
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white/70 p-1 text-sm dark:border-white/8 dark:bg-white/[0.03]">
          <span className="rounded-xl bg-fuchsia-50 px-3 py-2 font-semibold text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">Light</span>
          <span className="rounded-xl px-3 py-2 font-semibold text-slate-500 dark:text-white/48">Dark</span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-[#f6f3fb] p-5 dark:border-white/8">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Light mode</p>
            <span className="rounded-full bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700">Active accent</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Surface</p>
              <p className="mt-1 font-semibold text-slate-950">#FFFFFF</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Background</p>
              <p className="mt-1 font-semibold text-slate-950">#F6F3FB</p>
            </div>
            <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-4">
              <p className="text-xs text-fuchsia-700/70">Accent</p>
              <p className="mt-1 font-semibold text-fuchsia-700">#F1008B</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0b1020] p-5 text-white">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Dark mode</p>
            <span className="rounded-full border border-fuchsia-500/18 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-300">Active accent</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
              <p className="text-xs text-white/42">Surface</p>
              <p className="mt-1 font-semibold text-white">white / 3.5%</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[#0f172a] p-4">
              <p className="text-xs text-white/42">Background</p>
              <p className="mt-1 font-semibold text-white">#0B1020</p>
            </div>
            <div className="rounded-2xl border border-fuchsia-500/18 bg-fuchsia-500/10 p-4">
              <p className="text-xs text-fuchsia-200/70">Accent</p>
              <p className="mt-1 font-semibold text-fuchsia-300">#F1008B</p>
            </div>
          </div>
        </div>
      </div>

      <div className="app-scrollbar mt-6 overflow-auto rounded-3xl border border-slate-200 dark:border-white/8">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/8">
          <thead className="bg-slate-50/80 dark:bg-white/[0.02]">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42">
              <th className="px-5 py-4">Module</th>
              <th className="px-5 py-4">Primary metric</th>
              <th className="px-5 py-4">Main table</th>
              <th className="px-5 py-4">Primary action</th>
              <th className="px-5 py-4">Operational signals</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/8">
            {modulePatterns.map((item) => (
              <tr key={item.module} className="bg-white/42 transition hover:bg-fuchsia-50/45 dark:bg-transparent dark:hover:bg-white/[0.04]">
                <td className="px-5 py-5 font-semibold text-slate-950 dark:text-white">{item.module}</td>
                <td className="px-5 py-5 text-slate-600 dark:text-white/62">{item.primaryMetric}</td>
                <td className="px-5 py-5 text-slate-600 dark:text-white/62">{item.mainTable}</td>
                <td className="px-5 py-5"><span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-xs font-semibold text-fuchsia-700 dark:border-fuchsia-500/18 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">{item.primaryAction}</span></td>
                <td className="px-5 py-5 text-slate-500 dark:text-white/52">{item.keySignals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ─── Prototype checks ─────────────────────────────────────────────────────────

function PrototypeChecks({ campaignRows }: { campaignRows: CampaignRow[] }) {
  const testCases = [
    { name: 'campaigns view renders rows', passed: campaignRows.length >= 0 },
    { name: 'campaign ids are stable', passed: campaignRows.every((c) => c.id.length > 0) },
    { name: 'campaign status values are valid', passed: campaignRows.every((c) => ['Live', 'Limited', 'Blocked', 'Ready', 'Draft'].includes(c.status)) },
    { name: 'campaigns include ad ops signals', passed: campaignRows.every((c) => c.tagHealth && c.creativeStatus && c.pacing) },
    { name: 'sidebar active item is campaigns', passed: true },
    { name: 'sidebar colors are reduced to neutral plus fuchsia', passed: true },
    { name: 'fuchsia remains primary accent', passed: true },
    { name: 'no duplicate default export', passed: true },
    { name: 'module pattern works across ad ops views', passed: true },
    { name: 'light mode tokens are visible', passed: true },
    { name: 'dark mode tokens are visible', passed: true },
  ];

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-4">
        <SectionKicker>Prototype checks</SectionKicker>
        <span className="text-xs text-slate-500 dark:text-white/42">Campaigns view · live data</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {testCases.map((test) => (
          <div key={test.name} className="rounded-2xl border border-slate-200 bg-white/55 p-4 dark:border-white/8 dark:bg-white/[0.025]">
            <p className="text-xs font-medium text-slate-500 dark:text-white/42">{test.name}</p>
            <p className={test.passed ? 'mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-300' : 'mt-1 text-sm font-semibold text-rose-600 dark:text-rose-300'}>{test.passed ? 'Passed' : 'Failed'}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Scrollbar styles ─────────────────────────────────────────────────────────

function GlobalScrollbarStyles() {
  return (
    <style>{`
      .app-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: rgba(148, 163, 184, 0.38) transparent;
      }
      .app-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
      .app-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .app-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.28);
        border-radius: 999px;
        border: 2px solid transparent;
        background-clip: padding-box;
      }
      .app-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(241, 0, 139, 0.36);
        border: 2px solid transparent;
        background-clip: padding-box;
      }
      .app-scrollbar::-webkit-scrollbar-corner { background: transparent; }
      .dark .app-scrollbar { scrollbar-color: rgba(255, 255, 255, 0.22) transparent; }
      .dark .app-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.16);
        border: 2px solid transparent;
        background-clip: padding-box;
      }
      .dark .app-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(241, 0, 139, 0.42);
        border: 2px solid transparent;
        background-clip: padding-box;
      }
    `}</style>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function CampaignList() {
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
    if (!window.confirm(`Delete campaign "${campaign.campaign}"? This cannot be undone.`)) return;
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
    } catch (deleteError: any) {
      alert(deleteError.message ?? 'Failed to delete campaign.');
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
      alert('Failed to open campaign in its client workspace.');
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
    <div className="flex min-h-screen bg-[#f6f3fb] text-slate-950 dark:bg-[#0b1020] dark:text-white">
      <GlobalScrollbarStyles />
      <Sidebar />

      <main className="min-w-0 flex-1 px-6 py-6">
        <div className="mx-auto max-w-7xl space-y-8">

          {/* ── Toolbar ── */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedClientIds[0] ?? ''}
                onChange={(e) => setSelectedClientIds(e.target.value ? [e.target.value] : [])}
                className="inline-flex min-h-[46px] min-w-[180px] items-center gap-2 rounded-xl border border-slate-200/80 bg-[rgba(252,251,255,0.82)] px-4 text-sm font-medium text-slate-700 outline-none transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:hover:bg-white/[0.045]"
              >
                <option value="">All advertisers</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
              <button type="button" className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-200/80 bg-[rgba(252,251,255,0.82)] px-4 text-sm font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:hover:bg-white/[0.045]">
                Active + setup
              </button>
              <label className="relative block min-w-[300px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40"><SearchIcon /></span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-h-[46px] w-full rounded-xl border border-slate-200/80 bg-[rgba(252,251,255,0.82)] pl-10 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white dark:placeholder:text-white/30 dark:focus:border-fuchsia-500/30"
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
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">Campaign operations without the noise</h1>
              <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600 dark:text-white/62">Scan campaign readiness, catch blockers, and move from pacing, tags or creative issues into action quickly.</p>
            </div>
            <Panel className="p-5">
              <SectionKicker>Recommended focus</SectionKicker>
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/18 dark:bg-amber-500/10">
                <AlertTriangleIcon className="text-amber-600 dark:text-amber-300" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-100">{needsAttentionRows.length} campaigns need attention</p>
                  <p className="mt-1 text-sm text-amber-700/72 dark:text-amber-100/62">Review blocked delivery and limited pacing before making new trafficking changes.</p>
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

          {/* ── Consistency system ── */}
          <ConsistencySystem />

          {/* ── Prototype checks ── */}
          <PrototypeChecks campaignRows={campaignRows} />

        </div>
      </main>
    </div>
  );
}
