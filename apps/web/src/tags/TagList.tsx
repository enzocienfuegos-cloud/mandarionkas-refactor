import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  CenteredSpinner,
  DataTable,
  EmptyState,
  Input,
  Kicker,
  MetricCard,
  Panel,
  useConfirm,
  useToast,
} from '../system';
import { useTagColumns } from './tag-list/columns';
import { TagCreateModal } from './tag-list/TagCreateModal';
import { type IconProps } from './tag-list/types';
import { useTagListWorkspace } from './tag-list/useTagListWorkspace';
import {
  classNames,
} from './tag-list/utils';

function iconProps(className?: string) {
  return {
    className: classNames('h-5 w-5', className),
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  } as const;
}

const AlertTriangleIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M12 4 3.5 19h17L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
);

const SearchIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" />
    <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const FilterIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const TagsIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M4 5h7l9 9-7 7-9-9V5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <circle cx="8" cy="9" r="1.2" fill="currentColor" />
  </svg>
);

const TableIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 10h16M10 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export default function TagList() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    clients,
    selectedClientId,
    setSelectedClientId,
    tagSearch,
    setTagSearch,
    needsQaOnly,
    setNeedsQaOnly,
    selectedTagIds,
    setSelectedTagIds,
    loading,
    error,
    deletingId,
    bulkActionLoading,
    creating,
    createError,
    createForm,
    setCreateForm,
    filteredTags,
    activeTags,
    draftTags,
    archivedTags,
    totalTags,
    needsAttentionCount,
    tagMetrics,
    selectedKeySet,
    load,
    openCreate,
    closeCreate,
    handleDelete,
    handleBulkStatus,
    handleBulkDelete,
    handleExportTagCsv,
    handleCreate,
  } = useTagListWorkspace({
    confirm,
    toast,
    openCreateFromQuery: searchParams.get('create') === '1',
    clearCreateQuery: () => setSearchParams({}),
    onCreatedTag: (tagId) => navigate(`/tags/${tagId}`),
  });

  if (loading) {
    return <CenteredSpinner label="Loading tags workspace…" />;
  }

  if (error) {
    return (
      <Panel className="border-rose-200 bg-rose-50/90 p-4 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="font-medium">Error loading tags</p>
        <p className="mt-1 text-sm">{error}</p>
        <Button onClick={load} variant="ghost" size="sm" className="mt-3">Retry</Button>
      </Panel>
    );
  }

  const tagColumns = useTagColumns({
    deletingId,
    onEdit: (tag) => navigate(`/tags/${tag.id}`),
    onExport: handleExportTagCsv,
    onDelete: handleDelete,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedClientId}
            onChange={(event) => setSelectedClientId(event.target.value)}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-border-default/80 bg-[rgba(252,251,255,0.82)] px-4 text-sm font-medium text-text-secondary transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-surface-1/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:hover:bg-surface-1/[0.045]"
          >
            <option value="">All advertisers</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={() => setNeedsQaOnly((current) => !current)}
            variant="secondary"
            className={classNames(
              'min-h-[46px]',
              needsQaOnly && 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/22 dark:bg-fuchsia-500/10 dark:text-fuchsia-200',
            )}
          >
            Needs QA
          </Button>
          <label className="relative block min-w-[300px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--dusk-text-soft)] dark:text-white/40">
              <SearchIcon />
            </span>
            <Input
              value={tagSearch}
              onChange={(event) => setTagSearch(event.target.value)}
              className="min-h-[46px] border-border-default/80 bg-[rgba(252,251,255,0.82)] pl-10"
              placeholder="Search tag, advertiser, placement"
            />
          </label>
        </div>

        <Button type="button" onClick={openCreate} variant="primary">
          Generate tag
        </Button>
      </div>

      <header className="grid gap-6 xl:grid-cols-[1.4fr_1fr] xl:items-end">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:border-fuchsia-500/15 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
            Tags
            <span className="h-1 w-1 rounded-full bg-current opacity-60" />
            Pixel QA workspace
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)] md:text-5xl">Tag implementation without signal gaps</h1>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-text-muted dark:text-white/62">
            Generate, validate and monitor every tag from one dense operational view with the same CM360-style workspace pattern.
          </p>
        </div>

        <Panel className="p-5">
          <Kicker>Recommended focus</Kicker>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/18 dark:bg-amber-500/10">
            <AlertTriangleIcon className="text-amber-600 dark:text-amber-300" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-100">{needsAttentionCount} tags need implementation QA</p>
              <p className="mt-1 text-sm text-[color:var(--dusk-status-warning-fg)]/72 dark:text-amber-100/62">
                Review low firing, missing generation and no-firing tags before launching or scaling delivery.
              </p>
            </div>
          </div>
        </Panel>
      </header>

      <div className="grid gap-5 xl:grid-cols-4">
        {tagMetrics.map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            trend={metric.direction}
            context={metric.helper}
            series={metric.series}
            tone={metric.tone === 'fuchsia' ? 'brand' : metric.tone === 'emerald' ? 'success' : metric.tone === 'amber' ? 'warning' : metric.tone === 'rose' ? 'critical' : metric.tone === 'sky' ? 'info' : 'neutral'}
            icon={
              metric.id === 'tag-health'
                ? <TagsIcon />
                : metric.id === 'ready-tags'
                  ? <TableIcon />
                  : <AlertTriangleIcon />
            }
          />
        ))}
      </div>

      {filteredTags.length === 0 ? (
        <EmptyState
          kicker="No matches"
          title="No tags yet"
          description="No tags match the current advertiser or search filter."
          action={<Button onClick={openCreate} variant="primary">Generate tag</Button>}
        />
      ) : (
        <Panel className="overflow-hidden p-6">
          <div className="flex flex-col gap-4 border-b border-border-default pb-5 dark:border-white/8 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <Kicker>Tag workspace</Kicker>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">Pixels, firing status & implementation QA</h2>
              <p className="mt-2 text-sm text-text-muted dark:text-white/56">
                Dense operational view for tag generation, validation, firing health and implementation risk.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" size="sm">
                <FilterIcon className="h-4 w-4" />
                Filters
              </Button>
              <Link to="/tags/health">
                <Button variant="secondary" size="sm">Health</Button>
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4 dark:border-white/8 dark:bg-surface-1/[0.025]">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted dark:text-white/40">Total tags</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">{totalTags}</p>
              <p className="mt-1 text-sm text-text-muted dark:text-white/52">tracked in workspace</p>
            </div>
            <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4 dark:border-white/8 dark:bg-surface-1/[0.025]">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted dark:text-white/40">Firing</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">{activeTags}</p>
              <p className="mt-1 text-sm text-text-muted dark:text-white/52">healthy signal flow</p>
            </div>
            <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4 dark:border-white/8 dark:bg-surface-1/[0.025]">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted dark:text-white/40">Needs QA</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">{needsAttentionCount}</p>
              <p className="mt-1 text-sm text-text-muted dark:text-white/52">low or missing firing</p>
            </div>
            <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4 dark:border-white/8 dark:bg-surface-1/[0.025]">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted dark:text-white/40">Archived</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">{archivedTags}</p>
              <p className="mt-1 text-sm text-text-muted dark:text-white/52">retained for history</p>
            </div>
          </div>

          <div className="mt-6">
            <DataTable
              columns={tagColumns}
              data={filteredTags}
              rowKey={(tag) => tag.id}
              selectable
              density="comfortable"
              selectedKeys={selectedKeySet}
              onSelectionChange={(keys) => setSelectedTagIds(Array.from(keys))}
              renderBulkActions={() => (
                <>
                  <Button
                    onClick={() => void handleBulkStatus('active')}
                    disabled={bulkActionLoading}
                    variant="secondary"
                    size="sm"
                  >
                    Activate
                  </Button>
                  <Button
                    onClick={() => void handleBulkStatus('paused')}
                    disabled={bulkActionLoading}
                    variant="secondary"
                    size="sm"
                  >
                    Deactivate
                  </Button>
                  <Button
                    onClick={() => void handleBulkDelete()}
                    disabled={bulkActionLoading}
                    variant="danger"
                    size="sm"
                  >
                    Delete
                  </Button>
                  <Button
                    onClick={() => setSelectedTagIds([])}
                    disabled={bulkActionLoading}
                    variant="ghost"
                    size="sm"
                  >
                    Clear selection
                  </Button>
                </>
              )}
            />
          </div>
        </Panel>
      )}

      {creating ? (
        <TagCreateModal
          clients={clients}
          createError={createError}
          createForm={createForm}
          onClose={closeCreate}
          onCreate={handleCreate}
          setCreateForm={setCreateForm}
        />
      ) : null}
    </div>
  );
}
