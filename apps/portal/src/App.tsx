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
      badge: 'border-fuchsia-400/25 bg-fuchsia-500/12 text-fuchsia-200',
      mark: 'border-fuchsia-400/30 bg-fuchsia-500/12 text-fuchsia-200',
    },
    emerald: {
      badge: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
      mark: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
    },
    slate: {
      badge: 'border-white/10 bg-white/[0.04] text-white/50',
      mark: 'border-white/10 bg-white/[0.04] text-white/45',
    },
  }[tone];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(17,18,26,0.9)] p-6 text-left shadow-[0_22px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl transition ${
        disabled
          ? 'cursor-not-allowed opacity-65'
          : 'cursor-pointer hover:-translate-y-1 hover:border-fuchsia-400/40 hover:bg-[rgba(24,25,35,0.96)]'
      }`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-px opacity-80 transition ${disabled ? 'bg-transparent' : tone === 'emerald' ? 'bg-gradient-to-r from-emerald-400/0 via-emerald-300/70 to-emerald-400/0' : 'bg-gradient-to-r from-fuchsia-400/0 via-fuchsia-300/80 to-violet-300/0'}`}
      />
      <div
        aria-hidden="true"
        className={`absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl transition ${disabled ? 'bg-transparent' : tone === 'emerald' ? 'bg-emerald-500/10 group-hover:bg-emerald-400/20' : 'bg-fuchsia-500/12 group-hover:bg-fuchsia-400/20'}`}
      />
      <div className="flex items-start justify-between gap-4">
        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${accents.badge}`}>
          {title}
        </span>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-xs font-semibold uppercase tracking-[0.22em] ${accents.mark}`}>
          {title === 'Ad Server' ? 'ADS' : title === 'Studio' ? 'STU' : 'SMX'}
        </div>
      </div>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white">{label}</h2>
      <p className="mt-3 text-sm leading-6 text-white/55">{copy}</p>
      <div className={`mt-8 text-sm font-medium ${disabled ? 'text-white/28' : 'text-fuchsia-200'}`}>
        Open workspace →
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07010f] px-4 py-10 text-white sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute left-0 top-0 h-[32rem] w-[32rem] -translate-x-1/4 -translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(236,72,153,0.22)_0%,_rgba(236,72,153,0.08)_35%,_transparent_72%)]" />
        <div className="absolute bottom-0 right-0 h-[34rem] w-[34rem] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(126,34,206,0.20)_0%,_rgba(126,34,206,0.08)_36%,_transparent_74%)]" />
      </div>

      <section className="relative z-10 w-full max-w-[440px] rounded-[28px] border border-white/10 bg-[rgba(17,18,26,0.9)] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/12 text-sm font-semibold uppercase tracking-[0.24em] text-fuchsia-300">
              SMX
            </div>
            <div>
              <p className="text-base font-semibold tracking-[0.01em] text-fuchsia-200">SMX Portal</p>
              <span className="mt-1 block text-sm text-white/55">User Administration</span>
            </div>
          </div>
          <span className="inline-flex rounded-full border border-fuchsia-400/25 bg-fuchsia-500/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200">
            Internal
          </span>
        </header>

        <div className="mt-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Sign in</h1>
          <p className="mt-2 text-sm text-white/55">Access the admin workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/28 focus:border-fuchsia-400/80 focus:ring-2 focus:ring-fuchsia-500/25"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/28 focus:border-fuchsia-400/80 focus:ring-2 focus:ring-fuchsia-500/25"
          />

          <div className="flex items-center justify-between gap-4 pt-1">
            <label className="flex items-center gap-3 text-sm text-white/62">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-fuchsia-500 focus:ring-fuchsia-500/30"
              />
              Remember me
            </label>
            <a
              href="#"
              onClick={(event) => event.preventDefault()}
              className="text-sm font-medium text-fuchsia-300 transition hover:text-fuchsia-200"
            >
              Forgot password?
            </a>
          </div>

          {error && (
            <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-[#ec4899] to-[#c026d3] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(192,38,211,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-8 border-t border-white/8 pt-5 text-xs leading-6 text-white/35">
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
    <main className="relative min-h-screen overflow-hidden bg-[#07010f] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-[34rem] w-[34rem] -translate-x-1/4 -translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(236,72,153,0.18)_0%,_rgba(236,72,153,0.07)_34%,_transparent_74%)]" />
        <div className="absolute bottom-0 right-0 h-[36rem] w-[36rem] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(126,34,206,0.18)_0%,_rgba(126,34,206,0.07)_36%,_transparent_76%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%,transparent_82%,rgba(255,255,255,0.02))]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl items-center">
        <div className="w-full rounded-[32px] border border-white/8 bg-[rgba(10,11,18,0.58)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-7 lg:p-8">
          <header className="flex flex-col gap-5 rounded-[28px] border border-white/8 bg-[rgba(17,18,26,0.72)] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ec4899] to-[#c026d3] text-sm font-semibold uppercase tracking-[0.24em] text-white shadow-[0_16px_38px_rgba(192,38,211,0.28)]">
                SMX
              </div>
              <div>
                <p className="text-lg font-semibold tracking-[0.01em] text-fuchsia-200">SMX Portal</p>
                <span className="mt-1 block text-sm text-white/55">Workspace Access</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
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
                className="min-w-[220px] rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-400/80 focus:ring-2 focus:ring-fuchsia-500/25"
              >
                {(session?.workspaces ?? []).map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white/72 transition hover:bg-white/[0.08]"
              >
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>

              <button
                type="button"
                onClick={async () => { await logout(); navigate('/login', { replace: true }); }}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white/72 transition hover:bg-white/[0.08]"
              >
                Log out
              </button>
            </div>
          </header>

          <div className="mt-6 rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-5 py-8 sm:px-7 sm:py-10">
            <span className="inline-flex rounded-full border border-fuchsia-400/25 bg-fuchsia-500/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200">
              Admin access
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.6rem] lg:leading-[1.02]">
              Choose where to work
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
              Active workspace: <span className="font-medium text-white">{workspaceLabel}</span>
              {' '}· Role: <span className="font-medium text-white">{getPlatformRoleLabel(session?.user.role)}</span>
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

          <div className="mt-10 grid gap-5 md:grid-cols-2">
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

          <div className="mt-8 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/38">
            Authorized internal users only. Access depends on your assigned workspace and role.
          </div>
        </div>
      </div>
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
