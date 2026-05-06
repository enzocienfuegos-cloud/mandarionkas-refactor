import React, { useEffect, useState } from 'react';
import { Button, CenteredSpinner, Panel, useConfirm, useToast } from '../system';
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
    fetch('/v1/api-keys', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed to load API keys'); return r.json(); })
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">API Keys</h1>
          <p className="text-sm text-text-muted mt-1">Manage programmatic access to the SMX Studio API</p>
        </div>
        <Button onClick={openModal}>
          + Create Key
        </Button>
      </div>

      {error && (
        <Panel className="mb-4 border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-sm text-[color:var(--dusk-status-critical-fg)]">
          {error}
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
