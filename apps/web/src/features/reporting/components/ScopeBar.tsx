import React from 'react';
import { Button } from '../../../system';
import { Calendar, Filter, Send } from '../../../system/icons';
import type { ReportingMode } from '../reporting.types';

const toneClasses: Record<ReportingMode, string> = {
  all: 'border-[color:var(--dusk-border-strong)] bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-secondary)]',
  display: 'border-[color:var(--dusk-border-strong)] bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-secondary)]',
  video: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]',
  identity: 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]',
};

export function ScopeBar({
  mode,
  onShare,
  lastUpdated,
  scopeLabel = 'Current workspace',
  dateRangeLabel = 'Last 30 days',
  spendViewLabel = 'Without margin',
}: {
  mode: ReportingMode;
  onShare?: () => void;
  lastUpdated?: string;
  scopeLabel?: string;
  dateRangeLabel?: string;
  spendViewLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-[color:var(--dusk-border-default)] bg-surface-1 p-4 shadow-2 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${toneClasses[mode]}`}>
          <Filter className="h-3 w-3" />
          {mode === 'all' ? 'Unified scope' : `${mode} scope`}
        </span>
        <span className="rounded-full border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--dusk-text-secondary)]">Workspace: {scopeLabel}</span>
        <span className="rounded-full border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--dusk-text-secondary)]">Date range: {dateRangeLabel}</span>
        <span className="rounded-full border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--dusk-text-secondary)]">Spend view: {spendViewLabel}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--dusk-text-muted)]">
        {lastUpdated ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] px-3 py-1">
            <Calendar className="h-3 w-3" />
            Updated {lastUpdated}
          </span>
        ) : null}
        {onShare ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leadingIcon={<Send className="h-3 w-3" />}
            onClick={onShare}
          >
            Share
          </Button>
        ) : null}
      </div>
    </div>
  );
}
