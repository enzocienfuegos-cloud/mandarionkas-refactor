import React, { cloneElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../cn';

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

const sideClasses = {
  top: 'bottom-full mb-2',
  right: 'left-full ml-2',
  bottom: 'top-full mt-2',
  left: 'right-full mr-2',
} as const;

const alignClasses = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
} as const;

function isMenuItem(entry: DropdownMenuEntry): entry is DropdownMenuItem {
  return !('type' in entry);
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
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingFocusRef = useRef<1 | -1 | null>(null);

  const actionableEntries = useMemo(
    () => items.filter(isMenuItem).filter((entry) => !entry.disabled),
    [items],
  );

  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocumentClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

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
        <div
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          className={cn(
            'absolute z-[var(--dusk-z-popover)] min-w-[200px] rounded-md border border-[color:var(--dusk-border-default)] bg-surface-1 p-1 shadow-3',
            sideClasses[side],
            alignClasses[align],
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
        </div>
      )}
    </span>
  );
}
