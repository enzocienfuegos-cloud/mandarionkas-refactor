import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  workspace: {
    id: string;
    name: string;
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

export default function Shell() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    fetch('/v1/auth/me', { credentials: 'include' })
      .then(res => {
        if (res.status === 401) {
          navigate('/login');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data) setUser(data);
      })
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = async () => {
    await fetch('/v1/auth/logout', { method: 'POST', credentials: 'include' });
    navigate('/login');
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
          <SectionLabel label="Ad Ops" />
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

          <SectionLabel label="Creative Studio" />
          {/* Opens the canvas editor in a new tab — same session cookie, no second login */}
          <a
            href={getStudioUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <span>🎬</span> Open Studio
            <span className="ml-auto text-slate-500 text-xs">↗</span>
          </a>

          <SectionLabel label="Tools" />
          <button
            className="flex items-center justify-between gap-2 w-full px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            onClick={() => setToolsOpen(o => !o)}
          >
            <span className="flex items-center gap-2"><span>🔧</span> Tools</span>
            <span className={`transition-transform ${toolsOpen ? 'rotate-180' : ''}`}><ChevronDownIcon /></span>
          </button>
          {toolsOpen && (
            <div className="pl-4 space-y-0.5">
              <NavLink to="/tools/vast-validator" className={navLinkClass}>VAST Validator</NavLink>
              <NavLink to="/tools/chain-validator" className={navLinkClass}>Chain Validator</NavLink>
            </div>
          )}

          <SectionLabel label="Settings" />
          <button
            className="flex items-center justify-between gap-2 w-full px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            onClick={() => setSettingsOpen(o => !o)}
          >
            <span className="flex items-center gap-2"><span>⚙️</span> Settings</span>
            <span className={`transition-transform ${settingsOpen ? 'rotate-180' : ''}`}><ChevronDownIcon /></span>
          </button>
          {settingsOpen && (
            <div className="pl-4 space-y-0.5">
              <NavLink to="/settings/api-keys" className={navLinkClass}>API Keys</NavLink>
              <NavLink to="/settings/audit-log" className={navLinkClass}>Audit Log</NavLink>
              <NavLink to="/settings/workspace" className={navLinkClass}>Workspace</NavLink>
              <NavLink to="/settings/webhooks" className={navLinkClass}>Webhooks</NavLink>
            </div>
          )}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">
              {user?.workspace?.name ?? 'Workspace'}
            </span>
          </div>

          <div className="flex items-center gap-3">
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
          <Outlet context={{ user }} />
        </main>
      </div>

      {/* Click outside to close menus */}
      {(userMenuOpen || toolsOpen || settingsOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setUserMenuOpen(false); }}
        />
      )}
    </div>
  );
}
