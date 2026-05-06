import React, { useState, FormEvent } from 'react';

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

const severityConfig: Record<IssueSeverity, { cls: string; icon: string }> = {
  error:   { cls: 'bg-red-50 border-red-200 text-red-800',     icon: 'Error' },
  warning: { cls: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: 'Warning' },
  info:    { cls: 'bg-blue-50 border-blue-200 text-blue-800',   icon: 'Info' },
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
        <h1 className="text-2xl font-bold text-slate-800">VAST Validator</h1>
        <p className="text-sm text-slate-500 mt-1">Validate VAST XML tags for spec compliance and common issues</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        {/* Mode toggle */}
        <div className="flex gap-1 mb-5 p-1 bg-slate-100 rounded-lg w-fit">
          {(['xml', 'url'] as InputMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setResult(null); setError(''); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {m === 'xml' ? 'Paste XML' : 'Tag URL'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'xml' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">VAST XML</label>
              <textarea
                value={xmlInput}
                onChange={e => setXmlInput(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500 resize-y"
                placeholder={'<?xml version="1.0" encoding="UTF-8"?>\n<VAST version="4.2">\n  ...\n</VAST>'}
                spellCheck={false}
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">VAST Tag URL</label>
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                placeholder="https://ad.example.com/vast?placement=12345"
              />
              <p className="mt-1 text-xs text-slate-400">The URL will be fetched server-side to retrieve the VAST XML.</p>
            </div>
          )}

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
            {loading ? 'Validating...' : 'Validate VAST'}
          </button>
        </form>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className={`rounded-xl border p-5 flex items-center gap-4 ${
            result.valid
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className={`text-4xl`}>{result.valid ? 'OK' : 'Error'}</div>
            <div>
              <p className={`text-lg font-bold ${result.valid ? 'text-green-800' : 'text-red-800'}`}>
                {result.valid ? 'Valid VAST' : 'Invalid VAST'}
              </p>
              {result.vastVersion && (
                <p className="text-sm text-slate-600">
                  VAST Version: <strong>{result.vastVersion}</strong>
                </p>
              )}
              <p className="text-sm text-slate-600 mt-0.5">
                {result.errors?.length ?? 0} error{result.errors?.length !== 1 ? 's' : ''},{' '}
                {result.warnings?.length ?? 0} warning{result.warnings?.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Issues list */}
          {allIssues.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-700">Issues ({allIssues.length})</h2>
              </div>
              <ul className="divide-y divide-slate-100">
                {allIssues.map((issue, i) => {
                  const cfg = severityConfig[issue.severity];
                  return (
                    <li key={i} className={`px-5 py-3 flex gap-3 text-sm ${cfg.cls} border-l-4`} style={{ borderLeftColor: issue.severity === 'error' ? '#ef4444' : issue.severity === 'warning' ? '#eab308' : '#3b82f6' }}>
                      <span className="flex-shrink-0 font-bold">{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold capitalize">{issue.severity}</span>
                          {issue.code && (
                            <code className="text-xs bg-white/60 px-1.5 py-0.5 rounded font-mono">{issue.code}</code>
                          )}
                        </div>
                        <p>{issue.message}</p>
                        {issue.path && (
                          <p className="mt-0.5 text-xs opacity-70 font-mono">{issue.path}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {allIssues.length === 0 && result.valid && (
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-6 text-center text-sm text-slate-500">
              No issues detected. This VAST tag looks great!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
