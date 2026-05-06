import React, { useEffect, useRef } from 'react';
import { Close } from '../icons';
import { cn } from '../cn';
import { IconButton } from './Button';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Width preset. Default 'md'. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Don't close on backdrop click (default false) */
  preventBackdropClose?: boolean;
  /** Don't close on Escape (default false) */
  preventEscapeClose?: boolean;
  /** Show close button (default true) */
  showCloseButton?: boolean;
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * Modal dialog primitive.
 * - Focus is moved into the modal on open.
 * - Focus is restored to the previously focused element on close.
 * - Tab is trapped inside the modal while open.
 * - Escape and backdrop click both close (configurable).
 * - aria-modal="true" + role="dialog".
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  preventBackdropClose = false,
  preventEscapeClose = false,
  showCloseButton = true,
}: ModalProps) {
  const dialogRef    = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus management
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Focus first focusable element, or the dialog itself
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const target = focusable[0] ?? dialog;
    requestAnimationFrame(() => target.focus());

    return () => {
      previousFocusRef.current?.focus();
    };
  }, [open]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Keyboard: Escape + Tab trap
  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !preventEscapeClose) {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose, preventEscapeClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !preventBackdropClose) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[duskFadeIn_180ms_ease-out]"
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dusk-modal-title' : undefined}
        aria-describedby={description ? 'dusk-modal-description' : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full rounded-2xl bg-surface-1 shadow-overlay border border-[color:var(--dusk-border-default)]',
          'animate-[duskScaleIn_180ms_ease-out]',
          sizeClasses[size],
        )}
      >
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-2">
            <div className="min-w-0">
              {title && (
                <h2 id="dusk-modal-title" className="text-lg font-semibold text-[color:var(--dusk-text-primary)] tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id="dusk-modal-description" className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <IconButton
                icon={<Close />}
                aria-label="Close dialog"
                onClick={onClose}
                size="sm"
                variant="ghost"
                className="-mt-1 -mr-1"
              />
            )}
          </div>
        )}

        <div className="px-6 py-4">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[color:var(--dusk-border-subtle)]">
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes duskFadeIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes duskScaleIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px) }
          to   { opacity: 1; transform: scale(1) translateY(0) }
        }
      `}</style>
    </div>
  );
}
