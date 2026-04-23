import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  type CreativeVersion,
  approveCreativeVersion,
  loadPendingReviewVersions,
  rejectCreativeVersion,
} from './catalog';

interface User {
  id: string;
  email: string;
  role: string;
}

interface ActionState {
  versionId: string;
  type: 'approve' | 'reject';
  notes: string;
  reason: string;
  loading: boolean;
  error: string;
}

export default function CreativeApproval() {
  const { user } = useOutletContext<{ user: User }>();
  const [versions, setVersions] = useState<CreativeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [processed, setProcessed] = useState<Set<string>>(new Set());

  const canAct = user?.role === 'admin' || user?.role === 'owner';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setVersions(await loadPendingReviewVersions());
    } catch (loadError: any) {
      setError(loadError.message ?? 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const pending = versions.filter(version => !processed.has(version.id));

  const handleAction = async () => {
    if (!actionState) return;
    setActionState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      if (actionState.type === 'approve') {
        await approveCreativeVersion(actionState.versionId, actionState.notes.trim() || undefined);
      } else {
        if (!actionState.reason.trim()) {
          throw new Error('Rejection reason is required.');
        }
        await rejectCreativeVersion(actionState.versionId, actionState.reason.trim());
      }
      setProcessed(current => new Set([...current, actionState.versionId]));
      setActionState(null);
    } catch (actionError: any) {
      setActionState(current => current ? { ...current, loading: false, error: actionError.message ?? 'Action failed' } : current);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">Error loading review queue</p>
        <p className="mt-1 text-sm">{error}</p>
        <button onClick={() => void load()} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Creative Version Review</h1>
          <p className="mt-1 text-sm text-slate-500">{pending.length} version{pending.length !== 1 ? 's' : ''} awaiting review</p>
        </div>
        <button onClick={() => void load()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Refresh
        </button>
      </div>

      {!canAct && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          You have read-only access. Only admins and owners can approve or reject versions.
        </div>
      )}

      {pending.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-20 text-center">
          <div className="text-4xl">✅</div>
          <h3 className="mt-3 text-lg font-medium text-slate-700">Queue is empty</h3>
          <p className="mt-1 text-sm text-slate-500">All submitted versions have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(version => (
            <div key={version.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-semibold text-slate-800">{version.creativeName ?? version.creativeId}</h3>
                    <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">In review</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
                    <span>Version: <strong className="text-slate-700">v{version.versionNumber}</strong></span>
                    <span>Source: <strong className="text-slate-700">{version.sourceKind}</strong></span>
                    <span>Format: <strong className="text-slate-700">{version.servingFormat}</strong></span>
                    <span>Created: <strong className="text-slate-700">{version.createdAt ? new Date(version.createdAt).toLocaleString() : '—'}</strong></span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {version.publicUrl && (
                    <a href={version.publicUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50">
                      Preview
                    </a>
                  )}
                  {canAct && (
                    <>
                      <button onClick={() => setActionState({ versionId: version.id, type: 'approve', notes: '', reason: '', loading: false, error: '' })} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">
                        Approve
                      </button>
                      <button onClick={() => setActionState({ versionId: version.id, type: 'reject', notes: '', reason: '', loading: false, error: '' })} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {actionState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800">
              {actionState.type === 'approve' ? 'Approve creative version' : 'Reject creative version'}
            </h2>
            {actionState.error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {actionState.error}
              </div>
            )}
            {actionState.type === 'approve' ? (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={actionState.notes}
                  onChange={event => setActionState(current => current ? { ...current, notes: event.target.value } : current)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            ) : (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Reason</label>
                <textarea
                  value={actionState.reason}
                  onChange={event => setActionState(current => current ? { ...current, reason: event.target.value } : current)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setActionState(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={() => void handleAction()}
                disabled={actionState.loading}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${actionState.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {actionState.loading ? 'Saving…' : actionState.type === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
