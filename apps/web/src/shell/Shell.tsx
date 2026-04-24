import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getWorkspaceProductLabel, loadAuthMe, loadWorkspaces, switchWorkspace, type WorkspaceOption } from '../shared/workspaces';
import { THEME_PREFERENCE_KEY, applyTheme, getInitialTheme, persistTheme, type ThemeMode } from '../shared/theme';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  workspace: {
    id: string;
    name: string;
    productAccess: {
      ad_server: boolean;
      studio: boolean;
    };
  };
}

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
    isActive
      ? 'bg-indigo-700 text-white font-medium'
      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
  }`;

const SectionLabel = ({ label }: { label: string }) => (
  <div className="px-3 pt-4 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
    {label}
  </div>
);

function getStudioUrl(): string {
  const configured = import.meta.env.VITE_STUDIO_URL?.trim();
  if (configured) return configured;

  if (import.meta.env.DEV) {
    return 'http://localhost:5174';
  }

  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname.startsWith('app-')) {
      return `${protocol}//${hostname.replace(/^app-/, 'studio-')}`;
    }
  }

  return '/';
}

function WorkspaceAccessBadge({ workspace }: { workspace: { product_access?: { ad_server: boolean; studio: boolean } | undefined } }) {
  const access = workspace.product_access;
  const label = getWorkspaceProductLabel(workspace);
  const badgeClass = access?.ad_server && access?.studio
    ? 'bg-emerald-100 text-emerald-700'
    : access?.ad_server
      ? 'bg-indigo-100 text-indigo-700'
      : 'bg-amber-100 text-amber-700';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}>
      {label}
    </span>
  );
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

export default function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [clientError, setClientError] = useState('');
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

  function normalizeUserPayload(payload: any): User | null {
    if (!payload?.user) return null;
    const displayName = String(payload.user.display_name ?? '').trim() || String(payload.user.email ?? '').split('@')[0];
    const [firstName = '', ...rest] = displayName.split(/\s+/).filter(Boolean);
    const lastName = rest.join(' ');
    return {
      id: payload.user.id,
      email: payload.user.email,
      firstName,
      lastName,
      role: payload.role ?? 'member',
      workspace: {
        id: payload.workspace?.id ?? '',
        name: payload.workspace?.name ?? 'Workspace',
        productAccess: payload.productAccess ?? payload.workspace?.product_access ?? { ad_server: true, studio: true },
      },
    };
  }

  const hasAdServerAccess = user?.workspace?.productAccess?.ad_server !== false;
  const hasStudioAccess = user?.workspace?.productAccess?.studio !== false;

  useEffect(() => {
    const workspaceLoader = hasAdServerAccess ? loadWorkspaces('ad_server') : loadWorkspaces('all');
    Promise.all([loadAuthMe(), workspaceLoader])
      .then(([authMe, workspaceList]) => {
        const normalized = normalizeUserPayload(authMe);
        if (normalized) setUser(normalized);
        setWorkspaces(workspaceList);
      })
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false));
  }, [hasAdServerAccess, navigate]);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ preferences?: Record<string, unknown> }>('/v1/auth/preferences')
      .then((payload) => {
        if (cancelled) return;
        const preferredTheme = payload?.preferences?.[THEME_PREFERENCE_KEY];
        if (preferredTheme === 'dark' || preferredTheme === 'light') {
          setTheme(preferredTheme);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);
  const showClientSwitcher = useMemo(
    () => {
      const agnosticPrefixes = [
        '/overview',
        '/campaigns',
        '/tags',
        '/creatives',
        '/reporting',
        '/pacing',
        '/discrepancies',
        '/experiments',
        '/clients',
        '/tools',
        '/settings',
      ];
      return !agnosticPrefixes.some(prefix => location.pathname.startsWith(prefix)) || !hasAdServerAccess;
    },
    [hasAdServerAccess, location.pathname],
  );
  const toolsOpen = location.pathname.startsWith('/tools');
  const settingsOpen = location.pathname.startsWith('/settings');

  const handleLogout = async () => {
    await fetch('/v1/auth/logout', { method: 'POST', credentials: 'include' });
    navigate('/login');
  };

  const handleWorkspaceSwitch = async (workspaceId: string) => {
    if (!workspaceId || workspaceId === user?.workspace?.id) return;
    setWorkspaceBusy(true);
    setClientError('');
    try {
      await switchWorkspace(workspaceId);
      const [authMe, workspaceList] = await Promise.all([loadAuthMe(), hasAdServerAccess ? loadWorkspaces('ad_server') : loadWorkspaces('all')]);
      const normalized = normalizeUserPayload(authMe);
      if (normalized) setUser(normalized);
      setWorkspaces(workspaceList);
    } catch (error: any) {
      setClientError(error.message ?? 'Failed to switch client');
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleThemeToggle = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    void fetchJson('/v1/auth/preferences', {
      method: 'PUT',
      body: JSON.stringify({
        preferences: {
          [THEME_PREFERENCE_KEY]: nextTheme,
        },
      }),
    }).catch(() => {});
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-800 flex flex-col flex-shrink-0 overflow-y-auto">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-slate-700">
          <span className="text-white font-bold text-lg tracking-tight">SMX Studio</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {hasAdServerAccess && (
            <>
              <SectionLabel label="Ad Ops" />
              <NavLink to="/overview" className={navLinkClass}>
                <span>🛰️</span> Overview
              </NavLink>
              <NavLink to="/campaigns" className={navLinkClass}>
                <span>📋</span> Campaigns
              </NavLink>
              <NavLink to="/tags" className={navLinkClass}>
                <span>🏷️</span> Tags
              </NavLink>
              <NavLink to="/creatives" className={navLinkClass}>
                <span>🎨</span> Creatives
              </NavLink>

              <SectionLabel label="Analytics" />
              <NavLink to="/reporting" className={navLinkClass}>
                <span>📊</span> Reporting
              </NavLink>
              <NavLink to="/pacing" className={navLinkClass}>
                <span>⏱️</span> Pacing
              </NavLink>
              <NavLink to="/discrepancies" className={navLinkClass}>
                <span>⚠️</span> Discrepancies
              </NavLink>
              <NavLink to="/experiments" className={navLinkClass}>
                <span>🧪</span> Experiments
              </NavLink>
            </>
          )}

          <SectionLabel label="Creative Studio" />
          {/* Opens the canvas editor in a new tab — same session cookie, no second login */}
          {hasStudioAccess && (
            <a
              href={getStudioUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <span>🎬</span> Open Studio
              <span className="ml-auto text-slate-500 text-xs">↗</span>
            </a>
          )}

          {hasAdServerAccess && (
            <>
              <SectionLabel label="Tools" />
              <NavLink to="/tools" className={navLinkClass}>
                <span className="flex items-center gap-2"><span>🔧</span> Tools</span>
                <span className={`transition-transform ${toolsOpen ? 'rotate-180' : ''}`}><ChevronDownIcon /></span>
              </NavLink>
              {toolsOpen && (
                <div className="pl-4 space-y-0.5">
                  <NavLink to="/tools/vast-validator" className={navLinkClass}>VAST Validator</NavLink>
                  <NavLink to="/tools/chain-validator" className={navLinkClass}>Chain Validator</NavLink>
                </div>
              )}

              <SectionLabel label="Settings" />
              <NavLink to="/settings" className={navLinkClass}>
                <span className="flex items-center gap-2"><span>⚙️</span> Settings</span>
                <span className={`transition-transform ${settingsOpen ? 'rotate-180' : ''}`}><ChevronDownIcon /></span>
              </NavLink>
              {settingsOpen && (
                <div className="pl-4 space-y-0.5">
                  <NavLink to="/settings/api-keys" className={navLinkClass}>API Keys</NavLink>
                  <NavLink to="/settings/audit-log" className={navLinkClass}>Audit Log</NavLink>
                  <NavLink to="/settings/workspace" className={navLinkClass}>Workspace</NavLink>
                  <NavLink to="/settings/webhooks" className={navLinkClass}>Webhooks</NavLink>
                </div>
              )}
            </>
          )}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            {showClientSwitcher ? (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client</label>
                  <select
                    value={user?.workspace?.id ?? ''}
                    onChange={event => void handleWorkspaceSwitch(event.target.value)}
                    disabled={workspaceBusy}
                    className="min-w-[220px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
                  >
                    {workspaces.map(workspace => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name} · {getWorkspaceProductLabel(workspace)}
                      </option>
                    ))}
                  </select>
                  {user?.workspace?.id ? (
                    <WorkspaceAccessBadge
                      workspace={{
                        product_access: user.workspace.productAccess,
                      }}
                    />
                  ) : null}
                  {hasAdServerAccess ? (
                    <button
                      onClick={() => navigate('/clients')}
                      disabled={workspaceBusy}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Manage clients
                    </button>
                  ) : null}
                </div>
                {clientError && (
                  <span className="text-xs text-red-600">{clientError}</span>
                )}
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleThemeToggle}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
              <span className="hidden md:inline">{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
            </button>

            {/* Global search trigger */}
            <NavLink
              to="/search"
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors"
            >
              <span>🔍</span>
              <span>Search...</span>
              <kbd className="ml-2 text-xs bg-slate-100 px-1.5 py-0.5 rounded">⌘K</kbd>
            </NavLink>

            {/* User menu */}
            <div className="relative">
              <button
                className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
                onClick={() => setUserMenuOpen(o => !o)}
              >
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-medium">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <span className="text-sm text-slate-700 hidden md:block">
                  {user?.firstName} {user?.lastName}
                </span>
                <ChevronDownIcon />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-800">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                    <p className="text-xs text-slate-400 capitalize mt-0.5">{user?.role}</p>
                  </div>
                  <NavLink
                    to="/settings/workspace"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    ⚙️ Settings
                  </NavLink>
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={handleThemeToggle}
                  >
                    {theme === 'dark' ? '☀️ Switch to light' : '🌙 Switch to dark'}
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    onClick={handleLogout}
                  >
                    🚪 Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {hasAdServerAccess ? (
            <Outlet key={user?.workspace?.id ?? 'workspace-shell'} context={{ user }} />
          ) : (
            <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <h1 className="text-2xl font-bold text-slate-900">No Ad Server access</h1>
              <p className="mt-2 text-sm text-slate-600">
                Your access for this client is limited to Creative Studio. Contact an admin if you also need Ad Server access.
              </p>
              {hasStudioAccess && (
                <a
                  href={getStudioUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <span>🎬</span>
                  Open Studio
                </a>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Click outside to close the user menu without blocking sidebar links. */}
      {userMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setUserMenuOpen(false); }}
        />
      )}
    </div>
  );
}
