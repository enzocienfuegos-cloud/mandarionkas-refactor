import React from 'react';
import { Button, Input, Panel, Select } from '../../system';

type BulkAssignableTag = {
  id: string;
  name: string;
};

type Props = {
  selectedCount: number;
  bulkClickUrl: string;
  onBulkClickUrlChange: (value: string) => void;
  onBulkClickUrlUpdate: () => void | Promise<void>;
  bulkClickUrlSaving: boolean;
  bulkAssignTagId: string;
  onBulkAssignTagIdChange: (value: string) => void;
  onBulkAssignToTag: () => void | Promise<void>;
  bulkAssignSaving: boolean;
  bulkAssignableTags: BulkAssignableTag[];
  canBulkAssign: boolean;
  bulkAssignHint: string | null;
  onBulkStatusUpdate: (nextStatus: 'approved' | 'archived') => void | Promise<void>;
  bulkStatusSaving: boolean;
  onBulkDelete: () => void | Promise<void>;
  bulkDeleteSaving: boolean;
  onClearSelection: () => void;
};

export function CreativeBulkActionsPanel({
  selectedCount,
  bulkClickUrl,
  onBulkClickUrlChange,
  onBulkClickUrlUpdate,
  bulkClickUrlSaving,
  bulkAssignTagId,
  onBulkAssignTagIdChange,
  onBulkAssignToTag,
  bulkAssignSaving,
  bulkAssignableTags,
  canBulkAssign,
  bulkAssignHint,
  onBulkStatusUpdate,
  bulkStatusSaving,
  onBulkDelete,
  bulkDeleteSaving,
  onClearSelection,
}: Props) {
  return (
    <Panel className="border-brand-500/20 bg-brand-500/10 px-4 py-3">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-text-primary">
              {selectedCount} creative{selectedCount === 1 ? '' : 's'} selected
            </div>
            <div className="mt-1 text-xs text-text-secondary">
              Update landing pages in bulk or assign the selected creatives to one tag when they belong to the same client and share the same delivery type.
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Clear selection
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-brand-500/20 bg-surface-1/80 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-brand">Bulk destination URL</div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={bulkClickUrl}
                onChange={(event) => onBulkClickUrlChange(event.target.value)}
                placeholder="https://example.com/landing"
                className="min-w-0 flex-1"
              />
              <Button
                onClick={() => void onBulkClickUrlUpdate()}
                loading={bulkClickUrlSaving}
                size="md"
              >
                Update URL
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-brand-500/20 bg-surface-1/80 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-brand">Bulk tag assignment</div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={bulkAssignTagId}
                onChange={(event) => onBulkAssignTagIdChange(event.target.value)}
                disabled={!canBulkAssign}
                className="min-w-0 flex-1"
                options={[
                  { value: '', label: 'Select a tag' },
                  ...bulkAssignableTags.map((tag) => ({ value: tag.id, label: tag.name })),
                ]}
              />
              <Button
                onClick={() => void onBulkAssignToTag()}
                variant="secondary"
                loading={bulkAssignSaving}
                disabled={!bulkAssignTagId}
              >
                Assign to tag
              </Button>
            </div>
            {bulkAssignHint ? (
              <p className="mt-1 text-[11px] text-[color:var(--dusk-status-warning-fg)]">{bulkAssignHint}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-brand-500/20 bg-surface-1/80 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-text-brand">Bulk active state</div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void onBulkStatusUpdate('approved')}
                variant="secondary"
                loading={bulkStatusSaving}
              >
                Set active
              </Button>
              <Button
                onClick={() => void onBulkStatusUpdate('archived')}
                variant="ghost"
                loading={bulkStatusSaving}
              >
                Set inactive
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-[color:var(--dusk-status-critical-border)] bg-surface-1/80 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[color:var(--dusk-status-critical-fg)]">Bulk delete</div>
            <Button
              onClick={() => void onBulkDelete()}
              variant="danger"
              loading={bulkDeleteSaving}
            >
              Delete selected
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
