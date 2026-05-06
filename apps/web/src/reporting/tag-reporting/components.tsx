import React from 'react';
import { Button, EmptyState, Input, Kicker, Panel, Select } from '../../system';
import type { DailyStat, ReportingTab, Tag } from './types';

export function BarChart({ data }: { data: DailyStat[] }) {
  const W = 600;
  const H = 120;
  const PAD = { l: 40, r: 10, t: 10, b: 30 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const max = Math.max(...data.map(d => d.impressions), 1);
  const barW = data.length > 0 ? Math.max(2, (chartW / data.length) - 2) : 0;
  const labelStep = Math.max(1, Math.ceil(data.length / 7));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + chartH} stroke="#e2e8f0" strokeWidth="1" />
      <line x1={PAD.l} y1={PAD.t + chartH} x2={PAD.l + chartW} y2={PAD.t + chartH} stroke="#e2e8f0" strokeWidth="1" />

      {[0, 0.25, 0.5, 0.75, 1].map(frac => {
        const y = PAD.t + chartH - frac * chartH;
        const val = Math.round(max * frac);
        return (
          <g key={frac}>
            <line x1={PAD.l} y1={y} x2={PAD.l + chartW} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
              {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const barH = max > 0 ? (d.impressions / max) * chartH : 0;
        const x = PAD.l + i * (chartW / data.length) + 1;
        const y = PAD.t + chartH - barH;
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={barH} fill="#6366f1" rx="2">
              <title>{d.date}: {d.impressions.toLocaleString()} impressions</title>
            </rect>
            {i % labelStep === 0 && (
              <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize="8" fill="#94a3b8">
                {new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Panel className="p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-white/42">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-400 dark:text-white/36">{sub}</p> : null}
    </Panel>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="break-all text-right text-sm text-slate-700">{value || 'n/a'}</span>
    </div>
  );
}

export function TagSelectorPanel({
  filteredTags,
  selectedTagId,
  tagSearch,
  onSearchChange,
  onSelectTag,
}: {
  filteredTags: Tag[];
  selectedTagId: string | null;
  tagSearch: string;
  onSearchChange: (value: string) => void;
  onSelectTag: (tag: Tag) => void;
}) {
  return (
    <Panel className="overflow-hidden">
      <div className="space-y-2 border-b border-slate-100 bg-slate-50/80 px-3 py-3 dark:border-white/[0.07] dark:bg-white/[0.03]">
        <Kicker>Tags</Kicker>
        <Input
          type="search"
          value={tagSearch}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Filter by tag name"
        />
      </div>
      {filteredTags.length === 0 ? (
        <EmptyState
          kicker="No matches"
          title="No matching tags"
          description="Try a different tag name or clear the current filter."
          className="border-0 bg-transparent px-4 py-6 shadow-none"
        />
      ) : (
        <ul className="app-scrollbar max-h-[600px] divide-y divide-slate-100 overflow-y-auto dark:divide-white/[0.07]">
          {filteredTags.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                onClick={() => onSelectTag(tag)}
                className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                  selectedTagId === tag.id
                    ? 'bg-fuchsia-50 text-fuchsia-700 font-medium dark:bg-fuchsia-500/10 dark:text-fuchsia-200'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-white/76 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div>{tag.name}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-400 dark:text-white/36">{tag.format}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function ReportingFilterSummary({
  loadingBindings,
  bindingCount,
  selectedCreativeId,
  selectedVariantId,
  statsError,
  onRetry,
}: {
  loadingBindings: boolean;
  bindingCount: number;
  selectedCreativeId: string;
  selectedVariantId: string;
  statsError: string;
  onRetry: () => void;
}) {
  return (
    <Panel className="p-4">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/42">
        Filter Summary
      </label>
      <div className="space-y-1 text-sm text-slate-600 dark:text-white/62">
        <div>{loadingBindings ? 'Loading bindings…' : `${bindingCount} binding${bindingCount === 1 ? '' : 's'} available`}</div>
        <div>{selectedCreativeId ? 'Creative filter active' : 'No creative filter'}</div>
        <div>{selectedVariantId ? 'Size filter active' : 'No size filter'}</div>
      </div>
      {statsError ? (
        <div className="mt-4 rounded-xl border border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-3 py-3 text-sm text-[color:var(--dusk-status-critical-fg)]">
          <p>{statsError}</p>
          <Button onClick={onRetry} variant="ghost" size="sm" className="mt-3">
            Retry
          </Button>
        </div>
      ) : null}
    </Panel>
  );
}

export function ReportingWorkspaceControls({
  selectedTagName,
  dateRange,
  onDateRangeChange,
  exporting,
  loadingStats,
  canExport,
  onExport,
  selectedCreativeId,
  onSelectedCreativeIdChange,
  selectedVariantId,
  onSelectedVariantIdChange,
  creativeOptions,
  variantOptions,
  loadingBindings,
  bindingCount,
  statsError,
  onRetry,
  activeTab,
  onActiveTabChange,
  dateRangeOptions,
  reportingTabOptions,
}: {
  selectedTagName: string;
  dateRange: number;
  onDateRangeChange: (value: number) => void;
  exporting: boolean;
  loadingStats: boolean;
  canExport: boolean;
  onExport: () => void;
  selectedCreativeId: string;
  onSelectedCreativeIdChange: (value: string) => void;
  selectedVariantId: string;
  onSelectedVariantIdChange: (value: string) => void;
  creativeOptions: Array<{ value: string; label: string }>;
  variantOptions: Array<{ value: string; label: string }>;
  loadingBindings: boolean;
  bindingCount: number;
  statsError: string;
  onRetry: () => void;
  activeTab: ReportingTab;
  onActiveTabChange: (value: ReportingTab) => void;
  dateRangeOptions: Array<{ value: string; label: string }>;
  reportingTabOptions: Array<{ value: string; label: string }>;
}) {
  return (
    <>
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Kicker>Selected tag</Kicker>
          <h2 className="mt-2 text-lg font-semibold text-slate-800 dark:text-white">{selectedTagName}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-white/56">Filter by assigned creative and exported size variant.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={String(dateRange)}
            onChange={(event) => onDateRangeChange(Number(event.target.value))}
            options={dateRangeOptions}
            selectSize="sm"
            className="min-w-[92px]"
            aria-label="Date range"
          />
          <Button
            onClick={onExport}
            disabled={exporting || loadingStats || !canExport}
            variant="primary"
            size="sm"
          >
            {exporting ? 'Exporting…' : 'Download Excel'}
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Panel className="p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/42">
            Assigned Creative
          </label>
          <Select
            value={selectedCreativeId}
            onChange={(event) => onSelectedCreativeIdChange(event.target.value)}
            disabled={loadingBindings}
            options={[{ value: '', label: 'All creatives' }, ...creativeOptions]}
          />
        </Panel>
        <Panel className="p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/42">
            Creative Size
          </label>
          <Select
            value={selectedVariantId}
            onChange={(event) => onSelectedVariantIdChange(event.target.value)}
            disabled={loadingBindings}
            options={[{ value: '', label: 'All sizes' }, ...variantOptions]}
          />
        </Panel>
        <ReportingFilterSummary
          loadingBindings={loadingBindings}
          bindingCount={bindingCount}
          selectedCreativeId={selectedCreativeId}
          selectedVariantId={selectedVariantId}
          statsError={statsError}
          onRetry={onRetry}
        />
      </div>

      <div className="mb-6 max-w-[180px]">
        <Select
          value={activeTab}
          onChange={(event) => onActiveTabChange(event.target.value as ReportingTab)}
          options={reportingTabOptions}
          selectSize="sm"
          aria-label="Reporting mode"
        />
      </div>
    </>
  );
}

export function ReportingBreakdownTable({
  title,
  subtitle,
  emptyTitle,
  rows,
  columns,
}: {
  title: string;
  subtitle: string;
  emptyTitle: string;
  rows: DailyStat[];
  columns: Array<{
    key: string;
    header: string;
    render: (row: DailyStat) => React.ReactNode;
    emphasize?: boolean;
  }>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-1">
      <div className="flex items-center justify-between border-b border-[color:var(--dusk-border-subtle)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[color:var(--dusk-text-primary)]">{title}</h3>
        <p className="text-xs text-[color:var(--dusk-text-soft)]">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          kicker="No data"
          title={emptyTitle}
          description="Adjust the tag filters or wait for new traffic to populate this table."
          className="border-0 bg-transparent px-4 py-8 shadow-none"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--dusk-border-subtle)]">
            <thead className="bg-[color:var(--dusk-surface-muted)]">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--dusk-text-soft)]"
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--dusk-border-subtle)]">
              {[...rows].reverse().map((row) => (
                <tr key={row.date} className="hover:bg-[color:var(--dusk-surface-muted)]">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-2.5 text-sm ${
                        column.emphasize
                          ? 'font-medium text-[color:var(--dusk-text-primary)]'
                          : 'text-[color:var(--dusk-text-secondary)]'
                      }`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
