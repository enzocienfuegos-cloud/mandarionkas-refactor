import React, { useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Settings2 } from '../icons';
import { cn } from '../cn';
import { Button } from '../primitives/Button';
import { Panel } from '../primitives/Panel';
import { Tooltip } from '../primitives/Tooltip';
import type { MetricDefinition, ResolvedMetric } from './registry';

export interface MetricPickerProps<TData> {
  available: Array<{ definition: MetricDefinition<TData>; resolved: ResolvedMetric }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onReset: () => void;
  isCustomized: boolean;
  maxSelected?: number;
}

export function MetricPicker<TData>({
  available,
  selectedIds,
  onToggle,
  onReset,
  isCustomized,
  maxSelected = 6,
}: MetricPickerProps<TData>) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    return available.reduce<Map<string, typeof available>>((map, entry) => {
      const key = entry.definition.group;
      const existing = map.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(key, [entry]);
      }
      return map;
    }, new Map());
  }, [available]);

  return (
    <div className="relative inline-flex">
      <Tooltip content={isCustomized ? 'Custom metric selection' : 'Default metric selection'}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<Settings2 className="h-3.5 w-3.5" />}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          Customize
          {isCustomized ? <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand-500" aria-label="Customized" /> : null}
        </Button>
      </Tooltip>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close metric picker"
            className="fixed inset-0 z-[var(--dusk-z-popover)]"
            onClick={() => setOpen(false)}
          />
          <Panel
            elevation={3}
            padding="sm"
            className="absolute right-0 top-full z-[calc(var(--dusk-z-popover)+1)] mt-2 max-h-[480px] w-[340px] overflow-y-auto"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">Metric cards</p>
                <p className="text-xs text-text-soft">
                  {selectedIds.length} of {Math.min(maxSelected, available.length)} selected
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leadingIcon={<RefreshCw className="h-3 w-3" />}
                onClick={() => {
                  onReset();
                  setOpen(false);
                }}
                disabled={!isCustomized}
              >
                Reset
              </Button>
            </div>

            <div className="space-y-3">
              {[...grouped.entries()].map(([group, entries]) => (
                <div key={group}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-kicker text-text-soft">{group}</p>
                  <ul className="space-y-1">
                    {entries.map(({ definition }) => {
                      const isSelected = selectedIds.includes(definition.id);
                      const isAtCap = !isSelected && selectedIds.length >= maxSelected;
                      return (
                        <li key={definition.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (!isAtCap) onToggle(definition.id);
                            }}
                            disabled={isAtCap}
                            aria-pressed={isSelected}
                            className={cn(
                              'flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                              isSelected
                                ? 'bg-surface-active text-text-primary'
                                : 'text-text-secondary hover:bg-surface-hover',
                              isAtCap && 'cursor-not-allowed opacity-50',
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{definition.label}</p>
                              {definition.description ? (
                                <p className="mt-0.5 text-xs text-text-soft">{definition.description}</p>
                              ) : null}
                            </div>
                            {isSelected ? <CheckCircle2 className="h-4 w-4 shrink-0 text-text-brand" aria-hidden /> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
