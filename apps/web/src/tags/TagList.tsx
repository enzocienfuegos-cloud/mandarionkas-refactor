import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

interface Tag {
  id: string;
  name: string;
  campaign: { id: string; name: string } | null;
  format: 'VAST' | 'display' | 'native';
  status: 'active' | 'paused' | 'archived' | 'draft';
  sizeLabel?: string;
  createdAt: string;
}

const formatBadge = (format: Tag['format']) => {
  const cls: Record<Tag['format'], string> = {
    VAST: 'bg-purple-100 text-purple-800',
    display: 'bg-blue-100 text-blue-800',
    native: 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls[format]}`}>
      {format}
    </span>
  );
};

const statusBadge = (status: Tag['status']) => {
  const cls: Record<Tag['status'], string> = {
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    archived: 'bg-slate-100 text-slate-600',
    draft: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls[status]}`}>
      {status}
    </span>
  );
};

export default function TagList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState({
    name: '',
    campaignId: '',
    format: 'display' as Tag['format'],
    status: 'draft' as Tag['status'],
    servingWidth: '',
    servingHeight: '',
  });

  const load = () => {
    setLoading(true);
    fetch('/v1/tags', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to load tags'); return r.json(); })
      .then(d => setTags(d?.tags ?? d ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setCreating(true);
    }
  }, [searchParams]);

  const handleDelete = async (tag: Tag) => {
    if (!window.confirm(`Delete tag "${tag.name}"? This cannot be undone.`)) return;
    setDeletingId(tag.id);
    try {
      const res = await fetch(`/v1/tags/${tag.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
      setTags(ts => ts.filter(t => t.id !== tag.id));
    } catch {
      alert('Failed to delete tag.');
    } finally {
      setDeletingId(null);
    }
  };

  const closeCreate = () => {
    setCreating(false);
    setCreateError('');
    setCreateForm({ name: '', campaignId: '', format: 'display', status: 'draft', servingWidth: '', servingHeight: '' });
    if (searchParams.get('create') === '1') {
      setSearchParams({});
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      setCreateError('Tag name is required.');
      return;
    }
    if (createForm.format === 'display') {
      const width = Number(createForm.servingWidth);
      const height = Number(createForm.servingHeight);
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        setCreateError('Display tags require width and height.');
        return;
      }
    }
    setCreateError('');
    try {
      const res = await fetch('/v1/tags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          campaignId: createForm.campaignId || null,
          format: createForm.format,
          status: createForm.status,
          servingWidth: createForm.format === 'display' ? Number(createForm.servingWidth) || null : null,
          servingHeight: createForm.format === 'display' ? Number(createForm.servingHeight) || null : null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message ?? 'Failed to create tag');
      closeCreate();
      await load();
      const createdId = payload?.tag?.id ?? payload?.id;
      if (createdId) navigate(`/tags/${createdId}`);
    } catch (createErr: any) {
      setCreateError(createErr.message ?? 'Failed to create tag');
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
        <p className="font-medium">Error loading tags</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tags</h1>
          <p className="text-sm text-slate-500 mt-1">{tags.length} tag{tags.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/tags/bindings"
            className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            🔗 Assignments
          </Link>
          <Link
            to="/tags/health"
            className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 font-medium px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            🩺 Health
          </Link>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            + New Tag
          </button>
        </div>
      </div>

      {tags.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <p className="text-4xl mb-3">🏷️</p>
          <h3 className="text-lg font-medium text-slate-700">No tags yet</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">Create your first ad tag to start serving ads.</p>
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 bg-indigo-600 text-white font-medium px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors">
            + New Tag
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Name', 'Campaign', 'Format', 'Size', 'Status', 'Created At', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tags.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{t.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{t.campaign?.name ?? '—'}</td>
                    <td className="px-4 py-3">{formatBadge(t.format)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{t.sizeLabel || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(t.status)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/tags/${t.id}`)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          disabled={deletingId === t.id}
                          className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {deletingId === t.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800">Create Tag</h2>
            <p className="mt-1 text-sm text-slate-500">Create the tag first, then configure snippet variants and assignments from the tag workspace.</p>
            {createError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>
            )}
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tag Name</label>
                <input
                  value={createForm.name}
                  onChange={event => setCreateForm(current => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Homepage 300x250 display"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Format</label>
                <div className="flex gap-2">
                  {(['VAST', 'display', 'native'] as Tag['format'][]).map(format => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => setCreateForm(current => ({ ...current, format }))}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                        createForm.format === format
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
              {createForm.format === 'display' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Width</label>
                    <input
                      type="number"
                      min="1"
                      value={createForm.servingWidth}
                      onChange={event => setCreateForm(current => ({ ...current, servingWidth: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="300"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Height</label>
                    <input
                      type="number"
                      min="1"
                      value={createForm.servingHeight}
                      onChange={event => setCreateForm(current => ({ ...current, servingHeight: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="250"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={createForm.status}
                  onChange={event => setCreateForm(current => ({ ...current, status: event.target.value as Tag['status'] }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeCreate} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => void handleCreate()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Create Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
