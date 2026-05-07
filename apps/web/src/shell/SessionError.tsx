import React from 'react';
import { Button, Panel } from '../system';

export function SessionError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex h-screen items-center justify-center bg-bg p-4">
      <Panel padding="lg" className="max-w-md">
        <h2 className="text-base font-semibold text-[color:var(--dusk-status-critical-fg)]">
          Connection error
        </h2>
        <p className="mt-2 text-sm text-[color:var(--dusk-text-muted)]">{error}</p>
        <Button variant="primary" onClick={onRetry} className="mt-5">
          Retry
        </Button>
      </Panel>
    </div>
  );
}
