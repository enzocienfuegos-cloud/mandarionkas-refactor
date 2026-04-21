import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  role: string;
}

interface Creative {
  id: string;
  name: string;
  format: string;
  submittedAt: string;
  previewUrl?: string;
  submittedBy?: { email: string };
}

interface ActionState {
  creativeId: string;
  type: 'approve' | 'reject';
  notes: string;
  reason: string;
  loading: boolean;
  error: string;
}

const formatLabel: Record<string, string> = {
  vast_video: 'VAST Video',
  display: 'Display',
  native: 'Native',
};

export default function CreativeApproval() {
  const { user } = useOutletContext<{ user: User }>();
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [processed, setProcessed] = useState<Set<string>>(new Set());

  const canAct = user?.role === 'admin' || user?.role === 'owner';

  const load = () => {
    setLoading(true);
    fetch('/v1/creatives?approvalStatus=pending_review', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to load review queue'); return r.json(); })
      .then(d => setCreatives(d?.creatives ?? d ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const pending = creatives.filter(c => !processed.has(c.id));

  const openAction = (creative: Creative, type: 'approve' | 'reject') => {
    setActionState({ creativeId: creative.id, type, notes: '', reason: '', loading: false, error: '' });
  };

  const closeAction = () => setActionState(null);

  const handleSubmitAction = async () => {
    if (!actionState) return;
    const { creativeId, type, notes, reason } = actionState;

    if (type === 'reject' && !reason.trim()) {
      setActionState(s => s ? { ...s, error: 'Rejection reason is required.' } : s);
      return;
    }

    setActionState(s => s ? { ...s, loading: true, error: '' } : s);

    const url = `/v1/creatives/${creativeId}/${type}`;
    const body = type === 'approve' ? { notes: notes.trim() || undefined } : { reason: reason.trim() };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? 'Action failed');
      }

      setProcessed(p => new Set([...p, creativeId]));
      setActionState(null);
    } catch (e: any) {
      setActionState(s => s ? { ...s, loading: false, error: e.message } : s);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">Error loading review queue</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Creative Review Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            {pending.length} creative{pending.length !== 1 ? 's' : ''} awaiting review
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {!canAct && (
        <div className="mb-6 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          ⚠️ You have read-only access. Only admins and owners can approve or reject creatives.
        </div>
      )}

      {pending.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <p className="text-4xl mb-3">✅</p>
          <h3 className="text-lg font-medium text-slate-700">Queue is empty</h3>
          <p className="text-sm text-slate-500 mt-1">All submitted creatives have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-semibold text-slate-800">{c.name}</h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      In Review
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                    <span>Format: <strong className="text-slate-700">{formatLabel[c.format] ?? c.format}</strong></span>
                    <span>Submitted: <strong className="text-slate-700">{new Date(c.submittedAt).toLocaleDateString()}</strong></span>
                    {c.submittedBy && (
                      <span>By: <strong className="text-slate-700">{c.submittedBy.email}</strong></span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {c.previewUrl && (
                    <a
                      href={c.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
                    >
                      Preview
                    </a>
                  )}
                  {canAct && (
                    <>
                      <button
                        onClick={() => openAction(c, 'approve')}
                        className="text-sm font-medium text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => openAction(c, 'reject')}
                        className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        ✕ Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action modal */}
      {actionState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              {actionState.type === 'approve' ? '✓ Approve Creative' : '✕ Reject Creative'}
            </h2>

            {actionState.error && (
              <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {actionState.error}
              </div>
            )}

            {actionState.type === 'approve' ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={actionState.notes}
                  onChange={e => setActionState(s => s ? { ...s, notes: e.target.value } : s)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Any notes for the submitter..."
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={actionState.reason}
                  onChange={e => setActionState(s => s ? { ...s, reason: e.target.value } : s)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  placeholder="Explain why this creative was rejected..."
                />
              </div>
            )}

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={closeAction}
                className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAction}
                disabled={actionState.loading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${
                  actionState.type === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionState.loading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                )}
                {actionState.type === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
