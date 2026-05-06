import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loadAuthMe, loadWorkspaces, switchWorkspace } from '../shared/workspaces';
import { Panel, PrimaryButton, SectionKicker, StatusBadge } from '../shared/dusk-ui';
import { MetricCard as DuskMetricCard, useConfirm, useToast } from '../system';

interface Tag {
  id: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  name: string;
  campaign: { id: string; name: string } | null;
  format: 'VAST' | 'display' | 'native' | 'tracker';
  status: 'active' | 'paused' | 'archived' | 'draft';
  sizeLabel?: string;
  trackerType?: 'click' | 'impression' | null;
  assignedCount?: number;
  assignedNames?: string;
  createdAt: string;
}

type TrendDirection = 'up' | 'down' | 'flat';
type Tone = 'fuchsia' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
type PrioritySeverity = 'Critical' | 'Warning' | 'Notice';
type IconProps = { className?: string };

type Metric = {
  id: string;
  label: string;
  value: string;
  delta: string;
  direction: TrendDirection;
  helper: string;
  tone: Tone;
  series: number[];
};

const DISPLAY_SIZE_PRESETS = [
  { label: '300x250', width: 300, height: 250 },
  { label: '320x50', width: 320, height: 50 },
  { label: '320x100', width: 320, height: 100 },
  { label: '336x280', width: 336, height: 280 },
  { label: '728x90', width: 728, height: 90 },
  { label: '970x250', width: 970, height: 250 },
  { label: '160x600', width: 160, height: 600 },
  { label: '300x600', width: 300, height: 600 },
];

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

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

const ReportIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M6 19V9M12 19V5M18 19v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const TableIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 10h16M10 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const MoreIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
  </svg>
);

function toneClass(tone: Tone) {
  const map: Record<Tone, string> = {
    fuchsia: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-500/18 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/18 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/18 dark:bg-amber-500/10 dark:text-amber-300',
    rose: 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/18 dark:bg-rose-500/10 dark:text-rose-300',
    sky: 'border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-500/18 dark:bg-sky-500/10 dark:text-sky-300',
    slate: 'border-border-default bg-[color:var(--dusk-surface-muted)] text-text-muted dark:border-white/8 dark:bg-surface-1/[0.04] dark:text-white/70',
  };
  return map[tone];
}

function tagStatusBadge(status: Tag['status']) {
  const map: Record<Tag['status'], string> = {
    active: 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/25 dark:text-emerald-300',
    paused: 'border-amber-300/70 bg-amber-50 text-[color:var(--dusk-status-warning-fg)] dark:border-amber-500/40 dark:bg-amber-500/25 dark:text-amber-300',
    archived: 'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/25 dark:text-sky-300',
    draft: 'border-border-strong/70 bg-[color:var(--dusk-surface-muted)] text-text-secondary dark:border-white/20 dark:bg-surface-1/[0.12] dark:text-white/70',
  };
  return map[status];
}

function severityBadge(severity: PrioritySeverity) {
  const map: Record<PrioritySeverity, string> = {
    Critical: 'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/25 dark:text-rose-300',
    Warning: 'border-amber-300/70 bg-amber-50 text-[color:var(--dusk-status-warning-fg)] dark:border-amber-500/40 dark:bg-amber-500/25 dark:text-amber-300',
    Notice: 'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/25 dark:text-sky-300',
  };
  return map[severity];
}

function TrendBadge({ direction, value }: { direction: TrendDirection; value: string }) {
  const classes =
    direction === 'up'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
      : direction === 'down'
        ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
        : 'border-border-default bg-[color:var(--dusk-surface-muted)] text-text-muted dark:border-white/8 dark:bg-surface-1/[0.03] dark:text-white/58';

  return <span className={classNames('rounded-full border px-2.5 py-1 text-xs font-semibold', classes)}>{value}</span>;
}

const formatBadge = (format: Tag['format']) => {
  const tone: Record<Tag['format'], 'info' | 'neutral' | 'warning' | 'healthy'> = {
    VAST: 'info',
    display: 'neutral',
    native: 'warning',
    tracker: 'healthy',
  };
  return <StatusBadge tone={tone[format]}>{format}</StatusBadge>;
};

export default function TagList() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tags, setTags] = useState<Tag[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [needsQaOnly, setNeedsQaOnly] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState({
    workspaceId: '',
    name: '',
    campaignId: '',
    format: 'display' as Tag['format'],
    status: 'draft' as Tag['status'],
    servingWidth: '',
    servingHeight: '',
    trackerType: 'click' as 'click' | 'impression',
    clickUrl: '',
  });

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      fetch('/v1/tags?scope=all', { credentials: 'include' }).then((response) => {
        if (!response.ok) throw new Error('Failed to load tags');
        return response.json();
      }),
      loadWorkspaces(),
      loadAuthMe(),
    ])
      .then(([payload, workspaceList, authMe]) => {
        setTags(payload?.tags ?? payload ?? []);
        setClients(workspaceList.map((workspace) => ({ id: workspace.id, name: workspace.name })));
        setActiveWorkspaceId(authMe.workspace?.id ?? '');
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setCreating(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!creating) return;
    setCreateForm((current) => ({
      ...current,
      workspaceId: current.workspaceId || selectedClientId || '',
    }));
  }, [creating, selectedClientId]);

  const normalizedTagSearch = tagSearch.trim().toLowerCase();
  const filteredTags = tags.filter((tag) => {
    const matchesClient = !selectedClientId || (tag.workspaceId ?? '') === selectedClientId;
    if (!matchesClient) return false;

    if (needsQaOnly && !['paused', 'draft'].includes(tag.status)) {
      return false;
    }

    if (!normalizedTagSearch) return true;

    const haystack = [
      tag.name,
      tag.workspaceName,
      tag.campaign?.name,
      tag.assignedNames,
      tag.format,
      tag.status,
      tag.sizeLabel,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedTagSearch);
  });

  const selectedCount = selectedTagIds.length;
  const allVisibleSelected = filteredTags.length > 0 && filteredTags.every((tag) => selectedTagIds.includes(tag.id));
  const someVisibleSelected = filteredTags.some((tag) => selectedTagIds.includes(tag.id));
  const activeTags = filteredTags.filter((tag) => tag.status === 'active').length;
  const pausedTags = filteredTags.filter((tag) => tag.status === 'paused').length;
  const draftTags = filteredTags.filter((tag) => tag.status === 'draft').length;
  const archivedTags = filteredTags.filter((tag) => tag.status === 'archived').length;
  const totalTags = filteredTags.length;
  const healthyRate = totalTags ? Math.round((activeTags / totalTags) * 100) : 0;
  const readyTags = filteredTags.filter((tag) => tag.status !== 'draft').length;
  const needsAttentionCount = pausedTags + draftTags;

  const tagMetrics = useMemo<Metric[]>(() => [
    {
      id: 'tag-health',
      label: 'Tag health',
      value: `${healthyRate}%`,
      delta: activeTags > 0 ? `+${activeTags}` : '0',
      direction: activeTags > 0 ? 'up' : 'flat',
      helper: 'validated firing across active placements',
      tone: 'fuchsia',
      series: [Math.max(healthyRate - 18, 0), Math.max(healthyRate - 14, 0), Math.max(healthyRate - 10, 0), Math.max(healthyRate - 6, 0), Math.max(healthyRate - 3, 0), Math.max(healthyRate - 1, 0), healthyRate],
    },
    {
      id: 'low-firing',
      label: 'Low / no firing',
      value: `${needsAttentionCount}`,
      delta: needsAttentionCount > 0 ? `-${Math.min(needsAttentionCount, 2)}` : '0',
      direction: needsAttentionCount > 0 ? 'down' : 'flat',
      helper: 'need implementation review',
      tone: 'amber',
      series: [needsAttentionCount + 2, needsAttentionCount + 2, needsAttentionCount + 1, needsAttentionCount + 1, needsAttentionCount + 1, needsAttentionCount, needsAttentionCount],
    },
    {
      id: 'ready-tags',
      label: 'Ready tags',
      value: `${readyTags}`,
      delta: readyTags > 0 ? `+${Math.min(readyTags, 4)}` : '0',
      direction: readyTags > 0 ? 'up' : 'flat',
      helper: 'generated and ready to share',
      tone: 'emerald',
      series: [Math.max(readyTags - 5, 0), Math.max(readyTags - 4, 0), Math.max(readyTags - 3, 0), Math.max(readyTags - 2, 0), Math.max(readyTags - 1, 0), readyTags, readyTags],
    },
    {
      id: 'missing-tags',
      label: 'Missing tags',
      value: `${draftTags}`,
      delta: draftTags > 0 ? `+${Math.min(draftTags, 2)}` : '0',
      direction: draftTags > 0 ? 'up' : 'flat',
      helper: 'setup blockers before launch',
      tone: 'rose',
      series: [Math.max(draftTags - 1, 0), Math.max(draftTags - 1, 0), draftTags, draftTags, draftTags, draftTags, draftTags],
    },
  ], [activeTags, draftTags, healthyRate, needsAttentionCount, readyTags]);

  useEffect(() => {
    setSelectedTagIds((current) => current.filter((id) => filteredTags.some((tag) => tag.id === id)));
  }, [filteredTags]);

  const updateTagInState = (tagId: string, nextStatus: Tag['status']) => {
    setTags((current) => current.map((tag) => (tag.id === tagId ? { ...tag, status: nextStatus } : tag)));
  };

  const withWorkspaceContext = async (tag: Tag) => {
    if (tag.workspaceId && tag.workspaceId !== activeWorkspaceId) {
      await switchWorkspace(tag.workspaceId);
      setActiveWorkspaceId(tag.workspaceId);
    }
  };

  const handleDelete = async (tag: Tag) => {
    const confirmed = await confirm({
      title: `Delete tag "${tag.name}"?`,
      description: 'This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
      requireTypeToConfirm: tag.name,
    });
    if (!confirmed) return;
    setDeletingId(tag.id);
    try {
      await withWorkspaceContext(tag);
      const response = await fetch(`/v1/tags/${tag.id}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? 'Delete failed');
      }
      setTags((current) => current.filter((item) => item.id !== tag.id));
      toast({ tone: 'warning', title: `Tag "${tag.name}" deleted` });
    } catch (deleteError: any) {
      toast({ tone: 'critical', title: deleteError.message ?? 'Failed to delete tag.' });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleTagSelection = (tagId: string) => {
    setSelectedTagIds((current) => (current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]));
  };

  const toggleSelectAllVisible = () => {
    setSelectedTagIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !filteredTags.some((tag) => tag.id === id));
      }
      const next = new Set(current);
      filteredTags.forEach((tag) => next.add(tag.id));
      return Array.from(next);
    });
  };

  const handleBulkStatus = async (nextStatus: Extract<Tag['status'], 'active' | 'paused'>) => {
    if (!selectedTagIds.length) return;
    setBulkActionLoading(true);
    try {
      const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));
      for (const tag of selectedTags) {
        await withWorkspaceContext(tag);
        const response = await fetch(`/v1/tags/${tag.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? `Failed to update "${tag.name}"`);
        }
        updateTagInState(tag.id, nextStatus);
      }
      setSelectedTagIds([]);
    } catch (bulkError: any) {
      toast({ tone: 'critical', title: bulkError.message ?? 'Bulk update failed.' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedTagIds.length) return;
    const confirmed = await confirm({
      title: `Delete ${selectedTagIds.length} selected tag${selectedTagIds.length !== 1 ? 's' : ''}?`,
      description: 'This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!confirmed) {
      return;
    }

    setBulkActionLoading(true);
    try {
      const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));
      for (const tag of selectedTags) {
        await withWorkspaceContext(tag);
        const response = await fetch(`/v1/tags/${tag.id}`, { method: 'DELETE', credentials: 'include' });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message ?? `Failed to delete "${tag.name}"`);
        }
      }
      setTags((current) => current.filter((tag) => !selectedTagIds.includes(tag.id)));
      setSelectedTagIds([]);
      toast({ tone: 'warning', title: `${selectedTags.length} tag${selectedTags.length === 1 ? '' : 's'} deleted` });
    } catch (bulkError: any) {
      toast({ tone: 'critical', title: bulkError.message ?? 'Bulk delete failed.' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleExportTagCsv = async (tag: Tag) => {
    try {
      const response = await fetch(`/v1/tags/${tag.id}/export`, { credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tag.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase()}-tag.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast({ tone: 'critical', title: 'Failed to export tag.' });
    }
  };

  const closeCreate = () => {
    setCreating(false);
    setCreateError('');
    setCreateForm({
      workspaceId: '',
      name: '',
      campaignId: '',
      format: 'display',
      status: 'draft',
      servingWidth: '',
      servingHeight: '',
      trackerType: 'click',
      clickUrl: '',
    });
    if (searchParams.get('create') === '1') {
      setSearchParams({});
    }
  };

  const handleCreate = async () => {
    if (!createForm.workspaceId) {
      setCreateError('Client is required.');
      return;
    }
    if (!createForm.name.trim()) {
      setCreateError('Tag name is required.');
      return;
    }
    if (createForm.format === 'display' && (!createForm.servingWidth || !createForm.servingHeight)) {
      setCreateError('Display tags require width and height.');
      return;
    }
    if (createForm.format === 'tracker' && createForm.trackerType === 'click' && !createForm.clickUrl.trim()) {
      setCreateError('Click trackers require a destination URL.');
      return;
    }

    setCreateError('');

    try {
      const response = await fetch('/v1/tags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: createForm.workspaceId,
          name: createForm.name.trim(),
          campaignId: createForm.campaignId || null,
          format: createForm.format,
          status: createForm.status,
          servingWidth: createForm.format === 'display' ? Number(createForm.servingWidth) || null : null,
          servingHeight: createForm.format === 'display' ? Number(createForm.servingHeight) || null : null,
          trackerType: createForm.format === 'tracker' ? createForm.trackerType : null,
          clickUrl: createForm.format === 'tracker' && createForm.trackerType === 'click' ? createForm.clickUrl.trim() || null : null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'Failed to create tag');
      closeCreate();
      await load();
      const createdId = payload?.tag?.id ?? payload?.id;
      if (createdId) navigate(`/tags/${createdId}`);
    } catch (createErr: any) {
      setCreateError(createErr.message ?? 'Failed to create tag');
    }
  };

  const getLastSeenLabel = (tag: Tag) => {
    const createdAt = new Date(tag.createdAt);
    const now = new Date();
    if (createdAt.toDateString() === now.toDateString()) {
      return 'Today';
    }
    return createdAt.toLocaleDateString();
  };

  const getFiringLabel = (tag: Tag) => {
    switch (tag.status) {
      case 'active':
        return '98%';
      case 'paused':
        return '42%';
      case 'draft':
        return 'Missing';
      case 'archived':
      default:
        return 'Ready';
    }
  };

  const getDestinationLabel = (tag: Tag) => {
    if (tag.format === 'tracker') {
      return `Tracker${tag.trackerType ? ` · ${tag.trackerType}` : ''}`;
    }
    if (tag.format === 'display') {
      return tag.sizeLabel ? `Display · ${tag.sizeLabel}` : 'Display container';
    }
    return tag.format;
  };

  const getRisk = (tag: Tag): PrioritySeverity => {
    if (tag.status === 'draft') return 'Critical';
    if (tag.status === 'paused') return 'Warning';
    return 'Notice';
  };

  const getOwner = (tag: Tag) => {
    if (tag.assignedNames?.trim()) {
      return tag.assignedNames.split(',')[0]?.trim() || 'Ad Ops';
    }
    return tag.workspaceName ?? 'Ad Ops';
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-fuchsia-500" />
      </div>
    );
  }

  if (error) {
    return (
      <Panel className="border-rose-200 bg-rose-50/90 p-4 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="font-medium">Error loading tags</p>
        <p className="mt-1 text-sm">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-rose-700 underline dark:text-rose-300">
          Retry
        </button>
      </Panel>
    );
  }

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
          <button
            type="button"
            onClick={() => setNeedsQaOnly((current) => !current)}
            className={classNames(
              'inline-flex min-h-[46px] items-center gap-2 rounded-xl border px-4 text-sm font-medium transition',
              needsQaOnly
                ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/22 dark:bg-fuchsia-500/10 dark:text-fuchsia-200'
                : 'border-border-default/80 bg-[rgba(252,251,255,0.82)] text-text-secondary hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-surface-1/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:hover:bg-surface-1/[0.045]',
            )}
          >
            Needs QA
          </button>
          <label className="relative block min-w-[300px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--dusk-text-soft)] dark:text-white/40">
              <SearchIcon />
            </span>
            <input
              value={tagSearch}
              onChange={(event) => setTagSearch(event.target.value)}
              className="min-h-[46px] w-full rounded-xl border border-border-default/80 bg-[rgba(252,251,255,0.82)] pl-10 pr-3 text-sm text-text-primary outline-none placeholder:text-[color:var(--dusk-text-soft)] transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/[0.06] dark:bg-surface-1/[0.025] dark:text-white dark:placeholder:text-white/30 dark:focus:border-fuchsia-500/30"
              placeholder="Search tag, advertiser, placement"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex min-h-[46px] items-center rounded-xl bg-brand-gradient px-5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(241,0,139,0.28)] transition hover:translate-y-[-1px] hover:shadow-[0_18px_42px_rgba(241,0,139,0.34)]"
        >
          Generate tag
        </button>
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
          <SectionKicker>Recommended focus</SectionKicker>
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
          <DuskMetricCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            trend={metric.direction}
            context={metric.helper}
            series={metric.series}
            tone={
              metric.tone === 'fuchsia'
                ? 'brand'
                : metric.tone === 'emerald'
                  ? 'success'
                  : metric.tone === 'amber'
                    ? 'warning'
                    : metric.tone === 'rose'
                      ? 'critical'
                      : metric.tone === 'sky'
                        ? 'info'
                        : 'neutral'
            }
            icon={
              metric.id === 'tag-health'
                ? <TagsIcon />
                : metric.id === 'ready-tags'
                  ? <ReportIcon />
                  : <AlertTriangleIcon />
            }
          />
        ))}
      </div>

      {selectedCount > 0 && (
        <Panel className="border-fuchsia-200 bg-fuchsia-50/80 px-4 py-3 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-fuchsia-900 dark:text-fuchsia-200">
              {selectedCount} tag{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => void handleBulkStatus('active')}
              disabled={bulkActionLoading}
              className="rounded-xl border border-emerald-200 bg-surface-1 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/20 dark:bg-surface-1/[0.04] dark:text-emerald-300 dark:hover:bg-surface-1/[0.07]"
            >
              Activate
            </button>
            <button
              onClick={() => void handleBulkStatus('paused')}
              disabled={bulkActionLoading}
              className="rounded-xl border border-amber-200 bg-surface-1 px-3 py-2 text-sm font-medium text-[color:var(--dusk-status-warning-fg)] hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-500/20 dark:bg-surface-1/[0.04] dark:text-amber-300 dark:hover:bg-surface-1/[0.07]"
            >
              Deactivate
            </button>
            <button
              onClick={() => void handleBulkDelete()}
              disabled={bulkActionLoading}
              className="rounded-xl border border-rose-200 bg-surface-1 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/20 dark:bg-surface-1/[0.04] dark:text-rose-300 dark:hover:bg-surface-1/[0.07]"
            >
              Delete
            </button>
            {bulkActionLoading && <span className="text-xs text-text-muted dark:text-white/52">Applying changes...</span>}
          </div>
        </Panel>
      )}

      {filteredTags.length === 0 ? (
        <Panel className="px-6 py-20 text-center">
          <SectionKicker>No matches</SectionKicker>
          <h3 className="mt-3 text-lg font-semibold text-text-primary dark:text-white">No tags yet</h3>
          <p className="mt-2 text-sm text-text-muted dark:text-white/56">No tags match the current advertiser or search filter.</p>
          <div className="mt-5 flex justify-center">
            <PrimaryButton onClick={() => setCreating(true)}>Generate tag</PrimaryButton>
          </div>
        </Panel>
      ) : (
        <Panel className="overflow-hidden p-6">
          <div className="flex flex-col gap-4 border-b border-border-default pb-5 dark:border-white/8 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <SectionKicker>Tag workspace</SectionKicker>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">Pixels, firing status & implementation QA</h2>
              <p className="mt-2 text-sm text-text-muted dark:text-white/56">
                Dense operational view for tag generation, validation, firing health and implementation risk.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-1 px-3 py-2 text-sm font-medium text-text-secondary transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/8 dark:bg-surface-1/[0.03] dark:text-white/72 dark:hover:border-fuchsia-500/28 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-200"
              >
                <FilterIcon className="h-4 w-4" />
                Filters
              </button>
              <Link
                to="/tags/health"
                className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-1 px-3 py-2 text-sm font-medium text-text-secondary transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/8 dark:bg-surface-1/[0.03] dark:text-white/72 dark:hover:border-fuchsia-500/28 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-200"
              >
                Health
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

          <div className="app-scrollbar mt-6 overflow-auto rounded-3xl border border-border-default dark:border-white/8">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/8">
              <thead className="bg-[color:var(--dusk-surface-muted)]/80 dark:bg-surface-1/[0.02]">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted dark:text-white/42">
                  <th className="px-4 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(element) => {
                        if (element) {
                          element.indeterminate = !allVisibleSelected && someVisibleSelected;
                        }
                      }}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4 rounded border-border-strong text-fuchsia-600 focus:ring-fuchsia-500"
                      aria-label="Select all visible tags"
                    />
                  </th>
                  <th className="px-5 py-4">Tag</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Firing</th>
                  <th className="px-5 py-4">Destination</th>
                  <th className="px-5 py-4">Last seen</th>
                  <th className="px-5 py-4">Risk</th>
                  <th className="px-5 py-4">Owner</th>
                  <th className="px-5 py-4" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/8">
                {filteredTags.map((tag) => {
                  const risk = getRisk(tag);
                  return (
                    <tr key={tag.id} className="bg-surface-1/42 transition hover:bg-fuchsia-50/45 dark:bg-transparent dark:hover:bg-surface-1/[0.04]">
                      <td className="px-4 py-5">
                        <input
                          type="checkbox"
                          checked={selectedTagIds.includes(tag.id)}
                          onChange={() => toggleTagSelection(tag.id)}
                          className="h-4 w-4 rounded border-border-strong text-fuchsia-600 focus:ring-fuchsia-500"
                          aria-label={`Select tag ${tag.name}`}
                        />
                      </td>
                      <td className="px-5 py-5">
                        <p className="font-semibold text-[color:var(--dusk-text-primary)]">{tag.name}</p>
                        <p className="mt-1 text-xs text-text-muted dark:text-white/48">
                          {tag.workspaceName ?? 'Workspace'} · {tag.campaign?.name ?? 'No campaign'}
                        </p>
                      </td>
                      <td className="px-5 py-5">
                        <span className={classNames('inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize', tagStatusBadge(tag.status))}>
                          {tag.status}
                        </span>
                      </td>
                      <td className="px-5 py-5 font-medium text-text-secondary dark:text-white/72">{getFiringLabel(tag)}</td>
                      <td className="px-5 py-5">
                        <div className="flex flex-col gap-2">
                          {formatBadge(tag.format)}
                          <span className="text-xs text-text-muted dark:text-white/48">{getDestinationLabel(tag)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-5 text-text-muted dark:text-white/62">{getLastSeenLabel(tag)}</td>
                      <td className="px-5 py-5">
                        <span className={classNames('inline-flex rounded-full border px-3 py-1 text-xs font-semibold', severityBadge(risk))}>{risk}</span>
                      </td>
                      <td className="px-5 py-5 text-text-muted dark:text-white/62">{getOwner(tag)}</td>
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleExportTagCsv(tag)}
                            className="rounded-xl border border-transparent p-2 text-[color:var(--dusk-text-soft)] transition hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-600 dark:text-white/36 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
                            aria-label={`Export ${tag.name}`}
                          >
                            <ReportIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/tags/${tag.id}`)}
                            className="rounded-xl border border-transparent p-2 text-[color:var(--dusk-text-soft)] transition hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-600 dark:text-white/36 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
                            aria-label={`Edit ${tag.name}`}
                          >
                            <TableIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(tag)}
                            disabled={deletingId === tag.id}
                            className="rounded-xl border border-transparent p-2 text-[color:var(--dusk-text-soft)] transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/36 dark:hover:border-rose-500/20 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                            aria-label={`Delete ${tag.name}`}
                          >
                            {deletingId === tag.id ? <span className="text-xs font-semibold">...</span> : <MoreIcon className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-surface-1 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-text-primary">Create Tag</h2>
            <p className="mt-1 text-sm text-text-muted">Create the tag first, then configure snippet variants and assignments from the tag workspace.</p>
            {createError && <div className="mt-4 rounded-lg border border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-3 py-2 text-sm text-[color:var(--dusk-status-critical-fg)]">{createError}</div>}
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Client</label>
                <select
                  value={createForm.workspaceId}
                  onChange={(event) => setCreateForm((current) => ({ ...current, workspaceId: event.target.value }))}
                  className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Tag Name</label>
                <input
                  value={createForm.name}
                  onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
                  placeholder="Homepage 300x250 display"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Format</label>
                <div className="flex gap-2">
                  {(['VAST', 'display', 'native', 'tracker'] as Tag['format'][]).map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() =>
                        setCreateForm((current) => ({
                          ...current,
                          format,
                          servingWidth: format === 'display' ? current.servingWidth : '',
                          servingHeight: format === 'display' ? current.servingHeight : '',
                          trackerType: format === 'tracker' ? current.trackerType : 'click',
                        }))
                      }
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                        createForm.format === format
                          ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700'
                          : 'border-border-strong text-text-muted hover:bg-[color:var(--dusk-surface-muted)]'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
              {createForm.format === 'display' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-secondary">Display Size</label>
                  <select
                    value={createForm.servingWidth && createForm.servingHeight ? `${createForm.servingWidth}x${createForm.servingHeight}` : ''}
                    onChange={(event) => {
                      const preset = DISPLAY_SIZE_PRESETS.find((entry) => entry.label === event.target.value);
                      setCreateForm((current) => ({
                        ...current,
                        servingWidth: preset ? String(preset.width) : '',
                        servingHeight: preset ? String(preset.height) : '',
                      }));
                    }}
                    className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
                  >
                    <option value="">Select a size</option>
                    {DISPLAY_SIZE_PRESETS.map((preset) => (
                      <option key={preset.label} value={preset.label}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {createForm.format === 'tracker' && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-text-secondary">Tracker Type</label>
                    <select
                      value={createForm.trackerType}
                      onChange={(event) => setCreateForm((current) => ({ ...current, trackerType: event.target.value as 'click' | 'impression' }))}
                      className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
                    >
                      <option value="click">Click tracker</option>
                      <option value="impression">Impression tracker</option>
                    </select>
                  </div>
                  {createForm.trackerType === 'click' && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-secondary">Destination URL</label>
                      <input
                        value={createForm.clickUrl}
                        onChange={(event) => setCreateForm((current) => ({ ...current, clickUrl: event.target.value }))}
                        className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
                        placeholder="https://example.com/landing"
                      />
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">Status</label>
                <select
                  value={createForm.status}
                  onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as Tag['status'] }))}
                  className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeCreate} className="rounded-lg border border-border-strong px-4 py-2 text-sm text-text-secondary hover:bg-[color:var(--dusk-surface-muted)]">
                Cancel
              </button>
              <button onClick={() => void handleCreate()} className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-700">
                Create Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
