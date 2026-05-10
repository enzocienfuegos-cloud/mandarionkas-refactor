import React from 'react';
import { Button, Input, Modal } from '../../system';
import type { ClickUrlEditorState } from './types';

type Props = {
  state: ClickUrlEditorState;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  onValueChange: (value: string) => void;
};

export function ClickUrlEditorModal({
  state,
  onClose,
  onSave,
  onValueChange,
}: Props) {
  return (
    <Modal
      open
      onClose={onClose}
      title={`Destination URL · ${state.creativeName}`}
      description="Leave blank to clear the creative destination URL."
      size="md"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void onSave()} loading={state.loading}>
            Save URL
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
        value={state.value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder="https://example.com/landing"
        autoFocus
      />
    </Modal>
  );
}
