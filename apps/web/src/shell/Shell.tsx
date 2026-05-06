import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  loadAuthMe,
  loadWorkspaces,
  switchWorkspace,
  type WorkspaceOption,
} from '../shared/workspaces';
import { getPlatformRoleLabel } from '../shared/roles';
import { loadPreference, savePreference } from '../shared/preferences';
import {
  THEME_PREFERENCE_KEY,
  applyTheme,
  getInitialTheme,
  persistTheme,
  type ThemeMode,
} from '../shared/theme';
import { ShellCommands } from './ShellCommands';
import { useCommandPalette } from '../system';
import type { PlatformRole, ProductAccess } from '../shared/roles';
import { CenteredSpinner, Panel, Button } from '../system';
import { AppShell } from './AppShell';
import type { SidebarItemId } from './Sidebar';

interface ShellUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: PlatformRole;
  permissions: string[];
  workspace: { id: string; name: string; productAccess: ProductAccess };
}

function getStudioUrl(): string {
  const configured = import.meta.env.VITE_STUDIO_URL?.trim();
  if (configured) return configured;
  if (import.meta.env.DEV) return 'http://localhost:5174';
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname.startsWith('app-')) {
      return `${protocol}//${hostname.replace(/^app-/, 'studio-')}`;
    }
  }
  return '/';
}

/**
 * Application Shell.
 *
 * Responsibilities:
 *   1. Resolve the current user and workspace from the API.
 *   2. Provide the AppShell layout (sidebar + topbar) around the route outlet.
 *   3. Guard routes against missing product access.
 *   4. Manage theme.
 *
 * What it does NOT do anymore (vs S50):
 *   - Hardcoded badge counts (those were lies — removed).
 *   - Hardcoded campaign focus (decoration with fake data — removed).
 *
 * Page-specific filters live in pages, not here.
 */
export default function Shell() {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser]               = useState<ShellUser | null>(null);
  const [workspaces, setWorkspaces]   = useState<WorkspaceOption[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState('');
  const [theme, setTheme]             = useState<ThemeMode>(() => getInitialTheme());
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    () => loadPreference('dusk:sidebar-collapsed') === '1',
  );

  const initialised = useRef(false);

  // ── Initialisation ────────────────────────────────────────────────────
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    Promise.all([loadAuthMe(), loadWorkspaces('all')])
      .then(([authMe, workspaceList]) => {
        const displayName =
          String(authMe.user.name ?? '').trim() ||
          String(authMe.user.email).split('@')[0];
        const [firstName = '', ...rest] = displayName.split(/\s+/).filter(Boolean);

        setUser({
          id:          authMe.user.id,
          email:       authMe.user.email,
          firstName,
          lastName:    rest.join(' '),
          role:        authMe.user.role,
          permissions: authMe.permissions,
          workspace: {
            id:            authMe.workspace?.id ?? '',
            name:          authMe.workspace?.name ?? 'Workspace',
            productAccess: authMe.productAccess,
          },
        });
        setWorkspaces(workspaceList);
      })
      .catch((error: unknown) => {
        const status = (error as any)?.status ?? 0;
        if (status === 401) {
          navigate('/login', { replace: true });
        } else {
          setLoadError(
            `Could not load session: ${(error as Error)?.message ?? 'unknown error'}.`,
          );
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Route guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !user) return;

    const { ad_server: hasAdServer } = user.workspace.productAccess;
    const canAudit = user.permissions.includes('audit:read');
    const path = location.pathname;

    const isLauncherRoute  = path === '/' || path === '/launch';
    const isWorkspaceRoute = path.startsWith('/settings/workspace');
    const isAdServerRoute  = !isLauncherRoute && !isWorkspaceRoute;

    if (!hasAdServer && isAdServerRoute) {
      navigate('/launch', { replace: true });
      return;
    }

    if (!canAudit && path.startsWith('/settings/audit-log')) {
      navigate('/settings', { replace: true });
    }
  }, [loading, user, location.pathname, navigate]);

  // ── Theme ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const preferredTheme = loadPreference<ThemeMode>(THEME_PREFERENCE_KEY);
    if (preferredTheme === 'dark' || preferredTheme === 'light') setTheme(preferredTheme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
    savePreference(THEME_PREFERENCE_KEY, theme);
  }, [theme]);

  // ── Active sidebar item from current path ─────────────────────────────
  const activeItem: SidebarItemId = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/campaigns'))      return 'campaigns';
    if (path.startsWith('/tags'))           return 'tags';
    if (path.startsWith('/creatives'))      return 'creatives';
    if (path.startsWith('/pacing'))         return 'pacing';
    if (path.startsWith('/discrepancies'))  return 'discrepancies';
    if (path.startsWith('/reporting'))      return 'reporting';
    if (path.startsWith('/analytics'))      return 'reporting';
    if (path.startsWith('/experiments'))    return 'experiments';
    if (path.startsWith('/clients'))        return 'clients';
    if (path.startsWith('/tools'))          return 'tools';
    if (path.startsWith('/settings'))       return 'settings';
    return 'overview';
  }, [location.pathname]);

  const handleWorkspaceSwitch = async (workspaceId: string) => {
    if (!workspaceId || workspaceId === user?.workspace.id) return;
    try {
      const authMe = await switchWorkspace(workspaceId);
      const wsList = await loadWorkspaces('all');
      const displayName =
        String(authMe.user.name ?? '').trim() ||
        String(authMe.user.email).split('@')[0];
      const [firstName = '', ...rest] = displayName.split(/\s+/).filter(Boolean);
      setUser({
        id:          authMe.user.id,
        email:       authMe.user.email,
        firstName,
        lastName:    rest.join(' '),
        role:        authMe.user.role,
        permissions: authMe.permissions,
        workspace: {
          id:            authMe.workspace?.id ?? '',
          name:          authMe.workspace?.name ?? 'Workspace',
          productAccess: authMe.productAccess,
        },
      });
      setWorkspaces(wsList);
    } catch {
      // Keep current workspace on error
    }
  };

  // ── Render states ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <CenteredSpinner label="Loading workspace…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg p-4">
        <Panel padding="lg" className="max-w-md">
          <h2 className="text-base font-semibold text-[color:var(--dusk-status-critical-fg)]">
            Connection error
          </h2>
          <p className="mt-2 text-sm text-[color:var(--dusk-text-muted)]">{loadError}</p>
          <Button variant="primary" onClick={() => window.location.reload()} className="mt-5">
            Retry
          </Button>
        </Panel>
      </div>
    );
  }

  const hasAdServerAccess = user?.workspace.productAccess.ad_server !== false;
  const isLauncherRoute  = location.pathname === '/' || location.pathname === '/launch';

  const handleSignOut = async () => {
    try {
      await fetch('/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      navigate('/login');
    }
  };

  const palette = useCommandPalette();
  const isWorkspaceRoute = location.pathname.startsWith('/settings/workspace');
  const canRenderCurrentRoute =
    hasAdServerAccess || isLauncherRoute || isWorkspaceRoute;

  return (
    <AppShell
      activeItem={activeItem}
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebarCollapsed={() => {
        setSidebarCollapsed((current) => {
          const next = !current;
          savePreference('dusk:sidebar-collapsed', next ? '1' : '0');
          return next;
        });
      }}
      topbar={{
        workspaces: workspaces.map((w) => ({ id: w.id, name: w.name })),
        activeWorkspaceId: user?.workspace.id ?? '',
        onWorkspaceChange: (id) => void handleWorkspaceSwitch(id),
        theme,
        onThemeToggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
        notificationCount: 0,
        onSearchClick: palette.open,
        user: user
          ? {
              initials: `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}` || 'SA',
              name: `${user.firstName} ${user.lastName}`.trim() || 'Account',
              email: user.email,
            }
          : undefined,
      }}
    >
      <div className="dusk-page">
        <ShellCommands
          themeMode={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onSignOut={() => void handleSignOut()}
        />
        {canRenderCurrentRoute ? (
          <Outlet
            key={user?.workspace.id ?? 'shell'}
            context={{ user, theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}
          />
        ) : (
          <Panel padding="lg" className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
              No Ad Server access
            </h1>
            <p className="mt-2 text-sm text-[color:var(--dusk-text-muted)]">
              Your role ({getPlatformRoleLabel(user?.role)}) does not include Ad Server access for this workspace.
              Contact an admin if you need it.
            </p>
            {user?.workspace.productAccess.studio !== false && (
              <Button
                variant="primary"
                className="mt-5"
                onClick={() => window.open(getStudioUrl(), '_blank', 'noopener')}
              >
                Launch Studio
              </Button>
            )}
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
