import React, { useEffect, useState } from 'react';
import {
  createClientWorkspace,
  grantClientAccess,
  getWorkspaceProductLabel,
  loadAuthMe,
  loadClientAccess,
  loadWorkspaces,
  removeClientAccess,
  updateClientAccess,
  type ClientAccessUser,
  type WorkspaceOption,
} from '../shared/workspaces';
import { derivePlatformRoleFromAssignment, type PlatformRole } from '../shared/roles';

function ProductAccessBadges({ productAccess }: { productAccess?: { ad_server: boolean; studio: boolean } | null }) {
  const access = productAccess ?? { ad_server: true, studio: true };
  return (
    <div className="flex flex-wrap gap-1.5">
      {access.ad_server ? (
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
          Ad Server
        </span>
      ) : null}
      {access.studio ? (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          Studio
        </span>
      ) : null}
      {!access.ad_server && !access.studio ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          No product access
        </span>
      ) : null}
    </div>
  );
}

export default function ClientManager() {
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [accessClients, setAccessClients] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [accessUsers, setAccessUsers] = useState<ClientAccessUser[]>([]);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<PlatformRole>('ad_ops');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [productAccess, setProductAccess] = useState({ ad_server: true, studio: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [updatingAccessKey, setUpdatingAccessKey] = useState('');
  const [removingAccessKey, setRemovingAccessKey] = useState('');
  const [accessDrafts, setAccessDrafts] = useState<Record<string, {
    role: PlatformRole;
    productAccess: { ad_server: boolean; studio: boolean };
  }>>({});
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [authMe, workspaceList, accessPayload] = await Promise.all([loadAuthMe(), loadWorkspaces(), loadClientAccess()]);
      setWorkspaces(workspaceList);
      setActiveWorkspaceId(authMe.workspace?.id ?? workspaceList[0]?.id ?? '');
      setAccessClients(accessPayload.clients ?? []);
      setAccessUsers(accessPayload.users ?? []);
    } catch (loadError: any) {
      setError(loadError.message ?? 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const toggleClient = (workspaceId: string) => {
    setSelectedClientIds((current) => current.includes(workspaceId)
      ? current.filter((id) => id !== workspaceId)
      : [...current, workspaceId]);
  };

  const handleGrantAccess = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userEmail.trim()) {
      setError('User email is required.');
      return;
    }
    if (!selectedClientIds.length) {
      setError('Select at least one client for the user.');
      return;
    }
    if (!productAccess.ad_server && !productAccess.studio) {
      setError('Select at least one product access.');
      return;
    }

    setSavingAccess(true);
    setError('');
    try {
      await grantClientAccess({
        email: userEmail.trim(),
        role: userRole,
        workspaceIds: selectedClientIds,
        productAccess,
      });
      setUserEmail('');
      setUserRole('ad_ops');
      setSelectedClientIds([]);
      setProductAccess({ ad_server: true, studio: true });
      await load();
    } catch (saveError: any) {
      setError(saveError.message ?? 'Failed to grant access');
    } finally {
      setSavingAccess(false);
    }
  };

  const handleRemoveAccess = async (clientId: string, userId: string) => {
    const key = `${clientId}:${userId}`;
    setRemovingAccessKey(key);
    setError('');
    try {
      await removeClientAccess(clientId, userId);
      await load();
    } catch (removeError: any) {
      setError(removeError.message ?? 'Failed to remove access');
    } finally {
      setRemovingAccessKey('');
    }
  };

  const getAssignmentRole = (assignment: ClientAccessUser['assignments'][number]) =>
    derivePlatformRoleFromAssignment({
      role: assignment.role,
      productAccess: assignment.product_access,
    });

  const getAssignmentDraft = (assignment: ClientAccessUser['assignments'][number], userId: string) => {
    const key = `${assignment.workspace_id}:${userId}`;
    return accessDrafts[key] ?? {
      role: getAssignmentRole(assignment),
      productAccess: assignment.product_access,
    };
  };

  const updateAssignmentDraft = (
    assignment: ClientAccessUser['assignments'][number],
    userId: string,
    patch: Partial<{ role: PlatformRole; productAccess: { ad_server: boolean; studio: boolean } }>,
  ) => {
    const key = `${assignment.workspace_id}:${userId}`;
    const current = getAssignmentDraft(assignment, userId);
    setAccessDrafts((drafts) => ({
      ...drafts,
      [key]: {
        role: patch.role ?? current.role,
        productAccess: patch.productAccess ?? current.productAccess,
      },
    }));
  };

  const handleUpdateAccess = async (assignment: ClientAccessUser['assignments'][number], userId: string) => {
    const key = `${assignment.workspace_id}:${userId}`;
    const draft = getAssignmentDraft(assignment, userId);
    if (!draft.productAccess.ad_server && !draft.productAccess.studio) {
      setError('Select at least one product access.');
      return;
    }
    setUpdatingAccessKey(key);
    setError('');
    try {
      await updateClientAccess({
        clientId: assignment.workspace_id,
        userId,
        role: draft.role,
        productAccess: draft.productAccess,
      });
      setAccessDrafts((drafts) => {
        const next = { ...drafts };
        delete next[key];
        return next;
      });
      await load();
    } catch (updateError: any) {
      setError(updateError.message ?? 'Failed to update access');
    } finally {
      setUpdatingAccessKey('');
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
      });
      setName('');
      setWebsite('');
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
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">{workspace.name}</p>
                          <ProductAccessBadges productAccess={workspace.product_access} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {workspace.id === activeWorkspaceId
                            ? `Active client · ${getWorkspaceProductLabel(workspace)}`
                            : `Available for trafficking filters · ${getWorkspaceProductLabel(workspace)}`}
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

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
        <form onSubmit={handleGrantAccess} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">User access</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create a user by email and assign one or more clients. With those assignments they can view everything related to those clients.
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">User email</label>
              <input
                value={userEmail}
                onChange={(event) => setUserEmail(event.target.value)}
                placeholder="trafficker@example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Role across selected clients</label>
              <select
                value={userRole}
                onChange={(event) => setUserRole(event.target.value as PlatformRole)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ad_ops">Ad Ops</option>
                <option value="designer">Designer</option>
                <option value="reviewer">Reviewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <p className="mb-2 block text-sm font-medium text-slate-700">Assign clients</p>
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
                {accessClients.length ? accessClients.map((client) => (
                  <label key={client.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedClientIds.includes(client.id)}
                        onChange={() => toggleClient(client.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{client.name}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        Managed client
                      </span>
                      <ProductAccessBadges
                        productAccess={workspaces.find((workspace) => workspace.id === client.id)?.product_access}
                      />
                    </div>
                  </label>
                )) : (
                  <div className="text-sm text-slate-500">No manageable clients available.</div>
                )}
              </div>
            </div>
            <div>
              <p className="mb-2 block text-sm font-medium text-slate-700">Product access</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={productAccess.ad_server}
                    onChange={() => setProductAccess((current) => ({ ...current, ad_server: !current.ad_server }))}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Ad Server</span>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={productAccess.studio}
                    onChange={() => setProductAccess((current) => ({ ...current, studio: !current.studio }))}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Studio</span>
                </label>
              </div>
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={savingAccess}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
              >
                {savingAccess ? 'Saving…' : 'Grant access'}
              </button>
            </div>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Assigned users</h2>
          <p className="mt-1 text-sm text-slate-500">
            Users only see the clients they are assigned to.
          </p>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-indigo-500" />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {accessUsers.map((user) => (
                <div key={user.id} className="rounded-xl border border-slate-200 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{user.display_name || user.email}</p>
                      <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {user.assignments.map((assignment) => {
                      const key = `${assignment.workspace_id}:${user.id}`;
                      const draft = getAssignmentDraft(assignment, user.id);
                      return (
                        <div key={key} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          <span className="font-medium">{assignment.workspace_name}</span>
                          <ProductAccessBadges productAccess={assignment.product_access} />
                          <select
                            value={draft.role}
                            onChange={(event) => updateAssignmentDraft(assignment, user.id, { role: event.target.value as PlatformRole })}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                          >
                            <option value="ad_ops">Ad Ops</option>
                            <option value="designer">Designer</option>
                            <option value="reviewer">Reviewer</option>
                            <option value="admin">Admin</option>
                          </select>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={draft.productAccess.ad_server}
                              onChange={() => updateAssignmentDraft(assignment, user.id, {
                                productAccess: {
                                  ...draft.productAccess,
                                  ad_server: !draft.productAccess.ad_server,
                                },
                              })}
                            />
                            <span>Ad Server</span>
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={draft.productAccess.studio}
                              onChange={() => updateAssignmentDraft(assignment, user.id, {
                                productAccess: {
                                  ...draft.productAccess,
                                  studio: !draft.productAccess.studio,
                                },
                              })}
                            />
                            <span>Studio</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => void handleUpdateAccess(assignment, user.id)}
                            disabled={updatingAccessKey === key}
                            className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-400"
                          >
                            {updatingAccessKey === key ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemoveAccess(assignment.workspace_id, user.id)}
                            disabled={removingAccessKey === key}
                            className="font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
                          >
                            {removingAccessKey === key ? '...' : 'Remove'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!accessUsers.length && (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                  No users assigned yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
