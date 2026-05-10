import React from 'react';

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  status: 'active' | 'expired' | 'revoked';
  lastUsedAt?: string | null;
}

export interface CreateKeyResult {
  key: ApiKey;
  rawKey: string;
}

export interface ScopeCategory {
  label: string;
  scopes: { value: string; label: string }[];
}

export const SCOPE_CATEGORIES: ScopeCategory[] = [
  {
    label: 'Campaigns',
    scopes: [
      { value: 'campaigns:read', label: 'Read campaigns' },
      { value: 'campaigns:write', label: 'Write campaigns' },
    ],
  },
  {
    label: 'Tags',
    scopes: [
      { value: 'tags:read', label: 'Read tags' },
      { value: 'tags:write', label: 'Write tags' },
    ],
  },
  {
    label: 'Creatives',
    scopes: [
      { value: 'creatives:read', label: 'Read creatives' },
      { value: 'creatives:write', label: 'Write creatives' },
    ],
  },
  {
    label: 'Reporting',
    scopes: [
      { value: 'reporting:read', label: 'Read reporting data' },
    ],
  },
  {
    label: 'Admin',
    scopes: [
      { value: 'team:manage', label: 'Manage team members' },
      { value: 'webhooks:write', label: 'Manage webhooks' },
      { value: 'audit:read', label: 'Read audit log' },
    ],
  },
];

export function statusBadge(status: ApiKey['status']) {
  const cfg: Record<ApiKey['status'], { cls: string; label: string }> = {
    active: { cls: 'bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]', label: 'Active' },
    expired: { cls: 'bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]', label: 'Expired' },
    revoked: { cls: 'bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)]', label: 'Revoked' },
  };
  const { cls, label } = cfg[status];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
