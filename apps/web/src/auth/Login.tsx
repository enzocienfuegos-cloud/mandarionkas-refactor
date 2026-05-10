import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, LogIn } from '../system/icons';
import { Button, FormField, Input, Panel, useToast } from '../system';
import { DuskLogo } from '../shell/DuskLogo';

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError(response.status === 401 ? 'Invalid email or password' : 'Sign in failed');
        return;
      }

      navigate('/launch');
    } catch {
      setError('Could not reach the server');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSso = (provider: 'google' | 'microsoft') => {
    toast({ tone: 'info', title: `Redirecting to ${provider}…` });
    window.location.href = `/v1/auth/sso/${provider}`;
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'radial-gradient(ellipse at top, rgba(241, 0, 139, 0.08) 0%, transparent 50%), var(--dusk-bg)' }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <DuskLogo />
        </div>

        <Panel elevation={3} padding="lg">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">Welcome back</h1>
            <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">Sign in to your SignalMix workspace.</p>
          </div>

          <div className="space-y-2">
            <Button variant="secondary" fullWidth onClick={() => handleSso('google')}>Continue with Google</Button>
            <Button variant="secondary" fullWidth onClick={() => handleSso('microsoft')}>Continue with Microsoft</Button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[color:var(--dusk-border-default)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface-1 px-2 text-xs text-[color:var(--dusk-text-soft)]">or with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <FormField label="Email" htmlFor="login-email">
              <Input id="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
            </FormField>
            <FormField label="Password" htmlFor="login-password">
              <Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </FormField>

            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg p-3 text-xs"
                style={{
                  background: 'var(--dusk-status-critical-bg)',
                  border: '1px solid var(--dusk-status-critical-border)',
                  color: 'var(--dusk-status-critical-fg)',
                }}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <Button type="submit" variant="primary" fullWidth loading={submitting} leadingIcon={!submitting ? <LogIn /> : undefined}>
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-center">
            <a href="/forgot-password" className="text-xs text-[color:var(--dusk-text-muted)] transition-colors hover:text-text-brand">
              Forgot password?
            </a>
          </p>
        </Panel>

        <p className="mt-6 text-center text-xs text-[color:var(--dusk-text-soft)]">
          Don't have an account?{' '}
          <a href="mailto:hello@signalmix.com" className="font-medium text-text-brand">Contact your admin</a>
        </p>
      </div>
    </div>
  );
}
