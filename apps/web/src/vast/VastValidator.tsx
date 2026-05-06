import React, { useState, FormEvent } from 'react';
import { Badge, Button, EmptyState, Input, Kicker, Panel } from '../system';

type InputMode = 'xml' | 'url';
type IssueSeverity = 'error' | 'warning' | 'info';

interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  path?: string;
}

interface ValidationResult {
  valid: boolean;
  vastVersion?: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const severityConfig: Record<IssueSeverity, { tone: 'critical' | 'warning' | 'info'; icon: string }> = {
  error:   { tone: 'critical', icon: 'Error' },
  warning: { tone: 'warning', icon: 'Warning' },
  info:    { tone: 'info', icon: 'Info' },
};

export default function VastValidator() {
  const [mode, setMode] = useState<InputMode>('xml');
  const [xmlInput, setXmlInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (mode === 'xml' && !xmlInput.trim()) {
      setError('Please paste your VAST XML.');
      return;
    }
    if (mode === 'url' && !urlInput.trim()) {
      setError('Please enter a VAST tag URL.');
      return;
    }

    setLoading(true);
    try {
      const body = mode === 'xml'
        ? { xml: xmlInput.trim() }
        : { url: urlInput.trim() };

      const res = await fetch('/v1/vast/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? 'Validation request failed.');
      }

      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const allIssues: ValidationIssue[] = result
    ? [...(result.errors ?? []), ...(result.warnings ?? [])]
    : [];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Kicker>Verification</Kicker>
        <h1 className="text-2xl font-bold text-[color:var(--dusk-text-primary)]">VAST Validator</h1>
        <p className="text-sm text-[color:var(--dusk-text-muted)] mt-1">Validate VAST XML tags for spec compliance and common issues</p>
      </div>

      <Panel className="mb-6 rounded-2xl">
        {/* Mode toggle */}
        <div className="flex gap-1 mb-5 p-1 bg-surface-muted rounded-lg w-fit">
          {(['xml', 'url'] as InputMode[]).map(m => (
            <Button
              key={m}
              type="button"
              onClick={() => { setMode(m); setResult(null); setError(''); }}
              variant={mode === m ? 'secondary' : 'ghost'}
              size="sm"
            >
              {m === 'xml' ? 'Paste XML' : 'Tag URL'}
            </Button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'xml' ? (
            <div>
              <label className="block text-sm font-medium text-[color:var(--dusk-text-secondary)] mb-1">VAST XML</label>
              <textarea
                value={xmlInput}
                onChange={e => setXmlInput(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-[color:var(--dusk-border-default)] rounded-lg text-sm font-mono bg-surface-1 text-[color:var(--dusk-text-primary)] focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 resize-y"
                placeholder={'<?xml version="1.0" encoding="UTF-8"?>\n<VAST version="4.2">\n  ...\n</VAST>'}
                spellCheck={false}
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-[color:var(--dusk-text-secondary)] mb-1">VAST Tag URL</label>
              <Input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://ad.example.com/vast?placement=12345"
              />
              <p className="mt-1 text-xs text-[color:var(--dusk-text-soft)]">The URL will be fetched server-side to retrieve the VAST XML.</p>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 bg-[color:var(--dusk-status-critical-bg)] border border-[color:var(--dusk-status-critical-border)] rounded-lg text-sm text-[color:var(--dusk-status-critical-fg)]">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} fullWidth variant="primary">
            {loading ? 'Validating...' : 'Validate VAST'}
          </Button>
        </form>
      </Panel>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <Panel className={result.valid ? 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)]' : 'border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)]'}>
            <div className="flex items-center gap-4">
            <div className="text-4xl">{result.valid ? 'OK' : 'Error'}</div>
            <div>
              <p className={`text-lg font-bold ${result.valid ? 'text-[color:var(--dusk-status-success-fg)]' : 'text-[color:var(--dusk-status-critical-fg)]'}`}>
                {result.valid ? 'Valid VAST' : 'Invalid VAST'}
              </p>
              {result.vastVersion && (
                <p className="text-sm text-[color:var(--dusk-text-secondary)]">
                  VAST Version: <strong>{result.vastVersion}</strong>
                </p>
              )}
              <p className="text-sm text-[color:var(--dusk-text-secondary)] mt-0.5">
                {result.errors?.length ?? 0} error{result.errors?.length !== 1 ? 's' : ''},{' '}
                {result.warnings?.length ?? 0} warning{result.warnings?.length !== 1 ? 's' : ''}
              </p>
            </div>
            </div>
          </Panel>

          {/* Issues list */}
          {allIssues.length > 0 && (
            <Panel padding="none" className="overflow-hidden rounded-2xl">
              <div className="px-5 py-3 border-b border-[color:var(--dusk-border-subtle)] bg-surface-muted">
                <h2 className="text-sm font-semibold text-[color:var(--dusk-text-secondary)]">Issues ({allIssues.length})</h2>
              </div>
              <ul className="divide-y divide-[color:var(--dusk-border-subtle)]">
                {allIssues.map((issue, i) => {
                  const cfg = severityConfig[issue.severity];
                  return (
                    <li key={i} className="px-5 py-3 flex gap-3 text-sm border-l-4 bg-surface-1" style={{ borderLeftColor: issue.severity === 'error' ? 'var(--dusk-status-critical-fg)' : issue.severity === 'warning' ? 'var(--dusk-status-warning-fg)' : 'var(--dusk-status-info-fg)' }}>
                      <span className="flex-shrink-0 font-bold">{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge tone={cfg.tone} size="sm">{issue.severity}</Badge>
                          {issue.code && (
                            <code className="text-xs bg-surface-muted px-1.5 py-0.5 rounded font-mono">{issue.code}</code>
                          )}
                        </div>
                        <p className="text-[color:var(--dusk-text-secondary)]">{issue.message}</p>
                        {issue.path && (
                          <p className="mt-0.5 text-xs text-[color:var(--dusk-text-soft)] font-mono">{issue.path}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}

          {allIssues.length === 0 && result.valid && (
            <EmptyState title="No issues detected" description="This VAST tag looks great." />
          )}
        </div>
      )}
    </div>
  );
}
