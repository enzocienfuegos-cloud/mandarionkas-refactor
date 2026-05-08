import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Placement } from '@floating-ui/react';
import { cn } from '../cn';
import { createFloatingPositioner } from '../internal/floatingPosition';

export interface PopoverProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  role?: 'dialog' | 'menu';
}

export function Popover({
  open,
  anchorRef,
  onClose,
  className,
  children,
  placement = 'bottom',
  role = 'dialog',
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const cleanupPosition = anchorRef.current && panelRef.current
      ? createFloatingPositioner(anchorRef.current, panelRef.current, {
          placement: `${placement}-start` as Placement,
          offset: 8,
        })
      : null;

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cleanupPosition?.();
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose, open, placement]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-modal={role === 'dialog' ? 'false' : undefined}
      className={cn(
        'fixed left-0 top-0 z-[var(--dusk-z-popover)] min-w-[var(--dusk-menu-min-width)]',
        'rounded-2xl border border-[color:var(--dusk-border-default)] bg-surface-1 p-2 shadow-overlay backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
