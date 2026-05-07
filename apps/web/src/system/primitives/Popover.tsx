import React, { useEffect, useRef } from 'react';
import { cn } from '../cn';

export interface PopoverProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}

export function Popover({ open, anchorRef, onClose, className, children }: PopoverProps) {
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

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose, open]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      className={cn(
        'absolute left-0 top-[calc(100%+0.5rem)] z-[var(--dusk-z-popover)] min-w-[220px]',
        'rounded-2xl border border-[color:var(--dusk-border-default)] bg-surface-1 p-2 shadow-overlay backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </div>
  );
}
