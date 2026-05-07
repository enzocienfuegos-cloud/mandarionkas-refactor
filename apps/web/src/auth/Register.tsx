import React, { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button, FormField, Input, Panel } from '../system';

interface FormErrors {
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  workspaceName?: string;
  general?: string;
}

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    workspaceName: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(er => ({ ...er, [field]: undefined }));
  };

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (!form.email.trim()) errs.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address.';
    if (!form.firstName.trim()) errs.firstName = 'First name is required.';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required.';
    if (!form.password) errs.password = 'Password is required.';
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters.';
    if (!form.workspaceName.trim()) errs.workspaceName = 'Workspace name is required.';
    return errs;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      const res = await fetch('/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });

      if (res.ok) {
        navigate('/');
      } else {
        const data = await res.json().catch(() => ({}));
        if (data?.field) {
          setErrors({ [data.field]: data.message });
        } else {
          setErrors({ general: data?.message ?? 'Registration failed. Please try again.' });
        }
      }
    } catch {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const Field = ({
    id, label, type = 'text', value, onChange, error, placeholder, autoComplete,
  }: {
    id: keyof typeof form;
    label: string;
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
    placeholder?: string;
    autoComplete?: string;
  }) => (
    <FormField label={label} error={error}>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        invalid={Boolean(error)}
      />
    </FormField>
  );

  return (
    <div className="min-h-screen bg-[color:var(--dusk-surface-canvas)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary">SMX Studio</h1>
          <p className="mt-2 text-text-muted">Create your account</p>
        </div>

        <Panel className="rounded-2xl p-8 shadow-3">
          <h2 className="mb-6 text-xl font-semibold text-text-primary">Get started</h2>

          {errors.general && (
            <div className="mb-4 rounded-lg border border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-critical-fg)]">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <Field
                id="firstName"
                label="First name"
                value={form.firstName}
                onChange={set('firstName')}
                error={errors.firstName}
                autoComplete="given-name"
              />
              <Field
                id="lastName"
                label="Last name"
                value={form.lastName}
                onChange={set('lastName')}
                error={errors.lastName}
                autoComplete="family-name"
              />
            </div>

            <Field
              id="email"
              label="Email address"
              type="email"
              value={form.email}
              onChange={set('email')}
              error={errors.email}
              placeholder="you@example.com"
              autoComplete="email"
            />

            <Field
              id="password"
              label="Password"
              type="password"
              value={form.password}
              onChange={set('password')}
              error={errors.password}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />

            <Field
              id="workspaceName"
              label="Workspace name"
              value={form.workspaceName}
              onChange={set('workspaceName')}
              error={errors.workspaceName}
              placeholder="Acme Corp"
            />

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 w-full"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              )}
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-text-brand hover:text-text-brand">
              Sign in
            </Link>
          </p>
        </Panel>
      </div>
    </div>
  );
}
