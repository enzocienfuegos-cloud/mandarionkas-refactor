import React from 'react';
import { Badge, Kicker, Panel } from '../../system';
import type { Creative } from '../catalog';
import type { PrototypeCheck } from './types';

type Props = {
  publishingCreatives: number;
  attentionCreatives: number;
  previewMissingCreatives: Creative[];
  prototypeChecks: PrototypeCheck[];
};

export function CreativeSidebarInsights({
  publishingCreatives,
  attentionCreatives,
  previewMissingCreatives,
  prototypeChecks,
}: Props) {
  return (
    <div className="space-y-8">
      <section>
        <Kicker>Delivery health</Kicker>
        <div className="mt-4 grid gap-3">
          <Panel className="px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Publishing</p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{publishingCreatives}</p>
            <p className="mt-1 text-sm text-text-muted">creatives still preparing delivery assets</p>
          </Panel>
          <Panel className="px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Needs attention</p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{attentionCreatives}</p>
            <p className="mt-1 text-sm text-text-muted">upload, publish, or URL issues</p>
          </Panel>
          <Panel className="px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Missing preview</p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{previewMissingCreatives.length}</p>
            <p className="mt-1 text-sm text-text-muted">assets still unavailable for inline preview</p>
          </Panel>
        </div>
      </section>

      <section>
        <Kicker>Missing preview assets</Kicker>
        <div className="mt-4 space-y-3">
          {previewMissingCreatives.length > 0 ? previewMissingCreatives.map((creative) => (
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
