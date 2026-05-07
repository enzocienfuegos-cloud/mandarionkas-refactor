import React from 'react';
import { Badge, Button, FormField, Modal, Panel, Select } from '../../system';
import type { BindingState } from './types';
import { statusBadge } from './ui';

type TagOptionLike = {
  id: string;
  name: string;
  format?: string | null;
  status?: string | null;
};

type Props = {
  bindingState: BindingState;
  tags: TagOptionLike[];
  onClose: () => void;
  onAssign: () => void | Promise<void>;
  onTagChange: (tagId: string) => void;
  onQuickCreateTag: () => void | Promise<void>;
  onOpenTags: () => void;
  onBindingStatusChange: (bindingId: string, status: 'active' | 'paused') => void | Promise<void>;
};

export function TagBindingModal({
  bindingState,
  tags,
  onClose,
  onAssign,
  onTagChange,
  onQuickCreateTag,
  onOpenTags,
  onBindingStatusChange,
}: Props) {
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Assign creative version to tag"
      description="Assign this creative version to one or more delivery tags."
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void onAssign()} loading={bindingState.loading}>Assign</Button>
        </>
      )}
    >
      {bindingState.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {bindingState.error}
        </div>
      )}
      <div className="mt-4">
        <FormField label="Tag">
          <Select
            value={bindingState.tagId}
            onChange={(event) => onTagChange(event.target.value)}
          >
            <option value="">Select a tag</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name} · {tag.format} · {tag.status}
              </option>
            ))}
          </Select>
        </FormField>
        {tags.length === 0 && (
          <Panel className="mt-3 px-3 py-3 text-sm text-text-muted">
            <p>No tags exist yet for this client.</p>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => void onQuickCreateTag()}
                variant="secondary"
                size="sm"
                disabled={bindingState.loading}
              >
                Quick create tag
              </Button>
              <Button
                onClick={onOpenTags}
                variant="ghost"
                size="sm"
              >
                Open tags
              </Button>
            </div>
          </Panel>
        )}
      </div>
      {bindingState.tagId && (
        <Panel className="mt-4 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-text-primary">Current assignments</h3>
              <p className="text-xs text-text-muted">Review what this tag is already serving before you change it.</p>
            </div>
            {bindingState.bindingsLoading && (
              <span className="text-xs text-text-muted">Loading…</span>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {bindingState.bindings.map((binding) => {
              const isCurrentVersion = binding.creativeVersionId === bindingState.versionId;
              return (
                <Panel key={binding.id} className="px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-text-primary">{binding.creativeName}</span>
                        {statusBadge(binding.status)}
                        {isCurrentVersion && (
                          <Badge tone="brand" size="sm">Selected version</Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-text-muted">
                        {binding.sourceKind} · {binding.servingFormat} · weight {binding.weight}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {binding.status === 'active' ? (
                        <Button
                          onClick={() => void onBindingStatusChange(binding.id, 'paused')}
                          disabled={bindingState.loading}
                          variant="secondary"
                          size="sm"
                        >
                          Pause
                        </Button>
                      ) : (
                        <Button
                          onClick={() => void onBindingStatusChange(binding.id, 'active')}
                          disabled={bindingState.loading}
                          variant="secondary"
                          size="sm"
                        >
                          Activate
                        </Button>
                      )}
                    </div>
                  </div>
                </Panel>
              );
            })}
            {!bindingState.bindingsLoading && bindingState.bindings.length === 0 && (
              <Panel className="border-dashed px-3 py-4 text-sm text-text-muted">
                This tag has no assignments yet.
              </Panel>
            )}
          </div>
        </Panel>
      )}
    </Modal>
  );
}
