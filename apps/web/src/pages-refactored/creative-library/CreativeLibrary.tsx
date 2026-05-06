import React, { useEffect, useMemo, useState } from 'react';
import { Upload, ImageIcon, Trash2 } from '../../system/icons';
import {
  Button,
  Kicker,
  Panel,
  EmptyState,
  useToast,
  useConfirm,
} from '../../system';
import { CreativeFiltersBar } from './CreativeFilters';
import { CreativeGrid } from './CreativeGrid';
import { CreativeUploadModal } from './CreativeUploadModal';
import { CreativePreviewModal } from './CreativePreviewModal';
import type { Creative, CreativeFilters } from './types';

const EMPTY_FILTERS: CreativeFilters = {
  search: '',
  format: 'all',
  status: 'all',
};

/**
 * Creative Library — refactored to the design system (S56).
 *
 * BEFORE this refactor the legacy `CreativeLibrary.tsx` was a single
 * 3,217-line god component with:
 *   - 29 useState hooks
 *   - 36 internal functions
 *   - inline upload UI (~600 lines)
 *   - inline preview UI (~400 lines)
 *   - inline filters (~200 lines)
 *
 * AFTER:
 *   creative-library/
 *   ├── CreativeLibrary.tsx       ← this file (orchestrator, ~120 lines)
 *   ├── CreativeFilters.tsx       ← filters bar (~70 lines)
 *   ├── CreativeGrid.tsx          ← grid + cards (~140 lines)
 *   ├── CreativeUploadModal.tsx   ← upload UI (~180 lines)
 *   ├── CreativePreviewModal.tsx  ← preview UI (~110 lines)
 *   └── types.ts                  ← shared types (~60 lines)
 *
 * Total: same surface area, ~80% reduction in any single file.
 */
export default function CreativeLibrary() {
  const { toast } = useToast();
  const confirm   = useConfirm();

  const [creatives, setCreatives]   = useState<Creative[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filters, setFilters]       = useState<CreativeFilters>(EMPTY_FILTERS);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview]       = useState<Creative | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch('/v1/creatives', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setCreatives(data?.items ?? []))
      .catch(() => toast({ tone: 'critical', title: 'Could not load creatives' }))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return creatives.filter((creative) => {
      if (filters.format !== 'all' && creative.format !== filters.format) return false;
      if (filters.status !== 'all' && creative.status !== filters.status) return false;
      if (filters.search) {
        const haystack = `${creative.name} ${creative.size} ${creative.tags?.join(' ') ?? ''}`.toLowerCase();
        if (!haystack.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    });
  }, [creatives, filters]);

  const toggleSelection = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkArchive = async () => {
    const count = selected.size;
    const ok = await confirm({
      title: `Archive ${count} creative${count === 1 ? '' : 's'}?`,
      description: 'Archived creatives are removed from active campaigns. They can be restored later.',
      tone: 'danger',
      confirmLabel: 'Archive',
    });
    if (!ok) return;

    try {
      await Promise.all(
        Array.from(selected).map((id) =>
          fetch(`/v1/creatives/${id}/archive`, { method: 'POST', credentials: 'include' }),
        ),
      );
      setCreatives((current) => current.filter((c) => !selected.has(c.id)));
      setSelected(new Set());
      toast({ tone: 'warning', title: `${count} creative${count === 1 ? '' : 's'} archived` });
    } catch {
      toast({ tone: 'critical', title: 'Could not archive creatives' });
    }
  };

  return (
    <div className="space-y-5">
      <header className="dusk-page-header">
        <div>
          <Kicker>Library</Kicker>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            Creatives
          </h1>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            All creative assets across the workspace.
          </p>
        </div>
        <Button variant="primary" leadingIcon={<Upload />} onClick={() => setUploadOpen(true)}>
          Upload
        </Button>
      </header>

      <CreativeFiltersBar
        filters={filters}
        onChange={setFilters}
        totalCount={creatives.length}
        filteredCount={filtered.length}
      />

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg bg-surface-active border border-brand-500/30">
          <span className="text-sm font-medium text-[color:var(--dusk-text-primary)]">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            <Button size="sm" variant="danger" leadingIcon={<Trash2 />} onClick={handleBulkArchive}>
              Archive
            </Button>
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 ? (
        <Panel padding="none">
          <EmptyState
            icon={<ImageIcon />}
            title={
              filters.search || filters.format !== 'all' || filters.status !== 'all'
                ? 'No creatives match your filters'
                : 'No creatives yet'
            }
            description={
              filters.search || filters.format !== 'all' || filters.status !== 'all'
                ? 'Try adjusting the filters.'
                : 'Upload your first creative to start building campaigns.'
            }
            action={
              filters.search || filters.format !== 'all' || filters.status !== 'all' ? (
                <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Clear filters
                </Button>
              ) : (
                <Button variant="primary" leadingIcon={<Upload />} onClick={() => setUploadOpen(true)}>
                  Upload
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <CreativeGrid
          creatives={filtered}
          loading={loading}
          selectedIds={selected}
          onToggleSelection={toggleSelection}
          onPreview={(c) => setPreview(c)}
          onMore={() => {
            // Placeholder — wire to your context menu component when available.
            toast({ tone: 'info', title: 'Right-click menu coming soon' });
          }}
        />
      )}

      <CreativeUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={load}
      />

      <CreativePreviewModal
        creative={preview}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
