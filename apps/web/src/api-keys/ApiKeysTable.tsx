import React from 'react';
import { Button, EmptyState, Panel } from '../system';
import { statusBadge, type ApiKey } from './types';

export function ApiKeysTable({
  keys,
  revokingId,
  onOpenCreate,
  onRevoke,
}: {
  keys: ApiKey[];
  revokingId: string | null;
  onOpenCreate: () => void;
  onRevoke: (key: ApiKey) => void | Promise<void>;
}) {
  if (keys.length === 0) {
    return (
      <Panel className="py-20 text-center">
        <EmptyState
          title="No API keys"
          description="Create an API key for programmatic access."
          action={<Button onClick={onOpenCreate}>Create Key</Button>}
        />
      </Panel>
    );
  }

  return (
    <Panel className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[color:var(--dusk-border-subtle)]">
          <caption className="sr-only">API keys and their scopes</caption>
          <thead className="bg-[color:var(--dusk-surface-muted)]">
            <tr>
              {['Name', 'Prefix', 'Scopes', 'Created', 'Expires', 'Status', 'Actions'].map((heading) => (
                <th key={heading} scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--dusk-border-subtle)]">
            {keys.map((key) => (
              <tr key={key.id} className="transition-colors hover:bg-[color:var(--dusk-surface-muted)]">
                <th scope="row" className="px-4 py-3 text-left text-sm font-medium text-text-primary">{key.name}</th>
                <td className="px-4 py-3">
                  <code className="rounded bg-[color:var(--dusk-surface-muted)] px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                    {key.prefix}...
                  </code>
                </td>
                <td className="px-4 py-3">
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {key.scopes.map((scope) => (
                      <span key={scope} className="rounded bg-[color:var(--dusk-surface-muted)] px-1.5 py-0.5 font-mono text-xs text-text-muted">
                        {scope}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-text-muted">{new Date(key.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-xs text-text-muted">
                  {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-3">{statusBadge(key.status)}</td>
                <td className="px-4 py-3">
                  {key.status === 'active' && (
                    <Button
                      onClick={() => void onRevoke(key)}
                      disabled={revokingId === key.id}
                      variant="ghost"
                      size="sm"
                    >
                      {revokingId === key.id ? '...' : 'Revoke'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
