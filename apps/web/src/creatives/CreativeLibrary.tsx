import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type CreativeFormat = 'vast_video' | 'display' | 'native';
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'draft' | 'pending_review';

interface Creative {
  id: string;
  name: string;
  format: CreativeFormat;
  approvalStatus: ApprovalStatus;
  thumbnailUrl?: string;
  previewUrl?: string;
  createdAt: string;
}

const formatLabel: Record<CreativeFormat, string> = {
  vast_video: 'VAST Video',
  display: 'Display',
  native: 'Native',
};

const formatBadge = (format: CreativeFormat) => {
  const cls: Record<CreativeFormat, string> = {
    vast_video: 'bg-purple-100 text-purple-800',
    display: 'bg-blue-100 text-blue-800',
    native: 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls[format]}`}>
      {formatLabel[format]}
    </span>
  );
};

const approvalBadge = (status: ApprovalStatus) => {
  const cfg: Record<ApprovalStatus, { cls: string; label: string }> = {
    pending:        { cls: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
    pending_review: { cls: 'bg-yellow-100 text-yellow-800', label: 'In Review' },
    approved:       { cls: 'bg-green-100 text-green-800',   label: 'Approved' },
    rejected:       { cls: 'bg-red-100 text-red-800',       label: 'Rejected' },
    draft:          { cls: 'bg-slate-100 text-slate-600',   label: 'Draft' },
  };
  const { cls, label } = cfg[status] ?? { cls: 'bg-slate-100 text-slate-600', label: status };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
};

const FORMATS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Formats' },
  { value: 'vast_video', label: 'VAST Video' },
  { value: 'display', label: 'Display' },
  { value: 'native', label: 'Native' },
];

const APPROVAL_STATUSES: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function CreativeLibrary() {
  const navigate = useNavigate();
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formatFilter, setFormatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/v1/creatives', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to load creatives'); return r.json(); })
      .then(d => setCreatives(d?.creatives ?? d ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmitForReview = async (creative: Creative) => {
    setSubmitting(creative.id);
    try {
      const res = await fetch(`/v1/creatives/${creative.id}/submit`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Submit failed');
      setCreatives(cs =>
        cs.map(c => c.id === creative.id ? { ...c, approvalStatus: 'pending_review' } : c)
      );
    } catch {
      alert('Failed to submit for review.');
    } finally {
      setSubmitting(null);
    }
  };

  const filtered = creatives.filter(c => {
    if (formatFilter !== 'all' && c.format !== formatFilter) return false;
    if (statusFilter !== 'all' && c.approvalStatus !== statusFilter) return false;
    return true;
  });

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
        <p className="font-medium">Error loading creatives</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Creative Library</h1>
          <p className="text-sm text-slate-500 mt-1">{creatives.length} creative{creatives.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/creatives/approval')}
            className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Review Queue
          </button>
          <button
            onClick={() => navigate('/creatives/upload')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Upload Creative
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 font-medium">Format:</label>
          <div className="flex gap-1">
            {FORMATS.map(f => (
              <button
                key={f.value}
                onClick={() => setFormatFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  formatFilter === f.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 font-medium">Status:</label>
          <div className="flex gap-1">
            {APPROVAL_STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === s.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <p className="text-4xl mb-3">🎨</p>
          <h3 className="text-lg font-medium text-slate-700">No creatives found</h3>
          <p className="text-sm text-slate-500 mt-1">
            {creatives.length > 0 ? 'Try adjusting your filters.' : 'Upload your first creative to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Thumbnail placeholder */}
              <div className="h-40 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                {c.thumbnailUrl ? (
                  <img src={c.thumbnailUrl} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">
                    {c.format === 'vast_video' ? '🎬' : c.format === 'display' ? '🖼️' : '📰'}
                  </span>
                )}
              </div>

              <div className="p-4">
                <h3 className="text-sm font-semibold text-slate-800 truncate mb-2">{c.name}</h3>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {formatBadge(c.format)}
                  {approvalBadge(c.approvalStatus)}
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  {new Date(c.createdAt).toLocaleDateString()}
                </p>

                <div className="flex gap-2">
                  {c.previewUrl && (
                    <a
                      href={c.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center text-xs font-medium text-indigo-600 border border-indigo-200 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      Preview
                    </a>
                  )}
                  {(c.approvalStatus === 'draft' || c.approvalStatus === 'rejected') && (
                    <button
                      onClick={() => handleSubmitForReview(c)}
                      disabled={submitting === c.id}
                      className="flex-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 px-2 py-1.5 rounded-lg transition-colors"
                    >
                      {submitting === c.id ? '...' : 'Submit'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
