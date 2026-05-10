import { useState } from 'react';
import { StudioIcon, StudioIcons } from '../shared/ui/icons';
import { usePlatformActions } from './runtime';

const DEMO_EMAIL = 'admin@smx.studio';
const DEMO_PASSWORD = 'demo123';

export function LoginScreen(): JSX.Element {
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = usePlatformActions();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await login(email, password, { remember });
      if (!result.ok) {
        setError(result.message ?? 'Credenciales incorrectas.');
        return;
      }
      setError('');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFillDemo(): void {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setRemember(true);
    setError('');
  }

  return (
    <div className="platform-login-shell">
      <div className="platform-login-shell__halo" aria-hidden="true" />
      <div className="platform-login-card">
        <section className="platform-login-copy">
          <div>
            <img src="/assets/mandarion-logo.svg" alt="MandaRion" className="platform-login-copy__logo" />
            <div className="platform-login-copy__eyebrow">Studio Platform</div>
            <h1>Sign in</h1>
            <p>Accedé a tus proyectos, campañas y banners desde un solo lugar.</p>
            <p className="platform-login-copy__muted">
              Remember session crea una sesión persistente de 30 días. Sin ella la sesión dura mientras dure el browser.
            </p>

            <div className="platform-login-copy__seed">
              <StudioIcon icon={StudioIcons.info} size={12} />
              <span>Demo:</span>
              <strong>{DEMO_EMAIL}</strong>
              <span>·</span>
              <strong>{DEMO_PASSWORD}</strong>
            </div>
          </div>

          <div className="platform-login-copy__footer">
            <div className="platform-login-copy__version">
              <span className="platform-login-copy__version-dot" />
              SMX Studio v4 · Sprint 55
            </div>
          </div>
        </section>

        <form className="platform-login-form" onSubmit={(event) => void handleSubmit(event)}>
          <header className="platform-login-form__header">
            <h2>Iniciar sesión</h2>
            <p>Ingresá tus credenciales para continuar.</p>
          </header>

          <label className="platform-login-field">
            <span className="platform-login-field__label">Email</span>
            <div className="platform-login-field__wrap">
              <input
                type="email"
                value={email}
                placeholder="tu@email.com"
                autoComplete="email"
                disabled={isSubmitting}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError('');
                }}
              />
            </div>
          </label>

          <label className="platform-login-field">
            <span className="platform-login-field__label">Contraseña</span>
            <div className="platform-login-field__wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isSubmitting}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError('');
                }}
              />
              <button
                type="button"
                className="platform-login-field__toggle"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPassword((current) => !current)}
              >
                <StudioIcon icon={showPassword ? StudioIcons.eyeOff : StudioIcons.eye} size={16} />
              </button>
            </div>
          </label>

          <label className="platform-login-remember">
            <input
              type="checkbox"
              checked={remember}
              disabled={isSubmitting}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <span className={`platform-login-remember__box ${remember ? 'is-checked' : ''}`.trim()} aria-hidden="true">
              <StudioIcon icon={StudioIcons.check} size={10} />
            </span>
            <span className="platform-login-remember__label">Remember this session</span>
          </label>

          {error ? (
            <div className="login-error" role="alert">
              <StudioIcon icon={StudioIcons.info} size={14} />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`platform-login-submit ${isSubmitting ? 'is-loading' : ''}`.trim()}
          >
            {isSubmitting ? <span className="platform-login-submit__spinner" aria-hidden="true" /> : null}
            <span>{isSubmitting ? 'Entrando…' : 'Entrar a la plataforma'}</span>
          </button>

          <div className="platform-login-form__demo">
            <button type="button" onClick={handleFillDemo}>
              Completar con usuario demo
            </button>
          </div>

          <div className="platform-login-form__divider" aria-hidden="true" />

          <footer className="platform-login-form__footer">
            Plataforma privada · Solo usuarios autorizados.
            <br />
            Seed users: <strong>admin@smx.studio</strong> y <strong>editor@smx.studio</strong>
          </footer>
        </form>
      </div>
    </div>
  );
}
