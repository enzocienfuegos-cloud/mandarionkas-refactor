import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  Building2,
  Shield,
  Bell,
  Webhook,
  KeyRound,
  Trash2,
} from '../system/icons';
import {
  Panel,
  PanelHeader,
  Button,
  Input,
  Select,
  FormField,
  Kicker,
  Badge,
  Tabs,
  TabsList,
  Tab,
  TabPanel,
  CenteredSpinner,
  useToast,
  useConfirm,
} from '../system';

type Section = 'profile' | 'workspace' | 'security' | 'notifications' | 'webhooks' | 'api-keys';

interface UserProfile {
  name: string;
  email: string;
  timezone: string;
  locale: string;
}

interface WorkspaceSettings {
  name: string;
  brandColor: string;
  defaultDsp: string;
  defaultCurrency: string;
  pacingThreshold: number;
  discrepancyThreshold: number;
}

interface NotificationPrefs {
  emailPacing: boolean;
  emailDiscrepancies: boolean;
  emailApprovals: boolean;
  slackWebhookUrl: string;
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * Settings — refactored to the design system (S56).
 *
 * Section-aware via URL: /settings/profile, /settings/workspace, etc.
 * Each section is its own form with sticky save bar (when dirty).
 */
export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const confirm   = useConfirm();

  const section = (location.pathname.split('/settings/')[1] || 'profile').split('/')[0] as Section;

  const handleTabChange = (next: string) => navigate(`/settings/${next}`);

  return (
    <div className="space-y-5 max-w-content mx-auto">
      <header>
        <Kicker>Settings</Kicker>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
          Workspace settings
        </h1>
        <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
          Configure your account, workspace defaults and integrations.
        </p>
      </header>

      <Tabs value={section} onValueChange={handleTabChange}>
        <TabsList aria-label="Settings sections">
          <Tab value="profile"       leadingIcon={<User className="h-4 w-4" />}>Profile</Tab>
          <Tab value="workspace"     leadingIcon={<Building2 className="h-4 w-4" />}>Workspace</Tab>
          <Tab value="security"      leadingIcon={<Shield className="h-4 w-4" />}>Security</Tab>
          <Tab value="notifications" leadingIcon={<Bell className="h-4 w-4" />}>Notifications</Tab>
          <Tab value="webhooks"      leadingIcon={<Webhook className="h-4 w-4" />}>Webhooks</Tab>
          <Tab value="api-keys"      leadingIcon={<KeyRound className="h-4 w-4" />}>API keys</Tab>
        </TabsList>

        <TabPanel value="profile">      <ProfileSection /></TabPanel>
        <TabPanel value="workspace">    <WorkspaceSection /></TabPanel>
        <TabPanel value="security">     <SecuritySection /></TabPanel>
        <TabPanel value="notifications"><NotificationsSection /></TabPanel>
        <TabPanel value="webhooks">     <WebhooksSection /></TabPanel>
        <TabPanel value="api-keys">     <ApiKeysSection /></TabPanel>
      </Tabs>
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────

function ProfileSection() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    fetch('/v1/me/profile', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setProfile(data?.profile ?? data))
      .catch(() => toast({ tone: 'critical', title: 'Could not load profile' }));
  }, [toast]);

  if (!profile) return <CenteredSpinner label="Loading profile…" />;

  const set = (field: keyof UserProfile) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setProfile((current) => current ? { ...current, [field]: event.target.value } : current);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/v1/me/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error('save failed');
      toast({ tone: 'success', title: 'Profile updated' });
    } catch {
      toast({ tone: 'critical', title: 'Could not save profile' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel padding="lg">
      <PanelHeader title="Profile" subtitle="Personal information attached to your account" />
      <div className="space-y-5 max-w-2xl">
        <FormField label="Full name" required>
          <Input value={profile.name} onChange={set('name')} />
        </FormField>
        <FormField label="Email" helper="Used for notifications and login">
          <Input type="email" value={profile.email} onChange={set('email')} />
        </FormField>
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Timezone">
            <Select
              value={profile.timezone}
              onChange={set('timezone')}
              options={[
                { value: 'America/El_Salvador', label: 'Central America (San Salvador)' },
                { value: 'America/New_York',    label: 'Eastern (New York)' },
                { value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
                { value: 'Europe/London',       label: 'UK (London)' },
                { value: 'UTC',                 label: 'UTC' },
              ]}
            />
          </FormField>
          <FormField label="Locale">
            <Select
              value={profile.locale}
              onChange={set('locale')}
              options={[
                { value: 'en-US', label: 'English (US)' },
                { value: 'es-SV', label: 'Español (El Salvador)' },
                { value: 'es-MX', label: 'Español (México)' },
              ]}
            />
          </FormField>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" loading={saving} onClick={handleSave}>Save changes</Button>
        </div>
      </div>
    </Panel>
  );
}

// ─── Workspace ────────────────────────────────────────────────────────────

function WorkspaceSection() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/v1/workspace/settings', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setSettings(data?.settings ?? data))
      .catch(() => toast({ tone: 'critical', title: 'Could not load workspace' }));
  }, [toast]);

  if (!settings) return <CenteredSpinner label="Loading workspace…" />;

  const set = <K extends keyof WorkspaceSettings>(field: K) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setSettings((current) => current
        ? { ...current, [field]: typeof current[field] === 'number' ? Number(event.target.value) : event.target.value }
        : current);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/v1/workspace/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('save failed');
      toast({ tone: 'success', title: 'Workspace updated' });
    } catch {
      toast({ tone: 'critical', title: 'Could not save workspace' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel padding="lg">
        <PanelHeader title="General" subtitle="Identifies the workspace across the product" />
        <div className="space-y-5 max-w-2xl">
          <FormField label="Workspace name" required>
            <Input value={settings.name} onChange={set('name')} />
          </FormField>
        </div>
      </Panel>

      <Panel padding="lg">
        <PanelHeader title="Defaults" subtitle="Pre-selected when creating new campaigns" />
        <div className="grid gap-5 md:grid-cols-2 max-w-2xl">
          <FormField label="Default DSP">
            <Select
              value={settings.defaultDsp}
              onChange={set('defaultDsp')}
              options={[
                { value: 'criteo',   label: 'Criteo' },
                { value: 'teads',    label: 'Teads' },
                { value: 'basis',    label: 'Basis DSP' },
                { value: 'adform',   label: 'Adform' },
                { value: 'cm360',    label: 'CM360' },
              ]}
            />
          </FormField>
          <FormField label="Default currency">
            <Select
              value={settings.defaultCurrency}
              onChange={set('defaultCurrency')}
              options={[
                { value: 'USD', label: 'USD — US Dollar' },
                { value: 'EUR', label: 'EUR — Euro' },
                { value: 'MXN', label: 'MXN — Mexican Peso' },
                { value: 'GTQ', label: 'GTQ — Guatemalan Quetzal' },
                { value: 'CRC', label: 'CRC — Costa Rican Colón' },
              ]}
            />
          </FormField>
        </div>
      </Panel>

      <Panel padding="lg">
        <PanelHeader title="Alert thresholds" subtitle="Trigger pacing and discrepancy alerts" />
        <div className="grid gap-5 md:grid-cols-2 max-w-2xl">
          <FormField label="Pacing alert threshold (%)" helper="Trigger when delivery deviates from goal by this much">
            <Input type="number" min="1" max="50" value={settings.pacingThreshold} onChange={set('pacingThreshold')} />
          </FormField>
          <FormField label="Discrepancy threshold (%)" helper="Trigger when ad server vs DSP differs by this much">
            <Input type="number" min="1" max="50" value={settings.discrepancyThreshold} onChange={set('discrepancyThreshold')} />
          </FormField>
        </div>
      </Panel>

      <div className="flex justify-end">
        <Button variant="primary" loading={saving} onClick={handleSave}>Save workspace</Button>
      </div>
    </div>
  );
}

// ─── Security ─────────────────────────────────────────────────────────────

function SecuritySection() {
  const { toast } = useToast();
  const confirm   = useConfirm();

  const handleResetPassword = async () => {
    const ok = await confirm({
      title: 'Send password reset email?',
      description: 'A reset link will be sent to your account email. Existing sessions remain active.',
    });
    if (!ok) return;

    try {
      const res = await fetch('/v1/me/reset-password', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      toast({ tone: 'success', title: 'Reset email sent' });
    } catch {
      toast({ tone: 'critical', title: 'Could not send reset email' });
    }
  };

  const handleSignOutEverywhere = async () => {
    const ok = await confirm({
      title: 'Sign out of all sessions?',
      description: 'You will be signed out everywhere except this browser.',
      tone: 'danger',
      confirmLabel: 'Sign out everywhere',
    });
    if (!ok) return;

    try {
      const res = await fetch('/v1/me/sessions', { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      toast({ tone: 'warning', title: 'All other sessions signed out' });
    } catch {
      toast({ tone: 'critical', title: 'Could not sign out sessions' });
    }
  };

  return (
    <div className="space-y-4">
      <Panel padding="lg">
        <PanelHeader title="Password" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[color:var(--dusk-text-secondary)]">
              We don't store your password directly. Reset it through the email flow.
            </p>
          </div>
          <Button variant="secondary" onClick={handleResetPassword}>Send reset email</Button>
        </div>
      </Panel>

      <Panel padding="lg">
        <PanelHeader title="Sessions" subtitle="Manage active devices" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[color:var(--dusk-text-secondary)]">
              Sign out of every browser and device except this one.
            </p>
          </div>
          <Button variant="danger" onClick={handleSignOutEverywhere}>Sign out everywhere</Button>
        </div>
      </Panel>
    </div>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────

function NotificationsSection() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/v1/me/notifications', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setPrefs(data?.prefs ?? data))
      .catch(() => toast({ tone: 'critical', title: 'Could not load preferences' }));
  }, [toast]);

  if (!prefs) return <CenteredSpinner label="Loading notifications…" />;

  const toggle = (field: keyof NotificationPrefs) =>
    setPrefs((current) => current ? { ...current, [field]: !current[field] } : current);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/v1/me/notifications', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error('save failed');
      toast({ tone: 'success', title: 'Notifications updated' });
    } catch {
      toast({ tone: 'critical', title: 'Could not save preferences' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel padding="lg">
      <PanelHeader title="Email notifications" />
      <div className="space-y-2 max-w-xl">
        <ToggleRow
          label="Pacing alerts"
          description="Email me when a campaign falls behind or pulls ahead of its goal."
          checked={prefs.emailPacing}
          onChange={() => toggle('emailPacing')}
        />
        <ToggleRow
          label="Discrepancy alerts"
          description="Email me when ad server metrics diverge from DSP reports."
          checked={prefs.emailDiscrepancies}
          onChange={() => toggle('emailDiscrepancies')}
        />
        <ToggleRow
          label="Approval requests"
          description="Email me when a creative is submitted for approval."
          checked={prefs.emailApprovals}
          onChange={() => toggle('emailApprovals')}
        />
      </div>

      <div className="mt-6 pt-6 border-t border-[color:var(--dusk-border-subtle)]">
        <h3 className="text-sm font-semibold text-[color:var(--dusk-text-primary)]">Slack</h3>
        <p className="mt-1 text-xs text-[color:var(--dusk-text-muted)]">
          Send the same alerts to a Slack channel via webhook.
        </p>
        <div className="mt-4 max-w-xl">
          <FormField label="Webhook URL" helper="Leave blank to disable">
            <Input
              value={prefs.slackWebhookUrl}
              onChange={(e) => setPrefs((current) => current ? { ...current, slackWebhookUrl: e.target.value } : current)}
              placeholder="https://hooks.slack.com/services/…"
              className="font-mono"
            />
          </FormField>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="primary" loading={saving} onClick={handleSave}>Save preferences</Button>
      </div>
    </Panel>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-[color:var(--dusk-surface-hover)] cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 accent-brand-500 rounded"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-[color:var(--dusk-text-primary)]">{label}</p>
        <p className="mt-0.5 text-xs text-[color:var(--dusk-text-muted)]">{description}</p>
      </div>
    </label>
  );
}

// ─── Webhooks ─────────────────────────────────────────────────────────────

function WebhooksSection() {
  return (
    <Panel padding="lg">
      <PanelHeader
        title="Webhooks"
        subtitle="Get notified about events in your workspace via HTTP"
        actions={<Button variant="primary">Add webhook</Button>}
      />
      <p className="text-sm text-[color:var(--dusk-text-muted)]">
        Webhooks fire on campaign status changes, creative approvals, and pacing alerts.
      </p>
    </Panel>
  );
}

// ─── API keys ─────────────────────────────────────────────────────────────

function ApiKeysSection() {
  const { toast } = useToast();
  const confirm   = useConfirm();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/v1/me/api-keys', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setKeys(data?.items ?? []))
      .catch(() => toast({ tone: 'critical', title: 'Could not load API keys' }))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleRevoke = async (key: ApiKey) => {
    const ok = await confirm({
      title: 'Revoke API key?',
      description: `Revoking "${key.name}" will immediately invalidate any client using it.`,
      tone: 'danger',
      confirmLabel: 'Revoke',
      requireTypeToConfirm: key.name,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/v1/me/api-keys/${key.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      setKeys((current) => current.filter((k) => k.id !== key.id));
      toast({ tone: 'warning', title: 'API key revoked' });
    } catch {
      toast({ tone: 'critical', title: 'Could not revoke key' });
    }
  };

  return (
    <Panel padding="lg">
      <PanelHeader
        title="API keys"
        subtitle="Programmatic access to the SignalMix API"
        actions={<Button variant="primary" leadingIcon={<KeyRound />}>Generate key</Button>}
      />

      {loading ? (
        <CenteredSpinner label="Loading keys…" />
      ) : keys.length === 0 ? (
        <p className="text-sm text-[color:var(--dusk-text-muted)] py-6 text-center">
          No API keys yet. Generate one to start integrating.
        </p>
      ) : (
        <ul className="space-y-2">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[color:var(--dusk-border-default)]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[color:var(--dusk-text-primary)]">{key.name}</p>
                  <Badge tone="neutral" size="sm" variant="outline" className="dusk-mono text-[10px]">
                    {key.prefix}…
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-[color:var(--dusk-text-soft)]">
                  Created {new Date(key.createdAt).toLocaleDateString()} ·
                  {key.lastUsedAt
                    ? ` last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                    : ' never used'}
                </p>
              </div>
              <Button size="sm" variant="danger" leadingIcon={<Trash2 />} onClick={() => handleRevoke(key)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
