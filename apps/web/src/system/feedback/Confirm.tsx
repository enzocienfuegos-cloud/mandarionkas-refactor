import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../primitives/Input';

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Use 'danger' for destructive actions (delete, archive, etc.) */
  tone?: 'default' | 'danger';
  /**
   * If set, the user must type this exact string to enable the confirm button.
   * Use for irreversible destructive actions: e.g. require typing the campaign name.
   */
  requireTypeToConfirm?: string;
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

/**
 * Hook to imperatively trigger a confirm dialog.
 *
 * @example
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Delete campaign?',
 *     description: 'This action cannot be undone.',
 *     tone: 'danger',
 *     requireTypeToConfirm: 'Q4 Brand Awareness',
 *   });
 *   if (ok) await deleteIt();
 */
export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx.confirm;
}

interface DialogState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/**
 * Mount once at root. Replaces all window.confirm() calls in the app.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [typed, setTyped]   = useState('');
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        setTyped('');
        setDialog({ ...opts, resolve });
      }),
    [],
  );

  const handleClose = useCallback(
    (result: boolean) => {
      if (dialog) dialog.resolve(result);
      setDialog(null);
      setTyped('');
    },
    [dialog],
  );

  const value = useMemo(() => ({ confirm }), [confirm]);

  const canConfirm =
    !dialog?.requireTypeToConfirm || typed === dialog.requireTypeToConfirm;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {dialog && (
        <Modal
          open
          onClose={() => handleClose(false)}
          title={dialog.title}
          description={dialog.description}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => handleClose(false)}>
                {dialog.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                variant={dialog.tone === 'danger' ? 'danger' : 'primary'}
                onClick={() => handleClose(true)}
                disabled={!canConfirm}
              >
                {dialog.confirmLabel ?? (dialog.tone === 'danger' ? 'Delete' : 'Confirm')}
              </Button>
            </>
          }
        >
          {dialog.requireTypeToConfirm && (
            <div className="space-y-2">
              <p className="text-sm text-[color:var(--dusk-text-muted)]">
                Type{' '}
                <code className="dusk-mono px-1.5 py-0.5 rounded bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-primary)]">
                  {dialog.requireTypeToConfirm}
                </code>{' '}
                to confirm.
              </p>
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={dialog.requireTypeToConfirm}
                autoFocus
              />
            </div>
          )}
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}
