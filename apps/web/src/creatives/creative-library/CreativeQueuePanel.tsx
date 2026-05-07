import React from 'react';
import { Button, Kicker } from '../../system';

type Props = {
  totalCreatives: number;
  liveCreatives: number;
  publishingCreatives: number;
  attentionCreatives: number;
  onRefresh: () => void;
};

export function CreativeQueuePanel({
  totalCreatives,
  liveCreatives,
  publishingCreatives,
  attentionCreatives,
  onRefresh,
}: Props) {
  return (
    <>
      <div className="flex flex-col gap-4 border-b border-border-default pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <Kicker>Creative workspace</Kicker>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">Creative delivery workspace</h2>
          <p className="mt-2 text-sm text-text-muted">Track publication state, preview availability, delivery setup and launch blockers from one operational queue.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Live</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{liveCreatives}</p>
          <p className="mt-1 text-sm text-text-muted">ready to serve</p>
        </div>
        <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Publishing</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{publishingCreatives}</p>
          <p className="mt-1 text-sm text-text-muted">processing before going live</p>
        </div>
        <div className="rounded-2xl border border-border-default bg-surface-1/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Needs attention</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{attentionCreatives}</p>
          <p className="mt-1 text-sm text-text-muted">preview, transcode or asset issues</p>
        </div>
      </div>
    </>
  );
}
