import React, { cloneElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Placement } from '@floating-ui/react';
import { cn } from '../cn';
import { createFloatingPositioner } from '../internal/floatingPosition';

export interface DropdownMenuItem {
  id: string;
  label: string;
  /** Optional leading icon. */
  icon?: React.ReactNode;
  /** Action handler. */
  onSelect: () => void;
  /** Marks item as destructive (red). */
  danger?: boolean;
  /** Disable individual item. */
  disabled?: boolean;
  /** Optional secondary text (right-aligned, muted). E.g. shortcut "⌘K". */
  shortcut?: string;
}

export interface DropdownMenuSeparator {
  type: 'separator';
}

export interface DropdownMenuLabel {
  type: 'label';
  text: string;
}

export type DropdownMenuEntry = DropdownMenuItem | DropdownMenuSeparator | DropdownMenuLabel;

export interface DropdownMenuProps {
  /** Trigger element. Will receive ref + onClick + aria-expanded. */
  trigger: React.ReactElement;
  /** Menu entries. */
  items: DropdownMenuEntry[];
  /** Side relative to trigger. Default 'bottom'. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Align with trigger edge. Default 'end'. */
  align?: 'start' | 'center' | 'end';
}

function isMenuItem(entry: DropdownMenuEntry): entry is DropdownMenuItem {
  return !('type' in entry);
}

function getPlacement(
  side: NonNullable<DropdownMenuProps['side']>,
  align: NonNullable<DropdownMenuProps['align']>,
): Placement {
  if (align === 'center') return side;
  return `${side}-${align}` as Placement;
}

/**
 * Compact action menu for dense row-level operations. Use this when a table
 * row has multiple real actions and inline buttons would steal scanability.
 */
export function DropdownMenu({
  trigger,
  items,
  side = 'bottom',
  align = 'end',
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingFocusRef = useRef<1 | -1 | null>(null);

  const actionableEntries = useMemo(
    () => items.filter(isMenuItem).filter((entry) => !entry.disabled),
    [items],
  );

  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocumentClick);
    document.addEventListener('keydown', onEscape);
    const cleanupPosition = triggerRef.current && menuRef.current
      ? createFloatingPositioner(triggerRef.current, menuRef.current, {
          placement: getPlacement(side, align),
          offset: 8,
        })
      : null;
    return () => {
      cleanupPosition?.();
      document.removeEventListener('mousedown', onDocumentClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [align, open, side]);

  useEffect(() => {
    if (!open || pendingFocusRef.current == null) return;
    const direction = pendingFocusRef.current;
    pendingFocusRef.current = null;
    requestAnimationFrame(() => moveFocus(direction));
  }, [open]);

  const focusItem = (index: number) => {
    itemRefs.current[index]?.focus();
  };

  const moveFocus = (direction: 1 | -1) => {
    const enabled = actionableEntries;
    if (enabled.length === 0) return;
    const currentIndex = enabled.findIndex((entry) => {
      const element = itemRefs.current.find((node) => node?.dataset.menuItemId === entry.id);
      return element === document.activeElement;
    });
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + direction + enabled.length) % enabled.length;
    const targetId = enabled[nextIndex].id;
    const domIndex = itemRefs.current.findIndex((node) => node?.dataset.menuItemId === targetId);
    if (domIndex >= 0) focusItem(domIndex);
  };

  return (
    <span ref={rootRef} className="relative inline-flex">
      {cloneElement(trigger, {
        ref: (node: HTMLElement | null) => {
          triggerRef.current = node;
          const originalRef = (trigger as React.ReactElement & { ref?: React.Ref<HTMLElement> }).ref;
          if (typeof originalRef === 'function') originalRef(node);
          else if (originalRef && typeof originalRef === 'object') {
            (originalRef as React.MutableRefObject<HTMLElement | null>).current = node;
          }
        },
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        'aria-controls': open ? menuId : undefined,
        onClick: (event: React.MouseEvent) => {
          trigger.props.onClick?.(event);
          if (event.defaultPrevented) return;
          setOpen((current) => !current);
        },
        onKeyDown: (event: React.KeyboardEvent) => {
          trigger.props.onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            pendingFocusRef.current = 1;
            setOpen(true);
          }
        },
      })}

      {open && (
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-orientation="vertical"
            className={cn(
              'fixed z-[var(--dusk-z-popover)] min-w-[200px] rounded-md border border-[color:var(--dusk-border-default)] bg-surface-1 p-1 shadow-3',
            )}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                moveFocus(1);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                moveFocus(-1);
              } else if (event.key === 'Home') {
                event.preventDefault();
                moveFocus(1);
              } else if (event.key === 'End') {
                event.preventDefault();
                moveFocus(-1);
              }
            }}
          >
            {items.map((entry, index) => {
              if ('type' in entry && entry.type === 'separator') {
                return <div key={`separator-${index}`} className="my-1 border-t border-[color:var(--dusk-border-subtle)]" />;
              }
              if ('type' in entry && entry.type === 'label') {
                return (
                  <div
                    key={`label-${entry.text}-${index}`}
                    className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-kicker text-[color:var(--dusk-text-soft)]"
                  >
                    {entry.text}
                  </div>
                );
              }

              const item = entry;
              return (
                <button
                  key={item.id}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  data-menu-item-id={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    'focus:bg-surface-active focus:outline-none',
                    item.danger
                      ? 'text-[color:var(--dusk-status-critical-fg)] hover:bg-[color:var(--dusk-status-critical-bg)]'
                      : 'text-[color:var(--dusk-text-primary)] hover:bg-surface-hover',
                    item.disabled && 'cursor-not-allowed opacity-50',
                  )}
                  onClick={() => {
                    if (item.disabled) return;
                    item.onSelect();
                    setOpen(false);
                  }}
                >
                  {item.icon && <span className="shrink-0 text-[color:inherit]">{item.icon}</span>}
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {item.shortcut && (
                    <span className="dusk-mono text-[11px] text-[color:var(--dusk-text-soft)]">{item.shortcut}</span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      )}
    </span>
  );
}
