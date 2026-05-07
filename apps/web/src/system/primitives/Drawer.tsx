import React, { useEffect, useRef } from 'react';
import { Close } from '../icons';
import { cn } from '../cn';
import { IconButton } from './Button';

export interface DrawerProps {
  /** Open state. */
  open: boolean;
  /** Close handler. */
  onClose: () => void;
  /** Side from which it slides. Default 'right'. */
  side?: 'right' | 'left';
  /** Width preset or px value. Default 'md'. */
  size?: 'sm' | 'md' | 'lg' | number;
  /** Title shown in header. */
  title?: string;
  /** Optional subtitle. */
  subtitle?: string;
  /** Footer content (e.g. action buttons). */
  footer?: React.ReactNode;
  /** Body content. */
  children: React.ReactNode;
  /** Optional className for the drawer container. */
  className?: string;
}

const sizeWidths = {
  sm: 'w-full max-w-[400px]',
  md: 'w-full max-w-[520px]',
  lg: 'w-full max-w-[720px]',
} as const;

/**
 * Side drawer for detail inspection while preserving list context. Use this
 * when a trafficker needs to inspect one entity and immediately jump back to
 * the queue without losing scroll position or workspace state.
 */
export function Drawer({
  open,
  onClose,
  side = 'right',
  size = 'md',
  title,
  subtitle,
  footer,
  children,
  className,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const target = focusable?.[0] ?? panel;
    requestAnimationFrame(() => target?.focus());
    return () => previousFocusRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
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
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const widthClass = typeof size === 'number' ? null : sizeWidths[size];

  return (
    <div className="fixed inset-0 z-modal">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-black/40 transition-opacity duration-base ease-standard motion-reduce:transition-none"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 flex flex-col border-[color:var(--dusk-border-default)] bg-surface-1 shadow-overlay transition-transform duration-base ease-standard motion-reduce:transition-none',
          side === 'right'
            ? 'right-0 border-l animate-[duskSlideInRight_180ms_ease-out]'
            : 'left-0 border-r animate-[duskSlideInLeft_180ms_ease-out]',
          widthClass,
          className,
        )}
        style={typeof size === 'number' ? { width: `${size}px`, maxWidth: '100%' } : undefined}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--dusk-border-subtle)] px-4 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">{subtitle}</p>}
          </div>
          <IconButton
            icon={<Close />}
            aria-label="Close drawer"
            onClick={onClose}
            size="sm"
            variant="ghost"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[color:var(--dusk-border-subtle)] px-4 py-4">
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes duskSlideInRight {
          from { transform: translateX(100%); opacity: 0.96; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes duskSlideInLeft {
          from { transform: translateX(-100%); opacity: 0.96; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
