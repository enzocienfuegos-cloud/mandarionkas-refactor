import React, { useEffect, useState } from 'react';
import { cn } from '../system/cn';
import { Sidebar, type SidebarItemId } from './Sidebar';
import { TopBar, type TopBarProps } from './TopBar';

export interface AppShellProps {
  activeItem: SidebarItemId;
  /** Optional badge counts to render in sidebar items */
  badgeCounts?: Partial<Record<SidebarItemId, string | number>>;
  /** Top bar props (workspace, search, theme, user) */
  topbar: TopBarProps;
  sidebarCollapsed?: boolean;
  onToggleSidebarCollapsed?: () => void;
  children: React.ReactNode;
}

/**
 * Application shell.
 *
 * Layout:
 *   [Sidebar 280px] [Topbar 56px sticky]
 *                   [Outlet content]
 *
 * The sidebar is hidden under 1024px (lg). On mobile, a drawer
 * triggered from the topbar opens it.
 */
export function AppShell({
  activeItem,
  badgeCounts,
  topbar,
  sidebarCollapsed = false,
  onToggleSidebarCollapsed,
  children,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close mobile nav on route change (handled by parent re-rendering activeItem)
  useEffect(() => {
    setMobileNavOpen(false);
  }, [activeItem]);

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-[color:var(--dusk-text-primary)]">
      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar
          activeItem={activeItem}
          badgeCounts={badgeCounts}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={onToggleSidebarCollapsed}
        />
      </div>

      {/* Mobile drawer overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-overlay lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute left-0 top-0 bottom-0 w-[280px] animate-[duskSlideIn_240ms_var(--dusk-ease-enter)]"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar activeItem={activeItem} badgeCounts={badgeCounts} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar {...topbar} onMobileMenuClick={() => setMobileNavOpen(true)} />
        <main
          className={cn(
            'dusk-scrollbar flex-1 overflow-y-auto',
            'bg-bg',
          )}
        >
          {children}
        </main>
      </div>

      <style>{`
        @keyframes duskSlideIn {
          from { transform: translateX(-100%) }
          to   { transform: translateX(0) }
        }
      `}</style>
    </div>
  );
}
