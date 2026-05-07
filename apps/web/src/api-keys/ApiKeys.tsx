import React, { useEffect, useState } from 'react';
import { Button, CenteredSpinner, PageHeader, Panel, useConfirm, useToast } from '../system';
import { ApiKeysTable } from './ApiKeysTable';
import { CreateApiKeyModal } from './CreateApiKeyModal';
import { type ApiKey } from './types';

export default function ApiKeys() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError('');
    fetch('/v1/api-keys', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('We could not load API keys for this workspace.'); return r.json(); })
      .then(d => setKeys(d?.keys ?? d ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openModal = () => {
    setShowModal(true);
  };

  const handleRevoke = async (key: ApiKey) => {
    const confirmed = await confirm({
      title: `Revoke key "${key.name}"?`,
      description: 'This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Revoke',
      requireTypeToConfirm: key.name,
    });
    if (!confirmed) return;
    setRevokingId(key.id);
    try {
      const res = await fetch(`/v1/api-keys/${key.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Revoke failed');
      setKeys(ks => ks.map(k => k.id === key.id ? { ...k, status: 'revoked' } : k));
      toast({ tone: 'warning', title: `Key "${key.name}" revoked` });
    } catch {
      toast({ tone: 'critical', title: 'Failed to revoke API key.' });
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) {
    return <CenteredSpinner label="Loading API keys…" />;
  }

  return (
    <div>
      <PageHeader
        title="API Keys"
        meta={`${keys.length} key${keys.length === 1 ? '' : 's'} in this workspace · manage programmatic access to the SMX Studio API`}
        primaryAction={<Button onClick={openModal}>+ Create Key</Button>}
      />

      {error && (
        <Panel className="mb-4 border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-sm text-[color:var(--dusk-status-critical-fg)]" role="status" aria-live="polite">
          <p className="font-medium">Couldn&apos;t load API keys</p>
          <p className="mt-1">Check workspace access or refresh the page, then retry. Details: {error}</p>
        </Panel>
      )}

      <ApiKeysTable
        keys={keys}
        revokingId={revokingId}
        onOpenCreate={openModal}
        onRevoke={handleRevoke}
      />

      {showModal && (
        <CreateApiKeyModal
          onClose={() => setShowModal(false)}
          onCreated={(key) => setKeys((current) => [key, ...current])}
        />
      )}
    </div>
  );
}
