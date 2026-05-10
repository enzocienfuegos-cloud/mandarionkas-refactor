import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Megaphone,
  Tags,
  ImageIcon,
  Gauge,
  AlertTriangle,
  BarChart3,
  FlaskConical,
  Wrench,
  Settings,
  Users,
  Plus,
  Sun,
  Moon,
  LogOut,
  Search,
} from '../system/icons';
import { useRegisterCommands, useToast, type CommandItem } from '../system';

export interface ShellCommandsProps {
  onSignOut: () => void;
  onToggleTheme: () => void;
  themeMode: 'light' | 'dark';
}

/**
 * Registers the shell's default command palette entries.
 *
 * Mount this component once inside <Shell>. It returns null and only
 * registers commands as a side-effect.
 *
 * Pages can register their own page-scoped commands via
 * useRegisterCommands() too — those will live alongside these.
 */
export function ShellCommands({ onSignOut, onToggleTheme, themeMode }: ShellCommandsProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Note: a fresh array on every render. The command palette dedupes by id,
  // and the deps array tells useRegisterCommands when to re-register.
  const items: CommandItem[] = [
    // ── Navigation ─────────────────────────────────────────────────────
    {
      id: 'nav-overview',
      group: 'Navigate',
      label: 'Go to overview',
      icon: <LayoutDashboard />,
      keywords: ['home', 'dashboard'],
      shortcut: ['G', 'O'],
      perform: (close) => { close(); navigate('/overview'); },
    },
    {
      id: 'nav-campaigns',
      group: 'Navigate',
      label: 'Go to campaigns',
      icon: <Megaphone />,
      keywords: ['ad', 'campaign'],
      shortcut: ['G', 'C'],
      perform: (close) => { close(); navigate('/campaigns'); },
    },
    {
      id: 'nav-tags',
      group: 'Navigate',
      label: 'Go to tags',
      icon: <Tags />,
      shortcut: ['G', 'T'],
      perform: (close) => { close(); navigate('/tags'); },
    },
    {
      id: 'nav-creatives',
      group: 'Navigate',
      label: 'Go to creatives',
      icon: <ImageIcon />,
      keywords: ['library', 'asset'],
      perform: (close) => { close(); navigate('/creatives'); },
    },
    {
      id: 'nav-pacing',
      group: 'Navigate',
      label: 'Go to pacing',
      icon: <Gauge />,
      keywords: ['delivery', 'health'],
      perform: (close) => { close(); navigate('/pacing'); },
    },
    {
      id: 'nav-discrepancies',
      group: 'Navigate',
      label: 'Go to discrepancies',
      icon: <AlertTriangle />,
      keywords: ['reconciliation', 'variance'],
      perform: (close) => { close(); navigate('/discrepancies'); },
    },
    {
      id: 'nav-reporting',
      group: 'Navigate',
      label: 'Go to reporting',
      icon: <BarChart3 />,
      keywords: ['analytics', 'metrics'],
      perform: (close) => { close(); navigate('/reporting'); },
    },
    {
      id: 'nav-experiments',
      group: 'Navigate',
      label: 'Go to experiments',
      icon: <FlaskConical />,
      keywords: ['ab', 'a/b', 'test'],
      perform: (close) => { close(); navigate('/experiments'); },
    },
    {
      id: 'nav-clients',
      group: 'Navigate',
      label: 'Go to clients',
      icon: <Users />,
      perform: (close) => { close(); navigate('/clients'); },
    },
    {
      id: 'nav-tools',
      group: 'Navigate',
      label: 'Go to tools',
      icon: <Wrench />,
      perform: (close) => { close(); navigate('/tools'); },
    },
    {
      id: 'nav-settings',
      group: 'Navigate',
      label: 'Go to settings',
      icon: <Settings />,
      shortcut: ['G', 'S'],
      perform: (close) => { close(); navigate('/settings/profile'); },
    },
    {
      id: 'settings-webhooks',
      group: 'Settings',
      label: 'Open webhook settings',
      icon: <Settings />,
      keywords: ['integrations', 'callbacks'],
      contextScope: { entity: 'settings' },
      perform: (close) => { close(); navigate('/settings/webhooks'); },
    },
    {
      id: 'settings-api-keys',
      group: 'Settings',
      label: 'Open API keys',
      icon: <Settings />,
      keywords: ['tokens', 'credentials'],
      contextScope: { entity: 'settings' },
      perform: (close) => { close(); navigate('/settings/api-keys'); },
    },
    {
      id: 'settings-audit-log',
      group: 'Settings',
      label: 'Open audit log',
      icon: <Settings />,
      keywords: ['history', 'events'],
      contextScope: { entity: 'settings' },
      perform: (close) => { close(); navigate('/settings/audit-log'); },
    },
    {
      id: 'tools-webhook-tester',
      group: 'Tools',
      label: 'Open webhook tester',
      icon: <Wrench />,
      keywords: ['webhook', 'delivery', 'callback'],
      contextScope: { entity: 'tools' },
      perform: (close) => { close(); navigate('/tools/webhook-tester'); },
    },
    {
      id: 'tools-macro-builder',
      group: 'Tools',
      label: 'Open macro builder',
      icon: <Wrench />,
      keywords: ['dsp', 'macros', 'tokens'],
      contextScope: { entity: 'tools' },
      perform: (close) => { close(); navigate('/tools/macro-builder'); },
    },
    {
      id: 'tools-tag-validator',
      group: 'Tools',
      label: 'Open tag validator',
      icon: <Wrench />,
      keywords: ['qa', 'snippet', 'preview'],
      contextScope: { entity: 'tools' },
      perform: (close) => { close(); navigate('/tools/tag-validator'); },
    },
    {
      id: 'tags-bindings',
      group: 'Tags',
      label: 'Open tag bindings',
      icon: <Tags />,
      keywords: ['assignments', 'creative binding'],
      contextScope: { entity: 'tag' },
      perform: (close) => { close(); navigate('/tags/bindings'); },
    },
    {
      id: 'tags-health',
      group: 'Tags',
      label: 'Open tag health',
      icon: <Tags />,
      keywords: ['validation', 'health'],
      contextScope: { entity: 'tag' },
      perform: (close) => { close(); navigate('/tags/health'); },
    },

    // ── Quick actions ──────────────────────────────────────────────────
    {
      id: 'action-new-campaign',
      group: 'Create',
      label: 'New campaign',
      icon: <Plus />,
      keywords: ['create', 'add'],
      shortcut: ['C', 'C'],
      perform: (close) => { close(); navigate('/campaigns/new'); },
    },
    {
      id: 'action-new-tag',
      group: 'Create',
      label: 'New tag',
      icon: <Plus />,
      shortcut: ['C', 'T'],
      perform: (close) => { close(); navigate('/tags/new'); },
    },
    {
      id: 'action-new-experiment',
      group: 'Create',
      label: 'New experiment',
      icon: <Plus />,
      keywords: ['ab test'],
      perform: (close) => { close(); navigate('/experiments/new'); },
    },

    // ── Preferences ────────────────────────────────────────────────────
    {
      id: 'pref-toggle-theme',
      group: 'Preferences',
      label: themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      icon: themeMode === 'dark' ? <Sun /> : <Moon />,
      keywords: ['dark', 'light', 'mode'],
      perform: (close) => {
        onToggleTheme();
        close();
        toast({ tone: 'info', title: `Switched to ${themeMode === 'dark' ? 'light' : 'dark'} theme` });
      },
    },

    // ── Account ────────────────────────────────────────────────────────
    {
      id: 'account-signout',
      group: 'Account',
      label: 'Sign out',
      icon: <LogOut />,
      perform: (close) => { close(); onSignOut(); },
    },
  ];

  useRegisterCommands(items, [navigate, themeMode]);

  return null;
}
