import React from 'react';
import { Kicker } from '../../system';
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
          <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.025]">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Pending QA</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{pendingQaCreatives}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-white/56">creatives need spec or approval review</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.025]">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Rejected</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{rejectedCreatives}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-white/56">require fixes before serving</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.025]">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Missing preview</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{pendingPreviewCreatives.length}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-white/56">assets still unavailable for review</p>
          </div>
        </div>
      </section>

      <section>
        <Kicker>Missing preview assets</Kicker>
        <div className="mt-4 space-y-3">
          {pendingPreviewCreatives.length > 0 ? pendingPreviewCreatives.map((creative) => (
            <div key={creative.id} className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.025]">
              <p className="font-semibold text-slate-950 dark:text-white">{creative.name}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-white/56">{creative.workspaceName ?? 'Workspace'} · preview artifact unavailable</p>
            </div>
          )) : (
            <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-4 text-sm text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.025] dark:text-white/56">
              All visible creatives have preview-ready assets.
            </div>
          )}
        </div>
      </section>

      <section>
        <Kicker>Prototype checks</Kicker>
        <div className="mt-4 grid gap-3">
          {prototypeChecks.map((test) => (
            <div key={test.name} className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.025]">
              <p className="text-xs font-medium text-slate-500 dark:text-white/42">{test.name}</p>
              <p className={test.passed ? 'mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-300' : 'mt-1 text-sm font-semibold text-rose-600 dark:text-rose-300'}>
                {test.passed ? 'Passed' : 'Failed'}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
