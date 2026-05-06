import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  Building2,
  Shield,
  Bell,
  Webhook,
  KeyRound,
  ScrollText,
} from '../system/icons';
import {
  Panel,
  PanelHeader,
  Button,
  Input,
  Select,
  FormField,
  Kicker,
  Tabs,
  TabsList,
  Tab,
  CenteredSpinner,
  useToast,
} from '../system';

/**
 * Settings — shell that hosts both owned sections and delegates to
 * existing repo modules.
 *
 * This page is a SHELL that provides:
 *   - Page header
 *   - Tab navigation
 *   - URL-driven section selection
 *
 * Each section either:
 *   - is owned here (Profile, Security, Notifications — per-user prefs), or
 *   - delegates to an existing repo module (Workspace, Webhooks, API keys,
 *     Audit log) that has its own CRUD and contracts wiring.
 *
 * Routing model:
 *   ONE route in App.tsx: `<Route path="/settings/*" element={<Settings />} />`
 *   The active section is derived from `location.pathname`.
 *
 * Other `<Route path="/settings/...">` entries in App.tsx must be removed
 * to avoid route collisions.
 */

type Section =
  | 'profile'
  | 'workspace'
  | 'security'
  | 'notifications'
  | 'webhooks'
  | 'api-keys'
  | 'audit-log';

const VALID_SECTIONS: Section[] = [
  'profile',
  'workspace',
  'security',
  'notifications',
  'webhooks',
  'api-keys',
  'audit-log',
];

// Lazy-load the heavy delegated sections — they are separate route bundles.
const WorkspaceSettings = lazy(() => import('../team/WorkspaceSettings'));
const WebhookManager    = lazy(() => import('../webhooks/WebhookManager'));
const ApiKeys           = lazy(() => import('../api-keys/ApiKeys'));
const AuditLog          = lazy(() => import('../audit/AuditLog'));

export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active section from URL. Falls back to 'profile' for /settings or unknown.
  const slug = location.pathname.replace(/^\/settings\/?/, '').split('/')[0];
  const section: Section = (VALID_SECTIONS as string[]).includes(slug)
    ? (slug as Section)
    : 'profile';

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
          <Tab value="audit-log"     leadingIcon={<ScrollText className="h-4 w-4" />}>Audit log</Tab>
        </TabsList>
      </Tabs>

      {/* Body — sections are siblings to TabsList because the heavy ones
          are lazy-loaded modules from elsewhere in the repo. */}
      <Suspense fallback={<CenteredSpinner label="Loading section…" />}>
        {section === 'profile'       && <ProfileSection />}
        {section === 'workspace'     && <WorkspaceSettings />}
        {section === 'security'      && <SecuritySection />}
        {section === 'notifications' && <NotificationsSection />}
        {section === 'webhooks'      && <WebhookManager />}
        {section === 'api-keys'      && <ApiKeys />}
        {section === 'audit-log'     && <AuditLog />}
      </Suspense>
    </div>
  );
}

// ─── Sections owned by this shell ─────────────────────────────────────────

interface UserProfile {
  name:     string;
  email:    string;
  timezone: string;
  locale:   string;
}

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

function SecuritySection() {
  const { toast } = useToast();

  const handleResetPassword = async () => {
    try {
      const res = await fetch('/v1/me/reset-password', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('failed');
      toast({ tone: 'success', title: 'Reset email sent' });
    } catch {
      toast({ tone: 'critical', title: 'Could not send reset email' });
    }
  };

  return (
    <Panel padding="lg">
      <PanelHeader title="Password" />
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-[color:var(--dusk-text-secondary)]">
          We don&apos;t store your password directly. Reset it through the email flow.
        </p>
        <Button variant="secondary" onClick={handleResetPassword}>Send reset email</Button>
      </div>
    </Panel>
  );
}

interface NotificationPrefs {
  emailPacing:        boolean;
  emailDiscrepancies: boolean;
  emailApprovals:     boolean;
  slackWebhookUrl:    string;
}

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
              onChange={(e) =>
                setPrefs((current) => current ? { ...current, slackWebhookUrl: e.target.value } : current)
              }
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
  label:       string;
  description: string;
  checked:     boolean;
  onChange:    () => void;
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
