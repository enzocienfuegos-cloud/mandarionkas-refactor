import React from 'react';
import { Button, IconButton } from '../../system';
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
          <Button
            onClick={() => void onToggleOperationalStatus(creative)}
            disabled={statusUpdateCreativeId === creative.id}
            variant={operationalState === 'inactive' ? 'secondary' : 'ghost'}
            size="sm"
            aria-label={`${operationalState === 'inactive' ? 'Set active' : 'Set inactive'} for ${creative.name}`}
            className={`${
              operationalState === 'inactive'
                ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/18 dark:text-emerald-300 dark:hover:bg-emerald-500/10'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/[0.05]'
            }`}
          >
            {statusUpdateCreativeId === creative.id ? 'Saving…' : operationalState === 'inactive' ? 'Set active' : 'Set inactive'}
          </Button>
          <Button
            onClick={() => void onEditClickUrl(creative)}
            variant="secondary"
            size="sm"
            aria-label={`${creative.clickUrl ? 'Edit' : 'Set'} destination URL for ${creative.name}`}
            className="border-slate-200 text-slate-700 hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/10 dark:text-white/72 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
          >
            {creative.clickUrl ? 'Edit URL' : 'Set URL'}
          </Button>
          <Button
            onClick={() => void onOpenDeliveryManager(creative, version)}
            variant="secondary"
            size="sm"
            aria-label={`Open ${version.servingFormat === 'vast_video' ? 'renditions' : 'sizes'} manager for ${creative.name}`}
            className="border-slate-200 text-slate-700 hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/10 dark:text-white/72 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
          >
            {version.servingFormat === 'vast_video' ? 'Renditions' : 'Sizes'}
          </Button>
          <Button
            onClick={() => void onAssignTag(creative, version)}
            disabled={workspaceBusy}
            variant="secondary"
            size="sm"
            aria-label={`Assign ${creative.name} to a tag`}
            className="border-slate-200 text-slate-700 hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/10 dark:text-white/72 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
          >
            Assign tag
          </Button>
        </>
      )}
      <IconButton
        onClick={() => void onDeleteCreative(creative)}
        className="border border-transparent text-slate-400 transition hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-600 dark:text-white/36 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
        aria-label={`Delete ${creative.name}`}
        icon={<MoreIcon className="h-4 w-4" />}
      />
    </div>
  );
}
