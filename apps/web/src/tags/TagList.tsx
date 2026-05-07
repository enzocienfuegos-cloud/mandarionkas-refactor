import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  CenteredSpinner,
  DataTable,
  EmptyState,
  FormField,
  Input,
  Kicker,
  MetricCard,
  PageHeader,
  Panel,
  Select,
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
      <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-[color:var(--dusk-status-critical-fg)]">
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
      <PageHeader
        kicker="Tags · Pixel QA workspace"
        title="Tags"
        meta={`${totalTags} tags · ${needsAttentionCount} need QA · implementation workspace`}
        primaryAction={<Button type="button" onClick={openCreate} variant="primary">Generate tag</Button>}
        alert={(
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangleIcon className="mt-0.5 shrink-0" />
              <p className="text-sm font-medium">
                {needsAttentionCount} tags need implementation QA before launch or scale.
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setNeedsQaOnly(true)} className="shrink-0">
              Filter to QA risk
            </Button>
          </div>
        )}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Advertiser" className="min-w-[220px]">
            <Select
              value={selectedClientId}
              onChange={(event) => setSelectedClientId(event.target.value)}
              selectSize="lg"
            >
              <option value="">All advertisers</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </FormField>
          <Button
            type="button"
            onClick={() => setNeedsQaOnly((current) => !current)}
            variant="secondary"
            className="min-h-[46px]"
          >
            Needs QA
            {needsQaOnly ? <Badge tone="brand" size="sm">On</Badge> : null}
          </Button>
          <FormField label="Search" className="min-w-[300px] flex-1">
            <Input
              value={tagSearch}
              onChange={(event) => setTagSearch(event.target.value)}
              inputSize="lg"
              leadingIcon={<SearchIcon />}
              placeholder="Search tag, advertiser, placement"
            />
          </FormField>
        </div>
      </div>

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
          <div className="flex flex-col gap-4 border-b border-border-default pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <Kicker>Tag workspace</Kicker>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">Pixels, firing status & implementation QA</h2>
              <p className="mt-2 text-sm text-text-muted">
                Dense operational view for tag generation, validation, firing health and implementation risk.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/tags/health">
                <Button variant="secondary" size="sm">Health</Button>
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Total tags</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">{totalTags}</p>
              <p className="mt-1 text-sm text-text-muted">tracked in workspace</p>
            </div>
            <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Firing</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">{activeTags}</p>
              <p className="mt-1 text-sm text-text-muted">healthy signal flow</p>
            </div>
            <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Needs QA</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">{needsAttentionCount}</p>
              <p className="mt-1 text-sm text-text-muted">low or missing firing</p>
            </div>
            <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Archived</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--dusk-text-primary)]">{archivedTags}</p>
              <p className="mt-1 text-sm text-text-muted">retained for history</p>
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
