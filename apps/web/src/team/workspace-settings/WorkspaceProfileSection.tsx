import React, { useState, type FormEvent } from 'react';
import { Button, Input, Panel } from '../../system';
import { type Workspace } from './types';

export function WorkspaceProfileSection({
  workspace,
  onSaved,
}: {
  workspace: Workspace | null;
  onSaved: (name: string) => Promise<void>;
}) {
  const [wsName, setWsName] = useState(workspace?.name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!wsName.trim()) {
      setProfileMsg('Name is required.');
      return;
    }
    setSavingProfile(true);
    setProfileMsg('');
    try {
      await onSaved(wsName.trim());
      setProfileMsg('Workspace name updated successfully.');
    } catch {
      setProfileMsg('Failed to save workspace name.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6">
      <Panel className="p-6">
        <h2 className="mb-4 text-base font-semibold text-text-primary">Workspace Profile</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Workspace Name</label>
            <Input
              type="text"
              value={wsName}
              onChange={(event) => setWsName(event.target.value)}
            />
          </div>
          {profileMsg && (
            <p className={`text-sm ${profileMsg.includes('Failed') ? 'text-[color:var(--dusk-status-critical-fg)]' : 'text-[color:var(--dusk-status-success-fg)]'}`}>
              {profileMsg}
            </p>
          )}
          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Panel>

      <Panel className="p-6">
        <h2 className="mb-4 text-base font-semibold text-text-primary">Plan & Billing</h2>
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
      </Panel>
    </div>
  );
}
