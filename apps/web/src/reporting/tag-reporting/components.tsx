import React from 'react';
import { Badge, Button, EmptyState, Input, Kicker, Panel, Select, Tab, Tabs, TabsList } from '../../system';
import type { DailyStat, ReportingTab, Tag } from './types';

function iconProps() {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    className: 'h-4 w-4',
    'aria-hidden': true,
  } as const;
}

function DisplayModeIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 10h16M10 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function VideoModeIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="m11 10 4 2-4 2v-4Z" fill="currentColor" />
    </svg>
  );
}

function IdentityModeIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="8.5" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const MODE_META: Record<ReportingTab, { title: string; description: string; tone: 'brand' | 'info' | 'success'; icon: React.ReactNode }> = {
  display: {
    title: 'Display analytics',
    description: 'Delivery, clicks, viewability and attention trends for display inventory.',
    tone: 'brand',
    icon: <DisplayModeIcon />,
  },
  video: {
    title: 'Video completion funnel',
    description: 'Starts, completions and rate quality for the selected tag and creative.',
    tone: 'info',
    icon: <VideoModeIcon />,
  },
  identity: {
    title: 'Identity and supply context',
    description: 'Latest delivery context, device signals and inventory environment snapshots.',
    tone: 'success',
    icon: <IdentityModeIcon />,
  },
};

function tagFormatTone(format: string): 'brand' | 'info' | 'success' | 'warning' | 'neutral' {
  const normalized = format.trim().toLowerCase();
  if (normalized.includes('video')) return 'info';
  if (normalized.includes('identity')) return 'success';
  if (normalized.includes('display')) return 'brand';
  if (normalized.includes('native')) return 'warning';
  return 'neutral';
}

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
      <p className="text-xs font-medium uppercase tracking-wider text-text-soft">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-text-muted">{sub}</p> : null}
    </Panel>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[color:var(--dusk-border-subtle)] py-2 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-soft">{label}</span>
      <span className="break-all text-right text-sm text-text-secondary">{value || 'n/a'}</span>
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
  const selectedTag = selectedTagId ? filteredTags.find((tag) => tag.id === selectedTagId) ?? null : null;

  return (
    <Panel className="overflow-hidden">
      <div className="space-y-2 border-b border-[color:var(--dusk-border-subtle)] bg-surface-muted px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <Kicker>Tags</Kicker>
          <Badge tone="neutral" size="sm">{filteredTags.length} visible</Badge>
        </div>
        <Input
          type="search"
          value={tagSearch}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Filter by tag name"
        />
        {selectedTag ? (
          <div className="rounded-xl border border-[color:var(--dusk-border-default)] bg-surface-1 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--dusk-text-soft)]">Selected</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium text-[color:var(--dusk-text-primary)]">{selectedTag.name}</p>
              <Badge tone={tagFormatTone(selectedTag.format)} size="sm">{selectedTag.format || 'Tag'}</Badge>
            </div>
          </div>
        ) : null}
      </div>
      {filteredTags.length === 0 ? (
        <EmptyState
          kicker="No matches"
          title="No matching tags"
          description="Try a different tag name or clear the current filter."
          className="border-0 bg-transparent px-4 py-6 shadow-none"
        />
      ) : (
        <ul className="app-scrollbar max-h-[600px] divide-y divide-[color:var(--dusk-border-subtle)] overflow-y-auto">
          {filteredTags.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                onClick={() => onSelectTag(tag)}
                className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                  selectedTagId === tag.id
                    ? 'bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)] font-medium'
                    : 'text-text-secondary hover:bg-surface-muted'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate">{tag.name}</div>
                  <div className="mt-1 text-xs text-text-soft">
                      {selectedTagId === tag.id ? 'Active reporting view' : 'Open reporting'}
                    </div>
                  </div>
                  <Badge tone={tagFormatTone(tag.format)} size="sm">
                    {tag.format || 'Tag'}
                  </Badge>
                </div>
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
  selectedCreativeName,
  selectedVariantName,
  statsError,
  onRetry,
}: {
  loadingBindings: boolean;
  bindingCount: number;
  selectedCreativeId: string;
  selectedVariantId: string;
  selectedCreativeName: string;
  selectedVariantName: string;
  statsError: string;
  onRetry: () => void;
}) {
  return (
    <Panel className="p-4">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-soft">
        Filter Summary
      </label>
      <div className="space-y-3">
        <div className="text-sm text-text-secondary">
          {loadingBindings ? 'Loading bindings…' : `${bindingCount} binding${bindingCount === 1 ? '' : 's'} available`}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={selectedCreativeId ? 'brand' : 'neutral'} size="sm">
            {selectedCreativeId ? `Creative: ${selectedCreativeName}` : 'All creatives'}
          </Badge>
          <Badge tone={selectedVariantId ? 'info' : 'neutral'} size="sm">
            {selectedVariantId ? `Size: ${selectedVariantName}` : 'All sizes'}
          </Badge>
        </div>
        <p className="text-xs text-text-soft">
          {selectedCreativeId || selectedVariantId
            ? 'Current reporting reflects the active scope above.'
            : 'No narrowing filters are active right now.'}
        </p>
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
  selectedTagFormat,
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
  selectedCreativeName,
  selectedVariantName,
}: {
  selectedTagName: string;
  selectedTagFormat: string;
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
  selectedCreativeName: string;
  selectedVariantName: string;
}) {
  const modeMeta = MODE_META[activeTab];

  return (
    <>
      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Kicker>Selected tag</Kicker>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">{selectedTagName}</h2>
            <Badge tone={tagFormatTone(selectedTagFormat)} size="sm">{selectedTagFormat || 'Tag'}</Badge>
            <Badge tone="neutral" size="sm">{bindingCount} binding{bindingCount === 1 ? '' : 's'}</Badge>
            <Badge tone="neutral" size="sm">Last {dateRange}d</Badge>
          </div>
          <p className="mt-2 text-sm text-text-secondary">Filter by assigned creative and exported size variant.</p>
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
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-soft">
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
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-soft">
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
          selectedCreativeName={selectedCreativeName}
          selectedVariantName={selectedVariantName}
          statsError={statsError}
          onRetry={onRetry}
        />
      </div>

      <div className="mb-6 max-w-[180px]">
        <Tabs value={activeTab} onValueChange={(value) => onActiveTabChange(value as ReportingTab)}>
          <TabsList aria-label="Reporting mode" className="w-full justify-start">
            {reportingTabOptions.map((option) => (
              <Tab
                key={option.value}
                value={option.value}
                className="capitalize"
                leadingIcon={MODE_META[option.value as ReportingTab].icon}
              >
                {option.label}
              </Tab>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Panel className="mb-6 flex items-start gap-3 p-4">
        <div className="mt-0.5 text-[color:var(--dusk-text-secondary)]">{modeMeta.icon}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[color:var(--dusk-text-primary)]">{modeMeta.title}</p>
            <Badge tone={modeMeta.tone} size="sm">{activeTab}</Badge>
          </div>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-secondary)]">{modeMeta.description}</p>
        </div>
      </Panel>
    </>
  );
}

export function ReportingBreakdownTable({
  title,
  subtitle,
  emptyTitle,
  emptyDescription,
  rows,
  columns,
}: {
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyDescription?: string;
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
          description={emptyDescription ?? 'Adjust the tag filters or wait for new traffic to populate this table.'}
          className="border-0 bg-transparent px-4 py-8 shadow-none"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--dusk-border-subtle)]">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-[color:var(--dusk-surface-muted)]">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
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
