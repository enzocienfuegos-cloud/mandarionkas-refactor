import React from 'react';
import { Button, Kicker } from '../../system';

type Props = {
  onRefresh: () => void;
};

export function CreativeQueuePanel({
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
    </>
  );
}
