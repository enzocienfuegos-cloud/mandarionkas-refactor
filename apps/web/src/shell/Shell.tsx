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

function NavGlyph({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold transition ${
        active
          ? 'border-fuchsia-500/30 bg-fuchsia-500/14 text-fuchsia-400'
          : 'border-white/8 bg-white/[0.03] text-white/35'
      }`}
    >
      <span className="h-2 w-2 rounded-sm bg-current" />
    </span>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
    isActive
      ? 'bg-fuchsia-500/12 text-fuchsia-400'
      : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
  }`;
}

const SectionLabel = ({ label }: { label: string }) => (
  <div className="px-3 pb-1 pt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-white/22">
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
      <div className="flex h-screen items-center justify-center bg-[#0c0c0e]">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-fuchsia-500" />
      </div>
    );
  }

  return (
    <div className="mandarion-shell flex h-screen overflow-hidden bg-[#0c0c0e] text-white">
      <aside className="flex w-[220px] flex-shrink-0 flex-col border-r border-white/[0.06] bg-[#111114]">
        <div className="border-b border-white/[0.06] px-5 py-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-[10px] text-white"
              style={{ background: BRAND, boxShadow: '0 6px 18px rgba(241, 0, 139, 0.24)' }}
            >
              <ZapIcon />
            </div>
            <div>
              <div className="font-semibold tracking-tight text-white">MandaRion</div>
              <div className="text-[11px] text-white/28">Ad Platform</div>
            </div>
          </div>
        </div>

        <div className="mx-3 mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 rounded-md bg-fuchsia-500/90" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{user?.workspace?.name ?? 'Workspace'}</div>
              <div className="text-[11px] text-white/28">{user?.role ?? 'member'}</div>
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
                    <NavGlyph active={isActive} />
                    <span className="font-medium">Overview</span>
                  </>
                )}
              </NavLink>
              <NavLink to="/campaigns" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} />
                    <span className="font-medium">Campaigns</span>
                  </>
                )}
              </NavLink>
              <NavLink to="/tags" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} />
                    <span className="font-medium">Tags</span>
                  </>
                )}
              </NavLink>
              <NavLink to="/creatives" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} />
                    <span className="font-medium">Creatives</span>
                  </>
                )}
              </NavLink>

              <SectionLabel label="Analytics" />
              <NavLink to="/reporting" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} />
                    <span className="font-medium">Reporting</span>
                  </>
                )}
              </NavLink>
              <NavLink to="/pacing" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} />
                    <span className="font-medium">Pacing</span>
                  </>
                )}
              </NavLink>
              <NavLink to="/discrepancies" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} />
                    <span className="font-medium">Discrepancies</span>
                  </>
                )}
              </NavLink>
              <NavLink to="/experiments" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive} />
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
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/55 transition hover:bg-white/[0.04] hover:text-white"
            >
              <NavGlyph active={false} />
              <span className="font-medium">Open Studio</span>
              <span className="ml-auto text-xs text-white/25 transition group-hover:text-white/45">↗</span>
            </a>
          )}

          {hasAdServerAccess && (
            <>
              <SectionLabel label="System" />
              <NavLink to="/tools" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive || toolsOpen} />
                    <span className="font-medium">Tools</span>
                    <span className={`ml-auto text-white/25 transition ${toolsOpen ? 'rotate-180' : ''}`}>
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
                        <NavGlyph active={isActive} />
                        <span className="font-medium">VAST Validator</span>
                      </>
                    )}
                  </NavLink>
                  <NavLink to="/tools/chain-validator" className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <NavGlyph active={isActive} />
                        <span className="font-medium">Chain Validator</span>
                      </>
                    )}
                  </NavLink>
                </div>
              )}

              <NavLink to="/settings" className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <NavGlyph active={isActive || settingsOpen} />
                    <span className="font-medium">Settings</span>
                    <span className={`ml-auto text-white/25 transition ${settingsOpen ? 'rotate-180' : ''}`}>
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
                        <NavGlyph active={isActive} />
                        <span className="font-medium">API Keys</span>
                      </>
                    )}
                  </NavLink>
                  <NavLink to="/settings/audit-log" className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <NavGlyph active={isActive} />
                        <span className="font-medium">Audit Log</span>
                      </>
                    )}
                  </NavLink>
                  <NavLink to="/settings/workspace" className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <NavGlyph active={isActive} />
                        <span className="font-medium">Workspace</span>
                      </>
                    )}
                  </NavLink>
                  <NavLink to="/settings/webhooks" className={navLinkClass}>
                    {({ isActive }) => (
                      <>
                        <NavGlyph active={isActive} />
                        <span className="font-medium">Webhooks</span>
                      </>
                    )}
                  </NavLink>
                </div>
              )}
            </>
          )}
        </nav>

        <div className="border-t border-white/[0.06] px-3 py-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f1008b_0%,#8b5cf6_100%)] text-xs font-bold text-white">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="truncate text-[11px] text-white/28">{user?.email}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[#0c0c0e]">
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0c0c0e] px-7">
          <div className="flex items-center gap-3">
            <div className="hidden max-w-[360px] items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/35 md:flex">
              <SearchIcon />
              <span className="truncate">Search campaigns, creatives, segments…</span>
              <span className="ml-auto rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-white/22">⌘K</span>
            </div>

            {showClientSwitcher ? (
              <div className="flex items-center gap-2">
                <select
                  value={user?.workspace?.id ?? ''}
                  onChange={(event) => void handleWorkspaceSwitch(event.target.value)}
                  disabled={workspaceBusy}
                  className="min-w-[220px] rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-medium text-white outline-none"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id} className="bg-[#111114] text-white">
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
                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/65 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-60"
                  >
                    Manage clients
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {clientError && <span className="text-xs text-red-300">{clientError}</span>}

            <button
              type="button"
              onClick={handleThemeToggle}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/55 transition hover:bg-white/[0.05] hover:text-white"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>

            <div className="relative z-50">
              <button
                className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 transition hover:bg-white/[0.05]"
                onClick={() => setUserMenuOpen((o) => !o)}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f1008b_0%,#8b5cf6_100%)] text-xs font-semibold text-white">
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </div>
                <span className="hidden text-sm text-white/75 md:block">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-white/25">
                  <ChevronDownIcon />
                </span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/[0.08] bg-[#17171b] p-2 shadow-2xl shadow-black/40">
                  <div className="border-b border-white/[0.06] px-3 py-3">
                    <p className="text-sm font-medium text-white">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="mt-1 text-xs text-white/38">{user?.email}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/22">{user?.role}</p>
                  </div>
                  <NavLink
                    to="/settings/workspace"
                    className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/65 transition hover:bg-white/[0.05] hover:text-white"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <ShieldIcon />
                    Settings
                  </NavLink>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/65 transition hover:bg-white/[0.05] hover:text-white"
                    onClick={handleThemeToggle}
                  >
                    <ShieldIcon />
                    {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                  </button>
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10"
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

        <main className="flex-1 overflow-y-auto bg-[#0c0c0e] p-6">
          {hasAdServerAccess ? (
            <Outlet key={user?.workspace?.id ?? 'workspace-shell'} context={{ user }} />
          ) : (
            <div className="mx-auto max-w-2xl rounded-[18px] border border-white/[0.08] bg-[#18181c] p-8 shadow-[0_18px_50px_rgba(0,0,0,0.32)]">
              <h1 className="text-2xl font-bold text-white">No Ad Server access</h1>
              <p className="mt-2 text-sm text-white/45">
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
