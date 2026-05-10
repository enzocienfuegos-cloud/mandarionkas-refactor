import { useEffect } from 'react';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

export function CreateClientModal({
  open,
  clientName,
  clientSlug,
  error,
  isSubmitting,
  onNameChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  clientName: string;
  clientSlug: string;
  error?: string | null;
  isSubmitting: boolean;
  onNameChange(value: string): void;
  onClose(): void;
  onSubmit(): void;
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="mandarion-client-modal-shell" role="presentation" onClick={onClose}>
      <div
        className="mandarion-client-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mandarion-create-client-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mandarion-client-modal__header">
          <div>
            <div className="workspace-hub-kicker">New client</div>
            <h2 id="mandarion-create-client-title">Create client</h2>
            <p>Create a new studio workspace with a real name and an automatically generated slug.</p>
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            label="Close client modal"
            showTooltip={false}
            icon={<StudioIcon icon={StudioIcons.x} size={14} />}
            onClick={onClose}
          />
        </header>

        <div className="mandarion-client-modal__body">
          <label className="mandarion-field">
            <span>Client name</span>
            <input
              value={clientName}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="e.g. Retail Group"
              autoFocus
            />
          </label>

          <label className="mandarion-field">
            <span>Slug</span>
            <input value={clientSlug || 'generated-on-create'} readOnly aria-readonly="true" />
            <small>The slug is generated automatically from the current name.</small>
          </label>

          {error ? <p className="mandarion-client-modal__error">{error}</p> : null}
        </div>

        <footer className="mandarion-client-modal__footer">
          <Button variant="ghost" size="md" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={onSubmit} loading={isSubmitting}>
            Create client
          </Button>
        </footer>
      </div>
    </div>
  );
}
