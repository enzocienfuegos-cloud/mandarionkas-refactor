import React, { useMemo, useState } from 'react';
import { ChevronDown, Search, X } from '../icons';
import { cn } from '../cn';
import { Button } from './Button';
import { Input } from './Input';
import { Popover } from './Popover';

export interface FilterPill {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

export interface FilterBarProps {
  pills: FilterPill[];
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  onResetAll?: () => void;
  activeFilterCount?: number;
  className?: string;
}

function isDefaultValue(pill: FilterPill) {
  return pill.value === pill.options[0]?.value;
}

export function FilterBar({
  pills,
  search,
  onResetAll,
  activeFilterCount = 0,
  className,
}: FilterBarProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [optionSearch, setOptionSearch] = useState<Record<string, string>>({});
  const anchorRefs = useMemo(
    () => Object.fromEntries(pills.map((pill) => [pill.id, React.createRef<HTMLButtonElement>()])),
    [pills],
  );

  return (
    <div className={cn('flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="flex flex-1 flex-wrap items-end gap-3">
        {pills.map((pill) => {
          const selectedOption = pill.options.find((option) => option.value === pill.value) ?? pill.options[0];
          const isActive = !isDefaultValue(pill);
          const anchorRef = anchorRefs[pill.id];
          const query = optionSearch[pill.id]?.trim().toLowerCase() ?? '';
          const filteredOptions = query
            ? pill.options.filter((option) => (
                option.label.toLowerCase().includes(query)
                || option.value.toLowerCase().includes(query)
              ))
            : pill.options;
          const isSearchable = pill.options.length > 8;

          return (
            <div key={pill.id} className="relative">
              <div
                role="group"
                aria-label={pill.label}
                className={cn(
                  'inline-flex h-12 items-center rounded-lg border transition-[background-color,border-color,box-shadow] duration-base ease-standard',
                  isActive
                    ? 'border-brand-500/40 bg-[color:var(--dusk-surface-active)]'
                    : 'border-[color:var(--dusk-border-default)] bg-surface-1 hover:border-[color:var(--dusk-border-strong)] hover:bg-surface-hover',
                )}
              >
                <button
                  ref={anchorRef}
                  type="button"
                  onClick={() => {
                    setOpenId((current) => current === pill.id ? null : pill.id);
                    setOptionSearch((current) => ({ ...current, [pill.id]: '' }));
                  }}
                  className="inline-flex flex-1 items-center gap-2 px-4 text-sm font-medium text-[color:var(--dusk-text-secondary)] hover:text-[color:var(--dusk-text-primary)]"
                  aria-expanded={openId === pill.id}
                  aria-haspopup="dialog"
                >
                  <span className="text-[color:var(--dusk-text-muted)]">{pill.label}</span>
                  <span>{selectedOption?.label}</span>
                  {!isActive && <ChevronDown className="h-4 w-4 text-[color:var(--dusk-text-soft)]" />}
                </button>
                {isActive ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      pill.onChange(pill.options[0]?.value ?? '');
                    }}
                    className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[color:var(--dusk-text-soft)] hover:bg-surface-hover hover:text-[color:var(--dusk-text-primary)]"
                    aria-label={`Clear ${pill.label}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <Popover
                open={openId === pill.id}
                anchorRef={anchorRef}
                onClose={() => setOpenId(null)}
                className="w-[min(28rem,calc(100vw-2rem))]"
              >
                <div className="space-y-2">
                  {isSearchable ? (
                    <Input
                      inputSize="sm"
                      value={optionSearch[pill.id] ?? ''}
                      onChange={(event) => {
                        setOptionSearch((current) => ({ ...current, [pill.id]: event.target.value }));
                      }}
                      placeholder={`Search ${pill.label.toLowerCase()}...`}
                      autoFocus
                    />
                  ) : null}

                  <div className="max-h-[min(24rem,calc(100vh-12rem))] space-y-1 overflow-y-auto pr-1">
                    {filteredOptions.map((option) => {
                      const checked = option.value === pill.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            pill.onChange(option.value);
                            setOpenId(null);
                          }}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm',
                            checked
                              ? 'bg-[color:var(--dusk-surface-active)] text-[color:var(--dusk-text-primary)]'
                              : 'text-[color:var(--dusk-text-secondary)] hover:bg-surface-hover hover:text-[color:var(--dusk-text-primary)]',
                          )}
                        >
                          <span
                            className={cn(
                              'h-4 w-4 rounded-full border',
                              checked
                                ? 'border-brand-500 bg-brand-500 shadow-brand'
                                : 'border-[color:var(--dusk-border-default)] bg-surface-1',
                            )}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate" title={option.label}>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {filteredOptions.length === 0 ? (
                    <div className="rounded-xl border border-[color:var(--dusk-border-subtle)] bg-surface-2 px-3 py-3 text-sm text-[color:var(--dusk-text-muted)]">
                      No {pill.label.toLowerCase()} matches "{optionSearch[pill.id]}".
                    </div>
                  ) : null}
                </div>
              </Popover>
            </div>
          );
        })}

        {search ? (
          <label className="relative min-w-[280px] flex-1">
            <span className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[color:var(--dusk-text-muted)]">
              <Search className="h-4 w-4" />
            </span>
            <Input
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
              className="min-h-[48px] pl-10"
              placeholder={search.placeholder ?? 'Search'}
            />
          </label>
        ) : null}
      </div>

      {onResetAll && activeFilterCount > 0 ? (
        <Button type="button" variant="ghost" size="sm" onClick={onResetAll}>
          Reset all
        </Button>
      ) : null}
    </div>
  );
}
