import { useState } from 'react';
import { usePlatformActions } from './runtime';

export function LoginScreen(): JSX.Element {
  const [email, setEmail] = useState('admin@smx.studio');
  const [password, setPassword] = useState('demo123');
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
          <h1>Login cloud-native con sesiones reales y workspaces persistidos.</h1>
          <p>Usuarios de seed: <strong>admin@smx.studio</strong> y <strong>editor@smx.studio</strong> · password <strong>demo123</strong>.</p>
          <p className="muted-copy">Remember session creates a persistent server session for 30 days. Off keeps it as a shorter browser session.</p>
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
