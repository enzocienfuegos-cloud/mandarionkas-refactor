import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useConfirm, useToast } from '../system';

interface TagRecord {
  id: string;
  name: string;
  workspaceName?: string | null;
  campaign?: { id: string; name: string } | null;
}

interface PixelRecord {
  id: string;
  tagId: string;
  pixelType: 'impression' | 'click' | 'viewability' | 'custom';
  url: string;
  createdAt: string | null;
}

const PIXEL_TYPES: Array<PixelRecord['pixelType']> = ['impression', 'click', 'viewability', 'custom'];

function emptyForm() {
  return { pixelType: 'impression' as PixelRecord['pixelType'], url: '' };
}

export default function TagPixelsManager() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const [tag, setTag] = useState<TagRecord | null>(null);
  const [pixels, setPixels] = useState<PixelRecord[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [tagResponse, pixelResponse] = await Promise.all([
        fetch(`/v1/tags/${id}`, { credentials: 'include' }),
        fetch(`/v1/tags/${id}/pixels`, { credentials: 'include' }),
      ]);
      if (!tagResponse.ok) throw new Error('Failed to load tag.');
      if (!pixelResponse.ok) {
        const payload = await pixelResponse.json().catch(() => ({}));
        throw new Error(payload?.message ?? 'Failed to load pixels.');
      }
      const tagPayload = await tagResponse.json();
      const pixelPayload = await pixelResponse.json();
      setTag(tagPayload.tag ?? null);
      setPixels(pixelPayload.pixels ?? []);
    } catch (caught: any) {
      setError(caught?.message ?? 'Failed to load tag pixels.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(
        editingId ? `/v1/tags/${id}/pixels/${editingId}` : `/v1/tags/${id}/pixels`,
        {
          method: editingId ? 'PUT' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'Failed to save pixel.');
      const nextPixel = payload.pixel as PixelRecord | undefined;
      if (nextPixel) {
        setPixels((current) => (
          editingId
            ? current.map((pixel) => (pixel.id === editingId ? nextPixel : pixel))
            : [...current, nextPixel]
        ));
      }
      setSuccess(editingId ? 'Pixel updated.' : 'Pixel added.');
      resetForm();
    } catch (caught: any) {
      setError(caught?.message ?? 'Failed to save pixel.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (pixel: PixelRecord) => {
    setEditingId(pixel.id);
    setForm({ pixelType: pixel.pixelType, url: pixel.url });
    setError('');
    setSuccess('');
  };

  const handleDelete = async (pixel: PixelRecord) => {
    if (!id) return;
    const confirmed = await confirm({
      title: `Delete the ${pixel.pixelType} pixel?`,
      description: 'The tag will stop firing this measurement endpoint immediately.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/v1/tags/${id}/pixels/${pixel.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'Failed to delete pixel.');
      setPixels((current) => current.filter((entry) => entry.id !== pixel.id));
      if (editingId === pixel.id) resetForm();
      setSuccess('Pixel deleted.');
      toast({ tone: 'warning', title: `${pixel.pixelType} pixel deleted` });
    } catch (caught: any) {
      setError(caught?.message ?? 'Failed to delete pixel.');
      toast({ tone: 'critical', title: caught?.message ?? 'Failed to delete pixel.' });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--dusk-text-soft)]">Tag Pixels</p>
          <h1 className="mt-2 text-2xl font-bold text-text-primary">{tag?.name ?? 'Tag pixels'}</h1>
          <p className="mt-1 text-sm text-text-muted">
            Manage measurement and redirect pixels for this tag.
            {tag?.workspaceName ? ` Workspace: ${tag.workspaceName}.` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/tags/${id}`} className="rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-text-secondary hover:bg-[color:var(--dusk-surface-muted)]">
            Back to tag
          </Link>
          <Link to={`/tags/${id}/tracking`} className="rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-text-secondary hover:bg-[color:var(--dusk-surface-muted)]">
            Tracking
          </Link>
          <Link to={`/tags/${id}/reporting`} className="rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-text-secondary hover:bg-[color:var(--dusk-surface-muted)]">
            Reporting
          </Link>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-critical-fg)]">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <div className="rounded-2xl border border-border-default bg-surface-1 overflow-hidden">
          <div className="border-b border-border-default px-6 py-4">
            <h2 className="text-lg font-semibold text-text-primary">Configured pixels</h2>
            <p className="mt-1 text-sm text-text-muted">Pixels fire alongside tag delivery and should stay tightly scoped to the measurement path.</p>
          </div>
          {pixels.length === 0 ? (
            <div className="px-6 py-10 text-sm text-text-muted">No pixels are configured for this tag yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pixels.map((pixel) => (
                <div key={pixel.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="inline-flex rounded-full bg-[color:var(--dusk-surface-muted)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                        {pixel.pixelType}
                      </div>
                      <p className="mt-3 break-all text-sm text-text-secondary">{pixel.url}</p>
                      <p className="mt-2 text-xs text-[color:var(--dusk-text-soft)]">
                        Added {pixel.createdAt ? new Date(pixel.createdAt).toLocaleString() : 'recently'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => handleEdit(pixel)} className="rounded-lg px-3 py-2 text-xs font-medium text-text-brand hover:bg-brand-50">
                        Edit
                      </button>
                      <button type="button" onClick={() => void handleDelete(pixel)} className="rounded-lg px-3 py-2 text-xs font-medium text-[color:var(--dusk-status-critical-fg)] hover:bg-[color:var(--dusk-status-critical-bg)]">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border-default bg-surface-1 p-6">
          <h2 className="text-lg font-semibold text-text-primary">{editingId ? 'Edit pixel' : 'Add pixel'}</h2>
          <p className="mt-1 text-sm text-text-muted">
            Use standard measurement endpoints and keep redirects deterministic.
          </p>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">Pixel type</label>
              <select
                value={form.pixelType}
                onChange={(event) => setForm((current) => ({ ...current, pixelType: event.target.value as PixelRecord['pixelType'] }))}
                className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
              >
                {PIXEL_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-secondary">URL</label>
              <textarea
                value={form.url}
                onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                rows={5}
                placeholder="https://measurement.example.com/pixel?id=..."
                className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingId ? 'Update pixel' : 'Add pixel'}
              </button>
              {editingId ? (
                <button type="button" onClick={resetForm} className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-text-secondary hover:bg-[color:var(--dusk-surface-muted)]">
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
