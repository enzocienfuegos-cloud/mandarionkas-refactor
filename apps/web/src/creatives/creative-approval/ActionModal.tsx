import React from 'react';
import { Button, Modal, Panel } from '../../system';
import type { ActionState } from './types';

export function ActionModal({
  actionState,
  onClose,
  onSubmit,
  onChange,
}: {
  actionState: ActionState;
  onClose: () => void;
  onSubmit: () => void;
  onChange: (patch: Partial<ActionState>) => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={actionState.type === 'approve' ? 'Approve creative version' : 'Reject creative version'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} loading={actionState.loading} variant={actionState.type === 'approve' ? 'primary' : 'danger'}>
            {actionState.type === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </>
      }
    >
      {actionState.error && (
        <Panel padding="sm" className="mb-4 border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)]">
          {actionState.error}
        </Panel>
      )}
      {actionState.type === 'approve' ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-secondary)]">Notes</label>
          <textarea
            value={actionState.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
            rows={3}
            className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2 text-sm text-[color:var(--dusk-text-primary)] focus:border-[color:var(--dusk-border-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--dusk-brand-500)]/20"
          />
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium text-[color:var(--dusk-text-secondary)]">Reason</label>
          <textarea
            value={actionState.reason}
            onChange={(event) => onChange({ reason: event.target.value })}
            rows={4}
            className="w-full rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2 text-sm text-[color:var(--dusk-text-primary)] focus:border-[color:var(--dusk-border-strong)] focus:outline-none focus:ring-2 focus:ring-[color:var(--dusk-brand-500)]/20"
          />
        </div>
      )}
    </Modal>
  );
}
