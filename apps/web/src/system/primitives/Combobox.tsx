import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from '../icons';
import { cn } from '../cn';
import { Input } from './Input';
import { Popover } from './Popover';
import { Badge } from './Badge';

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  group?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface ComboboxProps<T extends ComboboxOption = ComboboxOption> {
  options?: T[];
  loadOptions?: (query: string) => Promise<T[]>;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
  placeholder?: string;
  loading?: boolean;
  minQueryLength?: number;
  emptyMessage?: React.ReactNode;
  renderOption?: (option: T) => React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  fullWidth?: boolean;
}

function normalizeValue(value: string | string[]): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function fuzzyFilter<T extends ComboboxOption>(items: T[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((option) => {
    const haystack = [option.label, option.description, option.group].filter(Boolean).join(' ').toLowerCase();
    if (haystack.includes(q)) return true;
    let index = 0;
    for (const char of q) {
      index = haystack.indexOf(char, index);
      if (index === -1) return false;
      index += 1;
    }
    return true;
  });
}

export function Combobox<T extends ComboboxOption = ComboboxOption>({
  options = [],
  loadOptions,
  value,
  onChange,
  multi = false,
  placeholder = 'Select option',
  loading = false,
  minQueryLength = 0,
  emptyMessage = 'No options found',
  renderOption,
  disabled = false,
  size = 'md',
  invalid = false,
  fullWidth = true,
}: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [asyncOptions, setAsyncOptions] = useState<T[]>(options);
  const [activeIndex, setActiveIndex] = useState(0);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const listboxId = useId();

  useEffect(() => {
    setAsyncOptions(options);
  }, [options]);

  useEffect(() => {
    if (!open) return;
    const frameId = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frameId);
  }, [open]);

  useEffect(() => {
    if (!loadOptions) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (query.length < minQueryLength) {
      setAsyncOptions([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void loadOptions(query)
        .then((nextOptions) => {
          if (requestId === requestIdRef.current) {
            setAsyncOptions(nextOptions);
          }
        })
        .catch(() => {
          if (requestId === requestIdRef.current) {
            setAsyncOptions([]);
          }
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadOptions, minQueryLength, query]);

  const selectedValues = normalizeValue(value);
  const optionPool = loadOptions ? asyncOptions : options;
  const filtered = useMemo(() => loadOptions ? optionPool : fuzzyFilter(optionPool, query), [loadOptions, optionPool, query]);
  const selectedOptions = optionPool.filter((option) => selectedValues.includes(option.value));
  const activeOption = filtered[activeIndex] ?? null;

  const commit = (next: string[]) => {
    onChange(multi ? next : (next[0] ?? ''));
  };

  const selectOption = (option: T) => {
    if (option.disabled) return;
    const isSelected = selectedValues.includes(option.value);
    if (multi) {
      commit(isSelected
        ? selectedValues.filter((entry) => entry !== option.value)
        : [...selectedValues, option.value]);
      return;
    }
    commit([option.value]);
    setOpen(false);
  };

  return (
    <div className={cn('relative', fullWidth && 'w-full')}>
      <div
        ref={anchorRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-disabled={disabled || undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          'flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border bg-surface-1 px-3 text-left',
          invalid ? 'border-[color:var(--dusk-status-critical-fg)]' : 'border-border-default hover:border-border-strong',
          size === 'sm' && 'min-h-8 text-xs',
          size === 'md' && 'min-h-10 text-sm',
          size === 'lg' && 'min-h-12 text-sm',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {multi && selectedOptions.length > 0 ? (
            selectedOptions.map((option) => (
              <span key={option.value} className="inline-flex items-center gap-1">
                <Badge tone="neutral">{option.label}</Badge>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-text-soft hover:bg-surface-hover hover:text-text-primary"
                  aria-label={`Remove ${option.label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    commit(selectedValues.filter((entry) => entry !== option.value));
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          ) : (
            <span className={cn(selectedOptions[0] ? 'text-text-primary' : 'text-text-soft')}>
              {selectedOptions[0]?.label ?? placeholder}
            </span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-text-soft" />
      </div>

      <Popover open={open} anchorRef={anchorRef} onClose={() => setOpen(false)} role="dialog" className="w-[min(440px,calc(100vw-2rem))]">
        <div className="space-y-2">
          <Input
            ref={inputRef}
            value={query}
            role="combobox"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-activedescendant={activeOption ? `${listboxId}-${activeOption.value}` : undefined}
            aria-autocomplete="list"
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((current) => Math.max(current - 1, 0));
              } else if (event.key === 'Home') {
                event.preventDefault();
                setActiveIndex(0);
              } else if (event.key === 'End') {
                event.preventDefault();
                setActiveIndex(Math.max(filtered.length - 1, 0));
              } else if (event.key === 'Enter' && activeOption) {
                event.preventDefault();
                selectOption(activeOption);
              } else if (event.key === 'Escape') {
                setOpen(false);
              }
            }}
            leadingIcon={<Search />}
            placeholder="Search..."
            inputSize={size}
          />
          <div id={listboxId} role="listbox" className="max-h-72 overflow-auto">
            {loading ? (
              <div className="px-3 py-2 text-sm text-text-muted">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-text-muted">{emptyMessage}</div>
            ) : (
              filtered.map((option, index) => {
                const isSelected = selectedValues.includes(option.value);
                const isActive = index === activeIndex;
                return (
                  <button
                    key={option.value}
                    id={`${listboxId}-${option.value}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => selectOption(option)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left',
                      isActive && 'bg-surface-hover',
                      option.disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-surface-hover',
                    )}
                  >
                    <span className="mt-0.5 h-4 w-4 shrink-0 text-text-brand">
                      {isSelected ? <Check className="h-4 w-4" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      {renderOption ? renderOption(option) : (
                        <>
                          <span className="block text-sm text-text-primary">{option.label}</span>
                          {option.description ? <span className="block text-xs text-text-muted">{option.description}</span> : null}
                          {option.disabled && option.disabledReason ? <span className="block text-xs text-text-soft">{option.disabledReason}</span> : null}
                        </>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {multi && selectedOptions.length > 0 ? (
            <button
              type="button"
              onClick={() => commit([])}
              className="inline-flex items-center gap-2 px-2 py-1 text-xs text-text-muted hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" />
              Clear selection
            </button>
          ) : null}
        </div>
      </Popover>
    </div>
  );
}
