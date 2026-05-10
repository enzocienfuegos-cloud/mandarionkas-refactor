import React from 'react';
import { Button, Input, Modal } from '../../system';
import type { QuickCreateTagState } from './types';

type Props = {
  state: QuickCreateTagState;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  onNameChange: (value: string) => void;
};

export function QuickCreateTagModal({
  state,
  onClose,
  onConfirm,
  onNameChange,
}: Props) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Quick create tag"
      description={`Create a draft ${state.suggestedFormat} tag for ${state.creativeName}.`}
      size="md"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void onConfirm()} loading={state.loading}>
            Create tag
          </Button>
        </>
      )}
    >
      {state.error && (
        <div className="mb-4 rounded-lg border border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-3 py-2 text-sm text-[color:var(--dusk-status-critical-fg)]">
          {state.error}
        </div>
      )}
      <Input
        value={state.name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="Tag name"
        autoFocus
      />
    </Modal>
  );
}
