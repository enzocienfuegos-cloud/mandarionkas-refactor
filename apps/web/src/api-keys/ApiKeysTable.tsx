import React from 'react';
import { Badge, Button, DataTable, EmptyState, Panel, type ColumnDef } from '../system';
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
      <DataTable
        columns={[
          {
            id: 'name',
            header: 'Name',
            sortAccessor: (key) => key.name,
            cell: (key) => <span className="text-sm font-medium text-text-primary">{key.name}</span>,
          },
          {
            id: 'prefix',
            header: 'Prefix',
            sortAccessor: (key) => key.prefix,
            cell: (key) => (
              <code className="rounded bg-[color:var(--dusk-surface-muted)] px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                {key.prefix}...
              </code>
            ),
          },
          {
            id: 'scopes',
            header: 'Scopes',
            cell: (key) => (
              <div className="flex max-w-xs flex-wrap gap-1">
                {key.scopes.map((scope) => (
                  <Badge key={scope} tone="neutral" size="sm">{scope}</Badge>
                ))}
              </div>
            ),
          },
          {
            id: 'created',
            header: 'Created',
            sortAccessor: (key) => key.createdAt,
            cell: (key) => <span className="text-xs text-text-muted">{new Date(key.createdAt).toLocaleDateString()}</span>,
          },
          {
            id: 'expires',
            header: 'Expires',
            sortAccessor: (key) => key.expiresAt ?? '',
            cell: (key) => (
              <span className="text-xs text-text-muted">
                {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}
              </span>
            ),
          },
          {
            id: 'status',
            header: 'Status',
            sortAccessor: (key) => key.status,
            cell: (key) => statusBadge(key.status),
          },
          {
            id: 'actions',
            header: 'Actions',
            align: 'right',
            cell: (key) => (
              key.status === 'active' ? (
                <Button
                  onClick={() => void onRevoke(key)}
                  disabled={revokingId === key.id}
                  variant="ghost"
                  size="sm"
                >
                  {revokingId === key.id ? '...' : 'Revoke'}
                </Button>
              ) : null
            ),
          },
        ] as ColumnDef<ApiKey>[]}
        data={keys}
        rowKey={(key) => key.id}
        bordered={false}
        emptyState={null}
      />
    </Panel>
  );
}
