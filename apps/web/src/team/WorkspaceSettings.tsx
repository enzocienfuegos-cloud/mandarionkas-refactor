import React, { useEffect, useState, FormEvent } from 'react';

type Tab = 'profile' | 'members';

interface Workspace {
  id: string;
  name: string;
  plan: string;
  createdAt: string;
}

interface Member {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
}

const ROLES: Member['role'][] = ['owner', 'admin', 'member', 'viewer'];
const ROLE_LABELS: Record<Member['role'], string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

const roleBadge = (role: Member['role']) => {
  const cls: Record<Member['role'], string> = {
    owner:  'bg-purple-100 text-purple-800',
    admin:  'bg-blue-100 text-blue-800',
    member: 'bg-slate-100 text-slate-700',
    viewer: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
};

export default function WorkspaceSettings() {
  const [tab, setTab] = useState<Tab>('profile');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Profile form
  const [wsName, setWsName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Member['role']>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Role update
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  // Remove member
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/v1/workspace', { credentials: 'include' }).then(r => r.json()),
      fetch('/v1/team', { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([wsData, teamData]) => {
        setWorkspace(wsData);
        setWsName(wsData?.name ?? '');
        setMembers(teamData?.members ?? teamData ?? []);
      })
      .catch(() => setError('Failed to load workspace data.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!wsName.trim()) { setProfileMsg('Name is required.'); return; }
    setSavingProfile(true);
    setProfileMsg('');
    try {
      const res = await fetch('/v1/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: wsName.trim() }),
      });
      if (!res.ok) throw new Error('Save failed');
      setWorkspace(w => w ? { ...w, name: wsName.trim() } : w);
      setProfileMsg('Workspace name updated successfully.');
    } catch {
      setProfileMsg('Failed to save workspace name.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    if (!inviteEmail.trim()) { setInviteError('Email is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      setInviteError('Enter a valid email address.');
      return;
    }

    setInviting(true);
    try {
      const res = await fetch('/v1/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? 'Invite failed');
      }
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}.`);
      setInviteEmail('');
    } catch (e: any) {
      setInviteError(e.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (member: Member, newRole: Member['role']) => {
    setUpdatingRoleId(member.id);
    try {
      const res = await fetch(`/v1/team/${member.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Role update failed');
      setMembers(ms => ms.map(m => m.id === member.id ? { ...m, role: newRole } : m));
    } catch {
      alert('Failed to update role.');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleRemoveMember = async (member: Member) => {
    if (!window.confirm(`Remove ${member.email} from the workspace?`)) return;
    setRemovingId(member.id);
    try {
      const res = await fetch(`/v1/team/${member.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Remove failed');
      setMembers(ms => ms.filter(m => m.id !== member.id));
    } catch {
      alert('Failed to remove member.');
    } finally {
      setRemovingId(null);
    }
  };

  const tabClass = (t: Tab) =>
    `px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-indigo-600 text-indigo-600'
        : 'border-transparent text-slate-500 hover:text-slate-700'
    }`;

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
        <p className="font-medium">Error loading settings</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Workspace Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <button className={tabClass('profile')} onClick={() => setTab('profile')}>Profile</button>
        <button className={tabClass('members')} onClick={() => setTab('members')}>
          Members ({members.length})
        </button>
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Workspace Profile</h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Workspace Name</label>
                <input
                  type="text"
                  value={wsName}
                  onChange={e => setWsName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {profileMsg && (
                <p className={`text-sm ${profileMsg.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                  {profileMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Plan & Billing</h2>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-slate-500">Current Plan</p>
                <p className="text-lg font-bold text-indigo-700 capitalize">{workspace?.plan ?? 'Free'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Workspace ID</p>
                <code className="text-xs font-mono text-slate-600">{workspace?.id}</code>
              </div>
              <div>
                <p className="text-sm text-slate-500">Created</p>
                <p className="text-sm text-slate-700">
                  {workspace?.createdAt ? new Date(workspace.createdAt).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div className="space-y-6">
          {/* Invite form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Invite Member</h2>
            <form onSubmit={handleInvite} className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-48">
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="colleague@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as Member['role'])}
                  className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {ROLES.filter(r => r !== 'owner').map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {inviting ? 'Inviting...' : 'Send Invite'}
              </button>
            </form>
            {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
            {inviteSuccess && <p className="mt-2 text-sm text-green-600">{inviteSuccess}</p>}
          </div>

          {/* Members table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Team Members ({members.length})</h2>
            </div>
            {members.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">No members found</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    {['Member', 'Email', 'Role', 'Joined', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-semibold">
                            {m.firstName?.[0]}{m.lastName?.[0]}
                          </div>
                          <span className="text-sm font-medium text-slate-800">
                            {m.firstName} {m.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{m.email}</td>
                      <td className="px-4 py-3">
                        {m.role === 'owner' ? (
                          roleBadge(m.role)
                        ) : (
                          <select
                            value={m.role}
                            onChange={e => handleRoleChange(m, e.target.value as Member['role'])}
                            disabled={updatingRoleId === m.id}
                            className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            {ROLES.filter(r => r !== 'owner').map(r => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {m.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveMember(m)}
                            disabled={removingId === m.id}
                            className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {removingId === m.id ? '...' : 'Remove'}
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
