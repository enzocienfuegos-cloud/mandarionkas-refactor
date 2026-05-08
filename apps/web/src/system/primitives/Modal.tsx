import React, { useEffect, useId, useMemo, useRef } from 'react';
import { Close } from '../icons';
import { cn } from '../cn';
import { IconButton } from './Button';
import { lockBodyScroll, unlockBodyScroll } from '../internal/scrollLock';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Width preset. Default 'md'. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Don't close on backdrop click (default false) */
  preventBackdropClose?: boolean;
  /** Don't close on Escape (default false) */
  preventEscapeClose?: boolean;
  /** Show close button (default true) */
  showCloseButton?: boolean;
}

interface ModalSectionProps {
  children: React.ReactNode;
  className?: string;
}

type ModalComponent = React.FC<ModalProps> & {
  Header: React.FC<ModalSectionProps>;
  Body: React.FC<ModalSectionProps>;
  Footer: React.FC<ModalSectionProps>;
};

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-[var(--dusk-modal-max-width-sm)]',
  md: 'max-w-[var(--dusk-modal-max-width-md)]',
  lg: 'max-w-[var(--dusk-modal-max-width-lg)]',
  xl: 'max-w-[var(--dusk-modal-max-width-xl)]',
  '2xl': 'max-w-[var(--dusk-modal-max-width-2xl)]',
};

function ModalHeaderSection({ children, className }: ModalSectionProps) {
  return <div data-modal-section="header" className={className}>{children}</div>;
}

function ModalBodySection({ children, className }: ModalSectionProps) {
  return <div data-modal-section="body" className={className}>{children}</div>;
}

function ModalFooterSection({ children, className }: ModalSectionProps) {
  return <div data-modal-section="footer" className={className}>{children}</div>;
}

function isSectionElement(
  node: React.ReactNode,
  type: React.FC<ModalSectionProps>,
): node is React.ReactElement<ModalSectionProps> {
  return React.isValidElement(node) && node.type === type;
}

/**
 * Modal dialog primitive.
 * - Focus is moved into the modal on open.
 * - Focus is restored to the previously focused element on close.
 * - Tab is trapped inside the modal while open.
 * - Escape and backdrop click both close (configurable).
 * - aria-modal="true" + role="dialog".
 *
 * Supports both the legacy prop API and the compound API:
 * `<Modal.Header />`, `<Modal.Body />`, `<Modal.Footer />`.
 */
const ModalImpl: ModalComponent = function Modal({
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const compoundSections = useMemo(() => {
    const nodes = React.Children.toArray(children);
    const header = nodes.find((node) => isSectionElement(node, ModalHeaderSection)) as React.ReactElement<ModalSectionProps> | undefined;
    const body = nodes.find((node) => isSectionElement(node, ModalBodySection)) as React.ReactElement<ModalSectionProps> | undefined;
    const footerSection = nodes.find((node) => isSectionElement(node, ModalFooterSection)) as React.ReactElement<ModalSectionProps> | undefined;
    const hasCompound = Boolean(header || body || footerSection);

    return {
      hasCompound,
      header,
      body,
      footerSection,
    };
  }, [children]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const target = focusable[0] ?? dialog;
    requestAnimationFrame(() => target.focus());

    return () => {
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [open]);

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
        const last = focusable[focusable.length - 1];

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

  const shouldUseLegacyHeader = !compoundSections.hasCompound && (title || showCloseButton);
  const footerContent = compoundSections.hasCompound ? compoundSections.footerSection : footer;
  const bodyContent = compoundSections.hasCompound ? (compoundSections.body ?? null) : children;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !preventBackdropClose) onClose();
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
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full rounded-2xl border border-[color:var(--dusk-border-default)] bg-surface-1 shadow-overlay',
          'animate-[duskScaleIn_180ms_ease-out]',
          sizeClasses[size],
        )}
      >
        {compoundSections.hasCompound ? (
          <>
            {compoundSections.header ? (
              <div className={cn('px-6 pt-5 pb-2', compoundSections.header.props.className)}>
                {compoundSections.header.props.children}
              </div>
            ) : null}
            <div className="px-6 py-4">{bodyContent}</div>
          </>
        ) : (
          <>
            {shouldUseLegacyHeader && (
              <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-2">
                <div className="min-w-0">
                  {title ? (
                    <h2 id={titleId} className="text-lg font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
                      {title}
                    </h2>
                  ) : null}
                  {description ? (
                    <p id={descriptionId} className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
                      {description}
                    </p>
                  ) : null}
                </div>
                {showCloseButton ? (
                  <IconButton
                    icon={<Close />}
                    aria-label="Close dialog"
                    onClick={onClose}
                    size="sm"
                    variant="ghost"
                    className="-mt-1 -mr-1"
                  />
                ) : null}
              </div>
            )}
            <div className="px-6 py-4">{bodyContent}</div>
          </>
        )}

        {compoundSections.hasCompound ? (
          compoundSections.header && showCloseButton ? (
            <IconButton
              icon={<Close />}
              aria-label="Close dialog"
              onClick={onClose}
              size="sm"
              variant="ghost"
              className="absolute right-5 top-5"
            />
          ) : null
        ) : null}

        {footerContent ? (
          <div className={cn(
            'flex items-center justify-end gap-2 border-t border-[color:var(--dusk-border-subtle)] px-6 py-4',
            React.isValidElement(footerContent) ? (footerContent.props.className ?? '') : '',
          )}>
            {React.isValidElement(footerContent) ? footerContent.props.children : footerContent}
          </div>
        ) : null}
      </div>
    </div>
  );
} as ModalComponent;

ModalImpl.Header = ModalHeaderSection;
ModalImpl.Body = ModalBodySection;
ModalImpl.Footer = ModalFooterSection;

export const Modal = ModalImpl;
