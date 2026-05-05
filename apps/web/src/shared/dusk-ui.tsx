import React from 'react';
import {
  BarChart3,
  ChevronDown,
  Gauge,
  Image,
  LayoutDashboard,
  Search,
  SquareKanban,
  Tag,
  TriangleAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function DuskLogo({ className = 'h-[34px] w-[136px] text-slate-950 dark:text-white' }: { className?: string }) {
  return (
    <svg
      viewBox="170 780 1710 520"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-label="DUSK logo"
      role="img"
      fill="none"
    >
      <g fill="currentColor">
        <path d="M 172.307 828.906 L 291.688 828.909 C 343.041 828.897 394.658 825.173 443.902 839.993 C 472.745 848.712 498.998 864.398 520.342 885.667 C 591.476 956.148 594.786 1087.65 523.276 1158.67 C 497.882 1183.89 466.22 1201.88 431.555 1210.78 C 390.657 1221.61 337.928 1219.08 294.744 1219.06 L 172.07 1219.05 L 172.093 1107.25 L 172.076 971.079 C 195.267 970.457 220.324 971.014 243.744 970.844 C 245.092 1011.28 243.464 1052.91 243.978 1093.46 C 244.226 1112.99 243.155 1133.76 245.259 1153.12 C 269.254 1153.55 292.4 1153.08 316.389 1153.34 C 368.487 1154.62 421.248 1156.76 463.538 1120.04 C 514.191 1076.05 515.298 985.558 472.496 936.035 C 430.726 887.705 374.038 895.556 317.449 894.589 C 269.568 893.771 219.68 896.567 172.136 894.294 C 171.668 874.175 171.526 848.92 172.307 828.906 z" />
        <path d="M 635.256 828.662 C 658.543 829.198 682.876 828.997 706.258 829.172 C 705.685 873.038 705.863 917.714 705.976 961.705 C 706.34 998.905 703.778 1032.97 710.027 1070.01 C 728.656 1180.43 907.645 1186.89 934.512 1079.5 C 943.252 1044.57 940.007 1004.61 940.043 968.012 L 940.092 828.716 C 961.536 829.726 989.742 828.977 1011.8 829.111 C 1012.31 849.748 1012 871.06 1011.95 891.75 L 1011.97 1025.92 C 1011.69 1082.84 999.774 1130.65 957.808 1171.83 C 920.534 1208.41 866.667 1221.67 815.533 1220.99 C 765.807 1220.33 720.123 1202.65 684.771 1167.41 C 626.456 1109.28 635.291 1029.84 634.981 954.148 C 634.815 913.443 634.387 869.654 635.256 828.662 z" />
        <path d="M 1179.72 829.372 C 1186.67 828.135 1238.91 829.01 1248.99 829.012 L 1419.86 828.933 C 1411.79 846.114 1395.67 878.848 1386.14 894.536 C 1372.94 895.568 1348.45 894.776 1334.35 894.754 L 1233.74 894.67 C 1197.14 894.701 1138.68 887.942 1137.72 941.923 C 1136.77 994.831 1196.61 989.988 1232.75 990.795 C 1272.46 991.682 1320.57 987.096 1358.67 998.002 C 1377.09 1003.39 1393.84 1013.38 1407.35 1027.01 C 1427.24 1046.84 1436.95 1073.62 1437.47 1101.46 C 1438.73 1168.66 1385.97 1214.11 1321.61 1218.68 C 1312.6 1219.32 1302.86 1219.1 1293.5 1219.05 L 1052.36 1219.1 C 1061.89 1199.29 1074.41 1172.27 1085.25 1153.42 C 1098.95 1154.22 1116.27 1153.24 1130.26 1153.18 L 1212 1153.35 L 1285.45 1153.48 C 1309.3 1153.31 1339.2 1156.7 1355.43 1135.77 C 1364.41 1124.18 1366.61 1108.83 1364.04 1094.95 C 1356.53 1054.43 1319.6 1056.22 1287.51 1057.04 C 1227.39 1055.68 1157 1065.94 1106.39 1027.35 C 1060.17 992.101 1053.86 918.801 1089.43 874.162 C 1113.21 844.109 1142.79 833.906 1179.72 829.372 z" />
        <path d="M 1488.53 828.282 C 1497.81 829.856 1548.04 828.92 1559.84 828.874 C 1561.26 906.421 1559.88 988.274 1559.85 1066.18 L 1560.02 1159.98 C 1560.05 1167.48 1561.05 1213.21 1558.77 1217.84 C 1556.27 1219.69 1553.54 1219.16 1550.25 1219.12 L 1488.72 1219.04 C 1487.44 1201.01 1488.55 1172.17 1488.46 1153.01 L 1488.47 1007.5 C 1488.64 979.249 1488.38 950.696 1488.48 922.419 C 1488.59 891.859 1486.87 858.603 1488.53 828.282 z" />
        <path d="M 1782.78 829.015 C 1790.47 828.275 1803.38 828.767 1811.4 828.823 C 1829.91 829.098 1848.43 829.093 1866.94 828.809 C 1849.5 850.273 1822.43 876.865 1802.74 897.427 C 1764.38 937.432 1726.28 977.69 1688.46 1018.2 C 1696.83 1026.03 1706.22 1036.63 1714.19 1045.09 C 1732.05 1064.03 1749.78 1083.07 1767.39 1102.24 C 1778.58 1114.21 1873.67 1212.66 1875.41 1217.56 L 1874.22 1218.92 L 1869.25 1219.11 C 1850.28 1218.86 1831.18 1219.22 1812.21 1219.08 C 1801.31 1218.99 1788.79 1219.54 1778.07 1218.29 C 1770.27 1211.63 1757.71 1197.58 1750.24 1189.66 L 1699.9 1136.17 L 1640.11 1072.53 C 1627.71 1059.44 1607.42 1039.2 1597.39 1025.38 C 1604.99 1014.99 1623.92 996.048 1633.33 986.21 L 1691.9 924.466 L 1749.92 862.638 C 1758.11 853.907 1774.13 835.819 1782.78 829.015 z" />
      </g>
    </svg>
  );
}

export function GlobalScrollbarStyles() {
  return (
    <style>{`
      .app-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: rgba(148, 163, 184, 0.38) transparent;
      }
      .app-scrollbar::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      .app-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
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
      .app-scrollbar::-webkit-scrollbar-corner {
        background: transparent;
      }
      .dark .app-scrollbar {
        scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
      }
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

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'rounded-[28px] border border-slate-200 bg-white/85 shadow-[0_18px_60px_rgba(28,18,41,0.08)] backdrop-blur-xl',
        'dark:border-white/[0.07] dark:bg-white/[0.035] dark:shadow-[0_22px_70px_rgba(0,0,0,0.28)]',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionKicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-white/[0.42]', className)}>
      {children}
    </p>
  );
}

export function PrimaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex min-h-[46px] items-center rounded-xl bg-[linear-gradient(135deg,#F1008B,#c026d3)] px-5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(241,0,139,0.28)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_42px_rgba(241,0,139,0.34)] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-200/80 bg-[rgba(252,251,255,0.82)] px-4 text-sm font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/[0.86] dark:hover:border-fuchsia-500/22 dark:hover:bg-white/[0.045] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

type StatusTone = 'healthy' | 'warning' | 'critical' | 'info' | 'neutral';

const statusToneClass: Record<StatusTone, string> = {
  healthy: 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/22 dark:bg-emerald-500/10 dark:text-emerald-300',
  warning: 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-500/22 dark:bg-amber-500/10 dark:text-amber-300',
  critical: 'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-500/22 dark:bg-rose-500/10 dark:text-rose-300',
  info: 'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-500/22 dark:bg-sky-500/10 dark:text-sky-300',
  neutral: 'border-slate-300/70 bg-slate-50 text-slate-700 dark:border-white/12 dark:bg-white/[0.05] dark:text-white/[0.70]',
};

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-semibold', statusToneClass[tone], className)}>
      {children}
    </span>
  );
}

type DuskSidebarItem = {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  badge?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

function DuskSidebarItemRow({
  item,
}: {
  item: DuskSidebarItem;
}) {
  return (
    <button
      type="button"
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm transition',
        item.active
          ? 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300'
          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-950 dark:text-white/[0.66] dark:hover:bg-white/[0.05] dark:hover:text-white',
      )}
      onClick={item.onClick}
    >
      {item.active ? <span className="absolute left-0 top-2.5 h-9 w-1 rounded-r-full bg-fuchsia-500" /> : null}
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition',
          item.active
            ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-500/24 dark:bg-fuchsia-500/10 dark:text-fuchsia-300'
            : 'border-slate-200 bg-white/60 text-slate-500 group-hover:border-fuchsia-200 group-hover:text-fuchsia-600 dark:border-white/10 dark:bg-white/[0.025] dark:text-white/[0.56] dark:group-hover:border-fuchsia-500/20 dark:group-hover:text-fuchsia-300',
        )}
      >
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
      {item.badge ? (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
            item.active
              ? 'bg-fuchsia-600 text-white'
              : 'bg-slate-100 text-slate-500 dark:bg-white/[0.08] dark:text-white/[0.56]',
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </button>
  );
}

export type SidebarItemName =
  | 'Overview'
  | 'Campaigns'
  | 'Tags'
  | 'Creatives'
  | 'Pacing'
  | 'Discrepancies'
  | 'Reporting';

export type AdvertiserOption = {
  id: string;
  name: string;
  meta?: string;
};

type SidebarNavItem = {
  label: SidebarItemName;
  icon: React.ReactNode;
};

function SidebarNavGroup({
  title,
  items,
  activeItem,
  badgeCounts,
  onNavigate,
}: {
  title: string;
  items: readonly SidebarNavItem[];
  activeItem: SidebarItemName;
  badgeCounts?: Partial<Record<SidebarItemName, string>>;
  onNavigate: (item: SidebarItemName) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-white/[0.22]">
        {title}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <DuskSidebarItemRow
            key={item.label}
            item={{
              ...item,
              active: activeItem === item.label,
              badge: badgeCounts?.[item.label],
              onClick: () => onNavigate(item.label),
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function Sidebar({
  activeItem,
  badgeCounts,
  advertiserSelector,
  search,
}: {
  activeItem: SidebarItemName;
  badgeCounts?: Partial<Record<SidebarItemName, string>>;
  advertiserSelector?: {
    value: string;
    options: AdvertiserOption[];
    onChange: (advertiserId: string) => void;
  };
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
}) {
  const navigate = useNavigate();
  const operations = [
    { label: 'Overview', icon: <LayoutDashboard className="h-5 w-5" strokeWidth={1.8} /> },
    { label: 'Campaigns', icon: <SquareKanban className="h-5 w-5" strokeWidth={1.8} /> },
    { label: 'Tags', icon: <Tag className="h-5 w-5" strokeWidth={1.8} /> },
    { label: 'Creatives', icon: <Image className="h-5 w-5" strokeWidth={1.8} /> },
  ] as const satisfies readonly SidebarNavItem[];
  const monitoring = [
    { label: 'Pacing', icon: <Gauge className="h-5 w-5" strokeWidth={1.8} /> },
    { label: 'Discrepancies', icon: <TriangleAlert className="h-5 w-5" strokeWidth={1.8} /> },
    { label: 'Reporting', icon: <BarChart3 className="h-5 w-5" strokeWidth={1.8} /> },
  ] as const satisfies readonly SidebarNavItem[];
  const routeForItem: Record<SidebarItemName, string> = {
    Overview: '/overview',
    Campaigns: '/campaigns',
    Tags: '/tags',
    Creatives: '/creatives',
    Pacing: '/pacing',
    Discrepancies: '/discrepancies',
    Reporting: '/reporting',
  };

  return (
    <aside
      className="app-scrollbar sticky top-0 hidden h-screen w-[280px] shrink-0 overflow-y-auto border-r border-slate-200/80 bg-white/84 px-3 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1020]/90 lg:block"
    >
      <div className="flex min-h-full flex-col">
        <div className="px-2 pb-5">
          <DuskLogo className="h-[34px] w-[136px] text-slate-950 dark:text-white" />
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-white/40">Adserver workspace</p>
        </div>

        <button
          type="button"
          className="mb-3 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white/58 px-3 py-2.5 text-left transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/8 dark:bg-white/[0.025] dark:hover:border-fuchsia-500/22 dark:hover:bg-white/[0.045]"
        >
          {advertiserSelector ? (
            <div className="relative w-full">
              <select
                value={advertiserSelector.value}
                onChange={(event) => advertiserSelector.onChange(event.target.value)}
                className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white/58 px-3 pr-10 text-sm font-semibold text-slate-800 outline-none transition hover:border-fuchsia-300 focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/8 dark:bg-white/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:focus:border-fuchsia-500/26"
              >
                {advertiserSelector.options.map((option) => (
                  <option key={option.id} value={option.id} className="bg-white text-slate-900 dark:bg-[#111114] dark:text-white">
                    {option.name}
                    {option.meta ? ` · ${option.meta}` : ''}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/36">
                <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
              </span>
            </div>
          ) : (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-800 dark:text-white/86">All advertisers</span>
              <span className="block truncate text-xs text-slate-500 dark:text-white/38">5 active clients</span>
            </span>
          )}
        </button>

        <label className="relative mb-5 block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-white/36" />
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-white/58 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/8 dark:bg-white/[0.025] dark:text-white dark:placeholder:text-white/30 dark:focus:border-fuchsia-500/26"
            value={search?.value ?? ''}
            onChange={(event) => search?.onChange(event.target.value)}
            placeholder={search?.placeholder ?? 'Jump to campaign'}
          />
        </label>

        <nav className="space-y-5">
          <SidebarNavGroup
            title="Operations"
            items={operations}
            activeItem={activeItem}
            badgeCounts={badgeCounts}
            onNavigate={(item) => navigate(routeForItem[item])}
          />
          <SidebarNavGroup
            title="Monitoring"
            items={monitoring}
            activeItem={activeItem}
            badgeCounts={badgeCounts}
            onNavigate={(item) => navigate(routeForItem[item])}
          />
        </nav>
      </div>
    </aside>
  );
}

export function AppShell({
  activeItem,
  badgeCounts,
  advertiserSelector,
  search,
  children,
}: {
  activeItem: SidebarItemName;
  badgeCounts?: Partial<Record<SidebarItemName, string>>;
  advertiserSelector?: {
    value: string;
    options: AdvertiserOption[];
    onChange: (advertiserId: string) => void;
  };
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen overflow-hidden bg-[#f6f3fb] text-slate-950 dark:bg-[#0b1020] dark:text-white">
      <GlobalScrollbarStyles />
      <Sidebar activeItem={activeItem} badgeCounts={badgeCounts} advertiserSelector={advertiserSelector} search={search} />
      <div className="flex min-w-0 flex-1 flex-col bg-[#f6f3fb] dark:bg-[#0b1020]">
        {children}
      </div>
    </div>
  );
}
