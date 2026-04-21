import React, { useEffect, useState, FormEvent } from 'react';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive';
  secret?: string;
  createdAt: string;
}

interface Delivery {
  id: string;
  event: string;
  status: 'success' | 'failed' | 'pending';
  statusCode?: number;
  sentAt: string;
  responseTime?: number;
}

const ALL_EVENTS = [
  'tag.impression',
  'tag.click',
  'creative.approved',
  'creative.rejected',
  'campaign.started',
  'campaign.completed',
  'pacing.behind',
  'discrepancy.critical',
];

const statusBadge = (status: Webhook['status']) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
    status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
  }`}>
    {status === 'active' ? '● Active' : '○ Inactive'}
  </span>
);

const deliveryBadge = (status: Delivery['status']) => {
  const cfg: Record<Delivery['status'], string> = {
    success: 'bg-green-100 text-green-800',
    failed:  'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cfg[status]}`}>
      {status}
    </span>
  );
};

function generateSecret(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

export default function WebhookManager() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    url: '',
    events: new Set<string>(),
    secret: '',
    status: 'active' as Webhook['status'],
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/v1/webhooks', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to load webhooks'); return r.json(); })
      .then(d => setWebhooks(d?.webhooks ?? d ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const loadDeliveries = (webhookId: string) => {
    setLoadingDeliveries(true);
    setSelectedWebhookId(webhookId);
    fetch(`/v1/webhooks/${webhookId}/deliveries`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setDeliveries(d?.deliveries ?? d ?? []))
      .catch(() => setDeliveries([]))
      .finally(() => setLoadingDeliveries(false));
  };

  const openNewModal = () => {
    setEditingWebhook(null);
    setForm({ name: '', url: '', events: new Set(), secret: generateSecret(), status: 'active' });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (wh: Webhook) => {
    setEditingWebhook(wh);
    setForm({ name: wh.name, url: wh.url, events: new Set(wh.events), secret: wh.secret ?? '', status: wh.status });
    setFormError('');
    setShowModal(true);
  };

  const toggleEvent = (ev: string) => {
    setForm(f => {
      const s = new Set(f.events);
      s.has(ev) ? s.delete(ev) : s.add(ev);
      return { ...f, events: s };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (!form.url.trim()) { setFormError('URL is required.'); return; }
    if (form.events.size === 0) { setFormError('Select at least one event.'); return; }

    const body = {
      name: form.name.trim(),
      url: form.url.trim(),
      events: Array.from(form.events),
      secret: form.secret || undefined,
      status: form.status,
    };

    setCreating(true);
    try {
      const url = editingWebhook ? `/v1/webhooks/${editingWebhook.id}` : '/v1/webhooks';
      const method = editingWebhook ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message ?? 'Save failed');
      }
      const data = await res.json();
      if (editingWebhook) {
        setWebhooks(ws => ws.map(w => w.id === editingWebhook.id ? data : w));
      } else {
        setWebhooks(ws => [data, ...ws]);
      }
      setShowModal(false);
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (wh: Webhook) => {
    if (!window.confirm(`Delete webhook "${wh.name}"?`)) return;
    setDeletingId(wh.id);
    try {
      const res = await fetch(`/v1/webhooks/${wh.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
      setWebhooks(ws => ws.filter(w => w.id !== wh.id));
      if (selectedWebhookId === wh.id) { setSelectedWebhookId(null); setDeliveries([]); }
    } catch {
      alert('Failed to delete webhook.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (wh: Webhook) => {
    const newStatus = wh.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/v1/webhooks/${wh.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Update failed');
      setWebhooks(ws => ws.map(w => w.id === wh.id ? { ...w, status: newStatus } : w));
    } catch {
      alert('Failed to update webhook status.');
    }
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
          <h1 className="text-2xl font-bold text-slate-800">Webhooks</h1>
          <p className="text-sm text-slate-500 mt-1">Receive HTTP notifications for workspace events</p>
        </div>
        <button
          onClick={openNewModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + New Webhook
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {webhooks.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <p className="text-4xl mb-3">🔔</p>
          <h3 className="text-lg font-medium text-slate-700">No webhooks configured</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">Create a webhook to receive event notifications.</p>
          <button onClick={openNewModal} className="bg-indigo-600 text-white font-medium px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors">
            + New Webhook
          </button>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Webhook list */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    {['Name', 'URL', 'Events', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {webhooks.map(wh => (
                    <tr
                      key={wh.id}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedWebhookId === wh.id ? 'bg-indigo-50' : ''}`}
                      onClick={() => loadDeliveries(wh.id)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{wh.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate font-mono">{wh.url}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{wh.events.join(', ')}</td>
                      <td className="px-4 py-3">{statusBadge(wh.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleStatus(wh)}
                            className="text-xs text-slate-600 hover:text-slate-800 font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                          >
                            {wh.status === 'active' ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => openEditModal(wh)}
                            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(wh)}
                            disabled={deletingId === wh.id}
                            className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {deletingId === wh.id ? '...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delivery history panel */}
          {selectedWebhookId && (
            <div className="w-72 flex-shrink-0">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-semibold text-slate-700">Delivery History</h3>
                </div>
                {loadingDeliveries ? (
                  <div className="flex items-center justify-center h-24">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-500"></div>
                  </div>
                ) : deliveries.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-400">No deliveries yet</div>
                ) : (
                  <ul className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                    {deliveries.map(d => (
                      <li key={d.id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <code className="text-xs font-mono text-slate-600">{d.event}</code>
                          {deliveryBadge(d.status)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{new Date(d.sentAt).toLocaleString()}</span>
                          {d.statusCode && <span>· {d.statusCode}</span>}
                          {d.responseTime && <span>· {d.responseTime}ms</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingWebhook ? 'Edit Webhook' : 'New Webhook'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
            </div>
            <div className="p-6">
              {formError && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Production Webhook"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Endpoint URL <span className="text-red-500">*</span></label>
                  <input
                    type="url"
                    value={form.url}
                    onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://your-app.com/webhooks/smx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Events <span className="text-red-500">*</span></label>
                  <div className="space-y-2 border border-slate-200 rounded-lg p-3">
                    {ALL_EVENTS.map(ev => (
                      <label key={ev} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.events.has(ev)}
                          onChange={() => toggleEvent(ev)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <code className="text-xs font-mono text-slate-700">{ev}</code>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Signing Secret</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.secret}
                      onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
                      className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="whsec_..."
                    />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, secret: generateSecret() }))}
                      className="px-3 py-2.5 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                    >
                      Generate
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Used to verify webhook payloads via HMAC-SHA256 signature.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as Webhook['status'] }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
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
                    {creating ? 'Saving...' : editingWebhook ? 'Update Webhook' : 'Create Webhook'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
