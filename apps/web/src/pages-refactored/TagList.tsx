import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Copy,
  Tags as TagsIcon,
  ExternalLink,
  LinkIcon,
} from '../system/icons';
import {
  Panel,
  Button,
  Input,
  Select,
  Badge,
  Kicker,
  DataTable,
  type ColumnDef,
  EmptyState,
  useToast,
} from '../system';

type TagStatus = 'active' | 'paused' | 'archived' | 'draft';

interface Tag {
  id: string;
  name: string;
  campaignName: string;
  size: string;
  format: string;
  status: TagStatus;
  impressions: number;
  clicks: number;
  ctr: number;
  servingUrl: string;
}

const STATUS_TONE: Record<TagStatus, 'success' | 'warning' | 'neutral'> = {
  active:   'success',
  paused:   'warning',
  archived: 'neutral',
  draft: 'neutral',
};

function normalizeTag(row: any): Tag {
  const rawStatus = String(row?.status ?? 'draft').toLowerCase();
  const status: TagStatus =
    rawStatus === 'active' || rawStatus === 'paused' || rawStatus === 'archived'
      ? rawStatus
      : 'draft';
  const servingUrl =
    String(
      row?.servingUrl
      ?? row?.publicUrl
      ?? row?.impressionUrl
      ?? row?.clickUrl
      ?? '',
    );
  return {
    id: String(row?.id ?? ''),
    name: String(row?.name ?? ''),
    campaignName: String(row?.campaign?.name ?? row?.campaignName ?? row?.campaign_name ?? 'No campaign'),
    size: String(
      row?.size
      ?? row?.sizeLabel
      ?? ((row?.servingWidth && row?.servingHeight) ? `${row.servingWidth}x${row.servingHeight}` : ''),
    ),
    format: String(row?.format ?? 'display'),
    status,
    impressions: Number(row?.impressions ?? 0),
    clicks: Number(row?.clicks ?? 0),
    ctr: Number(row?.ctr ?? 0),
    servingUrl,
  };
}

/**
 * Tag list — refactored to the design system (S56).
 *
 * Replaces the inline metric cards and hand-rolled table from the legacy
 * version with system primitives.
 */
export default function TagList() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tags, setTags]               = useState<Tag[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [selected, setSelected]       = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetch('/v1/tags?scope=all', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setTags((data?.tags ?? data ?? []).map(normalizeTag)))
      .catch(() => toast({ tone: 'critical', title: 'Could not load tags' }))
      .finally(() => setLoading(false));
  }, [toast]);

  const filtered = useMemo(() => {
    return tags.filter((t) => {
      if (formatFilter !== 'all' && t.format !== formatFilter) return false;
      if (search) {
        const haystack = `${t.name} ${t.campaignName} ${t.size}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [tags, search, formatFilter]);

  const handleCopy = async (tag: Tag) => {
    try {
      await navigator.clipboard.writeText(tag.servingUrl);
      toast({ tone: 'success', title: 'Copied serving URL', description: tag.name });
    } catch {
      toast({ tone: 'critical', title: 'Could not copy URL' });
    }
  };

  const columns: ColumnDef<Tag>[] = [
    {
      id: 'name',
      header: 'Tag',
      sortAccessor: (row) => row.name,
      width: '34%',
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-[color:var(--dusk-text-primary)] truncate">{row.name}</p>
          <p className="mt-0.5 text-xs text-[color:var(--dusk-text-soft)] truncate">
            {row.campaignName}
          </p>
        </div>
      ),
    },
    {
      id: 'format',
      header: 'Format',
      sortAccessor: (row) => row.format,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Badge tone="neutral" size="sm" variant="outline">{row.format}</Badge>
          <span className="dusk-mono text-xs text-[color:var(--dusk-text-muted)]">{row.size}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortAccessor: (row) => row.status,
      cell: (row) => <Badge tone={STATUS_TONE[row.status]} dot>{row.status}</Badge>,
    },
    {
      id: 'impressions',
      header: 'Impressions',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.impressions,
      cell: (row) => row.impressions.toLocaleString(),
    },
    {
      id: 'ctr',
      header: 'CTR',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.ctr,
      cell: (row) => `${(row.ctr * 100).toFixed(2)}%`,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<Copy />}
            onClick={(e) => { e.stopPropagation(); void handleCopy(row); }}
            aria-label="Copy serving URL"
          >
            Copy
          </Button>
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<ExternalLink />}
            onClick={(e) => {
              e.stopPropagation();
              if (row.servingUrl) window.open(row.servingUrl, '_blank', 'noopener');
            }}
            aria-label="Open in new tab"
          >
            Preview
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <header className="dusk-page-header">
        <div>
          <Kicker>Tags</Kicker>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            All tags
          </h1>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            {tags.length} total · {tags.filter((t) => t.status === 'active').length} serving
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" leadingIcon={<LinkIcon />} onClick={() => navigate('/tags/bindings')}>
            Bindings
          </Button>
          <Button variant="primary" leadingIcon={<Plus />} onClick={() => navigate('/tags/new')}>
            New tag
          </Button>
        </div>
      </header>

      <Panel padding="md">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            inputSize="md"
            leadingIcon={<Search />}
            placeholder="Search tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
            fullWidth={false}
          />
          <Select
            selectSize="md"
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            fullWidth={false}
            className="min-w-[140px]"
            options={[
              { value: 'all',     label: 'All formats' },
              { value: 'display', label: 'Display' },
              { value: 'video',   label: 'Video' },
              { value: 'native',  label: 'Native' },
              { value: 'rich',    label: 'Rich media' },
            ]}
          />
          <Button variant="ghost" leadingIcon={<Filter />}>More filters</Button>
        </div>
      </Panel>

      {!loading && filtered.length === 0 ? (
        <Panel padding="none">
          <EmptyState
            icon={<TagsIcon />}
            title={search || formatFilter !== 'all' ? 'No tags match your filters' : 'No tags yet'}
            description={
              search || formatFilter !== 'all'
                ? 'Try adjusting the filters or clearing the search.'
                : 'Create your first tag to start serving creatives.'
            }
            action={
              search || formatFilter !== 'all' ? (
                <Button variant="secondary" onClick={() => { setSearch(''); setFormatFilter('all'); }}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" leadingIcon={<Plus />} onClick={() => navigate('/tags/new')}>
                  New tag
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(t) => t.id}
          loading={loading}
          density="comfortable"
          onRowClick={(t) => navigate(`/tags/${t.id}`)}
          selectable
          selectedKeys={selected}
          onSelectionChange={setSelected}
          renderBulkActions={(rows) => (
            <Button size="sm" variant="secondary">Bulk export ({rows.length})</Button>
          )}
        />
      )}
    </div>
  );
}
