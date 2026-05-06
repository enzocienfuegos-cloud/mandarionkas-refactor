import React from 'react';
import type { Creative, CreativeVersion } from '../catalog';
import { MoreIcon } from './ui';

type Props = {
  creative: Creative;
  version: CreativeVersion;
  statusUpdateCreativeId: string;
  workspaceBusy: boolean;
  getCreativeOperationalState: (creative: Creative) => 'active' | 'inactive' | 'pending_review' | 'rejected' | 'draft';
  onToggleOperationalStatus: (creative: Creative) => void | Promise<void>;
  onEditClickUrl: (creative: Creative) => void | Promise<void>;
  onOpenDeliveryManager: (creative: Creative, version: CreativeVersion) => void | Promise<void>;
  onAssignTag: (creative: Creative, version: CreativeVersion) => void | Promise<void>;
  onDeleteCreative: (creative: Creative) => void | Promise<void>;
};

export function CreativeRowActions({
  creative,
  version,
  statusUpdateCreativeId,
  workspaceBusy,
  getCreativeOperationalState,
  onToggleOperationalStatus,
  onEditClickUrl,
  onOpenDeliveryManager,
  onAssignTag,
  onDeleteCreative,
}: Props) {
  const operationalState = getCreativeOperationalState(creative);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {version.status !== 'rejected' && (
        <>
          <button
            type="button"
            onClick={() => void onToggleOperationalStatus(creative)}
            disabled={statusUpdateCreativeId === creative.id}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
              operationalState === 'inactive'
                ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/18 dark:text-emerald-300 dark:hover:bg-emerald-500/10'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/[0.05]'
            }`}
          >
            {statusUpdateCreativeId === creative.id ? 'Saving…' : operationalState === 'inactive' ? 'Set active' : 'Set inactive'}
          </button>
          <button
            type="button"
            onClick={() => void onEditClickUrl(creative)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/10 dark:text-white/72 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
          >
            {creative.clickUrl ? 'Edit URL' : 'Set URL'}
          </button>
          <button
            type="button"
            onClick={() => void onOpenDeliveryManager(creative, version)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/10 dark:text-white/72 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
          >
            {version.servingFormat === 'vast_video' ? 'Renditions' : 'Sizes'}
          </button>
          <button
            type="button"
            onClick={() => void onAssignTag(creative, version)}
            disabled={workspaceBusy}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 disabled:opacity-50 dark:border-white/10 dark:text-white/72 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
          >
            Assign tag
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => void onDeleteCreative(creative)}
        className="rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-600 dark:text-white/36 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
        aria-label={`More actions for ${creative.name}`}
      >
        <MoreIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
