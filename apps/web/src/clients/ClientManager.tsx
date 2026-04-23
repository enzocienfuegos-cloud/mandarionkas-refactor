import React, { useEffect, useState } from 'react';
import { createClientWorkspace, loadAuthMe, loadWorkspaces, type WorkspaceOption } from '../shared/workspaces';

const DSP_OPTIONS = ['Basis', 'Illumin', 'Criteo'] as const;

export default function ClientManager() {
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [dsp, setDsp] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [authMe, workspaceList] = await Promise.all([loadAuthMe(), loadWorkspaces()]);
      setWorkspaces(workspaceList);
      setActiveWorkspaceId(authMe.workspace?.id ?? workspaceList[0]?.id ?? '');
    } catch (loadError: any) {
      setError(loadError.message ?? 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Client name is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createClientWorkspace({
        name: name.trim(),
        website: website.trim(),
        dsp,
      });
      setName('');
      setWebsite('');
      setDsp('');
      await load();
    } catch (saveError: any) {
      setError(saveError.message ?? 'Failed to create client');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Client Setup</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage client workspaces separately from trafficking screens. Only the client name is required.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Add client</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Client name <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Banco Agricola"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Website</label>
              <input
                value={website}
                onChange={event => setWebsite(event.target.value)}
                placeholder="https://example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Default DSP</label>
              <select
                value={dsp}
                onChange={event => setDsp(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select DSP</option>
                {DSP_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
              >
                {saving ? 'Creating…' : 'Create client'}
              </button>
            </div>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Available clients</h2>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500" />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {workspaces.map(workspace => (
                <div key={workspace.id} className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{workspace.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {workspace.id === activeWorkspaceId ? 'Active client' : 'Available in campaign filters'}
                      </p>
                    </div>
                    {workspace.id === activeWorkspaceId && (
                      <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {!workspaces.length && (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                  No clients yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
