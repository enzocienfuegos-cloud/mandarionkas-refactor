import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Search, ArrowRight, CornerDownLeft } from '../icons';
import { cn } from '../cn';

// ─── Types ────────────────────────────────────────────────────────────────

export interface CommandItem {
  id: string;
  label: string;
  /** Optional secondary text shown after the label */
  description?: string;
  /** Optional group heading. Items with the same group cluster together. */
  group?: string;
  /** Optional leading icon */
  icon?: React.ReactNode;
  /** Optional keyboard shortcut hint, e.g. ['⌘', 'K'] */
  shortcut?: string[];
  /** Extra search terms beyond the label — synonyms, slugs, etc. */
  keywords?: string[];
  /** What runs when the item is selected. Receives a close fn. */
  perform: (close: () => void) => void;
}

export interface CommandPaletteContextValue {
  open:    () => void;
  close:   () => void;
  toggle:  () => void;
  isOpen:  boolean;
  /** Register items dynamically. Returns an unregister fn. */
  register: (items: CommandItem[]) => () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error('useCommandPalette must be used within <CommandPaletteProvider>');
  }
  return ctx;
}

/**
 * Convenience hook to register commands when a component mounts.
 *
 * @example
 *   useRegisterCommands([
 *     { id: 'campaign-new', label: 'New campaign', perform: (close) => { close(); navigate('/campaigns/new'); } },
 *   ]);
 */
export function useRegisterCommands(items: CommandItem[], deps: React.DependencyList = []) {
  const { register } = useCommandPalette();
  // We intentionally don't include `items` in deps — caller provides deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => register(items), deps);
}

// ─── Provider ─────────────────────────────────────────────────────────────

export function CommandPaletteProvider({
  children,
  initialItems = [],
}: {
  children: React.ReactNode;
  initialItems?: CommandItem[];
}) {
  const [isOpen, setIsOpen]   = useState(false);
  const [items, setItems]     = useState<CommandItem[]>(initialItems);

  const open    = useCallback(() => setIsOpen(true), []);
  const close   = useCallback(() => setIsOpen(false), []);
  const toggle  = useCallback(() => setIsOpen((v) => !v), []);

  const register = useCallback((next: CommandItem[]): (() => void) => {
    setItems((current) => [...current, ...next]);
    return () => {
      setItems((current) => current.filter((it) => !next.some((n) => n.id === it.id)));
    };
  }, []);

  // Global Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ open, close, toggle, isOpen, register }),
    [open, close, toggle, isOpen, register],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {isOpen && <CommandPaletteDialog items={items} onClose={close} />}
    </CommandPaletteContext.Provider>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────

interface CommandPaletteDialogProps {
  items:   CommandItem[];
  onClose: () => void;
}

function CommandPaletteDialog({ items, onClose }: CommandPaletteDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLUListElement>(null);
  const [query, setQuery]           = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // Focus the input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Lock body scroll
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  // Filter items
  const filtered = useMemo(() => fuzzyFilter(items, query), [items, query]);

  // Reset active index when filter changes
  useEffect(() => { setActiveIndex(0); }, [query]);

  // Group filtered items by their group property
  const grouped = useMemo(() => groupItems(filtered), [filtered]);

  // Flat order matches what the user sees on screen — used for arrow keys
  const flatOrder = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const runActive = useCallback(() => {
    const item = flatOrder[activeIndex];
    if (item) item.perform(onClose);
  }, [activeIndex, flatOrder, onClose]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatOrder.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0); return; }
      if (e.key === 'End')  { e.preventDefault(); setActiveIndex(flatOrder.length - 1); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        runActive();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flatOrder.length, runActive, onClose]);

  // Keep active item in view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLLIElement>(`[data-active='true']`);
    if (active) active.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-modal flex items-start justify-center pt-[10vh] px-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Dialog */}
      <div
        className="
          relative w-full max-w-2xl rounded-2xl bg-surface-1
          border border-[color:var(--dusk-border-default)]
          shadow-overlay overflow-hidden
        "
        style={{ boxShadow: 'var(--dusk-shadow-overlay)' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[color:var(--dusk-border-subtle)]">
          <Search className="h-4 w-4 shrink-0 text-[color:var(--dusk-text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            className="
              flex-1 bg-transparent border-none outline-none
              text-sm text-[color:var(--dusk-text-primary)]
              placeholder:text-[color:var(--dusk-text-soft)]
            "
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex shrink-0 items-center gap-0.5 px-1.5 h-5 rounded border border-[color:var(--dusk-border-default)] bg-surface-muted text-[10px] font-medium dusk-mono text-[color:var(--dusk-text-soft)]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {flatOrder.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-[color:var(--dusk-text-muted)]">
              No commands match <span className="dusk-mono">"{query}"</span>
            </p>
          </div>
        ) : (
          <ul
            ref={listRef}
            role="listbox"
            aria-label="Commands"
            className="max-h-[60vh] overflow-y-auto dusk-scrollbar py-2"
          >
            {grouped.map((group) => (
              <React.Fragment key={group.heading || 'ungrouped'}>
                {group.heading && (
                  <li className="px-4 pt-3 pb-1.5">
                    <span className="dusk-kicker">{group.heading}</span>
                  </li>
                )}
                {group.items.map((item) => {
                  const flatIndex = flatOrder.indexOf(item);
                  const isActive  = flatIndex === activeIndex;
                  return (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive}
                      onMouseMove={() => setActiveIndex(flatIndex)}
                      onClick={() => item.perform(onClose)}
                      className={cn(
                        'flex items-center gap-3 mx-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                        isActive
                          ? 'bg-[color:var(--dusk-surface-active)]'
                          : 'hover:bg-[color:var(--dusk-surface-hover)]',
                      )}
                    >
                      {item.icon && (
                        <span
                          className={cn(
                            'shrink-0 [&>svg]:h-4 [&>svg]:w-4',
                            isActive ? 'text-text-brand' : 'text-[color:var(--dusk-text-muted)]',
                          )}
                          aria-hidden
                        >
                          {item.icon}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[color:var(--dusk-text-primary)] truncate">
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="mt-0.5 text-xs text-[color:var(--dusk-text-soft)] truncate">
                            {item.description}
                          </p>
                        )}
                      </div>
                      {item.shortcut && (
                        <span className="shrink-0 hidden sm:flex items-center gap-1">
                          {item.shortcut.map((key, i) => (
                            <kbd
                              key={i}
                              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded border border-[color:var(--dusk-border-default)] bg-surface-muted text-[10px] font-medium dusk-mono text-[color:var(--dusk-text-soft)]"
                            >
                              {key}
                            </kbd>
                          ))}
                        </span>
                      )}
                      {isActive && !item.shortcut && (
                        <CornerDownLeft className="shrink-0 h-3.5 w-3.5 text-[color:var(--dusk-text-soft)]" />
                      )}
                    </li>
                  );
                })}
              </React.Fragment>
            ))}
          </ul>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)]">
          <div className="flex items-center gap-3 text-[10px] text-[color:var(--dusk-text-soft)]">
            <span className="inline-flex items-center gap-1">
              <kbd className="dusk-mono">↑↓</kbd> navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="dusk-mono">↵</kbd> select
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="dusk-mono">esc</kbd> close
            </span>
          </div>
          <span className="text-[10px] text-[color:var(--dusk-text-soft)]">
            {flatOrder.length} command{flatOrder.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Filtering ────────────────────────────────────────────────────────────

/**
 * Score-based fuzzy match. Returns items in match-quality order.
 * Cheap, no external deps. Good enough for a few hundred commands.
 */
function fuzzyFilter(items: CommandItem[], query: string): CommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  const scored: { item: CommandItem; score: number }[] = [];

  for (const item of items) {
    const haystack = [
      item.label.toLowerCase(),
      item.description?.toLowerCase() ?? '',
      ...(item.keywords ?? []).map((k) => k.toLowerCase()),
    ].join(' ');

    const score = fuzzyScore(haystack, q, item.label.toLowerCase());
    if (score > 0) scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}

function fuzzyScore(haystack: string, needle: string, label: string): number {
  // Exact label match wins
  if (label === needle) return 1000;
  // Label starts with the needle
  if (label.startsWith(needle)) return 500;
  // Label contains the needle
  if (label.includes(needle)) return 200;
  // Haystack contains the needle
  if (haystack.includes(needle)) return 50;

  // Acronym / sparse match: every needle char appears in order in haystack
  let hi = 0;
  for (const c of needle) {
    hi = haystack.indexOf(c, hi);
    if (hi === -1) return 0;
    hi += 1;
  }
  return 10;
}

// ─── Grouping ─────────────────────────────────────────────────────────────

interface Group {
  heading: string;
  items:   CommandItem[];
}

function groupItems(items: CommandItem[]): Group[] {
  const order: string[] = [];
  const groups: Record<string, CommandItem[]> = {};

  for (const item of items) {
    const key = item.group ?? '';
    if (!(key in groups)) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(item);
  }

  return order.map((key) => ({ heading: key, items: groups[key] }));
}
