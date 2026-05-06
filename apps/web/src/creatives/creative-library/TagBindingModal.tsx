import React from 'react';
import { Button, Modal } from '../../system';
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
        <label className="mb-1 block text-sm font-medium text-slate-700">Tag</label>
        <select
          value={bindingState.tagId}
          onChange={(event) => onTagChange(event.target.value)}
          className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2 text-sm text-[color:var(--dusk-text-primary)] outline-none transition-[border-color,box-shadow] hover:border-[color:var(--dusk-border-strong)] focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
        >
          <option value="">Select a tag</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name} · {tag.format} · {tag.status}
            </option>
          ))}
        </select>
        {tags.length === 0 && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
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
          </div>
        )}
      </div>
      {bindingState.tagId && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-slate-800">Current assignments</h3>
              <p className="text-xs text-slate-500">Review what this tag is already serving before you change it.</p>
            </div>
            {bindingState.bindingsLoading && (
              <span className="text-xs text-slate-500">Loading…</span>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {bindingState.bindings.map((binding) => {
              const isCurrentVersion = binding.creativeVersionId === bindingState.versionId;
              return (
                <div key={binding.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-800">{binding.creativeName}</span>
                        {statusBadge(binding.status)}
                        {isCurrentVersion && (
                          <span className="inline-flex items-center rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
                            Selected version
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
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
                </div>
              );
            })}
            {!bindingState.bindingsLoading && bindingState.bindings.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                This tag has no assignments yet.
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
