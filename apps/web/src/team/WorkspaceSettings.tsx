import React, { useEffect, useState, FormEvent } from 'react';
import { getPlatformRoleLabel, type PlatformRole } from '../shared/roles';
import { useConfirm, useToast } from '../system';

type Tab = 'profile' | 'members';

interface Workspace {
  id: string;
  name: string;
  plan: string;
  createdAt: string;
}

interface ProductAccess {
  ad_server: boolean;
  studio: boolean;
}

interface Member {
  id: string;
  memberId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  platformRole: PlatformRole;
  productAccess: ProductAccess;
  joinedAt: string;
}

const PLATFORM_ROLES: PlatformRole[] = ['admin', 'designer', 'ad_ops', 'reviewer'];

const PLATFORM_ROLE_PRODUCT_ACCESS: Record<PlatformRole, ProductAccess> = {
  admin: { ad_server: true, studio: true },
  designer: { ad_server: false, studio: true },
  ad_ops: { ad_server: true, studio: false },
  reviewer: { ad_server: true, studio: true },
};

const ROLE_BADGE_CLASS: Record<PlatformRole | 'owner', string> = {
  owner: 'bg-violet-100 text-violet-800',
  admin: 'bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]',
  designer: 'bg-emerald-100 text-emerald-800',
  ad_ops: 'bg-fuchsia-100 text-fuchsia-800',
  reviewer: 'bg-[color:var(--dusk-surface-muted)] text-text-muted',
};

function roleBadge(role: PlatformRole | 'owner') {
  const label = role === 'owner' ? 'Owner' : getPlatformRoleLabel(role);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE_CLASS[role]}`}>
      {label}
    </span>
  );
}

function productAccessLabel(productAccess: ProductAccess) {
  if (productAccess.ad_server && productAccess.studio) return 'Ad Server + Studio';
  if (productAccess.ad_server) return 'Ad Server only';
  if (productAccess.studio) return 'Studio only';
  return 'No product access';
}

function normalizeWorkspace(payload: any): Workspace | null {
  const source = payload?.workspace ?? payload;
  if (!source?.id) return null;
  return {
    id: String(source.id),
    name: String(source.name ?? 'Workspace'),
    plan: String(source.plan ?? 'free'),
    createdAt: String(source.createdAt ?? source.created_at ?? ''),
  };
}

function getWorkspaceRoleForPlatformRole(role: PlatformRole): Member['role'] {
  if (role === 'admin') return 'admin';
  if (role === 'reviewer') return 'viewer';
  return 'member';
}

function normalizeProductAccess(raw: any, fallbackRole: PlatformRole): ProductAccess {
  if (raw && typeof raw === 'object') {
    return {
      ad_server: raw.ad_server !== false,
      studio: raw.studio !== false,
    };
  }
  return PLATFORM_ROLE_PRODUCT_ACCESS[fallbackRole];
}

function derivePlatformRole(raw: any, workspaceRole: Member['role'], productAccess: ProductAccess): PlatformRole {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'admin' || value === 'designer' || value === 'ad_ops' || value === 'reviewer') {
    return value as PlatformRole;
  }
  if (workspaceRole === 'owner' || workspaceRole === 'admin') return 'admin';
  if (workspaceRole === 'viewer') return 'reviewer';
  if (productAccess.ad_server && !productAccess.studio) return 'ad_ops';
  return 'designer';
}

function normalizeMember(raw: any): Member {
  const displayName = String(raw?.display_name ?? raw?.displayName ?? raw?.email ?? '').trim();
  const [firstName = '', ...rest] = displayName.split(/\s+/).filter(Boolean);
  const role = (['owner', 'admin', 'member', 'viewer'].includes(raw?.role) ? raw.role : 'member') as Member['role'];
  const productAccess = normalizeProductAccess(raw?.productAccess ?? raw?.product_access, role === 'owner' ? 'admin' : 'designer');
  const platformRole = derivePlatformRole(raw?.platformRole ?? raw?.platform_role, role, productAccess);
  return {
    id: String(raw?.user_id ?? raw?.userId ?? raw?.id ?? ''),
    memberId: String(raw?.memberId ?? raw?.id ?? ''),
    email: String(raw?.email ?? ''),
    firstName,
    lastName: rest.join(' '),
    role,
    platformRole,
    productAccess,
    joinedAt: String(raw?.joined_at ?? raw?.joinedAt ?? raw?.invited_at ?? raw?.invitedAt ?? ''),
  };
}

function ProductAccessBadge({ productAccess }: { productAccess: ProductAccess }) {
  const cls = productAccess.ad_server && productAccess.studio
    ? 'bg-emerald-50 text-emerald-700'
    : productAccess.ad_server
      ? 'bg-fuchsia-50 text-fuchsia-700'
      : 'bg-amber-50 text-[color:var(--dusk-status-warning-fg)]';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {productAccessLabel(productAccess)}
    </span>
  );
}

export default function WorkspaceSettings() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('profile');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [wsName, setWsName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<PlatformRole>('designer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function reloadMembers() {
    const teamData = await fetch('/v1/team', { credentials: 'include' }).then((response) => response.json());
    setMembers((teamData?.members ?? teamData ?? []).map(normalizeMember));
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/v1/workspace', { credentials: 'include' }).then((response) => response.json()),
      fetch('/v1/team', { credentials: 'include' }).then((response) => response.json()),
    ])
      .then(([wsData, teamData]) => {
        const nextWorkspace = normalizeWorkspace(wsData);
        setWorkspace(nextWorkspace);
        setWsName(nextWorkspace?.name ?? '');
        setMembers((teamData?.members ?? teamData ?? []).map(normalizeMember));
      })
      .catch(() => setError('Failed to load workspace settings.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!wsName.trim()) {
      setProfileMsg('Name is required.');
      return;
    }
    setSavingProfile(true);
    setProfileMsg('');
    try {
      const response = await fetch('/v1/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: wsName.trim() }),
      });
      if (!response.ok) throw new Error('Save failed');
      setWorkspace((current) => (current ? { ...current, name: wsName.trim() } : current));
      setProfileMsg('Workspace name updated successfully.');
    } catch {
      setProfileMsg('Failed to save workspace name.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    if (!inviteEmail.trim()) {
      setInviteError('Email is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      setInviteError('Enter a valid email address.');
      return;
    }

    setInviting(true);
    try {
      const response = await fetch('/v1/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          productAccess: PLATFORM_ROLE_PRODUCT_ACCESS[inviteRole],
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? 'Invite failed');
      }
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}.`);
      setInviteEmail('');
      await reloadMembers();
    } catch (caught: any) {
      setInviteError(caught.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (member: Member, nextRole: PlatformRole) => {
    setUpdatingRoleId(member.id);
    try {
      const response = await fetch(`/v1/team/${member.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          role: nextRole,
          productAccess: PLATFORM_ROLE_PRODUCT_ACCESS[nextRole],
        }),
      });
      if (!response.ok) throw new Error('Role update failed');
      setMembers((current) => current.map((entry) => (
        entry.id === member.id
          ? {
            ...entry,
            role: getWorkspaceRoleForPlatformRole(nextRole),
            platformRole: nextRole,
            productAccess: PLATFORM_ROLE_PRODUCT_ACCESS[nextRole],
          }
          : entry
      )));
      toast({ tone: 'success', title: `Role updated for ${member.email}` });
    } catch {
      toast({ tone: 'critical', title: 'Failed to update role.' });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleRemoveMember = async (member: Member) => {
    const confirmed = await confirm({
      title: `Remove ${member.email} from the workspace?`,
      description: 'They will lose access to this workspace immediately.',
      tone: 'danger',
      confirmLabel: 'Remove',
      requireTypeToConfirm: member.email,
    });
    if (!confirmed) return;
    setRemovingId(member.id);
    try {
      const response = await fetch(`/v1/team/${member.id}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) throw new Error('Remove failed');
      setMembers((current) => current.filter((entry) => entry.id !== member.id));
      toast({ tone: 'warning', title: `${member.email} removed from workspace` });
    } catch {
      toast({ tone: 'critical', title: 'Failed to remove member.' });
    } finally {
      setRemovingId(null);
    }
  };

  const tabClass = (nextTab: Tab) =>
    `px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
      tab === nextTab
        ? 'border-brand-500 text-text-brand'
        : 'border-transparent text-text-muted hover:text-text-secondary'
    }`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[color:var(--dusk-status-critical-bg)] border border-[color:var(--dusk-status-critical-border)] rounded-lg p-4 text-[color:var(--dusk-status-critical-fg)]">
        <p className="font-medium">Error loading workspace settings</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Workspace Settings</h1>
      </div>

      <div className="flex border-b border-border-default mb-6">
        <button className={tabClass('profile')} onClick={() => setTab('profile')}>Profile</button>
        <button className={tabClass('members')} onClick={() => setTab('members')}>
          Members ({members.length})
        </button>
      </div>

      {tab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-surface-1 rounded-xl border border-border-default p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4">Workspace Profile</h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Workspace Name</label>
                <input
                  type="text"
                  value={wsName}
                  onChange={(event) => setWsName(event.target.value)}
                  className="w-full px-3 py-2.5 border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              {profileMsg && (
                <p className={`text-sm ${profileMsg.includes('Failed') ? 'text-[color:var(--dusk-status-critical-fg)]' : 'text-[color:var(--dusk-status-success-fg)]'}`}>
                  {profileMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>

          <div className="bg-surface-1 rounded-xl border border-border-default p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4">Plan & Billing</h2>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-text-muted">Current Plan</p>
                <p className="text-lg font-bold text-text-brand capitalize">{workspace?.plan ?? 'Free'}</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">Workspace ID</p>
                <code className="text-xs font-mono text-text-muted">{workspace?.id}</code>
              </div>
              <div>
                <p className="text-sm text-text-muted">Created</p>
                <p className="text-sm text-text-secondary">
                  {workspace?.createdAt ? new Date(workspace.createdAt).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-6">
          <div className="bg-surface-1 rounded-xl border border-border-default p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4">Invite Member</h2>
            <form onSubmit={handleInvite} className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-48">
                <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  className="w-full px-3 py-2.5 border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="colleague@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Platform Role</label>
                <select
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as PlatformRole)}
                  className="px-3 py-2.5 border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {PLATFORM_ROLES.map((role) => (
                    <option key={role} value={role}>{getPlatformRoleLabel(role)}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting}
                className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {inviting ? 'Inviting...' : 'Send Invite'}
              </button>
            </form>
            {inviteError && <p className="mt-2 text-sm text-[color:var(--dusk-status-critical-fg)]">{inviteError}</p>}
            {inviteSuccess && <p className="mt-2 text-sm text-[color:var(--dusk-status-success-fg)]">{inviteSuccess}</p>}
          </div>

          <div className="bg-surface-1 rounded-xl border border-border-default overflow-hidden">
            <div className="px-5 py-3 border-b border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)]">
              <h2 className="text-sm font-semibold text-text-secondary">Team Members ({members.length})</h2>
            </div>
            {members.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-[color:var(--dusk-text-soft)]">No members found</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-[color:var(--dusk-surface-muted)]">
                  <tr>
                    {['Member', 'Email', 'Role', 'Product Access', 'Joined', 'Actions'].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-[color:var(--dusk-surface-muted)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-text-brand text-xs font-semibold">
                            {member.firstName?.[0]}{member.lastName?.[0]}
                          </div>
                          <span className="text-sm font-medium text-text-primary">
                            {member.firstName} {member.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted">{member.email}</td>
                      <td className="px-4 py-3">
                        {member.role === 'owner' ? (
                          roleBadge('owner')
                        ) : (
                          <select
                            value={member.platformRole}
                            onChange={(event) => handleRoleChange(member, event.target.value as PlatformRole)}
                            disabled={updatingRoleId === member.id}
                            className="px-2 py-1 border border-border-default rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                          >
                            {PLATFORM_ROLES.map((role) => (
                              <option key={role} value={role}>{getPlatformRoleLabel(role)}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ProductAccessBadge productAccess={member.productAccess} />
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'Pending'}
                      </td>
                      <td className="px-4 py-3">
                        {member.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveMember(member)}
                            disabled={removingId === member.id}
                            className="text-xs text-[color:var(--dusk-status-critical-fg)] hover:text-[color:var(--dusk-status-critical-fg)] font-medium px-2 py-1 rounded hover:bg-[color:var(--dusk-status-critical-bg)] transition-colors disabled:opacity-50"
                          >
                            {removingId === member.id ? '...' : 'Remove'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
