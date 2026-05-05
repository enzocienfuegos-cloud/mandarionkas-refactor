import React, { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const BRAND = '#f1008b';

type LoginState = 'idle' | 'loading' | 'success' | 'error';

function LogoMark() {
  return (
    <div className="flex items-center gap-[14px]" aria-label="MandaRion logo">
      <div className="flex h-[42px] w-[42px] shrink-0 translate-y-[1px] items-center justify-center">
        <svg
          viewBox="180 735 585 585"
          className="h-full w-full text-white/95"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
        >
          <title>MandaRion mark</title>
          <path d="M307.749 738.419C318.003 736.714 340.86 737.844 351.845 737.888L424.967 737.903L567.195 737.884C621.678 737.853 671.417 730.522 715.605 768.272C767.914 812.96 763.112 868.176 762.97 929.631L762.946 1026.67L762.957 1126C762.96 1151.7 764.117 1181.09 759.304 1206.01C754.813 1228.09 744.736 1248.65 730.035 1265.73C706.39 1293.11 671.809 1307.21 636.248 1309.85C567.191 1311.8 493.945 1310.16 424.599 1310.24L348.062 1310.42C302.393 1310.3 269.687 1310.76 231.786 1280.5C192.864 1249.43 182.814 1205.13 182.677 1157.47C182.646 1146.78 183.453 1136.14 183.438 1125.56L183.471 1002.5C183.482 965.042 184.381 924.294 183.262 887.004C180.856 806.832 222.579 746.405 307.749 738.419Z" />
          <path d="M265.447 840.068C402.831 838.64 543.172 839.987 680.751 840.012C681.829 887.154 680.776 938.589 680.752 986.015L604.543 985.878C602.972 1057.71 604.561 1135.61 604.614 1207.94L516.954 1208.01L516.984 898.492L622.879 898.521L622.981 927.706L546.223 927.653L546.052 1178.73C555.637 1178.85 565.46 1178.71 575.067 1178.69L575.205 956.697L651.056 956.288L651.241 869.499L487.627 869.601L487.667 1019.11L487.62 1208.17L458.196 1208.15L458.517 869.452L294.884 869.709L294.72 956.313C319.856 956.802 345.859 956.559 371.061 956.632L371.179 1178.75C380.608 1178.93 390.422 1178.68 399.879 1178.57L399.915 927.641L323.75 927.611L323.99 898.654C358.3 897.776 394.826 898.521 429.384 898.511C430.682 1000.35 429.314 1105.82 429.314 1207.95L341.505 1208.01L341.967 985.85L265.227 986.014C265.341 937.494 264.83 888.535 265.447 840.068Z" fill="#050507" />
        </svg>
      </div>

      <div className="flex flex-col justify-center">
        <div className="text-[25px] font-semibold leading-[1] tracking-[-0.028em] text-white">MandaRion</div>
        <div className="mt-[3px] text-[9.5px] font-medium uppercase leading-none tracking-[0.26em] text-white/30">Portal</div>
      </div>
    </div>
  );
}

function MailIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function InputIcon({ children }: { children: React.ReactNode }) {
  return <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/28">{children}</div>;
}

export default function Login() {
  const navigate = useNavigate();
  const [pointer, setPointer] = useState({ x: 50, y: 42 });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<LoginState>('idle');
  const [error, setError] = useState('');

  const fieldErrors = useMemo(
    () => ({
      email: error && !email.trim() ? 'Email required' : '',
      password: error && !password ? 'Password required' : '',
    }),
    [email, password, error],
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Enter credentials');
      setState('error');
      return;
    }

    setState('loading');

    try {
      const res = await fetch('/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password, remember }),
      });

      if (res.ok) {
        setState('success');
        navigate('/');
        return;
      }

      const data = await res.json().catch(() => ({}));
      setError(data?.message ?? 'Access denied');
      setState('error');
    } catch {
      setError('Network error');
      setState('error');
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
          <LogoMark />
        </div>

        <div className="absolute inset-[-1px] -z-10 rounded-[25px] bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.035)_38%,rgba(241,0,139,0.18)_100%)] opacity-80 blur-[0.2px]" />

        <div className="relative overflow-hidden rounded-[24px] border border-white/[0.10] bg-[#121217]/80 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_0%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08)_0%,transparent_28%,transparent_64%,rgba(241,0,139,0.08)_100%)]" />
          <div className="pointer-events-none absolute -inset-x-20 top-0 h-28 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)] blur-xl animate-[panelLight_10s_ease-in-out_infinite]" />

          <div className="relative z-10">
            <div className="mb-5">
              <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-white">Sign in</h2>
              <p className="mt-1 text-sm leading-6 text-white/42">Access your portal workspace and campaign controls.</p>
            </div>

            {error ? (
              <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3.5 py-2.5 text-sm font-medium text-red-200">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/38" htmlFor="email">
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
                    className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-10 py-3 text-sm text-white outline-none transition placeholder:text-white/22 focus:border-[#f1008b]/40 focus:bg-black/28 focus:ring-4 focus:ring-[#f1008b]/10"
                  />
                </div>
                {fieldErrors.email ? <p className="mt-1.5 text-xs text-red-300">{fieldErrors.email}</p> : null}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-white/38" htmlFor="password">
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
                  <InputIcon>
                    <LockIcon />
                  </InputIcon>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="password"
                    className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-10 py-3 pr-10 text-sm text-white outline-none transition placeholder:text-white/22 focus:border-[#f1008b]/40 focus:bg-black/28 focus:ring-4 focus:ring-[#f1008b]/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition hover:text-[#f1008b]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon />
                  </button>
                </div>
                {fieldErrors.password ? <p className="mt-1.5 text-xs text-red-300">{fieldErrors.password}</p> : null}
              </div>

              <label className="flex items-center gap-3 pt-1 text-xs font-medium uppercase tracking-[0.12em] text-white/38">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#f1008b] focus:ring-[#f1008b]"
                />
                Keep me signed in
              </label>

              <button
                type="submit"
                disabled={state === 'loading'}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(241,0,139,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(241,0,139,0.30)] disabled:cursor-not-allowed disabled:opacity-70"
                style={{ background: BRAND }}
              >
                <span>
                  {state === 'loading' ? 'Verifying access...' : state === 'success' ? 'Access granted' : 'Continue'}
                </span>
              </button>
            </form>

            <div className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-white/36">
              <span>Need an account?</span>
              <Link to="/register" className="font-semibold text-white/58 transition hover:text-[#f1008b]">
                Request access
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-white/28">Portal access is monitored and logged.</p>
      </div>
    </main>
  );
}
