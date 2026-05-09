import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type TooltipProps = {
  content: ReactNode;
  children: ReactElement;
  disabled?: boolean;
  placement?: 'top' | 'bottom';
  delay?: number;
  disableOnTouch?: boolean;
};

type TooltipPlacement = 'top' | 'bottom';

type TooltipPosition = {
  left: number;
  top: number;
  placement: TooltipPlacement;
};

type TooltipRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type TooltipViewport = {
  width: number;
  height: number;
};

export function resolveTooltipPosition(
  triggerRect: TooltipRect,
  bubbleRect: Pick<TooltipRect, 'width' | 'height'>,
  placement: TooltipPlacement,
  viewport: TooltipViewport,
  margin = 8,
): TooltipPosition {
  let resolvedPlacement = placement;
  let top = placement === 'top'
    ? triggerRect.top - bubbleRect.height - margin
    : triggerRect.bottom + margin;

  if (top < margin) {
    resolvedPlacement = 'bottom';
    top = triggerRect.bottom + margin;
  }

  if (top + bubbleRect.height > viewport.height - margin) {
    resolvedPlacement = 'top';
    top = triggerRect.top - bubbleRect.height - margin;
  }

  const left = Math.max(
    margin,
    Math.min(
      viewport.width - bubbleRect.width - margin,
      triggerRect.left + triggerRect.width / 2 - bubbleRect.width / 2,
    ),
  );

  return { left, top, placement: resolvedPlacement };
}

export function Tooltip({
  content,
  children,
  disabled = false,
  placement = 'top',
  delay = 400,
  disableOnTouch = true,
}: TooltipProps): JSX.Element {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLSpanElement | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<TooltipPosition | null>(null);
  const canUsePortal = typeof document !== 'undefined' && Boolean(document.body);

  if (disabled || !content || !isValidElement(children)) {
    return <>{children}</>;
  }

  const clearShowTimer = () => {
    if (showTimerRef.current !== null) {
      globalThis.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  };

  const show = (event?: FocusEvent<HTMLElement> | ReactPointerEvent<HTMLElement>) => {
    if (
      disableOnTouch
      && event
      && 'pointerType' in event
      && event.pointerType === 'touch'
    ) {
      return;
    }
    clearShowTimer();
    showTimerRef.current = globalThis.setTimeout(() => {
      showTimerRef.current = null;
      setOpen(true);
    }, delay);
  };

  const hide = () => {
    clearShowTimer();
    setOpen(false);
  };

  useEffect(() => () => clearShowTimer(), []);

  useEffect(() => {
    if (!open) return undefined;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hide();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !canUsePortal || !triggerRef.current || !bubbleRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const bubbleRect = bubbleRef.current.getBoundingClientRect();
    setCoords(resolveTooltipPosition(triggerRect, bubbleRect, placement, {
      width: window.innerWidth,
      height: window.innerHeight,
    }));
  }, [canUsePortal, content, open, placement]);

  const originalRef = (children as { ref?: unknown }).ref;
  const childProps = children.props as Record<string, unknown>;
  const child = cloneElement(children as ReactElement<Record<string, unknown>>, {
    'aria-describedby': open ? tooltipId : undefined,
    ref: (element: HTMLElement | null) => {
      triggerRef.current = element;
      if (typeof originalRef === 'function') {
        originalRef(element);
      } else if (originalRef && typeof originalRef === 'object') {
        (originalRef as { current: HTMLElement | null }).current = element;
      }
    },
    onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => {
      show(event);
      if (typeof childProps.onPointerEnter === 'function') {
        childProps.onPointerEnter(event);
      }
    },
    onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => {
      hide();
      if (typeof childProps.onPointerLeave === 'function') {
        childProps.onPointerLeave(event);
      }
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      show(event);
      if (typeof childProps.onFocus === 'function') {
        childProps.onFocus(event);
      }
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      hide();
      if (typeof childProps.onBlur === 'function') {
        childProps.onBlur(event);
      }
    },
  });

  const bubble = (
    <span
      ref={bubbleRef}
      id={tooltipId}
      role="tooltip"
      hidden={!open}
      aria-hidden={!open}
      className={[
        'tooltip-bubble',
        `tooltip-bubble--${coords?.placement ?? placement}`,
        canUsePortal ? 'tooltip-bubble--portal' : '',
      ].filter(Boolean).join(' ')}
      style={canUsePortal
        ? coords
          ? {
              position: 'fixed',
              left: coords.left,
              top: coords.top,
            }
          : {
              position: 'fixed',
              left: -9999,
              top: -9999,
            }
        : undefined}
    >
      {content}
    </span>
  );

  return (
    <span className="tooltip-shell">
      {child}
      {canUsePortal
        ? open
          ? createPortal(bubble, document.body)
          : null
        : bubble}
    </span>
  );
}
