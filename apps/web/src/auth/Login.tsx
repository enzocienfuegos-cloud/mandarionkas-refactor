import React, { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const BRAND = '#f1008b';

function Icon({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      {children}
    </span>
  );
}

function InputIcon({
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

function ZapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M13 2 3 14h7l-1 8 12-14h-8l2-6Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4z" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <path d="M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
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
    <div>
      <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#f1008b]/25 bg-[#f1008b]/12 text-[#f1008b]">
        <ZapIcon />
      </div>
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-sm leading-6 text-white/50">{copy}</p>
    </div>
  );
}

function GhostButton({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled
      className="flex w-full cursor-default items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/60"
    >
      {children}
    </button>
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

  const fieldErrors = useMemo(
    () => ({
      email: error && !email.trim() ? 'Email is required.' : '',
      password: error && !password ? 'Password is required.' : '',
    }),
    [email, password, error],
  );

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
    <div className="min-h-screen overflow-hidden bg-[#0a0010] text-white">
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#0a0010_0%,#0f0018_52%,#080010_100%)]" />
        <div className="absolute left-[45%] top-[16%] h-[340px] w-[420px] rounded-full bg-[#f1008b]/18 blur-[90px]" />
        <div className="absolute left-[66%] top-[12%] h-[220px] w-[240px] rounded-full bg-violet-600/15 blur-[70px]" />

        <div className="relative flex min-h-screen">
          <section className="hidden flex-1 px-10 py-10 lg:flex xl:px-14">
            <div className="flex max-w-3xl flex-1 flex-col">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                  style={{ background: BRAND, boxShadow: '0 8px 22px rgba(241, 0, 139, 0.28)' }}
                >
                  <ZapIcon />
                </div>
                <span className="text-lg font-semibold tracking-tight text-white">MandaRion</span>
              </div>

              <div className="mt-16">
                <h1 className="text-[5.25rem] font-extrabold leading-[0.95] tracking-[-0.06em] text-white">
                  Own
                  <br />
                  your <span style={{ color: BRAND }}>media.</span>
                </h1>
                <p className="mt-5 text-lg text-white/65">For agencies ready to scale.</p>
              </div>

              <div className="mt-12 grid max-w-2xl gap-8 md:grid-cols-3">
                <Feature title="Full control" copy="Decide how your campaigns run." />
                <Feature title="Flexible setup" copy="Adapt to your clients, not the other way around." />
                <Feature title="Move faster" copy="Launch and optimize without unnecessary complexity." />
              </div>

              <div className="mt-12">
                <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-white/30">
                  Works with your existing stack
                </div>
                <div className="flex flex-wrap items-center gap-5 text-sm font-semibold text-white/55">
                  <span>Google Ad Manager</span>
                  <span className="h-4 w-px bg-white/12" />
                  <span>Basis</span>
                  <span className="h-4 w-px bg-white/12" />
                  <span>Illumin</span>
                  <span className="h-4 w-px bg-white/12" />
                  <span>Magnite</span>
                </div>
              </div>

              <div className="mt-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-[#f1008b]/25 bg-[#f1008b]/12 text-[#f1008b]">
                    <ShieldIcon />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Independent. Transparent. Built for agencies.</div>
                    <p className="mt-1 text-sm text-white/45">No hidden fees. No platform lock-in.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="relative flex min-h-screen w-full items-center justify-center px-6 py-8 lg:w-[420px] lg:flex-none lg:border-l lg:border-white/10 lg:bg-[#13131a] lg:px-10">
            <div className="w-full max-w-md">
              <div className="mb-8 flex justify-center">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl text-white"
                  style={{ background: BRAND, boxShadow: '0 12px 28px rgba(241, 0, 139, 0.32)' }}
                >
                  <ZapIcon />
                </div>
              </div>

              <div className="mb-7 text-center">
                <h2 className="text-[1.65rem] font-semibold tracking-tight text-[#f0f0f4]">Access your workspace</h2>
                <p className="mt-2 text-sm text-white/40">Sign in to continue to MandaRion</p>
              </div>

              <div className="space-y-3">
                <GhostButton>
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </GhostButton>
                <GhostButton>
                  <LockIcon />
                  <span>Continue with SSO</span>
                </GhostButton>
              </div>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs font-medium text-white/35">or continue with email</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {error && (
                <div className="mb-4 rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/70" htmlFor="email">
                    Email
                  </label>
                  <div className="relative">
                    <InputIcon>
                      <MailIcon />
                    </InputIcon>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@agency.com"
                      className={`w-full rounded-xl border bg-white/5 px-11 py-3 text-sm text-white placeholder:text-white/28 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-pink-500/40 ${
                        fieldErrors.email ? 'border-red-400/70' : 'border-white/10'
                      }`}
                    />
                  </div>
                  {fieldErrors.email ? <p className="mt-2 text-xs text-red-300">{fieldErrors.email}</p> : null}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-white/70" htmlFor="password">
                      Password
                    </label>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#f1008b]"
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? 'Hide password' : 'Forgot password?'}
                    </button>
                  </div>
                  <div className="relative">
                    <InputIcon>
                      <LockIcon />
                    </InputIcon>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      className={`w-full rounded-xl border bg-white/5 px-11 py-3 text-sm text-white placeholder:text-white/28 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-pink-500/40 ${
                        fieldErrors.password ? 'border-red-400/70' : 'border-white/10'
                      }`}
                    />
                  </div>
                  {fieldErrors.password ? <p className="mt-2 text-xs text-red-300">{fieldErrors.password}</p> : null}
                </div>

                <label className="flex items-center gap-3 pt-1 text-sm text-white/60">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#f1008b] focus:ring-[#f1008b]"
                  />
                  Keep me signed in for 30 days
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
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
                  ) : (
                    'Sign in to MandaRion'
                  )}
                </button>
              </form>

              <div className="mt-5 rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/60">
                <div className="font-medium text-white/90">Staging access</div>
                <p className="mt-1 leading-6">
                  Use <span className="font-semibold text-white">admin@smxstudio.io</span> with <span className="font-semibold text-white">Admin1234!</span>.
                </p>
              </div>

              <p className="mt-5 text-center text-sm text-white/35">
                No account?{' '}
                <Link to="/register" className="font-semibold text-[#f1008b]">
                  Request access
                </Link>
              </p>

              <div className="mt-6 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-xs text-white/28">
                  <Icon className="text-white/28">
                    <ShieldIcon />
                  </Icon>
                  <span>Secure by design</span>
                </div>
                <p className="max-w-[300px] text-center text-[11px] leading-6 text-white/22">
                  By signing in you agree to MandaRion&apos;s{' '}
                  <span className="text-[#f1008b]">Terms of Service</span> and{' '}
                  <span className="text-[#f1008b]">Privacy Policy</span>.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
