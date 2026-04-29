import React, { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const BRAND = '#f1008b';

function FieldIcon({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35">
      {children}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function Feature({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-sm leading-6 text-white/65">{copy}</p>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fieldErrors = useMemo(() => ({
    email: error && !email.trim() ? 'Email is required.' : '',
    password: error && !password ? 'Password is required.' : '',
  }), [email, password, error]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password, remember }),
      });

      if (res.ok) {
        navigate('/');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? 'Invalid email or password.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#06010d] text-white">
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#0a0010_0%,#0f0018_50%,#080010_100%)]" />
        <div className="absolute left-[48%] top-[18%] h-[320px] w-[420px] rounded-full bg-[#f1008b]/20 blur-[70px]" />
        <div className="absolute left-[67%] top-[12%] h-[220px] w-[240px] rounded-full bg-violet-500/15 blur-[60px]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,0,16,0.55)_0%,transparent_38%,transparent_65%,rgba(8,0,14,0.7)_100%)]" />

        <div className="relative mx-auto grid min-h-screen max-w-7xl gap-12 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
          <section className="flex items-center">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 backdrop-blur-sm">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-[#0a0010]">S</span>
                <span>SMX Ad Server</span>
              </div>

              <h1 className="mt-8 text-5xl font-semibold tracking-tight text-white lg:text-6xl">
                Operate campaigns with a cleaner, faster control room.
              </h1>
              <p className="mt-6 text-lg leading-8 text-white/70">
                Log into the real ad server workspace for campaigns, tags, creatives, pacing, and reporting without changing the rest of your flow.
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <Feature title="Full control" copy="Manage campaigns, creatives, and delivery from one place." />
                <Feature title="Flexible setup" copy="Handle client workspaces without changing your rhythm." />
                <Feature title="Faster reviews" copy="Keep approvals, pacing, and reporting close to the work." />
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-5 text-sm font-semibold text-white/60">
                <div className="flex items-center gap-2">
                  <GoogleIcon />
                  <span>Google Ad Manager</span>
                </div>
                <span className="h-4 w-px bg-white/15" />
                <span>Basis</span>
                <span className="h-4 w-px bg-white/15" />
                <span>Illumin</span>
                <span className="h-4 w-px bg-white/15" />
                <span>Magnite</span>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center lg:justify-end">
            <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/8 p-8 shadow-2xl shadow-black/35 backdrop-blur-xl">
              <div className="mb-8">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/45">Welcome back</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">Sign in to SMX Studio</h2>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  Use your ad server account to continue into campaigns, tags, creatives, and reporting.
                </p>
              </div>

              {error && (
                <div className="mb-5 rounded-2xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75" htmlFor="email">
                    Email address
                  </label>
                  <div className="relative">
                    <FieldIcon>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16v16H4z" />
                        <path d="m22 6-10 7L2 6" />
                      </svg>
                    </FieldIcon>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="admin@smxstudio.io"
                      className={`w-full rounded-2xl border bg-white/5 px-11 py-3 text-sm text-white placeholder:text-white/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-pink-500/40 ${
                        fieldErrors.email ? 'border-red-400/70' : 'border-white/10'
                      }`}
                    />
                  </div>
                  {fieldErrors.email ? <p className="mt-2 text-xs text-red-300">{fieldErrors.email}</p> : null}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-white/75" htmlFor="password">
                      Password
                    </label>
                    <button type="button" className="text-xs font-semibold text-[#f1008b]" onClick={() => setShowPassword((value) => !value)}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="relative">
                    <FieldIcon>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        <path d="M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
                      </svg>
                    </FieldIcon>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      className={`w-full rounded-2xl border bg-white/5 px-11 py-3 text-sm text-white placeholder:text-white/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-pink-500/40 ${
                        fieldErrors.password ? 'border-red-400/70' : 'border-white/10'
                      }`}
                    />
                  </div>
                  {fieldErrors.password ? <p className="mt-2 text-xs text-red-300">{fieldErrors.password}</p> : null}
                </div>

                <label className="flex items-center gap-3 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#f1008b] focus:ring-[#f1008b]"
                  />
                  Keep me signed in on this device
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-0 px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ background: BRAND, boxShadow: '0 18px 40px rgba(241, 0, 139, 0.28)' }}
                >
                  {loading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v8H4z" />
                      </svg>
                      Signing in...
                    </>
                  ) : 'Sign in'}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/65">
                <div className="font-medium text-white/90">Staging access</div>
                <p className="mt-1 leading-6">
                  Use <span className="font-semibold text-white">admin@smxstudio.io</span> with <span className="font-semibold text-white">Admin1234!</span>.
                </p>
              </div>

              <p className="mt-6 text-center text-sm text-white/50">
                Don&apos;t have an account?{' '}
                <Link to="/register" className="font-semibold text-[#f1008b]">
                  Create one
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
