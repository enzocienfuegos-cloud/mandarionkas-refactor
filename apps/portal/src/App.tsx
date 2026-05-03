// apps/portal/src/App.tsx
//
// Portal — Sprint 51 definitive rewrite.
//
// Changes from S50:
//   - loadPortalSession() / switchWorkspace() now return the already-resolved
//     productAccess from the backend. No client-side inference.
//   - Auto-redirect fires only after `loading` is false and session is set.
//     The S50 version derived `shouldAutoRedirect` outside the loading guard,
//     which could trigger a redirect before the session was ready.
//   - switchWorkspace() re-fetches the full session (not just the workspace),
//     so productAccess is always re-resolved by the backend.
//   - Explicit error handling: non-401 errors show an inline message instead
//     of silently redirecting to /login.

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { applyTheme, getInitialTheme, persistTheme, type ThemeMode } from './theme';
import {
  loadPortalSession,
  login,
  logout,
  register,
  switchWorkspace,
  type PortalSession,
} from './shared/session';
import { getPlatformRoleLabel } from '../../../packages/contracts/src/platform';

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function getAdServerUrl(): string {
  const configured = import.meta.env.VITE_AD_SERVER_URL?.trim();
  if (configured) return new URL('/overview', configured).toString();
  if (import.meta.env.DEV) return 'http://localhost:5173/overview';
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname.startsWith('portal-')) {
      return `${protocol}//${hostname.replace(/^portal-/, 'app-')}/overview`;
    }
  }
  return '/';
}

function getStudioUrl(): string {
  const configured = import.meta.env.VITE_STUDIO_URL?.trim();
  if (configured) return configured;
  if (import.meta.env.DEV) return 'http://localhost:5174';
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname.startsWith('portal-')) {
      return `${protocol}//${hostname.replace(/^portal-/, 'studio-')}`;
    }
  }
  return '/';
}

// ---------------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------------

function ProductBadge({ label, tone }: { label: string; tone: 'fuchsia' | 'emerald' | 'slate' }) {
  const classes = {
    fuchsia: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    slate:   'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-white/55',
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${classes[tone]}`}>
      {label}
    </span>
  );
}

function CardButton({
  title, copy, label, onClick, disabled = false, tone,
}: {
  title: string;
  copy: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  tone: 'fuchsia' | 'emerald' | 'slate';
}) {
  const accents = {
    fuchsia: {
      mark: 'border-pink-500/20 bg-pink-500/10 text-pink-400',
      footer: 'text-pink-400',
    },
    emerald: {
      mark: 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-400',
      footer: 'text-pink-400',
    },
    slate: {
      mark: 'border-white/10 bg-white/[0.04] text-white/45',
      footer: 'text-white/35',
    },
  }[tone];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group rounded-[24px] border border-white/10 bg-[rgba(17,18,26,0.9)] p-6 text-left shadow-2xl backdrop-blur-xl transition ${
        disabled
          ? 'cursor-not-allowed opacity-65'
          : 'cursor-pointer hover:-translate-y-1 hover:border-pink-500/40 hover:bg-white/[0.07]'
      }`}
    >
      <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border text-xs font-semibold uppercase tracking-[0.22em] transition ${
        disabled ? accents.mark : `${accents.mark} group-hover:shadow-lg ${tone === 'emerald' ? 'group-hover:shadow-fuchsia-500/20' : 'group-hover:shadow-pink-500/20'}`
      }`}>
          {title === 'Ad Server' ? 'ADS' : title === 'Studio' ? 'STU' : 'SMX'}
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</p>
      <h2 className="mt-2 text-2xl font-bold text-white">{label}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
      <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
        <span className={disabled ? 'text-white/28' : 'text-slate-500'}>Open workspace</span>
        <span className={`transition ${disabled ? 'text-white/28' : `${accents.footer} group-hover:translate-x-1`}`}>→</span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Login page
// ---------------------------------------------------------------------------

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }
    setLoading(true);
    try {
      await login({ email: email.trim().toLowerCase(), password, remember });
      navigate('/', { replace: true });
    } catch (caught: unknown) {
      setError((caught as Error)?.message ?? 'Login failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#070b18] p-6 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.26),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.18),transparent_34%)]" />
      </div>

      <section className="relative w-full max-w-[420px] rounded-[24px] border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-7 flex items-center gap-3 font-semibold text-slate-300">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-400 text-xs font-black text-white shadow-lg shadow-cyan-500/10">
              SMX
          </div>
          <span>SMX Portal</span>
        </div>

        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Sign in</h1>
          <p className="mt-2 mb-7 text-slate-400">Access the admin workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            Email
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-xl border border-slate-500/30 bg-slate-950/60 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            Password
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl border border-slate-500/30 bg-slate-950/60 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
            />
          </label>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 accent-cyan-400"
              />
              Remember me
            </label>
            <a
              href="#"
              onClick={(event) => event.preventDefault()}
              className="font-medium text-cyan-300 hover:underline"
            >
              Forgot password?
            </a>
          </div>

          {error && (
            <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-400 font-extrabold text-white shadow-lg shadow-cyan-500/10 transition hover:-translate-y-0.5 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-slate-400">
          Need an account?{' '}
          <a href="/register" className="font-semibold text-cyan-300 hover:underline">
            Register
          </a>
        </p>

        <div className="mt-6 border-t border-white/8 pt-5 text-center text-xs leading-6 text-slate-500">
          Authorized users only. Activity may be monitored.
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Register page
// ---------------------------------------------------------------------------

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '', password: '', workspaceName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (caught: unknown) {
      setError((caught as Error)?.message ?? 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof typeof form, placeholder: string, type = 'text') => (
    <input
      type={type}
      placeholder={placeholder}
      value={form[key]}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/25 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
    />
  );

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">SMX Portal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Create account</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {field('firstName', 'First name')}
          {field('lastName', 'Last name')}
          {field('email', 'Email', 'email')}
          {field('password', 'Password', 'password')}
          {field('workspaceName', 'Workspace name')}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-fuchsia-500 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(241,0,139,0.24)] transition hover:bg-fuchsia-600 disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-sm text-slate-500 dark:text-white/45">
          Already have an account?{' '}
          <a href="/login" className="font-medium text-fuchsia-500 hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Portal home
// ---------------------------------------------------------------------------

function PortalHome() {
  const navigate = useNavigate();
  const [theme, setTheme]       = useState<ThemeMode>(() => getInitialTheme());
  const [session, setSession]   = useState<PortalSession | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState('');
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  // Load session once on mount
  useEffect(() => {
    loadPortalSession()
      .then(setSession)
      .catch((err: unknown) => {
        const status = (err as any)?.status ?? 0;
        if (status === 401) {
          navigate('/login', { replace: true });
        } else {
          setLoadError((err as Error)?.message ?? 'Could not load session.');
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-redirect when only one product is available.
  // Guard: only after loading is done AND session is present.
  useEffect(() => {
    if (loading || !session) return;

    const { ad_server, studio } = session.productAccess;
    const onlyAdServer = ad_server && !studio;
    const onlyStudio   = studio   && !ad_server;

    if (onlyAdServer || onlyStudio) {
      const timer = window.setTimeout(() => {
        window.location.assign(onlyAdServer ? getAdServerUrl() : getStudioUrl());
      }, 350);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [loading, session]);

  const workspaceLabel = useMemo(() => {
    if (!session?.workspace) return 'No active workspace';
    return session.workspace.name;
  }, [session]);

  const { ad_server: hasAdServer, studio: hasStudio } = session?.productAccess ?? {
    ad_server: false,
    studio: false,
  };

  const shouldAutoRedirect =
    session !== null &&
    (hasAdServer !== hasStudio); // exactly one product available

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-fuchsia-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-sm font-semibold text-red-500">Connection error</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-white/55">{loadError}</p>
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

  return (
    <main className="min-h-screen overflow-hidden bg-[#07010f] text-white relative">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(126,34,206,0.18),transparent_36%)]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-pink-500 to-fuchsia-600 text-xs font-black shadow-lg shadow-pink-500/20">
                SMX
              </div>
              <div>
                <p className="font-bold leading-none text-white">SMX Portal</p>
                <span className="mt-1 block text-xs text-slate-500">Workspace Access</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={session?.activeWorkspaceId ?? ''}
                disabled={switching}
                onChange={async (event) => {
                  if (!event.target.value) return;
                  setSwitching(true);
                  setSwitchError('');
                  try {
                    const nextSession = await switchWorkspace(event.target.value);
                    setSession(nextSession);
                  } catch (caught: unknown) {
                    setSwitchError((caught as Error)?.message ?? 'Workspace switch failed.');
                  } finally {
                    setSwitching(false);
                  }
                }}
                className="h-10 min-w-[180px] rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-300 outline-none focus:border-pink-500"
              >
                {(session?.workspaces ?? []).map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
              >
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>

              <button
                type="button"
                onClick={async () => { await logout(); navigate('/login', { replace: true }); }}
                className="h-10 rounded-xl border border-pink-500/20 bg-pink-500/10 px-4 text-sm font-semibold text-pink-400 transition hover:bg-pink-500/15"
              >
                Log out
              </button>
            </div>
          </header>

        <div className="flex flex-1 items-center justify-center py-14">
          <div className="w-full max-w-4xl">
            <div className="mb-8 text-center">
              <span className="inline-flex rounded-full border border-pink-500/20 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-400">
                Admin access
              </span>
              <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">
                Choose where to work
              </h1>
              <p className="mt-3 text-slate-400">
                Active workspace: <span className="font-semibold text-white">{workspaceLabel}</span>
                {' '}· Role: <span className="font-semibold text-white">{getPlatformRoleLabel(session?.user.role)}</span>
              </p>
            </div>

          {switchError && (
            <p className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {switchError}
            </p>
          )}

          {shouldAutoRedirect && (
            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Only one product is available for this workspace. Redirecting automatically.
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
          <CardButton
            title="Ad Server"
            label="Campaign operations"
            copy={
              hasAdServer
                ? 'Manage campaigns, tags, delivery, diagnostics, and reporting.'
                : 'Your role does not include Ad Server access for this workspace.'
            }
            onClick={hasAdServer ? () => window.location.assign(getAdServerUrl()) : undefined}
            disabled={!hasAdServer}
            tone={hasAdServer ? 'fuchsia' : 'slate'}
          />
          <CardButton
            title="Studio"
            label="Creative workflow"
            copy={
              hasStudio
                ? 'Review, publish, and hand off creative production tasks.'
                : 'Your role does not include Studio access for this workspace.'
            }
            onClick={hasStudio ? () => window.location.assign(getStudioUrl()) : undefined}
            disabled={!hasStudio}
            tone={hasStudio ? 'emerald' : 'slate'}
          />
          </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-xs text-slate-500">
              Authorized internal users only. Access depends on your assigned workspace and role.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// App router
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<PortalHome />} />
        <Route path="/launch"    element={<PortalHome />} />
        <Route path="/login"     element={<LoginPage />} />
        <Route path="/register"  element={<RegisterPage />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
