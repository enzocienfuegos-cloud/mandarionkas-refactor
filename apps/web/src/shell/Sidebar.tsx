import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Megaphone,
  Tags,
  ImageIcon,
  Gauge,
  AlertTriangle,
  BarChart3,
  Wrench,
  Settings,
  Users,
  FlaskConical,
  ChevronLeft,
} from '../system/icons';
import { cn } from '../system/cn';
import { DuskLogo } from './DuskLogo';

export type SidebarItemId =
  | 'overview'
  | 'campaigns'
  | 'tags'
  | 'creatives'
  | 'pacing'
  | 'discrepancies'
  | 'reporting'
  | 'experiments'
  | 'clients'
  | 'tools'
  | 'settings';

interface NavItem {
  id: SidebarItemId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * The complete navigation tree. EVERY route reachable in the app must
 * appear here. If a route exists in App.tsx but not here, it is dead UX.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { id: 'overview',  label: 'Overview',  icon: LayoutDashboard, to: '/overview' },
      { id: 'campaigns', label: 'Campaigns', icon: Megaphone,       to: '/campaigns' },
      { id: 'tags',      label: 'Tags',      icon: Tags,            to: '/tags' },
      { id: 'creatives', label: 'Creatives', icon: ImageIcon,       to: '/creatives' },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { id: 'pacing',        label: 'Pacing',        icon: Gauge,          to: '/pacing' },
      { id: 'discrepancies', label: 'Discrepancies', icon: AlertTriangle,  to: '/discrepancies' },
      { id: 'reporting',     label: 'Reporting',     icon: BarChart3,      to: '/reporting' },
      { id: 'experiments',   label: 'Experiments',   icon: FlaskConical,   to: '/experiments' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { id: 'clients',  label: 'Clients',  icon: Users,    to: '/clients' },
      { id: 'tools',    label: 'Tools',    icon: Wrench,   to: '/tools' },
      { id: 'settings', label: 'Settings', icon: Settings, to: '/settings' },
    ],
  },
];

export interface SidebarProps {
  activeItem: SidebarItemId;
  badgeCounts?: Partial<Record<SidebarItemId, string | number>>;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function Sidebar({ activeItem, badgeCounts, collapsed = false, onToggleCollapsed }: SidebarProps) {
  return (
    <aside
      className={cn(
        'dusk-scrollbar h-screen overflow-y-auto',
        'border-r border-[color:var(--dusk-border-default)]',
        'bg-surface-1 backdrop-blur-xl',
        'transition-[width] duration-base ease-standard',
      )}
      style={{ width: collapsed ? '64px' : 'var(--dusk-sidebar-width)' }}
      aria-label="Primary navigation"
    >
      <div className={cn('flex h-full flex-col py-4', collapsed ? 'px-2' : 'px-3')}>
        {/* Brand */}
        <div className={cn('pb-5', collapsed ? 'px-1 flex justify-center' : 'px-2')}>
          <Link to="/" aria-label="DUSK home" className="inline-block">
            {collapsed ? (
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-text-inverse text-xs font-bold"
                style={{ background: 'var(--dusk-brand-gradient)' }}
              >
                D
              </div>
            ) : (
              <>
                <DuskLogo className="h-[34px] w-auto text-[color:var(--dusk-text-primary)]" />
                <p className="mt-1 text-xs text-[color:var(--dusk-text-soft)]">Adserver workspace</p>
              </>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className={cn('flex-1', collapsed ? 'space-y-1' : 'space-y-5')}>
          {NAV_GROUPS.map((group) => (
            <NavGroupRender
              key={group.title}
              group={group}
              activeItem={activeItem}
              badgeCounts={badgeCounts}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="mt-4 border-t border-[color:var(--dusk-border-subtle)] pt-3">
          {!collapsed && <SystemStatus />}
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(
                'mt-2 w-full flex items-center justify-center h-8 rounded-lg',
                'text-[color:var(--dusk-text-soft)] hover:text-[color:var(--dusk-text-primary)]',
                'hover:bg-[color:var(--dusk-surface-hover)] transition-colors',
              )}
            >
              <ChevronLeft
                className={cn(
                  'h-4 w-4 transition-transform duration-base',
                  collapsed ? 'rotate-180' : '',
                )}
              />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavGroupRender({
  group,
  activeItem,
  badgeCounts,
  collapsed,
}: {
  group: NavGroup;
  activeItem: SidebarItemId;
  badgeCounts?: Partial<Record<SidebarItemId, string | number>>;
  collapsed?: boolean;
}) {
  return (
    <div>
      {!collapsed && (
        <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-kicker text-[color:var(--dusk-text-soft)]">
          {group.title}
        </p>
      )}
      <ul className="space-y-0.5">
        {group.items.map((item) => (
          <NavItemRow
            key={item.id}
            item={item}
            isActive={activeItem === item.id}
            badge={badgeCounts?.[item.id]}
            collapsed={collapsed}
          />
        ))}
      </ul>
    </div>
  );
}

function NavItemRow({
  item,
  isActive,
  badge,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  badge?: string | number;
  collapsed?: boolean;
}) {
  const navigate = useNavigate();
  const Icon = item.icon;

  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(item.to)}
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          'group relative flex w-full items-center rounded-lg text-sm font-medium',
          'transition-colors duration-base ease-standard text-left',
          collapsed ? 'h-10 justify-center' : 'gap-3 px-2.5 h-9',
          isActive
            ? 'bg-surface-active text-text-brand'
            : 'text-[color:var(--dusk-text-secondary)] hover:bg-[color:var(--dusk-surface-hover)] hover:text-[color:var(--dusk-text-primary)]',
        )}
      >
        {isActive && !collapsed && (
          <span
            aria-hidden
            className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-brand-500"
          />
        )}
        <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-text-brand' : 'text-[color:var(--dusk-text-muted)]')} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {badge !== undefined && badge !== null && (
              <span
                className={cn(
                  'shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold',
                  isActive
                    ? 'bg-brand-500 text-white'
                    : 'bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-muted)]',
                )}
              >
                {badge}
              </span>
            )}
          </>
        )}
        {collapsed && badge !== undefined && badge !== null && (
          <span
            className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-brand-500"
            aria-hidden
          />
        )}
      </button>
    </li>
  );
}

function SystemStatus() {
  return (
    <div className="px-2 py-2">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <p className="text-xs text-[color:var(--dusk-text-muted)]">All systems serving</p>
      </div>
    </div>
  );
}
