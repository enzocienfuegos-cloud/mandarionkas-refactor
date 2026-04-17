import { useState } from 'react';
import { usePlatformActions } from './runtime';

export function LoginScreen(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = usePlatformActions();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await login(email, password, { remember });
      if (!result.ok) {
        setError(result.message ?? 'Unable to login');
        return;
      }
      setError('');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="platform-login-shell">
      <div className="platform-login-card">
        <div className="platform-login-copy">
          <span className="brand-mark">SMX Studio Platform</span>
          <h1>Login + clients, sin tocar el core del editor.</h1>
          <p>Conecta tu cuenta de plataforma para trabajar con clientes, proyectos y assets sobre la API cloud.</p>
          <p className="muted-copy">Remember session keeps auth for 30 days. Off keeps it only for the browser session.</p>
        </div>
        <form className="platform-login-form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} disabled={isSubmitting} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isSubmitting} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} disabled={isSubmitting} />
            Remember this session
          </label>
          {error ? <div className="login-error">{error}</div> : null}
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Entering…' : 'Enter platform'}</button>
        </form>
      </div>
    </div>
  );
}
