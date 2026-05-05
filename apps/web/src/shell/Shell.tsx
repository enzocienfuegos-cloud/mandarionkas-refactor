// apps/web/src/shell/Shell.tsx
//
// Shell — Sprint 51 definitive rewrite.
//
// What changed from S50:
//
//   LOOP FIX — Root cause: three separate useEffects firing on `user` state
//   that was null during first render caused:
//     Shell → /launch (no adserver access inferred from null)
//     ProductLauncher → /overview (hasAdServerAccess = undefined !== false = true)
//     Shell → /launch again → loop
//
//   Fix:
//   1. Single initialisation effect. Deps: [] — runs once on mount.
//      Errors that are NOT 401 do NOT navigate to /login, they surface
//      an inline error so the user isn't bounced into a loop when backend
//      routes are partially deployed.
//   2. Single guard effect. Only runs after loading is false AND user is
//      resolved. Never runs while loading.
//   3. productAccess always comes from the backend-resolved payload.
//      No client-side inference from workspace rows.

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
import type { PlatformRole, ProductAccess } from '../shared/roles';
import { AppShell, type SidebarFocusItem, type SidebarItemName } from '../shared/dusk-ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShellUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: PlatformRole;
  permissions: string[];
  workspace: {
    id: string;
    name: string;
    productAccess: ProductAccess;
  };
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

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export default function Shell() {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser]           = useState<ShellUser | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState('');
  const [jumpSearch, setJumpSearch] = useState('');
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  // Prevent the initialisation effect from running twice in React StrictMode
  const initialised = useRef(false);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function buildShellUser(authMe: Awaited<ReturnType<typeof loadAuthMe>>): ShellUser {
    const displayName =
      String(authMe.user.name ?? '').trim() ||
      String(authMe.user.email).split('@')[0];
    const [firstName = '', ...rest] = displayName.split(/\s+/).filter(Boolean);
    return {
      id:          authMe.user.id,
      email:       authMe.user.email,
      firstName,
      lastName:    rest.join(' '),
      role:        authMe.user.role,
      permissions: authMe.permissions,
      workspace: {
        id:            authMe.workspace?.id ?? '',
        name:          authMe.workspace?.name ?? 'Workspace',
        // productAccess is always resolved by the backend.
        productAccess: authMe.productAccess,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Initialisation — runs once on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    Promise.all([loadAuthMe(), loadWorkspaces('all')])
      .then(([authMe, workspaceList]) => {
        setUser(buildShellUser(authMe));
        setWorkspaces(workspaceList);
      })
      .catch((error: unknown) => {
        const status = (error as any)?.status ?? 0;
        if (status === 401) {
          // Genuine unauthenticated — send to login
          navigate('/login', { replace: true });
        } else {
          // Backend may be partially deployed (404, 500, network error).
          // Surface the error inline — do NOT loop to login.
          setLoadError(
            `Could not load session: ${(error as Error)?.message ?? 'unknown error'}. Check the API connection.`,
          );
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Route guard — runs after loading resolves
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Never guard while loading — this is what caused the loop
    if (loading) return;

    // No user after load = shouldn't happen (handled in init), but guard anyway
    if (!user) return;

    const { ad_server: hasAdServer } = user.workspace.productAccess;
    const canAudit = user.permissions.includes('audit:read');
    const path = location.pathname;

    // User is on an adserver route but has no adserver access → portal
    const isLauncherRoute  = path === '/' || path === '/launch';
    const isWorkspaceRoute = path.startsWith('/settings/workspace');
    const isAdServerRoute  = !isLauncherRoute && !isWorkspaceRoute;

    if (!hasAdServer && isAdServerRoute) {
      navigate('/launch', { replace: true });
      return;
    }

    // Audit log is gated by permission, not product
    if (!canAudit && path.startsWith('/settings/audit-log')) {
      navigate('/settings', { replace: true });
    }
  }, [loading, user, location.pathname, navigate]);

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const preferredTheme = loadPreference<ThemeMode>(THEME_PREFERENCE_KEY);
    if (preferredTheme === 'dark' || preferredTheme === 'light') setTheme(preferredTheme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
    savePreference(THEME_PREFERENCE_KEY, theme);
  }, [theme]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const hasAdServerAccess = user?.workspace.productAccess.ad_server !== false;
  const hasStudioAccess   = user?.workspace.productAccess.studio !== false;
  const canReadAudit      = Boolean(user?.permissions.includes('audit:read'));
  const isDark            = theme === 'dark';

  const campaignFocus: SidebarFocusItem[] = useMemo(() => {
    if (location.pathname.startsWith('/campaigns')) {
      return [
        { label: 'Needs attention', count: '2', active: true },
        { label: 'Ready to launch', count: '1' },
        { label: 'Draft setup', count: '1' },
      ];
    }
    if (location.pathname.startsWith('/tags')) return [];
    if (location.pathname.startsWith('/creatives')) {
      return [
        { label: 'Pending QA', count: '4', active: true },
        { label: 'Rejected specs', count: '2' },
        { label: 'Missing preview', count: '1' },
      ];
    }
    if (location.pathname.startsWith('/pacing')) {
      return [
        { label: 'Behind target', count: '2', active: true },
        { label: 'Overpacing', count: '1' },
        { label: 'Ending soon' },
      ];
    }
    if (location.pathname.startsWith('/discrepancies')) {
      return [
        { label: 'Above threshold', count: '2', active: true },
        { label: 'Pending reconciliation', count: '1' },
        { label: 'Recently resolved' },
      ];
    }
    if (location.pathname.startsWith('/reporting')) {
      return [
        { label: 'Scheduled reports', count: '3', active: true },
        { label: 'Failed exports', count: '1' },
        { label: 'Favorite reports' },
      ];
    }
    return [
      { label: 'Needs attention', count: '2', active: true },
      { label: 'Ready to launch', count: '1' },
      { label: 'Draft setup', count: '1' },
    ];
  }, [location.pathname]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleWorkspaceSwitch = async (workspaceId: string) => {
    if (!workspaceId || workspaceId === user?.workspace.id) return;
    try {
      const authMe = await switchWorkspace(workspaceId);
      const wsList = await loadWorkspaces('all');
      setUser(buildShellUser(authMe));
      setWorkspaces(wsList);
    } catch {
      // Keep the current workspace selected when switch fails.
    }
  };

  const handleThemeToggle = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  const activeItem: SidebarItemName = useMemo(() => {
    if (location.pathname.startsWith('/campaigns')) return 'Campaigns';
    if (location.pathname.startsWith('/tags')) return 'Tags';
    if (location.pathname.startsWith('/creatives')) return 'Creatives';
    if (location.pathname.startsWith('/pacing')) return 'Pacing';
    if (location.pathname.startsWith('/discrepancies')) return 'Discrepancies';
    if (location.pathname.startsWith('/reporting')) return 'Reporting';
    return 'Overview';
  }, [location.pathname]);

  const badgeCounts = useMemo(
    () => ({
      Overview: '3',
      Campaigns: '2',
      Tags: '1',
      Creatives: '6',
      Pacing: '!',
      Discrepancies: '1',
    }),
    [],
  );

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? 'bg-[#0b1020]' : 'bg-[#f6f3fb]'}`}>
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-fuchsia-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? 'bg-[#0b1020]' : 'bg-[#f6f3fb]'}`}>
        <div className={`max-w-md rounded-2xl p-8 ${isDark ? 'border border-white/10 bg-[#18181c] text-white' : 'border border-slate-200 bg-white text-slate-900'}`}>
          <p className="text-sm font-semibold text-red-500">Connection error</p>
          <p className="mt-2 text-sm opacity-70">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // canRenderCurrentRoute is true when either: user has adserver access,
  // OR the current path is one of the routes accessible without it.
  const isLauncherRoute  = location.pathname === '/' || location.pathname === '/launch';
  const isWorkspaceRoute = location.pathname.startsWith('/settings/workspace');
  const canRenderCurrentRoute =
    hasAdServerAccess ||
    isLauncherRoute   ||
    isWorkspaceRoute;

  // ---------------------------------------------------------------------------
  // Full shell render
  // ---------------------------------------------------------------------------

  return (
    <>
      <AppShell
        activeItem={activeItem}
        badgeCounts={badgeCounts}
        advertiserSelector={{
          value: user?.workspace.id ?? '',
          options: workspaces.map((ws) => ({
            id: ws.id,
            name: ws.name,
            meta: `${workspaces.length} active clients`,
          })),
          onChange: (advertiserId) => {
            void handleWorkspaceSwitch(advertiserId);
          },
        }}
        search={{
          value: jumpSearch,
          onChange: setJumpSearch,
          placeholder: 'Jump to campaign',
        }}
        campaignFocus={campaignFocus}
        userSummary={{
          initials: `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}` || 'SA',
          name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'SMX Admin',
          subtitle: user?.email ?? 'admin@smx.studio',
        }}
      >
        <main className={`app-scrollbar min-w-0 flex-1 overflow-y-auto px-6 py-6 ${isDark ? 'bg-[#0b1020]' : 'bg-[#f6f3fb]'}`}>
          {canRenderCurrentRoute ? (
            <div className="dusk-page">
              <Outlet key={user?.workspace.id ?? 'shell'} context={{ user, theme, toggleTheme: handleThemeToggle }} />
            </div>
          ) : (
            <div className={`mx-auto max-w-2xl rounded-[18px] p-8 ${isDark ? 'border border-white/[0.08] bg-[#18181c] shadow-[0_18px_50px_rgba(0,0,0,0.32)]' : 'border border-slate-200 bg-white shadow-sm'}`}>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>No Ad Server access</h1>
              <p className={`mt-2 text-sm ${isDark ? 'text-white/45' : 'text-slate-500'}`}>
                Your role ({getPlatformRoleLabel(user?.role)}) does not include Ad Server access for this workspace.
                Contact an admin if you need it.
              </p>
              {hasStudioAccess && (
                <a href={getStudioUrl()} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-medium text-white shadow-[0_10px_28px_rgba(241,0,139,0.24)]">
                  Launch Studio
                </a>
              )}
            </div>
          )}
        </main>
      </AppShell>

    </>
  );
}
