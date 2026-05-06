import React, { useState, FormEvent } from 'react';

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
        <h1 className="text-2xl font-bold text-slate-800">VAST Chain Validator</h1>
        <p className="text-sm text-slate-500 mt-1">
          Resolve VAST wrapper chains to find the final inline ad and diagnose redirect depth issues
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              VAST Tag URL
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              placeholder="https://ad.example.com/vast?placement=12345"
            />
            <p className="mt-1 text-xs text-slate-400">
              The chain will be resolved server-side. Each wrapper redirect is followed up to 10 levels deep.
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-gradient hover:opacity-95 disabled:opacity-60 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            )}
            {loading ? 'Resolving chain...' : 'Resolve Chain'}
          </button>
        </form>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className={`rounded-xl border p-5 ${
            !result.resolved
              ? 'bg-red-50 border-red-200'
              : depthWarning
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">
                {!result.resolved ? 'Invalid' : depthWarning ? 'Warning' : 'Valid'}
              </span>
              <div>
                <p className={`font-bold text-lg ${
                  !result.resolved ? 'text-red-800' : depthWarning ? 'text-yellow-800' : 'text-green-800'
                }`}>
                  {!result.resolved
                    ? 'Chain failed to resolve'
                    : depthWarning
                    ? `Resolved — but chain depth (${result.totalDepth}) exceeds recommended limit of 3`
                    : `Resolved — chain depth: ${result.totalDepth}`}
                </p>
                {result.finalType && (
                  <p className="text-sm text-slate-600 mt-0.5">
                    Final ad type: <strong>{result.finalType}</strong>
                    {result.finalType === 'Wrapper' && (
                      <span className="ml-1 text-yellow-700"> (no InLine found)</span>
                    )}
                  </p>
                )}
                {result.error && (
                  <p className="text-sm text-red-700 mt-0.5">{result.error}</p>
                )}
              </div>
            </div>
          </div>

          {depthWarning && (
            <div className="px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <strong>Depth warning:</strong> IAB recommends VAST wrapper chains be no deeper than 3 hops. Excessive depth increases latency and can cause ad serving failures.
            </div>
          )}

          {/* Chain visualization */}
          {result.steps.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-700">
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
                        <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-slate-200" />
                      )}

                      <div className={`flex gap-4 rounded-xl border p-4 ${
                        isError
                          ? 'bg-red-50 border-red-200'
                          : isWarning
                          ? 'bg-yellow-50 border-yellow-200'
                          : step.type === 'InLine'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}>
                        {/* Depth circle */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          isError ? 'bg-red-200 text-red-800' :
                          isWarning ? 'bg-yellow-200 text-yellow-800' :
                          step.type === 'InLine' ? 'bg-green-200 text-green-800' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {step.depth}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              step.type === 'InLine'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {step.type}
                            </span>
                            <span className="text-xs text-slate-500">
                              VAST {step.vastVersion}
                            </span>
                            {step.adSystem && (
                              <span className="text-xs text-slate-500">· {step.adSystem}</span>
                            )}
                            {isWarning && !isError && (
                              <span className="text-xs text-yellow-700 font-medium">⚠ Deep chain</span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-slate-600 break-all">{step.url}</p>
                          {step.error && (
                            <p className="mt-1 text-xs text-red-700">Error: {step.error}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
