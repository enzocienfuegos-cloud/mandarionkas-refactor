import React, { cloneElement, isValidElement, useState } from 'react';
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { cn } from '../cn';

export interface TooltipProps {
  /** Content shown on hover. Keep it short — 1-2 lines max. */
  content: React.ReactNode;
  /** Trigger content. When `asChild` is true, pass a single element to receive the trigger props directly. */
  children: React.ReactNode;
  /** Position relative to trigger. Default 'top'. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Delay before showing (ms). Default 200. */
  delay?: number;
  /** Disable tooltip without removing it from tree. */
  disabled?: boolean;
  /** Forward trigger props directly to the child element instead of wrapping it in a span. */
  asChild?: boolean;
}

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
  asChild = false,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const floating = useFloating({
    open,
    onOpenChange: setOpen,
    placement: side,
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const hover = useHover(floating.context, {
    enabled: !disabled,
    delay: { open: delay, close: 0 },
  });
  const focus = useFocus(floating.context, { enabled: !disabled });
  const dismiss = useDismiss(floating.context);
  const role = useRole(floating.context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  const trigger = isValidElement(children)
    ? cloneElement(children, {
        ...getReferenceProps(children.props),
        ref: floating.refs.setReference,
      })
    : (
      <span
        {...getReferenceProps({
          ref: floating.refs.setReference,
        })}
        tabIndex={disabled ? undefined : 0}
        className="inline-flex"
      >
        {children}
      </span>
    );

  return (
    <>
      {trigger}
      {open && !disabled && (
        <FloatingPortal>
          <div
            ref={floating.refs.setFloating}
            style={floating.floatingStyles}
            className={cn(
              'pointer-events-none z-[var(--dusk-z-tooltip)] max-w-xs rounded-md border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2 text-xs text-[color:var(--dusk-text-secondary)] shadow-3',
              'animate-[duskFadeIn_160ms_ease-out]',
            )}
            {...getFloatingProps()}
          >
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
