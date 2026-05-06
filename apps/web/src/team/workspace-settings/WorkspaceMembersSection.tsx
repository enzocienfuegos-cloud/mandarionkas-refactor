import React, { useState, type FormEvent } from 'react';
import { getPlatformRoleLabel, type PlatformRole } from '../../shared/roles';
import { Button, EmptyState, Input, Panel, Select } from '../../system';
import {
  ProductAccessBadge,
  PLATFORM_ROLES,
  PLATFORM_ROLE_PRODUCT_ACCESS,
  roleBadge,
  type Member,
} from './types';

export function WorkspaceMembersSection({
  members,
  updatingRoleId,
  removingId,
  onInvited,
  onRoleChange,
  onRemoveMember,
}: {
  members: Member[];
  updatingRoleId: string | null;
  removingId: string | null;
  onInvited: (email: string, role: PlatformRole) => Promise<void>;
  onRoleChange: (member: Member, nextRole: PlatformRole) => Promise<void>;
  onRemoveMember: (member: Member) => Promise<void>;
}) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<PlatformRole>('designer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

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
      await onInvited(inviteEmail.trim(), inviteRole);
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}.`);
      setInviteEmail('');
    } catch (caught: any) {
      setInviteError(caught.message ?? 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Panel className="p-6">
        <h2 className="mb-4 text-base font-semibold text-text-primary">Invite Member</h2>
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className="mb-1 block text-sm font-medium text-text-secondary">Email</label>
            <Input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="colleague@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Platform Role</label>
            <Select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as PlatformRole)}
              options={PLATFORM_ROLES.map((role) => ({ value: role, label: getPlatformRoleLabel(role) }))}
            />
          </div>
          <Button type="submit" disabled={inviting}>
            {inviting ? 'Inviting...' : 'Send Invite'}
          </Button>
        </form>
        {inviteError && <p className="mt-2 text-sm text-[color:var(--dusk-status-critical-fg)]">{inviteError}</p>}
        {inviteSuccess && <p className="mt-2 text-sm text-[color:var(--dusk-status-success-fg)]">{inviteSuccess}</p>}
      </Panel>

      <Panel className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-5 py-3">
          <h2 className="text-sm font-semibold text-text-secondary">Team Members ({members.length})</h2>
        </div>
        {members.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No members found"
              description="Invite your first collaborator to this workspace."
            />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-100">
            <caption className="sr-only">Workspace team members and permissions</caption>
            <thead className="bg-[color:var(--dusk-surface-muted)]">
              <tr>
                {['Member', 'Email', 'Role', 'Product Access', 'Joined', 'Actions'].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => (
                <tr key={member.id} className="transition-colors hover:bg-[color:var(--dusk-surface-muted)]">
                  <th scope="row" className="px-4 py-3 text-left">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-text-brand">
                        {member.firstName?.[0]}{member.lastName?.[0]}
                      </div>
                      <span className="text-sm font-medium text-text-primary">
                        {member.firstName} {member.lastName}
                      </span>
                    </div>
                  </th>
                  <td className="px-4 py-3 text-sm text-text-muted">{member.email}</td>
                  <td className="px-4 py-3">
                    {member.role === 'owner' ? (
                      roleBadge('owner')
                    ) : (
                      <Select
                        value={member.platformRole}
                        onChange={(event) => void onRoleChange(member, event.target.value as PlatformRole)}
                        disabled={updatingRoleId === member.id}
                        options={PLATFORM_ROLES.map((role) => ({ value: role, label: getPlatformRoleLabel(role) }))}
                      />
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
                      <Button
                        onClick={() => void onRemoveMember(member)}
                        disabled={removingId === member.id}
                        variant="ghost"
                        size="sm"
                      >
                        {removingId === member.id ? '...' : 'Remove'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
