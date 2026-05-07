import React, { useEffect, useState } from 'react';
import { type PlatformRole } from '../shared/roles';
import { CenteredSpinner, Panel, Button, useConfirm, useToast } from '../system';
import { WorkspaceMembersSection } from './workspace-settings/WorkspaceMembersSection';
import { WorkspaceProfileSection } from './workspace-settings/WorkspaceProfileSection';
import {
  getWorkspaceRoleForPlatformRole,
  normalizeMember,
  normalizeWorkspace,
  PLATFORM_ROLE_PRODUCT_ACCESS,
  type Member,
  type Tab,
  type Workspace,
} from './workspace-settings/types';

export default function WorkspaceSettings() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('profile');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
        setMembers((teamData?.members ?? teamData ?? []).map(normalizeMember));
      })
      .catch(() => setError('Failed to load workspace settings.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async (name: string) => {
    const response = await fetch('/v1/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Save failed');
    setWorkspace((current) => (current ? { ...current, name } : current));
  };

  const handleInvite = async (email: string, inviteRole: PlatformRole) => {
    const response = await fetch('/v1/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email,
        role: inviteRole,
        productAccess: PLATFORM_ROLE_PRODUCT_ACCESS[inviteRole],
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.message ?? 'Invite failed');
    }
    await reloadMembers();
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
    return <CenteredSpinner label="Loading workspace settings…" />;
  }

  if (error) {
    return (
      <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-[color:var(--dusk-status-critical-fg)]">
        <p className="font-medium">Error loading workspace settings</p>
        <p className="text-sm mt-1">{error}</p>
      </Panel>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Workspace Settings</h1>
      </div>

      <div className="flex border-b border-border-default mb-6">
        <Button variant="ghost" className={tabClass('profile')} onClick={() => setTab('profile')}>Profile</Button>
        <Button variant="ghost" className={tabClass('members')} onClick={() => setTab('members')}>
          Members ({members.length})
        </Button>
      </div>

      {tab === 'profile' && (
        <WorkspaceProfileSection workspace={workspace} onSaved={handleSaveProfile} />
      )}

      {tab === 'members' && (
        <WorkspaceMembersSection
          members={members}
          updatingRoleId={updatingRoleId}
          removingId={removingId}
          onInvited={handleInvite}
          onRoleChange={handleRoleChange}
          onRemoveMember={handleRemoveMember}
        />
      )}
    </div>
  );
}
