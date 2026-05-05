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
  const [pointer, setPointer] = useState({ x: 50, y: 42 });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08080b] px-4 text-white"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: ((event.clientX - rect.left) / rect.width) * 100,
          y: ((event.clientY - rect.top) / rect.height) * 100,
        });
      }}
      onPointerLeave={() => setPointer({ x: 50, y: 42 })}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[#050507]" />
        <div
          className="absolute h-[920px] w-[920px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(241,0,139,0.11)_0%,rgba(241,0,139,0.045)_46%,transparent_76%)] blur-[145px] transition-[left,top] duration-700 ease-out"
          style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }}
        />
        <div
          className="absolute h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(88,166,255,0.08)_0%,rgba(88,166,255,0.03)_44%,transparent_72%)] blur-[150px] transition-[left,top] duration-1000 ease-out"
          style={{
            left: `${Math.max(18, Math.min(82, 100 - pointer.x * 0.42))}%`,
            top: `${Math.max(10, Math.min(80, pointer.y * 0.72 + 12))}%`,
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(800px_400px_at_50%_-10%,rgba(255,255,255,0.06),transparent_70%)]" />
        <div className="absolute inset-0 opacity-[0.025] mix-blend-overlay bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.55)_1px,transparent_0)] [background-size:22px_22px]" />
      </div>

      <style>{`
        @keyframes panelLight {
          0%, 100% { transform: translate3d(-18%, 0, 0); opacity: .18; }
          50% { transform: translate3d(18%, 0, 0); opacity: .34; }
        }
      `}</style>

      <div className="relative w-full max-w-[396px]">
        <div className="mb-7 flex justify-center">
          <div className="flex items-center gap-[14px]" aria-label="Temple logo">
            <div className="flex h-[42px] w-[42px] shrink-0 translate-y-[1px] items-center justify-center">
              <svg
                viewBox="180 735 585 585"
                className="h-full w-full text-white/95"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                role="img"
              >
                <title>Temple mark</title>
                <path d="M307.749 738.419C318.003 736.714 340.86 737.844 351.845 737.888L424.967 737.903L567.195 737.884C621.678 737.853 671.417 730.522 715.605 768.272C767.914 812.96 763.112 868.176 762.97 929.631L762.946 1026.67L762.957 1126C762.96 1151.7 764.117 1181.09 759.304 1206.01C754.813 1228.09 744.736 1248.65 730.035 1265.73C706.39 1293.11 671.809 1307.21 636.248 1309.85C567.191 1311.8 493.945 1310.16 424.599 1310.24L348.062 1310.42C302.393 1310.3 269.687 1310.76 231.786 1280.5C192.864 1249.43 182.814 1205.13 182.677 1157.47C182.646 1146.78 183.453 1136.14 183.438 1125.56L183.471 1002.5C183.482 965.042 184.381 924.294 183.262 887.004C180.856 806.832 222.579 746.405 307.749 738.419Z" />
                <path d="M265.447 840.068C402.831 838.64 543.172 839.987 680.751 840.012C681.829 887.154 680.776 938.589 680.752 986.015L604.543 985.878C602.972 1057.71 604.561 1135.61 604.614 1207.94L516.954 1208.01L516.984 898.492L622.879 898.521L622.981 927.706L546.223 927.653L546.052 1178.73C555.637 1178.85 565.46 1178.71 575.067 1178.69L575.205 956.697L651.056 956.288L651.241 869.499L487.627 869.601L487.667 1019.11L487.62 1208.17L458.196 1208.15L458.517 869.452L294.884 869.709L294.72 956.313C319.856 956.802 345.859 956.559 371.061 956.632L371.179 1178.75C380.608 1178.93 390.422 1178.68 399.879 1178.57L399.915 927.641L323.75 927.611L323.99 898.654C358.3 897.776 394.826 898.521 429.384 898.511C430.682 1000.35 429.314 1105.82 429.314 1207.95L341.505 1208.01L341.967 985.85L265.227 986.014C265.341 937.494 264.83 888.535 265.447 840.068Z" fill="#050507" />
              </svg>
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-[25px] font-semibold leading-[1] tracking-[-0.028em] text-white">Temple</div>
              <div className="mt-[3px] text-[9.5px] font-medium uppercase leading-none tracking-[0.26em] text-white/30">Superadmin</div>
            </div>
          </div>
        </div>

        <div className="absolute inset-[-1px] -z-10 rounded-[25px] bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.035)_38%,rgba(241,0,139,0.18)_100%)] opacity-80 blur-[0.2px]" />

        <div className="relative overflow-hidden rounded-[24px] border border-white/[0.10] bg-[#121217]/80 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_0%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08)_0%,transparent_28%,transparent_64%,rgba(241,0,139,0.08)_100%)]" />
          <div className="pointer-events-none absolute -inset-x-20 top-0 h-28 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)] blur-xl animate-[panelLight_10s_ease-in-out_infinite]" />

          <div className="relative z-10">
            <div className="mb-5">
              <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-white">Sign in</h1>
              <p className="mt-1 text-sm leading-6 text-white/42">Manage licenses, seats and privileged access.</p>
            </div>

            {error ? (
              <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-200">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/38">
                  Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/28">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="superadmin@company.com"
                    className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-10 py-3 text-sm text-white outline-none transition placeholder:text-white/22 focus:border-[#f1008b]/40 focus:bg-black/28 focus:ring-4 focus:ring-[#f1008b]/10"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-white/38">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="text-xs font-semibold text-white/38 transition hover:text-[#f1008b]"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/28">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="4" y="10" width="16" height="10" rx="2" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="password"
                    className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-10 py-3 pr-10 text-sm text-white outline-none transition placeholder:text-white/22 focus:border-[#f1008b]/40 focus:bg-black/28 focus:ring-4 focus:ring-[#f1008b]/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition hover:text-[#f1008b]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-3 pt-1 text-xs font-medium uppercase tracking-[0.12em] text-white/38">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#f1008b] focus:ring-[#f1008b]"
                />
                Keep me signed in
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(241,0,139,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(241,0,139,0.30)] disabled:cursor-not-allowed disabled:opacity-70"
                style={{ background: '#f1008b' }}
              >
                <span>{loading ? 'Verifying access...' : 'Continue'}</span>
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-white/36">
              Need an account?{' '}
              <a href="/register" className="font-semibold text-white/58 transition hover:text-[#f1008b]">
                Register
              </a>
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-white/28">Privileged access is monitored and logged.</p>
      </div>
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
