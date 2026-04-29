import { useMemo, useState } from 'react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import { usePlatformActions } from './runtime';

const BRAND = '#f1008b';
const BRAND_GLOW = 'rgba(241, 0, 139, 0.35)';

function Icon({
  paths,
  size = 18,
  stroke = 'currentColor',
  strokeWidth = 1.8,
}: {
  paths: string | string[];
  size?: number;
  stroke?: string;
  strokeWidth?: number;
}): JSX.Element {
  const values = Array.isArray(paths) ? paths : [paths];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {values.map((path) => <path key={path} d={path} />)}
    </svg>
  );
}

function ZapIcon({ size = 20 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function GoogleIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function PartnerLogos(): JSX.Element {
  const item: CSSProperties = { color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: 14 };
  const divider: CSSProperties = { width: 1, height: 18, background: 'rgba(255,255,255,0.14)' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <GoogleIcon />
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ ...item, fontSize: 13 }}>Google</div>
          <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 10 }}>Ad Manager</div>
        </div>
      </div>
      <div style={divider} />
      <div style={item}>EQUATIV</div>
      <div style={divider} />
      <div style={item}>Magnite</div>
      <div style={divider} />
      <div style={item}>PubMatic</div>
      <div style={divider} />
      <div style={item}>OpenX</div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  placeholder,
  onChange,
  icon,
  error,
  rightLabel,
  onRightLabelClick,
}: {
  label: string;
  type: 'text' | 'password';
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  icon: string | string[];
  error?: string;
  rightLabel?: string;
  onRightLabelClick?: () => void;
}): JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const [resolvedType, setResolvedType] = useState(type);
  const borderColor = error ? '#ef4444' : isFocused ? BRAND : 'rgba(255,255,255,0.12)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ display: 'block', margin: 0, fontSize: 13, fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.75)' }}>
          {label}
        </label>
        {rightLabel ? (
          <button
            type="button"
            onClick={onRightLabelClick}
            style={{ background: 'none', border: 'none', boxShadow: 'none', minHeight: 0, padding: 0, color: BRAND, fontSize: 12, fontWeight: 600 }}
          >
            {rightLabel}
          </button>
        ) : null}
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: isFocused ? 'rgba(255,255,255,0.52)' : 'rgba(255,255,255,0.28)', pointerEvents: 'none' }}>
          <Icon paths={icon} size={15} stroke="currentColor" />
        </div>
        <input
          type={resolvedType}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            width: '100%',
            minHeight: 46,
            padding: '11px 42px',
            borderRadius: 10,
            border: `1px solid ${borderColor}`,
            background: 'rgba(255,255,255,0.05)',
            color: '#f0f0f4',
            boxShadow: isFocused ? '0 0 0 3px rgba(241,0,139,0.15)' : 'none',
          }}
        />
        {type === 'password' ? (
          <button
            type="button"
            onClick={() => setResolvedType((current) => (current === 'password' ? 'text' : 'password'))}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', boxShadow: 'none', minHeight: 0, padding: 4, color: 'rgba(255,255,255,0.35)' }}
          >
            <Icon
              paths={resolvedType === 'password'
                ? ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z']
                : ['M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94', 'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19', 'M1 1l22 22']}
              size={16}
              stroke="currentColor"
            />
          </button>
        ) : null}
      </div>
      {error ? <div style={{ marginTop: 6, fontSize: 11, color: '#ef4444' }}>{error}</div> : null}
    </div>
  );
}

function ActionButton({
  children,
  type = 'button',
  variant = 'outline',
  onClick,
  disabled,
}: {
  children: ReactNode;
  type?: 'button' | 'submit';
  variant?: 'outline' | 'brand';
  onClick?: () => void;
  disabled?: boolean;
}): JSX.Element {
  const [isHovered, setIsHovered] = useState(false);
  const style = variant === 'brand'
    ? {
        width: '100%',
        minHeight: 48,
        borderRadius: 10,
        border: 'none',
        background: disabled ? 'rgba(241,0,139,0.55)' : BRAND,
        color: '#fff',
        fontWeight: 700,
        boxShadow: disabled ? 'none' : `0 10px 24px ${BRAND_GLOW}`,
        transform: isHovered && !disabled ? 'translateY(-1px)' : 'none',
      }
    : {
        width: '100%',
        minHeight: 46,
        borderRadius: 10,
        border: `1px solid rgba(255,255,255,${isHovered ? 0.2 : 0.12})`,
        background: isHovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
        color: '#f0f0f4',
        fontWeight: 600,
        boxShadow: 'none',
      };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={style}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>{children}</span>
    </button>
  );
}

function GradientBackdrop(): JSX.Element {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0a0010 0%, #0f0018 50%, #080010 100%)' }} />
      <div style={{ position: 'absolute', top: '18%', left: '48%', width: 420, height: 320, borderRadius: '50%', background: 'rgba(241,0,139,0.18)', filter: 'blur(48px)' }} />
      <div style={{ position: 'absolute', top: '12%', left: '66%', width: 240, height: 220, borderRadius: '50%', background: 'rgba(140,50,255,0.15)', filter: 'blur(42px)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,0,16,0.5) 0%, transparent 35%, transparent 65%, rgba(8,0,14,0.65) 100%)' }} />
    </>
  );
}

const features = [
  {
    icon: ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
    title: 'Full control',
    desc: 'Decide how your campaigns run.',
  },
  {
    icon: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
    title: 'Flexible setup',
    desc: 'Adapt to your clients, not the other way around.',
  },
  {
    icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    title: 'Move faster',
    desc: 'Launch and optimize without unnecessary complexity.',
  },
];

export function LoginScreen(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = usePlatformActions();

  const fieldErrors = useMemo(() => ({
    email: error && !email ? 'Email is required.' : '',
    password: error && !password ? 'Password is required.' : '',
  }), [email, password, error]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!email || !password) {
      setError('Enter your email and password to continue.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await login(email, password, { remember });
      if (!result.ok) {
        setError(result.message ?? 'Unable to sign in.');
        return;
      }
      setError('');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mandarion-login-shell" style={{ display: 'flex', width: '100vw', minHeight: '100vh', background: '#0a0010', overflow: 'hidden' }}>
      <div className="mandarion-login-left" style={{ flex: 1, minWidth: 0, position: 'relative', padding: '36px 44px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <GradientBackdrop />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 11, marginBottom: 48 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${BRAND_GLOW}` }}>
            <ZapIcon size={17} />
          </div>
          <span style={{ fontFamily: '"Space Grotesk", Inter, sans-serif', fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: -0.3 }}>
            MandaRion
          </span>
        </div>

        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 760 }}>
          <h1 style={{ margin: 0, fontFamily: '"DM Sans", Inter, sans-serif', fontWeight: 800, lineHeight: 0.98, letterSpacing: -2.4 }}>
            <span style={{ display: 'block', fontSize: 'clamp(64px, 8vw, 96px)', color: '#fff' }}>Own</span>
            <span style={{ display: 'block', fontSize: 'clamp(64px, 8vw, 96px)', color: '#fff' }}>
              your <span style={{ color: BRAND }}>media.</span>
            </span>
          </h1>
          <p style={{ margin: '18px 0 42px', fontSize: 18, color: 'rgba(255,255,255,0.65)', maxWidth: 420 }}>
            For agencies ready to scale.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 28, maxWidth: 560, marginBottom: 44 }}>
            {features.map((feature) => (
              <div key={feature.title}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(241,0,139,0.18)', border: '1px solid rgba(241,0,139,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon paths={feature.icon} size={17} stroke={BRAND} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 5 }}>{feature.title}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.48)' }}>{feature.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 16 }}>
              Works with your existing stack
            </div>
            <PartnerLogos />
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', maxWidth: 480 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(241,0,139,0.12)', border: '1px solid rgba(241,0,139,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon paths={['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4']} size={18} stroke={BRAND} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 3 }}>Independent. Transparent. Built for agencies.</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>No hidden fees. No platform lock-in.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mandarion-login-right" style={{ width: 420, flexShrink: 0, background: '#13131a', borderLeft: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '44px 40px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, background: BRAND, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px ${BRAND_GLOW}` }}>
            <ZapIcon size={24} />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#f0f0f4', fontFamily: '"Space Grotesk", Inter, sans-serif', letterSpacing: -0.6 }}>Access your workspace</h2>
          <p style={{ margin: '7px 0 0', fontSize: 13.5, color: 'rgba(255,255,255,0.42)' }}>Sign in to continue to MandaRion</p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ActionButton variant="outline" disabled>
            <GoogleIcon />
            <span>Continue with Google</span>
          </ActionButton>

          <ActionButton variant="outline" disabled>
            <Icon paths={['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4']} size={16} stroke="rgba(255,255,255,0.6)" />
            <span>Continue with SSO</span>
          </ActionButton>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2, marginBottom: 2 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>or continue with email</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <Field
            label="Email"
            type="text"
            value={email}
            placeholder="you@agency.com"
            onChange={setEmail}
            icon={['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6']}
            error={fieldErrors.email}
          />

          <Field
            label="Password"
            type="password"
            value={password}
            placeholder="••••••••"
            onChange={setPassword}
            icon={['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z', 'M7 11V7a5 5 0 0 1 10 0v4']}
            rightLabel="Forgot password?"
            error={fieldErrors.password}
          />

          <div
            style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', marginTop: 2 }}
            onClick={() => setRemember((current) => !current)}
          >
            <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${remember ? BRAND : 'rgba(255,255,255,0.25)'}`, background: remember ? BRAND : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {remember ? <Icon paths="M20 6L9 17l-5-5" size={10} stroke="#fff" strokeWidth={3} /> : null}
            </div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', userSelect: 'none' }}>Keep me signed in for 30 days</span>
          </div>

          {error ? (
            <div style={{ borderRadius: 10, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(127,29,29,0.22)', color: '#fecaca', padding: '10px 12px', fontSize: 13 }}>
              {error}
            </div>
          ) : null}

          <ActionButton type="submit" variant="brand" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" strokeOpacity=".3" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
                <span>Signing in…</span>
              </>
            ) : (
              <span style={{ fontFamily: '"Space Grotesk", Inter, sans-serif', fontSize: 15, letterSpacing: 0.1 }}>Sign in to MandaRion</span>
            )}
          </ActionButton>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
            No account? <span style={{ color: BRAND, fontWeight: 600 }}>Request access</span>
          </p>

          <div style={{ borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,0.52)', lineHeight: 1.55 }}>
            Demo access: <strong style={{ color: '#fff' }}>admin@smx.studio</strong> or <strong style={{ color: '#fff' }}>editor@smx.studio</strong> with password <strong style={{ color: '#fff' }}>demo123</strong>.
          </div>
        </form>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            <Icon paths={['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4']} size={13} stroke="rgba(255,255,255,0.3)" />
            <span>Secure by design</span>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', textAlign: 'center', lineHeight: 1.65, maxWidth: 300, margin: 0 }}>
            By signing in you agree to MandaRion&apos;s <span style={{ color: BRAND }}>Terms of Service</span> and <span style={{ color: BRAND }}>Privacy Policy</span>.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 980px) {
          .mandarion-login-shell {
            flex-direction: column;
          }
          .mandarion-login-left {
            min-height: 420px;
            padding: 28px 24px;
          }
          .mandarion-login-right {
            width: 100% !important;
            border-left: none !important;
            border-top: 1px solid rgba(255,255,255,0.07);
            padding: 28px 24px !important;
          }
        }
        @media (max-width: 720px) {
          .mandarion-login-left {
            display: none !important;
          }
          .mandarion-login-right {
            min-height: 100vh;
            border-top: none;
          }
        }
      `}</style>
    </div>
  );
}
