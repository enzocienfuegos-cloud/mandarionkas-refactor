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

const BRAND = '#f1008b';

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
  | 'overview'
  | 'campaigns'
  | 'tags'
  | 'creatives'
  | 'reporting'
  | 'pacing'
  | 'discrepancies'
  | 'experiments'
  | 'studio'
  | 'tools'
  | 'settings'
  | 'keys'
  | 'audit'
  | 'workspace'
  | 'webhooks';

function NavGlyph({ active, name }: { active: boolean; name: NavIconName }) {
  const icon = (() => {
    switch (name) {
      case 'overview':
        return <path d="M3.5 10.5 8 6l4.5 4.5V16H3.5z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />;
      case 'campaigns':
        return <>
          <rect x="3.5" y="4.5" width="9" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <rect x="3.5" y="8.75" width="9" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <rect x="3.5" y="13" width="6" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none" />
        </>;
      case 'tags':
        return <path d="M3.5 8V4.5h3.5L12.5 10 8 14.5 3.5 10Z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />;
      case 'creatives':
        return <>
          <rect x="3.5" y="4" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <path d="m5.2 11.8 2.1-2.2 1.8 1.8 1.7-2 1.2 2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </>;
      case 'reporting':
        return <>
          <path d="M4 12.5 6.5 10l2 1.5L12 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11.9 7.5h-2.7V4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>;
      case 'pacing':
        return <>
          <circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <path d="M8 8 10.5 6.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>;
      case 'discrepancies':
        return <>
          <path d="M8 3.5 12.5 12H3.5Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
          <path d="M8 6.6v2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="10.6" r=".45" fill="currentColor" />
        </>;
      case 'experiments':
        return <>
          <path d="M5 3.5h6M8 3.5v2m-2 7.5h4m-4-7.5 2 3 2-3m-2 3v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </>;
      case 'studio':
        return <>
          <rect x="3.5" y="4" width="9" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <path d="m6.7 6.2 3 1.8-3 1.8Z" fill="currentColor" />
        </>;
      case 'tools':
        return <path d="M5 4.2a2 2 0 1 0 2.8 2.8l3 3-1.2 1.2-3-3A2 2 0 0 0 3.8 5Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case 'settings':
        return <>
          <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <path d="M8 3.3v1.2M8 11.5v1.2M12.7 8h-1.2M4.5 8H3.3M11.3 4.7l-.9.9M5.6 10.4l-.9.9M11.3 11.3l-.9-.9M5.6 5.6l-.9-.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </>;
      case 'keys':
        return <>
          <circle cx="5.5" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <path d="M7.5 8H12.5M10.5 6.8v2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>;
      case 'audit':
        return <>
          <rect x="4" y="3.8" width="8" height="10.2" rx="1.4" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <path d="M6 6.3h4M6 8.4h4M6 10.5h2.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </>;
      case 'workspace':
        return <>
          <rect x="3.8" y="4" width="3.5" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <rect x="8.7" y="4" width="3.5" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <rect x="3.8" y="8.9" width="3.5" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <rect x="8.7" y="8.9" width="3.5" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="1.3" fill="none" />
        </>;
      case 'webhooks':
        return <>
          <path d="M5.5 6.3a2.5 2.5 0 1 1 0 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M10.5 6.3a2.5 2.5 0 1 0 0 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M5.8 8.8h4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>;
    }
  })();

  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold transition ${
        active
          ? 'border-fuchsia-500/30 bg-fuchsia-500/14 text-fuchsia-500 dark:text-fuchsia-400'
          : 'border-slate-200 bg-white text-slate-400 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/35'
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {icon}
      </svg>
    </span>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
    isActive
      ? 'bg-fuchsia-500/12 text-fuchsia-500 dark:text-fuchsia-400'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/[0.04] dark:hover:text-white'
  }`;
}

const SectionLabel = ({ label }: { label: string }) => (
  <div className="px-3 pb-1 pt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-white/22">
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
  const isDark = theme === 'dark';

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

  const showClientSwitcher = useMemo(() => {
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
    return !agnosticPrefixes.some((prefix) => location.pathname.startsWith(prefix)) || !hasAdServerAccess;
  }, [hasAdServerAccess, location.pathname]);

  const toolsOpen = location.pathname.startsWith('/tools');
  const settingsOpen = location.pathname.startsWith('/settings');
  const isOverviewRoute = location.pathname.startsWith('/overview');

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
      <div className={`flex h-screen items-center justify-center ${isDark ? 'bg-[#0c0c0e]' : 'bg-[#f6f3f8]'}`}>
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-fuchsia-500" />
      </div>
    );
  }

  return (
    <div className={`mandarion-shell flex h-screen overflow-hidden ${isDark ? 'bg-[#0c0c0e] text-white' : 'bg-[#f6f3f8] text-slate-900'}`}>
      <aside className={`flex w-[220px] flex-shrink-0 flex-col ${isDark ? 'border-r border-white/[0.06] bg-[#111114]' : 'border-r border-slate-200 bg-white'}`}>
        <div className={`px-5 py-5 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-[10px] text-white"
              style={{ background: BRAND, boxShadow: '0 6px 18px rgba(241, 0, 139, 0.24)' }}
            >
              <ZapIcon />
            </div>
            <div>
              <div className={`font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>MandaRion</div>
              <div className={`text-[11px] ${isDark ? 'text-white/28' : 'text-slate-400'}`}>Ad Platform</div>
            </div>
          </div>
        </div>

        <div className={`mx-3 mt-3 rounded-xl px-3 py-3 ${isDark ? 'border border-white/[0.08] bg-white/[0.03]' : 'border border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded-md bg-fuchsia-500/90" />
            <div className="min-w-0 flex-1">
              <div className={`truncate text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{user?.workspace?.name ?? 'Workspace'}</div>
              <div className={`text-[11px] ${isDark ? 'text-white/28' : 'text-slate-400'}`}>{user?.role ?? 'member'}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          {hasAdServerAccess && (
            <>
              <SectionLabel label="Main" />
              <NavLink to="/overview" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} name="overview" />
                    <span className="font-medium">Overview</span>
                  </>
                )}
              </NavLink>
              <NavLink to="/campaigns" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} name="campaigns" />
                    <span className="font-medium">Campaigns</span>
                  </>
                )}
              </NavLink>
              <NavLink to="/tags" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} name="tags" />
                    <span className="font-medium">Tags</span>
                  </>
                )}
              </NavLink>
              <NavLink to="/creatives" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} name="creatives" />
                    <span className="font-medium">Creatives</span>
                  </>
                )}
              </NavLink>

              <SectionLabel label="Analytics" />
              <NavLink to="/reporting" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} name="reporting" />
                    <span className="font-medium">Reporting</span>
                  </>
                )}
              </NavLink>
              <NavLink to="/pacing" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} name="pacing" />
                    <span className="font-medium">Pacing</span>
                  </>
                )}
              </NavLink>
              <NavLink to="/discrepancies" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} name="discrepancies" />
                    <span className="font-medium">Discrepancies</span>
                  </>
                )}
              </NavLink>
              <NavLink to="/experiments" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} name="experiments" />
                    <span className="font-medium">Experiments</span>
                  </>
                )}
              </NavLink>
            </>
          )}

          <SectionLabel label="Creative Studio" />
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
                    <NavGlyph active={isActive || toolsOpen} name="tools" />
                    <span className="font-medium">Tools</span>
                    <span className={`ml-auto transition ${toolsOpen ? 'rotate-180' : ''} ${isDark ? 'text-white/25' : 'text-slate-300'}`}>
                      <ChevronDownIcon />
                    </span>
                  </>
                )}
              </NavLink>
              {toolsOpen && (
                <div className="space-y-1 pl-5">
                  <NavLink to="/tools/vast-validator" className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <NavGlyph active={isActive} name="tools" />
                        <span className="font-medium">VAST Validator</span>
                      </>
                    )}
                  </NavLink>
                  <NavLink to="/tools/chain-validator" className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <NavGlyph active={isActive} name="tools" />
                        <span className="font-medium">Chain Validator</span>
                      </>
                    )}
                  </NavLink>
                </div>
              )}

              <NavLink to="/settings" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive || settingsOpen} name="settings" />
                    <span className="font-medium">Settings</span>
                    <span className={`ml-auto transition ${settingsOpen ? 'rotate-180' : ''} ${isDark ? 'text-white/25' : 'text-slate-300'}`}>
                      <ChevronDownIcon />
                    </span>
                  </>
                )}
              </NavLink>
              {settingsOpen && (
                <div className="space-y-1 pl-5">
                  <NavLink to="/settings/api-keys" className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <NavGlyph active={isActive} name="keys" />
                        <span className="font-medium">API Keys</span>
                      </>
                    )}
                  </NavLink>
                  <NavLink to="/settings/audit-log" className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <NavGlyph active={isActive} name="audit" />
                        <span className="font-medium">Audit Log</span>
                      </>
                    )}
                  </NavLink>
                  <NavLink to="/settings/workspace" className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <NavGlyph active={isActive} name="workspace" />
                        <span className="font-medium">Workspace</span>
                      </>
                    )}
                  </NavLink>
                  <NavLink to="/settings/webhooks" className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <NavGlyph active={isActive} name="webhooks" />
                        <span className="font-medium">Webhooks</span>
                      </>
                    )}
                  </NavLink>
                </div>
              )}
            </>
          )}
        </nav>

        <div className={`px-3 py-3 ${isDark ? 'border-t border-white/[0.06]' : 'border-t border-slate-200'}`}>
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f1008b_0%,#8b5cf6_100%)] text-xs font-bold text-white">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
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

      <div className={`flex min-w-0 flex-1 flex-col ${isDark ? 'bg-[#0c0c0e]' : 'bg-[#f6f3f8]'}`}>
        {!isOverviewRoute ? (
        <header className={`flex h-14 flex-shrink-0 items-center justify-between px-7 ${isDark ? 'border-b border-white/[0.06] bg-[#0c0c0e]' : 'border-b border-slate-200 bg-[#f6f3f8]'}`}>
          <div className="flex items-center gap-3">
            <div className={`hidden max-w-[360px] items-center gap-2 rounded-xl px-3 py-2 text-sm md:flex ${isDark ? 'border border-white/[0.08] bg-white/[0.03] text-white/35' : 'border border-slate-200 bg-white text-slate-400'}`}>
              <SearchIcon />
              <span className="truncate">Search campaigns, creatives, segments…</span>
              <span className={`ml-auto rounded-md px-1.5 py-0.5 text-[11px] ${isDark ? 'bg-white/[0.05] text-white/22' : 'bg-slate-100 text-slate-400'}`}>⌘K</span>
            </div>

            {showClientSwitcher ? (
              <div className="flex items-center gap-2">
                <select
                  value={user?.workspace?.id ?? ''}
                  onChange={(event) => void handleWorkspaceSwitch(event.target.value)}
                  disabled={workspaceBusy}
                  className={`min-w-[220px] rounded-xl px-3 py-2 text-sm font-medium outline-none ${isDark ? 'border border-white/[0.08] bg-white/[0.03] text-white' : 'border border-slate-200 bg-white text-slate-800'}`}
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id} className={isDark ? 'bg-[#111114] text-white' : 'bg-white text-slate-900'}>
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
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-60 ${isDark ? 'border border-white/[0.08] bg-white/[0.03] text-white/65 hover:bg-white/[0.05] hover:text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                  >
                    Manage clients
                  </button>
                ) : null}
              </div>
            ) : null}
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
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </div>
                <span className={`hidden text-sm md:block ${isDark ? 'text-white/75' : 'text-slate-700'}`}>
                  {user?.firstName} {user?.lastName}
                </span>
                <span className={isDark ? 'text-white/25' : 'text-slate-400'}>
                  <ChevronDownIcon />
                </span>
              </button>

              {userMenuOpen && (
                <div className={`absolute right-0 mt-2 w-56 rounded-2xl p-2 shadow-2xl ${isDark ? 'border border-white/[0.08] bg-[#17171b] shadow-black/40' : 'border border-slate-200 bg-white shadow-slate-300/30'}`}>
                  <div className={`px-3 py-3 ${isDark ? 'border-b border-white/[0.06]' : 'border-b border-slate-200'}`}>
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className={`mt-1 text-xs ${isDark ? 'text-white/38' : 'text-slate-500'}`}>{user?.email}</p>
                    <p className={`mt-1 text-[11px] uppercase tracking-[0.14em] ${isDark ? 'text-white/22' : 'text-slate-400'}`}>{user?.role}</p>
                  </div>
                  <NavLink
                    to="/settings/workspace"
                    className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${isDark ? 'text-white/65 hover:bg-white/[0.05] hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <ShieldIcon />
                    Settings
                  </NavLink>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${isDark ? 'text-white/65 hover:bg-white/[0.05] hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                    onClick={handleThemeToggle}
                  >
                    <ShieldIcon />
                    {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                  </button>
                  <button
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${isDark ? 'text-red-300 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}
                    onClick={handleLogout}
                  >
                    <ShieldIcon />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        ) : null}

        <main className={`flex-1 overflow-y-auto ${isOverviewRoute ? 'p-0' : 'p-6'} ${isDark ? 'bg-[#0c0c0e]' : 'bg-[#f6f3f8]'}`}>
          {hasAdServerAccess ? (
            <Outlet key={user?.workspace?.id ?? 'workspace-shell'} context={{ user }} />
          ) : (
            <div className={`mx-auto max-w-2xl rounded-[18px] p-8 ${isDark ? 'border border-white/[0.08] bg-[#18181c] shadow-[0_18px_50px_rgba(0,0,0,0.32)]' : 'border border-slate-200 bg-white shadow-sm'}`}>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>No Ad Server access</h1>
              <p className={`mt-2 text-sm ${isDark ? 'text-white/45' : 'text-slate-500'}`}>
                Your access for this client is limited to Creative Studio. Contact an admin if you also need Ad Server access.
              </p>
              {hasStudioAccess && (
                <a
                  href={getStudioUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-medium text-white shadow-[0_10px_28px_rgba(241,0,139,0.24)]"
                >
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
