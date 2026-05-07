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
import { Badge, Button, CenteredSpinner, EmptyState, Input, Kicker, Panel, Select } from '../system';

function ProductAccessBadges({ productAccess }: { productAccess?: { ad_server: boolean; studio: boolean } | null }) {
  const access = productAccess ?? { ad_server: true, studio: true };
  return (
    <div className="flex flex-wrap gap-1.5">
      {access.ad_server ? (
        <Badge tone="brand" size="sm">Ad Server</Badge>
      ) : null}
      {access.studio ? (
        <Badge tone="success" size="sm">Studio</Badge>
      ) : null}
      {!access.ad_server && !access.studio ? (
        <Badge tone="neutral" size="sm">No product access</Badge>
      ) : null}
    </div>
  );
}

type CreateClientForm = {
  name: string;
  website: string;
};

type AccessGrantForm = {
  userEmail: string;
  userRole: PlatformRole;
  selectedClientIds: string[];
  productAccess: { ad_server: boolean; studio: boolean };
};

export default function ClientManager() {
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [accessClients, setAccessClients] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [accessUsers, setAccessUsers] = useState<ClientAccessUser[]>([]);
  const [createForm, setCreateForm] = useState<CreateClientForm>({ name: '', website: '' });
  const [accessForm, setAccessForm] = useState<AccessGrantForm>({
    userEmail: '',
    userRole: 'ad_ops',
    selectedClientIds: [],
    productAccess: { ad_server: true, studio: true },
  });
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
      setError(loadError.message ?? 'We could not load client workspaces or assignments for this workspace.');
    } finally {
      setLoading(false);
    }
  };

  const toggleClient = (workspaceId: string) => {
    setAccessForm((current) => ({
      ...current,
      selectedClientIds: current.selectedClientIds.includes(workspaceId)
        ? current.selectedClientIds.filter((id) => id !== workspaceId)
        : [...current.selectedClientIds, workspaceId],
    }));
  };

  const handleGrantAccess = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessForm.userEmail.trim()) {
      setError('User email is required.');
      return;
    }
    if (!accessForm.selectedClientIds.length) {
      setError('Select at least one client for the user.');
      return;
    }
    if (!accessForm.productAccess.ad_server && !accessForm.productAccess.studio) {
      setError('Select at least one product access.');
      return;
    }

    setSavingAccess(true);
    setError('');
    try {
      await grantClientAccess({
        email: accessForm.userEmail.trim(),
        role: accessForm.userRole,
        workspaceIds: accessForm.selectedClientIds,
        productAccess: accessForm.productAccess,
      });
      setAccessForm({
        userEmail: '',
        userRole: 'ad_ops',
        selectedClientIds: [],
        productAccess: { ad_server: true, studio: true },
      });
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
    if (!createForm.name.trim()) {
      setError('Client name is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createClientWorkspace({
        name: createForm.name.trim(),
        website: createForm.website.trim(),
      });
      setCreateForm({ name: '', website: '' });
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
        <Kicker>Clients</Kicker>
        <h1 className="mt-3 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">Client Setup</h1>
        <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
          Manage client workspaces separately from trafficking screens. Only the client name is required.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-sm text-[color:var(--dusk-status-critical-fg)]">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Panel as="form" onSubmit={handleSubmit} className="rounded-2xl">
          <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">Add client</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-secondary)]">
                Client name <span className="text-[color:var(--dusk-status-critical-fg)]">*</span>
              </label>
              <Input
                value={createForm.name}
                onChange={event => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Banco Agricola"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-secondary)]">Website</label>
              <Input
                value={createForm.website}
                onChange={event => setCreateForm((current) => ({ ...current, website: event.target.value }))}
                placeholder="https://example.com"
              />
            </div>
            <div className="pt-2">
              <Button type="submit" loading={saving}>{saving ? 'Creating…' : 'Create client'}</Button>
            </div>
          </div>
        </Panel>

        <Panel className="rounded-2xl">
          <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">Available clients</h2>
          {loading ? (
            <CenteredSpinner label="Loading clients…" />
          ) : (
            <div className="mt-4 space-y-3">
                {workspaces.map(workspace => (
                  <div key={workspace.id} className="rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-1 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-[color:var(--dusk-text-primary)]">{workspace.name}</p>
                          <ProductAccessBadges productAccess={workspace.product_access} />
                        </div>
                        <p className="mt-1 text-xs text-[color:var(--dusk-text-muted)]">
                          {workspace.id === activeWorkspaceId
                            ? `Active client · ${getWorkspaceProductLabel(workspace)}`
                            : `Available for trafficking filters · ${getWorkspaceProductLabel(workspace)}`}
                        </p>
                      </div>
                      {workspace.id === activeWorkspaceId && (
                      <Badge tone="brand">Active</Badge>
                    )}
                  </div>
                </div>
              ))}
              {!workspaces.length && (
                <EmptyState title="No clients yet" description="Create your first client workspace to start trafficking against it." />
              )}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
        <Panel as="form" onSubmit={handleGrantAccess} className="rounded-2xl">
          <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">User access</h2>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            Create a user by email and assign one or more clients. With those assignments they can view everything related to those clients.
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-secondary)]">User email</label>
              <Input
                value={accessForm.userEmail}
                onChange={(event) => setAccessForm((current) => ({ ...current, userEmail: event.target.value }))}
                placeholder="trafficker@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-secondary)]">Role across selected clients</label>
              <Select
                value={accessForm.userRole}
                onChange={(event) => setAccessForm((current) => ({ ...current, userRole: event.target.value as PlatformRole }))}
                options={[
                  { value: 'ad_ops', label: 'Ad Ops' },
                  { value: 'designer', label: 'Designer' },
                  { value: 'reviewer', label: 'Reviewer' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 block text-sm font-medium text-[color:var(--dusk-text-secondary)]">Assign clients</p>
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-[color:var(--dusk-border-default)] p-3">
                {accessClients.length ? accessClients.map((client) => (
                  <label key={client.id} className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2 text-sm text-[color:var(--dusk-text-secondary)]">
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={accessForm.selectedClientIds.includes(client.id)}
                        onChange={() => toggleClient(client.id)}
                        className="h-4 w-4 rounded border-[color:var(--dusk-border-default)] text-brand-500 focus:ring-brand-500"
                      />
                      <span>{client.name}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral" size="sm">Managed client</Badge>
                      <ProductAccessBadges
                        productAccess={workspaces.find((workspace) => workspace.id === client.id)?.product_access}
                      />
                    </div>
                  </label>
                )) : (
                  <div className="text-sm text-[color:var(--dusk-text-muted)]">No manageable clients available.</div>
                )}
              </div>
            </div>
            <div>
              <p className="mb-2 block text-sm font-medium text-[color:var(--dusk-text-secondary)]">Product access</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border border-[color:var(--dusk-border-default)] px-3 py-2 text-sm text-[color:var(--dusk-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={accessForm.productAccess.ad_server}
                    onChange={() => setAccessForm((current) => ({
                      ...current,
                      productAccess: { ...current.productAccess, ad_server: !current.productAccess.ad_server },
                    }))}
                    className="h-4 w-4 rounded border-[color:var(--dusk-border-default)] text-brand-500 focus:ring-brand-500"
                  />
                  <span>Ad Server</span>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-[color:var(--dusk-border-default)] px-3 py-2 text-sm text-[color:var(--dusk-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={accessForm.productAccess.studio}
                    onChange={() => setAccessForm((current) => ({
                      ...current,
                      productAccess: { ...current.productAccess, studio: !current.productAccess.studio },
                    }))}
                    className="h-4 w-4 rounded border-[color:var(--dusk-border-default)] text-brand-500 focus:ring-brand-500"
                  />
                  <span>Studio</span>
                </label>
              </div>
            </div>
            <div className="pt-2">
              <Button type="submit" loading={savingAccess}>{savingAccess ? 'Saving…' : 'Grant access'}</Button>
            </div>
          </div>
        </Panel>

        <Panel className="rounded-2xl">
          <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">Assigned users</h2>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            Users only see the clients they are assigned to.
          </p>
          {loading ? (
            <CenteredSpinner label="Loading assigned users…" />
          ) : (
            <div className="mt-4 space-y-3">
              {accessUsers.map((user) => (
                <div key={user.id} className="rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-1 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[color:var(--dusk-text-primary)]">{user.display_name || user.email}</p>
                      <p className="mt-1 text-xs text-[color:var(--dusk-text-muted)]">{user.email}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {user.assignments.map((assignment) => {
                      const key = `${assignment.workspace_id}:${user.id}`;
                      const draft = getAssignmentDraft(assignment, user.id);
                      return (
                        <div key={key} className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-muted px-3 py-2 text-xs text-[color:var(--dusk-text-secondary)]">
                          <span className="font-medium">{assignment.workspace_name}</span>
                          <ProductAccessBadges productAccess={assignment.product_access} />
                          <Select
                            value={draft.role}
                            onChange={(event) => updateAssignmentDraft(assignment, user.id, { role: event.target.value as PlatformRole })}
                            options={[
                              { value: 'ad_ops', label: 'Ad Ops' },
                              { value: 'designer', label: 'Designer' },
                              { value: 'reviewer', label: 'Reviewer' },
                              { value: 'admin', label: 'Admin' },
                            ]}
                          />
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
                          <Button
                            onClick={() => void handleUpdateAccess(assignment, user.id)}
                            disabled={updatingAccessKey === key}
                            size="sm"
                            variant="primary"
                          >
                            {updatingAccessKey === key ? 'Saving…' : 'Save'}
                          </Button>
                          <Button
                            onClick={() => void handleRemoveAccess(assignment.workspace_id, user.id)}
                            disabled={removingAccessKey === key}
                            size="sm"
                            variant="ghost"
                          >
                            {removingAccessKey === key ? '...' : 'Remove'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!accessUsers.length && (
                <EmptyState title="No users assigned yet" description="Grant client access to a user to start routing workspaces and permissions." />
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
