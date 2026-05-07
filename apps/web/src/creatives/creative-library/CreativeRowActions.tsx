import React from 'react';
import { Button, IconButton } from '../../system';
import type { Creative, CreativeVersion } from '../catalog';
import { MoreIcon } from './ui';

type Props = {
  creative: Creative;
  version: CreativeVersion;
  statusUpdateCreativeId: string;
  workspaceBusy: boolean;
  getCreativeOperationalState: (creative: Creative) => 'live' | 'publishing' | 'inactive' | 'attention';
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
      <Button
        onClick={() => void onToggleOperationalStatus(creative)}
        disabled={statusUpdateCreativeId === creative.id || operationalState === 'publishing'}
        variant={operationalState === 'inactive' ? 'secondary' : 'ghost'}
        size="sm"
        aria-label={`${operationalState === 'inactive' ? 'Set live' : 'Set inactive'} for ${creative.name}`}
      >
        {statusUpdateCreativeId === creative.id ? 'Saving…' : operationalState === 'inactive' ? 'Set live' : 'Set inactive'}
      </Button>
      <Button
        onClick={() => void onEditClickUrl(creative)}
        variant="secondary"
        size="sm"
        aria-label={`${creative.clickUrl ? 'Edit' : 'Set'} destination URL for ${creative.name}`}
      >
        {creative.clickUrl ? 'Edit URL' : 'Set URL'}
      </Button>
      <Button
        onClick={() => void onOpenDeliveryManager(creative, version)}
        variant="secondary"
        size="sm"
        aria-label={`Open ${version.servingFormat === 'vast_video' ? 'renditions' : 'sizes'} manager for ${creative.name}`}
      >
        {version.servingFormat === 'vast_video' ? 'Renditions' : 'Sizes'}
      </Button>
      <Button
        onClick={() => void onAssignTag(creative, version)}
        disabled={workspaceBusy}
        variant="secondary"
        size="sm"
        aria-label={`Assign ${creative.name} to a tag`}
      >
        Assign tag
      </Button>
      <IconButton
        onClick={() => void onDeleteCreative(creative)}
        className="border border-transparent text-text-soft transition hover:border-brand-500/20 hover:bg-brand-500/10 hover:text-text-brand"
        aria-label={`Delete ${creative.name}`}
        icon={<MoreIcon className="h-4 w-4" />}
      />
    </div>
  );
}
