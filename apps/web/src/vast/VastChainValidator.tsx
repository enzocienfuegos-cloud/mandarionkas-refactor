import React, { useState, FormEvent } from 'react';
import { Badge, Button, EmptyState, Input, Kicker, Panel } from '../system';

interface ChainStep {
  depth: number;
  url: string;
  type: 'InLine' | 'Wrapper';
  vastVersion: string;
  adSystem?: string;
  error?: string;
}

interface ChainResult {
  resolved: boolean;
  totalDepth: number;
  steps: ChainStep[];
  finalType?: 'InLine' | 'Wrapper';
  error?: string;
}

export default function VastChainValidator() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ChainResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!url.trim()) {
      setError('Please enter a VAST tag URL.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/v1/vast/chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? 'Chain resolution failed.');
      }

      const data: ChainResult = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const depthWarning = result && result.totalDepth > 3;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Kicker>Verification</Kicker>
        <h1 className="text-2xl font-bold text-[color:var(--dusk-text-primary)]">VAST Chain Validator</h1>
        <p className="text-sm text-[color:var(--dusk-text-muted)] mt-1">
          Resolve VAST wrapper chains to find the final inline ad and diagnose redirect depth issues
        </p>
      </div>

      <Panel className="mb-6 rounded-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[color:var(--dusk-text-secondary)] mb-1">
              VAST Tag URL
            </label>
            <Input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://ad.example.com/vast?placement=12345"
            />
            <p className="mt-1 text-xs text-[color:var(--dusk-text-soft)]">
              The chain will be resolved server-side. Each wrapper redirect is followed up to 10 levels deep.
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 bg-[color:var(--dusk-status-critical-bg)] border border-[color:var(--dusk-status-critical-border)] rounded-lg text-sm text-[color:var(--dusk-status-critical-fg)]">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} fullWidth variant="primary">
            {loading ? 'Resolving chain...' : 'Resolve Chain'}
          </Button>
        </form>
      </Panel>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary bar */}
          <Panel className={!result.resolved ? 'border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)]' : depthWarning ? 'border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)]' : 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)]'}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">
                {!result.resolved ? 'Invalid' : depthWarning ? 'Warning' : 'Valid'}
              </span>
              <div>
                <p className={`font-bold text-lg ${
                  !result.resolved ? 'text-[color:var(--dusk-status-critical-fg)]' : depthWarning ? 'text-[color:var(--dusk-status-warning-fg)]' : 'text-[color:var(--dusk-status-success-fg)]'
                }`}>
                  {!result.resolved
                    ? 'Chain failed to resolve'
                    : depthWarning
                    ? `Resolved — but chain depth (${result.totalDepth}) exceeds recommended limit of 3`
                    : `Resolved — chain depth: ${result.totalDepth}`}
                </p>
                {result.finalType && (
                  <p className="text-sm text-[color:var(--dusk-text-secondary)] mt-0.5">
                    Final ad type: <strong>{result.finalType}</strong>
                    {result.finalType === 'Wrapper' && (
                      <span className="ml-1 text-[color:var(--dusk-status-warning-fg)]"> (no InLine found)</span>
                    )}
                  </p>
                )}
                {result.error && (
                  <p className="text-sm text-[color:var(--dusk-status-critical-fg)] mt-0.5">{result.error}</p>
                )}
              </div>
            </div>
          </Panel>

          {depthWarning && (
            <div className="px-4 py-3 bg-[color:var(--dusk-status-warning-bg)] border border-[color:var(--dusk-status-warning-border)] rounded-lg text-sm text-[color:var(--dusk-status-warning-fg)]">
              <strong>Depth warning:</strong> IAB recommends VAST wrapper chains be no deeper than 3 hops. Excessive depth increases latency and can cause ad serving failures.
            </div>
          )}

          {/* Chain visualization */}
          {result.steps.length > 0 && (
            <Panel padding="none" className="overflow-hidden rounded-2xl">
              <div className="px-5 py-3 border-b border-[color:var(--dusk-border-subtle)] bg-surface-muted">
                <h2 className="text-sm font-semibold text-[color:var(--dusk-text-secondary)]">
                  Chain ({result.steps.length} step{result.steps.length !== 1 ? 's' : ''})
                </h2>
              </div>
              <div className="p-5 space-y-3">
                {result.steps.map((step, i) => {
                  const isWarning = step.depth > 3;
                  const isError = Boolean(step.error);
                  const isLast = i === result.steps.length - 1;

                  return (
                    <div key={i} className="relative">
                      {/* Connector line */}
                      {!isLast && (
                        <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-[color:var(--dusk-border-default)]" />
                      )}

                      <div className={`flex gap-4 rounded-xl border p-4 ${
                        isError
                          ? 'bg-[color:var(--dusk-status-critical-bg)] border-[color:var(--dusk-status-critical-border)]'
                          : isWarning
                          ? 'bg-[color:var(--dusk-status-warning-bg)] border-[color:var(--dusk-status-warning-border)]'
                          : step.type === 'InLine'
                          ? 'bg-[color:var(--dusk-status-success-bg)] border-[color:var(--dusk-status-success-border)]'
                          : 'bg-surface-muted border-[color:var(--dusk-border-default)]'
                      }`}>
                        {/* Depth circle */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          isError ? 'bg-[color:var(--dusk-status-critical-border)] text-[color:var(--dusk-status-critical-fg)]' :
                          isWarning ? 'bg-[color:var(--dusk-status-warning-border)] text-[color:var(--dusk-status-warning-fg)]' :
                          step.type === 'InLine' ? 'bg-[color:var(--dusk-status-success-border)] text-[color:var(--dusk-status-success-fg)]' :
                          'bg-surface-1 text-[color:var(--dusk-text-secondary)]'
                        }`}>
                          {step.depth}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge tone={step.type === 'InLine' ? 'success' : 'info'} size="sm">
                              {step.type}
                            </Badge>
                            <span className="text-xs text-[color:var(--dusk-text-muted)]">
                              VAST {step.vastVersion}
                            </span>
                            {step.adSystem && (
                              <span className="text-xs text-[color:var(--dusk-text-muted)]">· {step.adSystem}</span>
                            )}
                            {isWarning && !isError && (
                              <Badge tone="warning" size="sm">Deep chain</Badge>
                            )}
                          </div>
                          <p className="text-xs font-mono text-[color:var(--dusk-text-secondary)] break-all">{step.url}</p>
                          {step.error && (
                            <p className="mt-1 text-xs text-[color:var(--dusk-status-critical-fg)]">Error: {step.error}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
