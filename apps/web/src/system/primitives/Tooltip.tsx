import React, { cloneElement, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../cn';

export interface TooltipProps {
  /** Content shown on hover. Keep it short — 1-2 lines max. */
  content: React.ReactNode;
  /** Element that triggers the tooltip. Must be focusable for keyboard users. */
  children: React.ReactElement;
  /** Position relative to trigger. Default 'top'. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Delay before showing (ms). Default 200. */
  delay?: number;
  /** Disable tooltip without removing it from tree. */
  disabled?: boolean;
}

const sideClasses: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
};

/**
 * Lightweight hover/focus tooltip for short operational hints.
 *
 * Use this for compact chrome that benefits from inline explanation:
 * status badges, icon-only actions, "last sync" indicators and similar
 * adserver surfaces where the meaning should be clear without stealing space.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 200,
  disabled = false,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const timerRef = useRef<number | null>(null);

  const clearPending = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const show = () => {
    if (disabled) return;
    clearPending();
    timerRef.current = window.setTimeout(() => setOpen(true), delay);
  };

  const hide = () => {
    clearPending();
    setOpen(false);
  };

  useEffect(() => () => clearPending(), []);

  return (
    <span className="relative inline-flex">
      {cloneElement(children, {
        'aria-describedby': open ? tooltipId : undefined,
        onMouseEnter: (event: React.MouseEvent) => {
          children.props.onMouseEnter?.(event);
          show();
        },
        onMouseLeave: (event: React.MouseEvent) => {
          children.props.onMouseLeave?.(event);
          hide();
        },
        onFocus: (event: React.FocusEvent) => {
          children.props.onFocus?.(event);
          show();
        },
        onBlur: (event: React.FocusEvent) => {
          children.props.onBlur?.(event);
          hide();
        },
      })}

      {open && !disabled && (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-[var(--dusk-z-tooltip)] max-w-xs rounded-md border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2 text-xs text-[color:var(--dusk-text-secondary)] shadow-3',
            'animate-[duskFadeIn_160ms_ease-out]',
            sideClasses[side],
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
