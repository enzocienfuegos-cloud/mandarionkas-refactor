import React from 'react';
import { Button, Kicker } from '../../system';
import { FilterIcon } from './ui';

type Props = {
  totalCreatives: number;
  approvedCreatives: number;
  pendingQaCreatives: number;
  blockedCreatives: number;
  onRefresh: () => void;
};

export function CreativeQueuePanel({
  totalCreatives,
  approvedCreatives,
  pendingQaCreatives,
  blockedCreatives,
  onRefresh,
}: Props) {
  return (
    <>
      <div className="flex flex-col gap-4 border-b border-border-default pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <Kicker>Creative workspace</Kicker>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">Creative QA queue</h2>
          <p className="mt-2 text-sm text-text-muted">Review approval status, preview availability, delivery setup, and launch blockers from one dense queue.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="sm" leadingIcon={<FilterIcon className="h-4 w-4" />}>
            Filters
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Total</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{totalCreatives}</p>
          <p className="mt-1 text-sm text-text-muted">creatives in workspace</p>
        </div>
        <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Approved</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{approvedCreatives}</p>
          <p className="mt-1 text-sm text-text-muted">ready to serve</p>
        </div>
        <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Pending QA</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{pendingQaCreatives}</p>
          <p className="mt-1 text-sm text-text-muted">awaiting approval</p>
        </div>
        <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Blocked</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{blockedCreatives}</p>
          <p className="mt-1 text-sm text-text-muted">rejected or missing assets</p>
        </div>
      </div>
    </>
  );
}
