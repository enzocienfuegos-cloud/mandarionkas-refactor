import React, { useEffect, useState, FormEvent } from 'react';
import { useConfirm, useToast } from '../system';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  status: 'active' | 'expired' | 'revoked';
  lastUsedAt?: string | null;
}

interface CreateKeyResult {
  key: ApiKey;
  rawKey: string;
}

interface ScopeCategory {
  label: string;
  scopes: { value: string; label: string }[];
}

const SCOPE_CATEGORIES: ScopeCategory[] = [
  {
    label: 'Campaigns',
    scopes: [
      { value: 'campaigns:read',  label: 'Read campaigns' },
      { value: 'campaigns:write', label: 'Write campaigns' },
    ],
  },
  {
    label: 'Tags',
    scopes: [
      { value: 'tags:read',  label: 'Read tags' },
      { value: 'tags:write', label: 'Write tags' },
    ],
  },
  {
    label: 'Creatives',
    scopes: [
      { value: 'creatives:read',  label: 'Read creatives' },
      { value: 'creatives:write', label: 'Write creatives' },
    ],
  },
  {
    label: 'Reporting',
    scopes: [
      { value: 'reporting:read', label: 'Read reporting data' },
    ],
  },
  {
    label: 'Admin',
    scopes: [
      { value: 'team:manage',    label: 'Manage team members' },
      { value: 'webhooks:write', label: 'Manage webhooks' },
      { value: 'audit:read',     label: 'Read audit log' },
    ],
  },
];

const statusBadge = (status: ApiKey['status']) => {
  const cfg: Record<ApiKey['status'], { cls: string; label: string }> = {
    active:  { cls: 'bg-green-100 text-green-800',  label: 'Active' },
    expired: { cls: 'bg-yellow-100 text-yellow-800', label: 'Expired' },
    revoked: { cls: 'bg-red-100 text-red-800',       label: 'Revoked' },
  };
  const { cls, label } = cfg[status];
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
};

export default function ApiKeys() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [rawKey, setRawKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [expiryDate, setExpiryDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/v1/api-keys', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to load API keys'); return r.json(); })
      .then(d => setKeys(d?.keys ?? d ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleScope = (scope: string) => {
    setSelectedScopes(s => {
      const n = new Set(s);
      n.has(scope) ? n.delete(scope) : n.add(scope);
      return n;
    });
  };

  const openModal = () => {
    setShowModal(true);
    setNewName('');
    setSelectedScopes(new Set());
    setExpiryDate('');
    setCreateError('');
    setRawKey('');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newName.trim()) { setCreateError('Name is required.'); return; }
    if (selectedScopes.size === 0) { setCreateError('Select at least one scope.'); return; }

    setCreating(true);
    try {
      const res = await fetch('/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newName.trim(),
          scopes: Array.from(selectedScopes),
          expiresAt: expiryDate || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? 'Failed to create key');
      }

      const data: CreateKeyResult = await res.json();
      setRawKey(data.rawKey);
      setKeys(ks => [data.key, ...ks]);
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (key: ApiKey) => {
    const confirmed = await confirm({
      title: `Revoke key "${key.name}"?`,
      description: 'This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Revoke',
      requireTypeToConfirm: key.name,
    });
    if (!confirmed) return;
    setRevokingId(key.id);
    try {
      const res = await fetch(`/v1/api-keys/${key.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Revoke failed');
      setKeys(ks => ks.map(k => k.id === key.id ? { ...k, status: 'revoked' } : k));
      toast({ tone: 'warning', title: `Key "${key.name}" revoked` });
    } catch {
      toast({ tone: 'critical', title: 'Failed to revoke API key.' });
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rawKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">API Keys</h1>
          <p className="text-sm text-slate-500 mt-1">Manage programmatic access to the SMX Studio API</p>
        </div>
        <button
          onClick={openModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + Create Key
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {keys.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <p className="text-4xl mb-3">🔑</p>
          <h3 className="text-lg font-medium text-slate-700">No API keys</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">Create an API key for programmatic access.</p>
          <button onClick={openModal} className="bg-indigo-600 text-white font-medium px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors">
            + Create Key
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Name', 'Prefix', 'Scopes', 'Created', 'Expires', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {keys.map(k => (
                  <tr key={k.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{k.name}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                        {k.prefix}...
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {k.scopes.map(s => (
                          <span key={s} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(k.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">{statusBadge(k.status)}</td>
                    <td className="px-4 py-3">
                      {k.status === 'active' && (
                        <button
                          onClick={() => handleRevoke(k)}
                          disabled={revokingId === k.id}
                          className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {revokingId === k.id ? '...' : 'Revoke'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create key modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Create API Key</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>

            <div className="p-6">
              {rawKey ? (
                /* Show raw key after creation */
                <div>
                  <div className="mb-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    ⚠️ <strong>Store this key securely — it won't be shown again.</strong>
                  </div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Your new API key</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2.5 bg-slate-900 text-green-400 text-sm font-mono rounded-lg break-all">
                      {rawKey}
                    </code>
                    <button
                      onClick={handleCopy}
                      className={`flex-shrink-0 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        copied ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {copied ? '✓' : '📋'}
                    </button>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="mt-4 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreate} className="space-y-5" noValidate>
                  {createError && (
                    <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {createError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Key Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="CI/CD Pipeline Key"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Scopes <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-3">
                      {SCOPE_CATEGORIES.map(cat => (
                        <div key={cat.label}>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{cat.label}</p>
                          <div className="space-y-1 pl-2">
                            {cat.scopes.map(s => (
                              <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedScopes.has(s.value)}
                                  onChange={() => toggleScope(s.value)}
                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-slate-700">{s.label}</span>
                                <code className="text-xs text-slate-400 font-mono">{s.value}</code>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Expiry Date <span className="text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={e => setExpiryDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {creating && (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                      )}
                      {creating ? 'Creating...' : 'Create Key'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
