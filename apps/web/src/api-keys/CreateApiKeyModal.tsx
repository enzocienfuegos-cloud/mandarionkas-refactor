import React, { useState, type FormEvent } from 'react';
import { Button, FormField, Input, Modal, Panel, ReadOnlyValue } from '../system';
import { type ApiKey, type CreateKeyResult, SCOPE_CATEGORIES } from './types';

export function CreateApiKeyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (key: ApiKey) => void;
}) {
  const [rawKey, setRawKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [expiryDate, setExpiryDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const toggleScope = (scope: string) => {
    setSelectedScopes((current) => {
      const next = new Set(current);
      next.has(scope) ? next.delete(scope) : next.add(scope);
      return next;
    });
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError('');
    if (!newName.trim()) { setCreateError('Name is required.'); return; }
    if (selectedScopes.size === 0) { setCreateError('Select at least one scope.'); return; }

    setCreating(true);
    try {
      const response = await fetch('/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newName.trim(),
          scopes: Array.from(selectedScopes),
          expiresAt: expiryDate || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message ?? 'Failed to create key');
      }

      const data: CreateKeyResult = await response.json();
      setRawKey(data.rawKey);
      onCreated(data.key);
    } catch (createErr: any) {
      setCreateError(createErr.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rawKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Modal open onClose={onClose} size="lg" title="Create API Key">
      {rawKey ? (
        <div>
          <Panel className="mb-4 border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-warning-fg)]">
            <strong>Store this key securely — it won't be shown again.</strong>
          </Panel>
          <div className="space-y-3">
            <ReadOnlyValue label="Your new API key" value={rawKey} className="font-mono" />
            <Button onClick={handleCopy} variant="secondary" className="w-full">
              {copied ? 'Copied' : 'Copy key'}
            </Button>
          </div>
          <Button onClick={onClose} className="mt-4 w-full">
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleCreate} className="space-y-5" noValidate>
          {createError && (
            <div className="rounded-lg border border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-critical-fg)]">
              {createError}
            </div>
          )}

          <FormField label="Key Name" required>
            <Input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="CI/CD Pipeline Key"
            />
          </FormField>

          <FormField label="Scopes" required>
            <div className="space-y-3">
              {SCOPE_CATEGORIES.map((category) => (
                <div key={category.label}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">{category.label}</p>
                  <div className="space-y-1 pl-2">
                    {category.scopes.map((scope) => (
                      <label key={scope.value} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedScopes.has(scope.value)}
                          onChange={() => toggleScope(scope.value)}
                          className="h-4 w-4 rounded border-border-strong text-text-brand focus:ring-brand-500"
                        />
                        <span className="text-sm text-text-secondary">{scope.label}</span>
                        <code className="font-mono text-xs text-[color:var(--dusk-text-soft)]">{scope.value}</code>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </FormField>

          <FormField label="Expiry Date" helper="Optional expiration date for this credential.">
            <Input
              type="date"
              value={expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </FormField>

          <div className="flex gap-3 pt-2">
            <Button type="button" onClick={onClose} variant="ghost" className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={creating} className="flex-1">
              {creating ? 'Creating...' : 'Create Key'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
