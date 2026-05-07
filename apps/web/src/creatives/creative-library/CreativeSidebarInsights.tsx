import React from 'react';
import { Badge, Kicker, Panel } from '../../system';
import type { Creative } from '../catalog';
import type { PrototypeCheck } from './types';

type Props = {
  pendingQaCreatives: number;
  rejectedCreatives: number;
  pendingPreviewCreatives: Creative[];
  prototypeChecks: PrototypeCheck[];
};

export function CreativeSidebarInsights({
  pendingQaCreatives,
  rejectedCreatives,
  pendingPreviewCreatives,
  prototypeChecks,
}: Props) {
  return (
    <div className="space-y-8">
      <section>
        <Kicker>Module health</Kicker>
        <div className="mt-4 grid gap-3">
          <Panel className="px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Pending QA</p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{pendingQaCreatives}</p>
            <p className="mt-1 text-sm text-text-muted">creatives need spec or approval review</p>
          </Panel>
          <Panel className="px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Rejected</p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{rejectedCreatives}</p>
            <p className="mt-1 text-sm text-text-muted">require fixes before serving</p>
          </Panel>
          <Panel className="px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Missing preview</p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{pendingPreviewCreatives.length}</p>
            <p className="mt-1 text-sm text-text-muted">assets still unavailable for review</p>
          </Panel>
        </div>
      </section>

      <section>
        <Kicker>Missing preview assets</Kicker>
        <div className="mt-4 space-y-3">
          {pendingPreviewCreatives.length > 0 ? pendingPreviewCreatives.map((creative) => (
            <Panel key={creative.id} className="px-4 py-3">
              <p className="font-semibold text-text-primary">{creative.name}</p>
              <p className="mt-1 text-sm text-text-muted">{creative.workspaceName ?? 'Workspace'} · preview artifact unavailable</p>
            </Panel>
          )) : (
            <Panel className="px-4 py-4 text-sm text-text-muted">
              All visible creatives have preview-ready assets.
            </Panel>
          )}
        </div>
      </section>

      <section>
        <Kicker>Prototype checks</Kicker>
        <div className="mt-4 grid gap-3">
          {prototypeChecks.map((test) => (
            <Panel key={test.name} className="px-4 py-3">
              <p className="text-xs font-medium text-text-soft">{test.name}</p>
              <div className="mt-2">
                <Badge tone={test.passed ? 'success' : 'critical'} size="sm">
                  {test.passed ? 'Passed' : 'Failed'}
                </Badge>
              </div>
            </Panel>
          ))}
        </div>
      </section>
    </div>
  );
}
