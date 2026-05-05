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
import { ChevronDown, Search, Shield } from 'lucide-react';
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
import { AppShell, type ContextualFocusItem, type SidebarItemName } from '../shared/dusk-ui';

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

  const isOverviewRoute = location.pathname.startsWith('/overview');
  const moduleFocusItems: ContextualFocusItem[] = useMemo(() => {
    if (location.pathname.startsWith('/overview')) {
      return [
        { label: 'Needs review', count: '2', active: true },
        { label: 'Launch readiness', count: '1' },
        { label: 'Quick ops' },
      ];
    }
    if (location.pathname.startsWith('/campaigns')) {
      return [
        { label: 'Needs attention', count: '2', active: true },
        { label: 'Ready to launch', count: '1' },
        { label: 'Draft setup', count: '1' },
      ];
    }
    if (location.pathname.startsWith('/tags')) {
      return [
        { label: 'Low firing', count: '3', active: true },
        { label: 'Missing cachebuster', count: '1' },
        { label: 'Recently updated' },
      ];
    }
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
      { label: 'Operational tools', active: true },
      { label: 'Workspace controls' },
      { label: 'System defaults' },
    ];
  }, [location.pathname]);

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
        isDark={isDark}
        activeItem={activeItem}
        navigateTo={navigate}
        contextualFocus={moduleFocusItems}
        badgeCounts={badgeCounts}
        workspaceSlot={
          <div className={isDark ? 'rounded-[20px] border border-white/[0.07] bg-white/[0.025] px-4 py-3' : 'rounded-[20px] border border-slate-200/80 bg-white/72 px-4 py-3'}>
            <div className={isDark ? 'text-[10px] font-bold uppercase tracking-[0.22em] text-white/[0.22]' : 'text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400'}>
              Advertiser
            </div>
            <div className="relative mt-2.5">
              <select
                value={user?.workspace.id ?? ''}
                onChange={(e) => void handleWorkspaceSwitch(e.target.value)}
                disabled={workspaceBusy}
                className={`h-12 w-full appearance-none rounded-xl border px-4 pr-10 text-sm font-medium outline-none transition ${isDark ? 'border-white/[0.08] bg-white/[0.03] text-white' : 'border-slate-200 bg-white text-slate-800'} disabled:opacity-60`}
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id} className={isDark ? 'bg-[#111114] text-white' : 'bg-white text-slate-900'}>
                    {ws.name}
                  </option>
                ))}
              </select>
              <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
              </span>
            </div>
            <p className={`mt-1.5 text-xs ${isDark ? 'text-white/34' : 'text-slate-500'}`}>{workspaces.length} active clients</p>
            <label className="relative mt-3 block">
              <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-white/36' : 'text-slate-400'}`}>
                <Search className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <input
                readOnly
                value=""
                placeholder="Jump to campaign"
                className={`h-10 w-full rounded-xl border pl-9 pr-10 text-sm outline-none transition ${isDark ? 'border-white/8 bg-white/[0.025] text-white placeholder:text-white/30 focus:border-fuchsia-500/26' : 'border-slate-200 bg-white/58 text-slate-800 placeholder:text-slate-400 focus:border-fuchsia-300'}`}
              />
            </label>
          </div>
        }
        user={{
          initials: `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`,
          name: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
          subtitle: user?.email ?? '',
          systemLabel: 'Serving online',
          systemValue: 'System healthy',
        }}
      >
        {!isOverviewRoute && (
          <header className={`flex h-14 flex-shrink-0 items-center justify-between px-7 ${isDark ? 'border-b border-white/[0.06] bg-[#0b1020]' : 'border-b border-slate-200/80 bg-[#f6f3fb]'}`}>
            <div className="flex items-center gap-3">
              <div className={`hidden max-w-[360px] items-center gap-2 rounded-xl px-3 py-2 text-sm md:flex ${isDark ? 'border border-white/[0.08] bg-white/[0.03] text-white/35' : 'border border-slate-200 bg-white text-slate-400'}`}>
                <Search className="h-4 w-4" strokeWidth={1.8} />
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
                  <span className={isDark ? 'text-white/25' : 'text-slate-400'}><ChevronDown className="h-4 w-4" strokeWidth={1.8} /></span>
                </button>

                {userMenuOpen && (
                  <div className={`absolute right-0 mt-2 w-56 rounded-2xl p-2 shadow-2xl ${isDark ? 'border border-white/[0.08] bg-[#17171b] shadow-black/40' : 'border border-slate-200 bg-white shadow-slate-300/30'}`}>
                    <div className={`px-3 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-200'}`}>
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{user?.firstName} {user?.lastName}</p>
                      <p className={`mt-1 text-xs ${isDark ? 'text-white/38' : 'text-slate-500'}`}>{user?.email}</p>
                      <p className={`mt-1 text-[11px] uppercase tracking-[0.14em] ${isDark ? 'text-white/22' : 'text-slate-400'}`}>{getPlatformRoleLabel(user?.role)}</p>
                    </div>
                    <NavLink to="/settings/workspace" className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${isDark ? 'text-white/65 hover:bg-white/[0.05] hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`} onClick={() => setUserMenuOpen(false)}>
                      <Shield className="h-4 w-4" strokeWidth={1.8} />Settings
                    </NavLink>
                    <button type="button" className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${isDark ? 'text-white/65 hover:bg-white/[0.05] hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`} onClick={handleThemeToggle}>
                      <Shield className="h-4 w-4" strokeWidth={1.8} />{theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                    </button>
                    <button className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${isDark ? 'text-red-300 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`} onClick={handleLogout}>
                      <Shield className="h-4 w-4" strokeWidth={1.8} />Log out
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
                  Launch Studio
                </a>
              )}
            </div>
          )}
        </main>
      </AppShell>

      {userMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />}
    </>
  );
}
