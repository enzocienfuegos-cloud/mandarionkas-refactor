import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { loadPreference, savePreference } from '../shared/preferences';
import { getPlatformRoleLabel } from '../shared/roles';
import { AppShell } from './AppShell';
import { ShellCommands } from './ShellCommands';
import { SessionError } from './SessionError';
import { useShellGuards } from './hooks/useShellGuards';
import { useShellSession } from './hooks/useShellSession';
import { useShellTheme } from './hooks/useShellTheme';
import { useShellWorkspaces } from './hooks/useShellWorkspaces';
import { getStudioUrl, resolveActiveItem } from './utils';
import { Button, CenteredSpinner, Panel, useCommandPalette } from '../system';

export default function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const palette = useCommandPalette();
  const session = useShellSession();
  const workspace = useShellWorkspaces(session.user, session.applyAuth);
  const theme = useShellTheme();
  const guards = useShellGuards(session.user, session.loading);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState<boolean>(
    () => loadPreference('dusk:sidebar-collapsed') === '1',
  );

  React.useEffect(() => {
    if (!session.user) return;
    void theme.sync().then(() => {
      setSidebarCollapsed(loadPreference('dusk:sidebar-collapsed') === '1');
    });
  }, [session.user, theme]);

  const activeItem = React.useMemo(() => resolveActiveItem(location.pathname), [location.pathname]);

  if (session.loading) {
    return <div className="flex h-screen items-center justify-center bg-bg"><CenteredSpinner label="Loading workspace…" /></div>;
  }

  if (session.error) {
    return <SessionError error={session.error} onRetry={() => void session.retry()} />;
  }

  const handleSignOut = async () => {
    try {
      await fetch('/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      navigate('/login');
    }
  };

  return (
    <AppShell
      activeItem={activeItem}
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebarCollapsed={() => setSidebarCollapsed((current) => {
        const next = !current;
        savePreference('dusk:sidebar-collapsed', next ? '1' : '0');
        return next;
      })}
      topbar={{
        workspaces: workspace.workspaces.map((item) => ({ id: item.id, name: item.name })),
        activeWorkspaceId: workspace.activeWorkspaceId,
        onWorkspaceChange: (id) => void workspace.switchActiveWorkspace(id),
        theme: theme.theme,
        onThemeToggle: theme.toggle,
        notificationCount: 0,
        onSearchClick: palette.open,
        user: session.user ? {
          initials: `${session.user.firstName?.[0] ?? ''}${session.user.lastName?.[0] ?? ''}` || 'SA',
          name: `${session.user.firstName} ${session.user.lastName}`.trim() || 'Account',
          email: session.user.email,
        } : undefined,
      }}
    >
      <div className="dusk-page">
        <ShellCommands themeMode={theme.theme} onToggleTheme={theme.toggle} onSignOut={() => void handleSignOut()} />
        {guards.canRenderCurrentRoute ? (
          <Outlet key={session.user?.workspace.id ?? 'shell'} context={{ user: session.user, theme: theme.theme, toggleTheme: theme.toggle }} />
        ) : (
          <Panel padding="lg" className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">No Ad Server access</h1>
            <p className="mt-2 text-sm text-[color:var(--dusk-text-muted)]">
              Your role ({getPlatformRoleLabel(session.user?.role)}) does not include Ad Server access for this workspace.
              Contact an admin if you need it.
            </p>
            {session.user?.workspace.productAccess.studio !== false ? (
              <Button variant="primary" className="mt-5" onClick={() => window.open(getStudioUrl(), '_blank', 'noopener')}>
                Launch Studio
              </Button>
            ) : null}
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
