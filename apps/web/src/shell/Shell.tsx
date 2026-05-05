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
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  getWorkspaceProductLabel,
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
import { DuskLogo, GlobalScrollbarStyles, SectionKicker } from '../shared/dusk-ui';

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

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

const BRAND = '#f1008b';

// ---------------------------------------------------------------------------
// Icons (unchanged from S50)
// ---------------------------------------------------------------------------

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="m11.5 11.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M12 3l7 3v6c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V6l7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ZapIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M13 2 3 14h7l-1 8 12-14h-8l2-6Z" />
  </svg>
);

type NavIconName =
  | 'overview' | 'campaigns' | 'tags' | 'creatives' | 'reporting'
  | 'pacing' | 'discrepancies' | 'experiments' | 'studio' | 'tools'
  | 'settings' | 'keys' | 'audit' | 'workspace' | 'webhooks';

function NavGlyph({ active, name }: { active: boolean; name: NavIconName }) {
  const icon = (() => {
    switch (name) {
      case 'overview':
        return <path d="M3.5 10.5 8 6l4.5 4.5V16H3.5z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />;
      case 'campaigns':
        return <><rect x="3.5" y="4.5" width="9" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none" /><rect x="3.5" y="8.75" width="9" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none" /><rect x="3.5" y="13" width="6" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none" /></>;
      case 'tags':
        return <path d="M3.5 8V4.5h3.5L12.5 10 8 14.5 3.5 10Z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />;
      case 'creatives':
        return <><rect x="3.5" y="4" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="m5.2 11.8 2.1-2.2 1.8 1.8 1.7-2 1.2 2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></>;
      case 'reporting':
        return <><path d="M4 12.5 6.5 10l2 1.5L12 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M11.9 7.5h-2.7V4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>;
      case 'pacing':
        return <><circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M8 8 10.5 6.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>;
      case 'discrepancies':
        return <><path d="M8 3.5 12.5 12H3.5Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" /><path d="M8 6.6v2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="8" cy="10.6" r=".45" fill="currentColor" /></>;
      case 'experiments':
        return <><path d="M5 3.5h6M8 3.5v2m-2 7.5h4m-4-7.5 2 3 2-3m-2 3v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></>;
      case 'studio':
        return <><rect x="3.5" y="4" width="9" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="m6.7 6.2 3 1.8-3 1.8Z" fill="currentColor" /></>;
      case 'tools':
        return <path d="M5 4.2a2 2 0 1 0 2.8 2.8l3 3-1.2 1.2-3-3A2 2 0 0 0 3.8 5Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case 'settings':
        return <><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M8 3.3v1.2M8 11.5v1.2M12.7 8h-1.2M4.5 8H3.3M11.3 4.7l-.9.9M5.6 10.4l-.9.9M11.3 11.3l-.9-.9M5.6 5.6l-.9-.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></>;
      case 'keys':
        return <><circle cx="5.5" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M7.5 8H12.5M10.5 6.8v2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>;
      case 'audit':
        return <><rect x="4" y="3.8" width="8" height="10.2" rx="1.4" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M6 6.3h4M6 8.4h4M6 10.5h2.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></>;
      case 'workspace':
        return <><rect x="3.8" y="4" width="3.5" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.3" fill="none" /><rect x="8.7" y="4" width="3.5" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.3" fill="none" /><rect x="3.8" y="8.9" width="3.5" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.3" fill="none" /><rect x="8.7" y="8.9" width="3.5" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.3" fill="none" /></>;
      case 'webhooks':
        return <><path d="M5.5 6.3a2.5 2.5 0 1 1 0 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" /><path d="M10.5 6.3a2.5 2.5 0 1 0 0 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" /><path d="M5.8 8.8h4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>;
    }
  })();

  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold transition ${
      active
        ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-500/24 dark:bg-fuchsia-500/10 dark:text-fuchsia-300'
        : 'border-slate-200 bg-white/60 text-slate-500 dark:border-white/10 dark:bg-white/[0.025] dark:text-white/[0.56]'
    }`}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">{icon}</svg>
    </span>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
    isActive
      ? 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300'
      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-950 dark:text-white/[0.66] dark:hover:bg-white/[0.05] dark:hover:text-white'
  }`;
}

const SectionLabel = ({ label }: { label: string }) => (
  <div className="px-3 pb-1 pt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-white/[0.22]">
    {label}
  </div>
);

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

function WorkspaceAccessBadge({
  workspace,
}: {
  workspace: { product_access?: ProductAccess };
}) {
  const label = getWorkspaceProductLabel(workspace);
  const access = workspace.product_access;
  const badgeClass =
    access?.ad_server && access?.studio
      ? 'bg-emerald-500/12 text-emerald-300 border-emerald-500/20'
      : access?.ad_server
        ? 'bg-fuchsia-500/12 text-fuchsia-300 border-fuchsia-500/20'
        : 'bg-amber-500/12 text-amber-300 border-amber-500/20';
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${badgeClass}`}>
      {label}
    </span>
  );
}

function getModuleFocusItems(pathname: string) {
  if (pathname.startsWith('/overview')) {
    return ['Needs review', 'Launch readiness', 'Quick ops'];
  }
  if (pathname.startsWith('/campaigns')) {
    return ['Needs attention', 'Ready to launch', 'Draft setup'];
  }
  if (pathname.startsWith('/tags')) {
    return ['Low firing', 'Missing cachebuster', 'Recently updated'];
  }
  if (pathname.startsWith('/creatives')) {
    return ['Pending QA', 'Rejected specs', 'Missing preview'];
  }
  if (pathname.startsWith('/pacing')) {
    return ['Behind target', 'Overpacing', 'Ending soon'];
  }
  if (pathname.startsWith('/discrepancies')) {
    return ['Above threshold', 'Pending reconciliation', 'Recently resolved'];
  }
  if (pathname.startsWith('/reporting')) {
    return ['Scheduled reports', 'Failed exports', 'Favorite reports'];
  }
  return ['Operational tools', 'Workspace controls', 'System defaults'];
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [clientError, setClientError] = useState('');
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

  const showClientSwitcher = useMemo(() => {
    const agnosticPrefixes = [
      '/overview', '/campaigns', '/tags', '/creatives', '/reporting',
      '/pacing', '/discrepancies', '/experiments', '/clients', '/tools', '/settings',
    ];
    return (
      !agnosticPrefixes.some((p) => location.pathname.startsWith(p)) ||
      !hasAdServerAccess
    );
  }, [hasAdServerAccess, location.pathname]);

  const toolsOpen    = location.pathname.startsWith('/tools');
  const settingsOpen = location.pathname.startsWith('/settings');
  const isOverviewRoute = location.pathname.startsWith('/overview');
  const moduleFocusItems = useMemo(() => getModuleFocusItems(location.pathname), [location.pathname]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleLogout = async () => {
    await fetch('/v1/auth/logout', { method: 'POST', credentials: 'include' });
    navigate('/login');
  };

  const handleWorkspaceSwitch = async (workspaceId: string) => {
    if (!workspaceId || workspaceId === user?.workspace.id) return;
    setWorkspaceBusy(true);
    setClientError('');
    try {
      const authMe = await switchWorkspace(workspaceId);
      const wsList = await loadWorkspaces('all');
      setUser(buildShellUser(authMe));
      setWorkspaces(wsList);
    } catch (error: unknown) {
      setClientError((error as Error)?.message ?? 'Failed to switch client');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleThemeToggle = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

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
    <div className={`mandarion-shell flex min-h-screen overflow-hidden ${isDark ? 'bg-[#0b1020] text-white' : 'bg-[#f6f3fb] text-slate-900'}`}>
      <GlobalScrollbarStyles />
      {/* Sidebar */}
      <aside className={`app-scrollbar sticky top-0 hidden h-screen w-[280px] shrink-0 overflow-y-auto border-r px-3 py-4 backdrop-blur-xl lg:block ${isDark ? 'border-white/10 bg-[#0b1020]/90' : 'border-slate-200/80 bg-white/84'}`}>
        <div className="px-2 pb-4">
          <DuskLogo className={isDark ? 'h-[34px] w-[136px] text-white' : 'h-[34px] w-[136px] text-slate-950'} />
          <p className={`mt-1 text-xs font-medium ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Adserver workspace</p>
        </div>

        <div className={`rounded-[24px] border px-4 py-4 ${isDark ? 'border-white/[0.07] bg-white/[0.025]' : 'border-slate-200/80 bg-white/72'}`}>
          <SectionKicker>Advertiser</SectionKicker>
          <div className="relative mt-3">
            <select
              value={user?.workspace.id ?? ''}
              onChange={(e) => void handleWorkspaceSwitch(e.target.value)}
              disabled={workspaceBusy}
              className={`h-14 w-full appearance-none rounded-2xl border px-4 pr-10 text-sm font-medium outline-none transition ${isDark ? 'border-white/[0.08] bg-white/[0.03] text-white' : 'border-slate-200 bg-white text-slate-800'} disabled:opacity-60`}
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id} className={isDark ? 'bg-[#111114] text-white' : 'bg-white text-slate-900'}>
                  {ws.name}
                </option>
              ))}
            </select>
            <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
              <ChevronDownIcon />
            </span>
          </div>
          <p className={`mt-2 text-xs ${isDark ? 'text-white/34' : 'text-slate-500'}`}>{workspaces.length} active clients</p>
          <label className="relative mt-4 block">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/36' : 'text-slate-400'}`}>
              <SearchIcon />
            </span>
            <input
              readOnly
              value=""
              placeholder="Jump to campaign"
              className={`h-10 w-full rounded-xl border pl-9 pr-10 text-sm outline-none transition ${isDark ? 'border-white/8 bg-white/[0.025] text-white placeholder:text-white/30 focus:border-fuchsia-500/26' : 'border-slate-200 bg-white/58 text-slate-800 placeholder:text-slate-400 focus:border-fuchsia-300'} `}
            />
          </label>
        </div>

        <nav className="app-scrollbar flex-1 overflow-y-auto px-2 pb-3">
          {hasAdServerAccess && (
            <>
              <SectionLabel label="Operations" />
              {(['overview', 'campaigns', 'tags', 'creatives'] as const).map((name) => (
                <NavLink key={name} to={`/${name}`} className={navLinkClass}>
                  {({ isActive }) => (
                    <>
                      {isActive ? <span className="absolute left-0 top-2.5 h-9 w-1 rounded-r-full bg-fuchsia-500" /> : null}
                      <NavGlyph active={isActive} name={name} />
                      <span className="font-medium capitalize">{name}</span>
                    </>
                  )}
                </NavLink>
              ))}

              <SectionLabel label="Monitoring" />
              {(['pacing', 'discrepancies', 'reporting', 'experiments'] as const).map((name) => (
                <NavLink key={name} to={`/${name}`} className={navLinkClass}>
                  {({ isActive }) => (
                    <>
                      {isActive ? <span className="absolute left-0 top-2.5 h-9 w-1 rounded-r-full bg-fuchsia-500" /> : null}
                      <NavGlyph active={isActive} name={name} />
                      <span className="font-medium capitalize">{name}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </>
          )}

          <SectionLabel label="Module focus" />
          <div className="space-y-1 px-3">
            {moduleFocusItems.map((item) => (
              <div
                key={item}
                className={`rounded-xl px-3 py-2 text-sm ${isDark ? 'text-white/56 hover:bg-white/[0.04]' : 'text-slate-500 hover:bg-slate-100/80'}`}
              >
                {item}
              </div>
            ))}
          </div>

          <SectionLabel label="Connected" />
          {hasStudioAccess && (
            <a
              href={getStudioUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isDark ? 'text-white/55 hover:bg-white/[0.04] hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <NavGlyph active={false} name="studio" />
              <span className="font-medium">Open Studio</span>
              <span className={`ml-auto text-xs transition ${isDark ? 'text-white/25 group-hover:text-white/45' : 'text-slate-300 group-hover:text-slate-500'}`}>↗</span>
            </a>
          )}

          {hasAdServerAccess && (
            <>
              <SectionLabel label="System" />
              <NavLink to="/tools" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    {isActive || toolsOpen ? <span className="absolute left-0 top-2.5 h-9 w-1 rounded-r-full bg-fuchsia-500" /> : null}
                    <NavGlyph active={isActive || toolsOpen} name="tools" />
                    <span className="font-medium">Tools</span>
                    <span className={`ml-auto transition ${toolsOpen ? 'rotate-180' : ''} ${isDark ? 'text-white/25' : 'text-slate-300'}`}><ChevronDownIcon /></span>
                  </>
                )}
              </NavLink>
              {toolsOpen && (
                <div className="space-y-1 pl-5">
                  {[['vast-validator', 'VAST Validator'], ['chain-validator', 'Chain Validator']].map(([slug, label]) => (
                  <NavLink key={slug} to={`/tools/${slug}`} className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        {isActive ? <span className="absolute left-0 top-2.5 h-9 w-1 rounded-r-full bg-fuchsia-500" /> : null}
                        <NavGlyph active={isActive} name="tools" />
                        <span className="font-medium">{label}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}

              <NavLink to="/settings" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    {isActive || settingsOpen ? <span className="absolute left-0 top-2.5 h-9 w-1 rounded-r-full bg-fuchsia-500" /> : null}
                    <NavGlyph active={isActive || settingsOpen} name="settings" />
                    <span className="font-medium">Settings</span>
                    <span className={`ml-auto transition ${settingsOpen ? 'rotate-180' : ''} ${isDark ? 'text-white/25' : 'text-slate-300'}`}><ChevronDownIcon /></span>
                  </>
                )}
              </NavLink>
              {settingsOpen && (
                <div className="space-y-1 pl-5">
                  <NavLink to="/settings/api-keys" className={navLinkClass}>
                    {({ isActive }) => (<>{isActive ? <span className="absolute left-0 top-2.5 h-9 w-1 rounded-r-full bg-fuchsia-500" /> : null}<NavGlyph active={isActive} name="keys" /><span className="font-medium">API Keys</span></>)}
                  </NavLink>
                  {canReadAudit && (
                    <NavLink to="/settings/audit-log" className={navLinkClass}>
                      {({ isActive }) => (<>{isActive ? <span className="absolute left-0 top-2.5 h-9 w-1 rounded-r-full bg-fuchsia-500" /> : null}<NavGlyph active={isActive} name="audit" /><span className="font-medium">Audit Log</span></>)}
                    </NavLink>
                  )}
                  <NavLink to="/settings/workspace" className={navLinkClass}>
                    {({ isActive }) => (<>{isActive ? <span className="absolute left-0 top-2.5 h-9 w-1 rounded-r-full bg-fuchsia-500" /> : null}<NavGlyph active={isActive} name="workspace" /><span className="font-medium">Workspace</span></>)}
                  </NavLink>
                  <NavLink to="/settings/webhooks" className={navLinkClass}>
                    {({ isActive }) => (<>{isActive ? <span className="absolute left-0 top-2.5 h-9 w-1 rounded-r-full bg-fuchsia-500" /> : null}<NavGlyph active={isActive} name="webhooks" /><span className="font-medium">Webhooks</span></>)}
                  </NavLink>
                </div>
              )}
            </>
          )}
        </nav>

        <div className={`mt-3 px-3 py-3 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-200'}`}>
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f1008b_0%,#8b5cf6_100%)] text-xs font-bold text-white">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className={`truncate text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {user?.firstName} {user?.lastName}
              </div>
              <div className={`truncate text-[11px] ${isDark ? 'text-white/28' : 'text-slate-400'}`}>{user?.email}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className={`flex min-w-0 flex-1 flex-col ${isDark ? 'bg-[#0b1020]' : 'bg-[#f6f3fb]'}`}>
        {!isOverviewRoute && (
          <header className={`flex h-14 flex-shrink-0 items-center justify-between px-7 ${isDark ? 'border-b border-white/[0.06] bg-[#0b1020]' : 'border-b border-slate-200/80 bg-[#f6f3fb]'}`}>
            <div className="flex items-center gap-3">
              <div className={`hidden max-w-[360px] items-center gap-2 rounded-xl px-3 py-2 text-sm md:flex ${isDark ? 'border border-white/[0.08] bg-white/[0.03] text-white/35' : 'border border-slate-200 bg-white text-slate-400'}`}>
                <SearchIcon />
                <span className="truncate">Search campaigns, creatives, segments…</span>
                <span className={`ml-auto rounded-md px-1.5 py-0.5 text-[11px] ${isDark ? 'bg-white/[0.05] text-white/22' : 'bg-slate-100 text-slate-400'}`}>⌘K</span>
              </div>

              {showClientSwitcher && (
                <div className="flex items-center gap-2">
                  <select
                    value={user?.workspace.id ?? ''}
                    onChange={(e) => void handleWorkspaceSwitch(e.target.value)}
                    disabled={workspaceBusy}
                    className={`min-w-[220px] rounded-xl px-3 py-2 text-sm font-medium outline-none ${isDark ? 'border border-white/[0.08] bg-white/[0.03] text-white' : 'border border-slate-200 bg-white text-slate-800'}`}
                  >
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id} className={isDark ? 'bg-[#111114] text-white' : 'bg-white text-slate-900'}>
                        {ws.name} · {getWorkspaceProductLabel(ws)}
                      </option>
                    ))}
                  </select>
                  {user?.workspace.id && (
                    <WorkspaceAccessBadge workspace={{ product_access: user.workspace.productAccess }} />
                  )}
                  {hasAdServerAccess && (
                    <button
                      onClick={() => navigate('/clients')}
                      disabled={workspaceBusy}
                      className={`rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-60 ${isDark ? 'border border-white/[0.08] bg-white/[0.03] text-white/65 hover:bg-white/[0.05] hover:text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    >
                      Manage clients
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {clientError && <span className={`text-xs ${isDark ? 'text-red-300' : 'text-red-600'}`}>{clientError}</span>}

              <button
                type="button"
                onClick={handleThemeToggle}
                className={`rounded-xl px-3 py-2 text-sm transition ${isDark ? 'border border-white/[0.08] bg-white/[0.03] text-white/55 hover:bg-white/[0.05] hover:text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>

              <div className="relative z-50">
                <button
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 transition ${isDark ? 'border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]' : 'border border-slate-200 bg-white hover:bg-slate-50'}`}
                  onClick={() => setUserMenuOpen((o) => !o)}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f1008b_0%,#8b5cf6_100%)] text-xs font-semibold text-white">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                  <span className={`hidden text-sm md:block ${isDark ? 'text-white/75' : 'text-slate-700'}`}>
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span className={isDark ? 'text-white/25' : 'text-slate-400'}><ChevronDownIcon /></span>
                </button>

                {userMenuOpen && (
                  <div className={`absolute right-0 mt-2 w-56 rounded-2xl p-2 shadow-2xl ${isDark ? 'border border-white/[0.08] bg-[#17171b] shadow-black/40' : 'border border-slate-200 bg-white shadow-slate-300/30'}`}>
                    <div className={`px-3 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-200'}`}>
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{user?.firstName} {user?.lastName}</p>
                      <p className={`mt-1 text-xs ${isDark ? 'text-white/38' : 'text-slate-500'}`}>{user?.email}</p>
                      <p className={`mt-1 text-[11px] uppercase tracking-[0.14em] ${isDark ? 'text-white/22' : 'text-slate-400'}`}>{getPlatformRoleLabel(user?.role)}</p>
                    </div>
                    <NavLink to="/settings/workspace" className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${isDark ? 'text-white/65 hover:bg-white/[0.05] hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`} onClick={() => setUserMenuOpen(false)}>
                      <ShieldIcon />Settings
                    </NavLink>
                    <button type="button" className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${isDark ? 'text-white/65 hover:bg-white/[0.05] hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`} onClick={handleThemeToggle}>
                      <ShieldIcon />{theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                    </button>
                    <button className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${isDark ? 'text-red-300 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`} onClick={handleLogout}>
                      <ShieldIcon />Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

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
                  Open Studio
                </a>
              )}
            </div>
          )}
        </main>
      </div>

      {userMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />}
    </div>
  );
}
