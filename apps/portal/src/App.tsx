import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { applyTheme, getInitialTheme, persistTheme, type ThemeMode } from './theme';
import { loadPortalSession, login, logout, register, switchWorkspace, type PortalSession } from './shared/session';

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

function roleLabel(role: string | null | undefined) {
  switch (String(role || '').trim().toLowerCase()) {
    case 'admin':
      return 'Admin';
    case 'designer':
      return 'Designer';
    case 'ad_ops':
      return 'Ad Ops';
    case 'reviewer':
      return 'Reviewer';
    default:
      return 'Member';
  }
}

function ProductBadge({ label, tone }: { label: string; tone: 'fuchsia' | 'emerald' | 'slate' }) {
  const classes = {
    fuchsia: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-white/55',
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${classes[tone]}`}>{label}</span>;
}

function CardButton({
  title,
  copy,
  label,
  onClick,
  disabled = false,
  tone,
}: {
  title: string;
  copy: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  tone: 'fuchsia' | 'emerald' | 'slate';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`portal-card rounded-[22px] p-6 text-left transition ${
        disabled ? 'cursor-not-allowed opacity-65' : 'hover:-translate-y-0.5 hover:shadow-lg'
      }`}
    >
      <ProductBadge label={title} tone={tone} />
      <h2 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">{label}</h2>
      <p className="mt-3 text-sm text-slate-500 dark:text-white/45">{copy}</p>
    </button>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
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
      await login({ email: email.trim(), password, remember });
      navigate('/', { replace: true });
    } catch (caught: any) {
      setError(caught.message || 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="portal-card w-full max-w-md rounded-[28px] p-8">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">SMX Portal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Sign in once</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-white/45">
            Access Ad Server and Studio from a single authenticated shell.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-white/70">Email</label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/25 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-white/70">Password</label>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/25 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-white/55">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            Keep me signed in
          </label>
          {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(241,0,139,0.28)] transition hover:bg-fuchsia-600 disabled:opacity-70"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500 dark:text-white/45">
          Need an account? <a href="/register" className="font-medium text-fuchsia-600 dark:text-fuchsia-300">Create one</a>
        </p>
      </div>
    </div>
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    workspaceName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim() || !form.password || !form.workspaceName.trim()) {
      setError('Complete every field to continue.');
      return;
    }
    setLoading(true);
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (caught: any) {
      setError(caught.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="portal-card w-full max-w-xl rounded-[28px] p-8">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">SMX Portal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">Create your workspace</h1>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-white/70">Email</label>
            <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/25 dark:border-white/10 dark:bg-white/[0.03] dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-white/70">First name</label>
            <input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/25 dark:border-white/10 dark:bg-white/[0.03] dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-white/70">Last name</label>
            <input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/25 dark:border-white/10 dark:bg-white/[0.03] dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-white/70">Password</label>
            <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/25 dark:border-white/10 dark:bg-white/[0.03] dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-white/70">Workspace name</label>
            <input value={form.workspaceName} onChange={(event) => setForm((current) => ({ ...current, workspaceName: event.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/25 dark:border-white/10 dark:bg-white/[0.03] dark:text-white" />
          </div>
          {error ? <p className="md:col-span-2 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
          <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2">
            <a href="/login" className="text-sm font-medium text-slate-500 dark:text-white/45">Already have an account?</a>
            <button type="submit" disabled={loading} className="rounded-xl bg-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(241,0,139,0.28)] transition hover:bg-fuchsia-600 disabled:opacity-70">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PortalHome() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [session, setSession] = useState<PortalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    loadPortalSession()
      .then(setSession)
      .catch(() => navigate('/login', { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  const access = session?.productAccess ?? { ad_server: true, studio: true };
  const hasAdServerAccess = access.ad_server !== false;
  const hasStudioAccess = access.studio !== false;
  const userName = session?.user.name?.split(/\s+/)[0] || 'there';
  const shouldAutoRedirect = hasAdServerAccess !== hasStudioAccess;

  useEffect(() => {
    if (!loading && shouldAutoRedirect) {
      const timer = window.setTimeout(() => {
        window.location.assign(hasAdServerAccess ? getAdServerUrl() : getStudioUrl());
      }, 350);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [hasAdServerAccess, hasStudioAccess, loading, shouldAutoRedirect]);

  const workspaceLabel = useMemo(() => {
    if (!session?.workspace) return 'No active workspace';
    return session.workspace.name;
  }, [session]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-fuchsia-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="portal-card rounded-[28px] p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">SMX Portal</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Choose where to work, {userName}
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-white/45">
                Active workspace: <span className="font-medium text-slate-800 dark:text-white">{workspaceLabel}</span>
                {' '}· role: <span className="font-medium text-slate-800 dark:text-white">{roleLabel(session?.user.role)}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={session?.activeWorkspaceId ?? ''}
                disabled={switching}
                onChange={async (event) => {
                  if (!event.target.value) return;
                  setSwitching(true);
                  setError('');
                  try {
                    await switchWorkspace(event.target.value);
                    const nextSession = await loadPortalSession();
                    setSession(nextSession);
                  } catch (caught: any) {
                    setError(caught.message || 'Workspace switch failed.');
                  } finally {
                    setSwitching(false);
                  }
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/25 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              >
                {(session?.workspaces ?? []).map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70"
              >
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  navigate('/login', { replace: true });
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70"
              >
                Log out
              </button>
            </div>
          </div>
          {error ? <p className="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
          {shouldAutoRedirect ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              Only one product is available for this workspace. Redirecting automatically.
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <CardButton
            title="Ad Server"
            label="Campaigns, tags, delivery, reporting"
            copy={hasAdServerAccess ? 'Open the Ad Server workspace for trafficking, diagnostics, and delivery operations.' : 'This workspace does not currently include Ad Server access.'}
            onClick={hasAdServerAccess ? () => window.location.assign(getAdServerUrl()) : undefined}
            disabled={!hasAdServerAccess}
            tone={hasAdServerAccess ? 'fuchsia' : 'slate'}
          />
          <CardButton
            title="Studio"
            label="Creative production and review"
            copy={hasStudioAccess ? 'Open Studio for creative generation, review, publishing, and handoff.' : 'This workspace does not currently include Studio access.'}
            onClick={hasStudioAccess ? () => window.location.assign(getStudioUrl()) : undefined}
            disabled={!hasStudioAccess}
            tone={hasStudioAccess ? 'emerald' : 'slate'}
          />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PortalHome />} />
        <Route path="/launch" element={<PortalHome />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
